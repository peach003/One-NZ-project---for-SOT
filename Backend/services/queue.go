package services

import (
	"errors"
	"fmt"
	"interview-system/models"
	"sort"
	"time"

	"gorm.io/gorm"
)

type QueueService struct {
	db    *gorm.DB
	wsHub *WebSocketHub
}

type QueueInfo struct {
	Position          models.Position   `json:"position"`
	QueuePosition     int               `json:"queue_position"`
	TotalInQueue      int               `json:"total_in_queue"`
	IsHighPriority    bool              `json:"is_high_priority"`
	EstimatedWaitTime int               `json:"estimated_wait_time"`
	Status            string            `json:"status"`
	CanSetPriority    bool              `json:"can_set_priority"`
	JoinedAt          time.Time         `json:"joined_at"`
}

func NewQueueService(db *gorm.DB, wsHub *WebSocketHub) *QueueService {
	return &QueueService{
		db:    db,
		wsHub: wsHub,
	}
}

func (s *QueueService) JoinQueue(candidateID uint, positionID uint) error {
	var existing models.QueueEntry
	if err := s.db.Where("candidate_id = ? AND position_id = ? AND status NOT IN (?)",
		candidateID, positionID, []string{"completed", "left"}).First(&existing).Error; err == nil {
		return errors.New("already in queue for this position")
	}

	var activeCount int64
	s.db.Model(&models.QueueEntry{}).Where("candidate_id = ? AND is_active = ? AND status NOT IN (?)",
		candidateID, true, []string{"completed", "left"}).Count(&activeCount)

	var activity models.ActivityControl
	s.db.First(&activity)

	isActive := activeCount < int64(activity.ActiveQueueLimit)

	entry := models.QueueEntry{
		CandidateID:    candidateID,
		PositionID:     positionID,
		JoinTime:       time.Now(),
		IsHighPriority: false,
		IsActive:       isActive,
		Status:         "waiting",
		DelayUsed:      0,
	}

	if err := s.db.Create(&entry).Error; err != nil {
		return err
	}

	s.updateQueuePositions(positionID)

	// Check and resolve conflicts after joining new queue
	hasConflicts, _ := s.ResolveConflicts(candidateID)
	if hasConflicts {
		// Conflicts were detected and resolved
		s.broadcastQueueUpdate(positionID)
	} else {
		s.broadcastQueueUpdate(positionID)
	}

	return nil
}

func (s *QueueService) SetHighPriority(candidateID uint, positionID uint) error {
	var activity models.ActivityControl
	s.db.First(&activity)

	if time.Until(activity.EndTime) < 30*time.Minute {
		return errors.New("cannot set high priority within 30 minutes of activity end")
	}

	var usedCount int64
	s.db.Model(&models.QueueEntry{}).Where("candidate_id = ? AND is_high_priority = ? AND status NOT IN (?)",
		candidateID, true, []string{"completed", "left"}).Count(&usedCount)

	if usedCount >= int64(activity.HighPriorityQuota) {
		return errors.New("high priority quota exceeded")
	}

	var entry models.QueueEntry
	if err := s.db.Where("candidate_id = ? AND position_id = ? AND status = ?",
		candidateID, positionID, "waiting").First(&entry).Error; err != nil {
		return errors.New("not in queue for this position")
	}

	if entry.IsHighPriority {
		return errors.New("already set as high priority")
	}

	now := time.Now()
	entry.IsHighPriority = true
	entry.PrioritySetTime = &now
	entry.IsActive = true

	if err := s.db.Save(&entry).Error; err != nil {
		return err
	}

	s.updateQueuePositions(positionID)

	// Only resolve conflicts if no optimization is available
	canOptimize, _ := s.CheckQueueOptimization(candidateID)
	if !canOptimize {
		// Check and resolve conflicts after priority change
		s.ResolveConflicts(candidateID)
	}

	s.broadcastQueueUpdate(positionID)

	return nil
}

func (s *QueueService) GetCandidateQueues(candidateID uint) ([]QueueInfo, error) {
	var entries []models.QueueEntry
	if err := s.db.Preload("Position").Preload("Position.Company").
		Where("candidate_id = ? AND status NOT IN (?)", candidateID, []string{"completed", "left"}).
		Find(&entries).Error; err != nil {
		return nil, err
	}

	var activity models.ActivityControl
	s.db.First(&activity)

	canSetPriority := time.Until(activity.EndTime) >= 30*time.Minute

	queues := make([]QueueInfo, len(entries))
	for i, entry := range entries {
		totalInQueue := s.getQueueLength(entry.PositionID)
		queuePos := s.getQueuePosition(entry.PositionID, candidateID)

		// Calculate actual wait time - use smart optimization if available
		actualWaitTime := s.calculateSmartWaitTime(entry.PositionID, candidateID, activity.AverageInterviewTime)

		queues[i] = QueueInfo{
			Position:          entry.Position,
			QueuePosition:     queuePos,
			TotalInQueue:      totalInQueue,
			IsHighPriority:    entry.IsHighPriority,
			EstimatedWaitTime: actualWaitTime,
			Status:            entry.Status,
			CanSetPriority:    canSetPriority && !entry.IsHighPriority,
			JoinedAt:          entry.JoinTime,
		}
	}

	return queues, nil
}

func (s *QueueService) updateQueuePositions(positionID uint) {
	var entries []models.QueueEntry
	s.db.Where("position_id = ? AND status = ?", positionID, "waiting").
		Order("is_high_priority DESC, priority_set_time ASC, join_time ASC").
		Find(&entries)

	for i, entry := range entries {
		entry.QueuePosition = i + 1
		s.db.Save(&entry)
	}
}

func (s *QueueService) getQueueLength(positionID uint) int {
	var count int64
	s.db.Model(&models.QueueEntry{}).Where("position_id = ? AND status = ?",
		positionID, "waiting").Count(&count)
	return int(count)
}

func (s *QueueService) getQueuePosition(positionID uint, candidateID uint) int {
	var entries []models.QueueEntry
	s.db.Where("position_id = ? AND status = ?", positionID, "waiting").
		Order("is_high_priority DESC, priority_set_time ASC, join_time ASC").
		Find(&entries)

	for i, entry := range entries {
		if entry.CandidateID == candidateID {
			return i + 1
		}
	}
	return 0
}

func (s *QueueService) estimateWaitTime(position int, avgInterviewTime int) int {
	// Position 1 is next (0 wait), position 2 waits for 1 interview, etc.
	if position <= 0 {
		return 0
	}
	return (position - 1) * avgInterviewTime
}

func (s *QueueService) estimateWaitTimeWithDelay(position int, avgInterviewTime int, entry models.QueueEntry) int {
	// Position 1 is next (0 wait), position 2 waits for 1 interview, etc.
	baseWaitTime := 0
	if position > 1 {
		baseWaitTime = (position - 1) * avgInterviewTime
	}

	// Add delay minutes directly based on delay usage (each delay adds 10 minutes)
	delayMinutes := entry.DelayUsed * 10

	return baseWaitTime + delayMinutes
}

// calculateSmartWaitTime calculates wait time with queue optimization prioritized over conflict resolution
func (s *QueueService) calculateSmartWaitTime(positionID uint, candidateID uint, avgInterviewTime int) int {
	// Get all queues for this candidate
	var candidateQueues []models.QueueEntry
	s.db.Where("candidate_id = ? AND status = ?", candidateID, "waiting").
		Preload("Position").Find(&candidateQueues)

	// If candidate has only one queue, use simple calculation
	if len(candidateQueues) <= 1 {
		queuePos := s.getQueuePosition(positionID, candidateID)
		if queuePos <= 0 {
			return 0
		}
		return (queuePos - 1) * avgInterviewTime
	}

	// Multiple queues - first check for optimization opportunity
	var activity models.ActivityControl
	s.db.First(&activity)

	// Get current position's details
	var currentEntry models.QueueEntry
	for _, entry := range candidateQueues {
		if entry.PositionID == positionID {
			currentEntry = entry
			break
		}
	}

	// Calculate base wait times for all positions
	baseWaitTimes := make(map[uint]int)
	for _, entry := range candidateQueues {
		queuePos := s.getQueuePosition(entry.PositionID, candidateID)
		baseWaitTimes[entry.PositionID] = (queuePos - 1) * avgInterviewTime
	}

	// Check if this position is eligible for optimization
	// Case 1: This is a regular position that's faster than priority positions
	if !currentEntry.IsHighPriority {
		// Check if any priority position has longer wait
		for _, entry := range candidateQueues {
			if entry.IsHighPriority {
				priorityWait := baseWaitTimes[entry.PositionID]
				currentWait := baseWaitTimes[positionID]

				// If this regular position is significantly faster (can complete before priority starts)
				if currentWait + avgInterviewTime + activity.BufferTime <= priorityWait {
					// Check if this optimized position conflicts with other simultaneous interviews
					// Count how many other positions also have 0 wait time
					simultaneousCount := 0
					for _, otherEntry := range candidateQueues {
						if otherEntry.PositionID != positionID {
							otherWait := baseWaitTimes[otherEntry.PositionID]
							if otherWait == currentWait { // Same wait time = potential conflict
								simultaneousCount++
							}
						}
					}

					// If there are simultaneous interviews, apply conflict resolution
					if simultaneousCount > 0 {
						return s.calculateActualWaitTime(positionID, candidateID, avgInterviewTime)
					}

					// Return the actual base wait time for this position
					return currentWait
				}
			}
		}
	}

	// Case 2: This is a priority position - check for conflicts first
	if currentEntry.IsHighPriority {
		currentWait := baseWaitTimes[positionID]

		// Check if this priority position conflicts with other simultaneous interviews
		simultaneousCount := 0
		for _, otherEntry := range candidateQueues {
			if otherEntry.PositionID != positionID {
				otherWait := baseWaitTimes[otherEntry.PositionID]
				if otherWait == currentWait { // Same wait time = potential conflict
					simultaneousCount++
				}
			}
		}

		// If there are simultaneous interviews, apply conflict resolution
		if simultaneousCount > 0 {
			return s.calculateActualWaitTime(positionID, candidateID, avgInterviewTime)
		}

		return baseWaitTimes[positionID]
	}

	// No optimization available, fall back to conflict resolution
	return s.calculateActualWaitTime(positionID, candidateID, avgInterviewTime)
}

func (s *QueueService) calculateActualWaitTime(positionID uint, candidateID uint, avgInterviewTime int) int {
	fmt.Printf("DEBUG calculateActualWaitTime: positionID=%d, candidateID=%d\n", positionID, candidateID)

	// First, run conflict resolution to ensure queue positions are up to date
	hasConflicts, messages := s.ResolveConflicts(candidateID)
	fmt.Printf("DEBUG ResolveConflicts result: hasConflicts=%t, messages=%v\n", hasConflicts, messages)

	// Get all queues for this candidate after conflict resolution
	var candidateQueues []models.QueueEntry
	s.db.Where("candidate_id = ? AND status = ?", candidateID, "waiting").
		Preload("Position").Find(&candidateQueues)

	// If candidate has only one queue, use simple calculation
	if len(candidateQueues) <= 1 {
		// Check if there's a resolved EstimatedTime for single queue
		if len(candidateQueues) == 1 && candidateQueues[0].EstimatedTime != nil {
			waitDuration := candidateQueues[0].EstimatedTime.Sub(time.Now())
			if waitDuration > 0 {
				return int(waitDuration.Minutes())
			}
			return 0
		}

		queuePos := s.getQueuePosition(positionID, candidateID)
		if queuePos <= 1 {
			return 0
		}
		return (queuePos - 1) * avgInterviewTime
	}

	// Multiple queues - use the ACTUAL queue positions from database
	// after conflict resolution has run and updated join times
	var activity models.ActivityControl
	s.db.First(&activity)

	// Build a list of all queue positions with their actual wait times
	type queueInfo struct {
		PositionID     uint
		QueuePosition  int
		ActualWaitTime int
		JoinTime       time.Time
	}

	queues := make([]queueInfo, len(candidateQueues))

	// Get the actual queue position for each (after conflict resolution)
	for i, cq := range candidateQueues {
		queuePos := s.getQueuePosition(cq.PositionID, candidateID)
		actualWait := 0

		// Check if this queue entry has a resolved EstimatedTime from conflict resolution
		if cq.EstimatedTime != nil {
			// Use the resolved time to calculate wait time
			waitDuration := cq.EstimatedTime.Sub(time.Now())
			if waitDuration > 0 {
				actualWait = int(waitDuration.Minutes())
			} else {
				actualWait = 0
			}
			fmt.Printf("  Using resolved EstimatedTime for position %d: wait=%d minutes\n", cq.PositionID, actualWait)
		} else {
			// Use normal queue position calculation
			if queuePos > 1 {
				actualWait = (queuePos - 1) * avgInterviewTime
			}
			fmt.Printf("  Using normal calculation for position %d: queuePos=%d, wait=%d minutes\n", cq.PositionID, queuePos, actualWait)
		}

		queues[i] = queueInfo{
			PositionID:     cq.PositionID,
			QueuePosition:  queuePos,
			ActualWaitTime: actualWait,
			JoinTime:       cq.JoinTime,
		}
	}

	// Find and return the actual wait time for the requested position
	for _, q := range queues {
		if q.PositionID == positionID {
			return q.ActualWaitTime
		}
	}

	return 0
}

func (s *QueueService) broadcastQueueUpdate(positionID uint) {
	message := Message{
		Type:      QueueUpdate,
		Data:      map[string]interface{}{"position_id": positionID},
		Timestamp: time.Now(),
	}
	s.wsHub.BroadcastToAll(message)
}

func (s *QueueService) ProcessJumpAhead(candidateID uint, positionID uint) (bool, string) {
	var entry models.QueueEntry
	if err := s.db.Where("candidate_id = ? AND position_id = ? AND status = ?",
		candidateID, positionID, "waiting").First(&entry).Error; err != nil {
		return false, "Not in queue"
	}

	if entry.JumpAheadUsed {
		return false, "Jump ahead already used"
	}

	var activity models.ActivityControl
	s.db.First(&activity)

	threshold := activity.AverageInterviewTime + activity.BufferTime

	currentPos := s.getQueuePosition(positionID, candidateID)
	if currentPos <= 1 {
		return false, "Already at front of queue"
	}

	var betterPos int
	var entries []models.QueueEntry
	s.db.Where("position_id = ? AND status = ? AND queue_position < ?",
		positionID, "waiting", currentPos).
		Order("queue_position DESC").Find(&entries)

	for _, e := range entries {
		timeSaved := (currentPos - e.QueuePosition) * activity.AverageInterviewTime
		if timeSaved >= threshold {
			betterPos = e.QueuePosition + 1
			break
		}
	}

	if betterPos > 0 && betterPos < currentPos {
		entry.QueuePosition = betterPos
		entry.JumpAheadUsed = true
		s.db.Save(&entry)
		s.updateQueuePositions(positionID)
		s.broadcastQueueUpdate(positionID)
		return true, "Jump ahead successful"
	}

	return false, "No better position available"
}

// CheckQueueOptimization checks if candidate can optimize their queue order
func (s *QueueService) CheckQueueOptimization(candidateID uint) (bool, map[string]interface{}) {
	// Get all queues for this candidate
	var candidateQueues []models.QueueEntry
	s.db.Where("candidate_id = ? AND status = ?", candidateID, "waiting").
		Preload("Position").Find(&candidateQueues)

	if len(candidateQueues) < 2 {
		return false, nil
	}

	var activity models.ActivityControl
	s.db.First(&activity)

	// Calculate actual wait times for all positions
	type queueDetail struct {
		Entry        models.QueueEntry
		Position     int
		WaitTime     int
		IsPriority   bool
	}

	queues := []queueDetail{}
	for _, cq := range candidateQueues {
		pos := s.getQueuePosition(cq.PositionID, candidateID)
		// Use smart wait time calculation to get optimized times
		waitTime := s.calculateSmartWaitTime(cq.PositionID, candidateID, activity.AverageInterviewTime)

		queues = append(queues, queueDetail{
			Entry:      cq,
			Position:   pos,
			WaitTime:   waitTime,
			IsPriority: cq.IsHighPriority,
		})
	}

	// Check for optimization opportunity:
	// If a regular position can be done immediately (0 wait) but priority position has wait,
	// suggest doing the regular first
	for i, priorityQueue := range queues {
		if !priorityQueue.IsPriority {
			continue
		}

		for j, regularQueue := range queues {
			if regularQueue.IsPriority || i == j {
				continue
			}

			// Check if regular position can be done immediately while priority has to wait
			if regularQueue.WaitTime == 0 && priorityQueue.WaitTime > 0 {
				// Found optimization opportunity!
				suggestion := map[string]interface{}{
					"can_optimize": true,
					"priority_position": map[string]interface{}{
						"name":      priorityQueue.Entry.Position.Name,
						"wait_time": priorityQueue.WaitTime,
						"position_id": priorityQueue.Entry.PositionID,
					},
					"regular_position": map[string]interface{}{
						"name":      regularQueue.Entry.Position.Name,
						"wait_time": regularQueue.WaitTime,
						"position_id": regularQueue.Entry.PositionID,
					},
					"time_saved": priorityQueue.WaitTime,
					"message": fmt.Sprintf(
						"You can interview for %s immediately (0 min wait) before %s (%d min wait), saving %d minutes!",
						regularQueue.Entry.Position.Name,
						priorityQueue.Entry.Position.Name,
						priorityQueue.WaitTime,
						priorityQueue.WaitTime,
					),
				}
				return true, suggestion
			}
		}
	}

	return false, nil
}

// ApplyQueueOptimization swaps the order of interviews when optimization is accepted
func (s *QueueService) ApplyQueueOptimization(candidateID uint, regularPositionID uint, priorityPositionID uint) error {
	// Get both queue entries
	var regularEntry, priorityEntry models.QueueEntry

	if err := s.db.Where("candidate_id = ? AND position_id = ? AND status = ?",
		candidateID, regularPositionID, "waiting").First(&regularEntry).Error; err != nil {
		return errors.New("regular position not found in queue")
	}

	if err := s.db.Where("candidate_id = ? AND position_id = ? AND status = ?",
		candidateID, priorityPositionID, "waiting").First(&priorityEntry).Error; err != nil {
		return errors.New("priority position not found in queue")
	}

	if !priorityEntry.IsHighPriority {
		return errors.New("specified position is not high priority")
	}

	// Calculate current wait times using smart wait time calculation
	var activity models.ActivityControl
	s.db.First(&activity)

	regularWait := s.calculateSmartWaitTime(regularPositionID, candidateID, activity.AverageInterviewTime)
	priorityWait := s.calculateSmartWaitTime(priorityPositionID, candidateID, activity.AverageInterviewTime)

	// Check if optimization is beneficial (regular can be done immediately while priority has wait)
	if regularWait >= priorityWait {
		return errors.New("optimization not beneficial")
	}

	// Swap the join times to reorder the queue
	// The regular position should come first, so give it an earlier join time
	tempTime := regularEntry.JoinTime
	regularEntry.JoinTime = priorityEntry.JoinTime
	priorityEntry.JoinTime = tempTime.Add(time.Duration(activity.AverageInterviewTime + activity.BufferTime) * time.Minute)

	// Save the changes
	s.db.Save(&regularEntry)
	s.db.Save(&priorityEntry)

	// Update queue positions for both
	s.updateQueuePositions(regularPositionID)
	s.updateQueuePositions(priorityPositionID)

	// Broadcast updates
	s.broadcastQueueUpdate(regularPositionID)
	s.broadcastQueueUpdate(priorityPositionID)

	// Send optimization confirmation
	if s.wsHub != nil {
		message := Message{
			Type: "queue_optimized",
			Data: map[string]interface{}{
				"message": fmt.Sprintf("Queue optimized! You'll interview for the regular position first."),
				"candidate_id": candidateID,
			},
			Timestamp: time.Now(),
		}
		s.wsHub.BroadcastToUser(candidateID, message)
	}

	return nil
}

func (s *QueueService) ProcessDelay(candidateID uint, minutes int) error {
	var entries []models.QueueEntry
	s.db.Where("candidate_id = ? AND status = ?", candidateID, "waiting").Find(&entries)

	fmt.Printf("DEBUG ProcessDelay: candidateID=%d, delaying %d minutes for %d positions\n", candidateID, minutes, len(entries))

	for _, entry := range entries {
		oldJoinTime := entry.JoinTime
		newJoinTime := entry.JoinTime.Add(time.Duration(minutes) * time.Minute)
		entry.JoinTime = newJoinTime
		entry.DelayUsed++
		s.db.Save(&entry)
		s.updateQueuePositions(entry.PositionID)

		fmt.Printf("  Position %d delayed: %s -> %s\n", entry.PositionID, oldJoinTime.Format("15:04:05"), newJoinTime.Format("15:04:05"))
	}

	return nil
}

func (s *QueueService) ResolveConflicts(candidateID uint) (bool, []string) {
	var entries []models.QueueEntry
	s.db.Where("candidate_id = ? AND status = ?", candidateID, "waiting").
		Preload("Position").Find(&entries)

	fmt.Printf("DEBUG ResolveConflicts: candidateID=%d, found %d entries\n", candidateID, len(entries))
	for i, entry := range entries {
		fmt.Printf("  Entry %d: PositionID=%d, Position=%s, JoinTime=%s\n", i, entry.PositionID, entry.Position.Name, entry.JoinTime.Format("15:04:05"))
	}

	if len(entries) <= 1 {
		fmt.Printf("DEBUG ResolveConflicts: Only %d entries, no conflicts possible\n", len(entries))
		return false, nil
	}

	type conflictInfo struct {
		Entry         *models.QueueEntry
		EstimatedTime time.Time
		EndTime       time.Time
		QueuePosition int
	}

	conflicts := make([]conflictInfo, len(entries))
	var activity models.ActivityControl
	s.db.First(&activity)

	// Calculate estimated times for each position
	for i, entry := range entries {
		queuePos := s.getQueuePosition(entry.PositionID, candidateID)
		waitTime := (queuePos - 1) * activity.AverageInterviewTime // Position 1 = 0 wait
		if waitTime < 0 {
			waitTime = 0
		}

		// Start time should be the later of:
		// 1. Queue-based start time (now + queue wait)
		// 2. Delayed join time (respects user delay)
		now := time.Now()
		queueBasedStartTime := now.Add(time.Duration(waitTime) * time.Minute)

		// Handle cross-day join times - if join time appears to be in the past,
		// it's likely been delayed to the next day
		delayedStartTime := entry.JoinTime
		if delayedStartTime.Before(now) {
			// Add 24 hours to bring it to tomorrow
			delayedStartTime = delayedStartTime.Add(24 * time.Hour)
		}

		fmt.Printf("  Time comparison for %s: Now=%s, QueueBased=%s, DelayedJoin=%s (adjusted=%s)\n",
			entry.Position.Name,
			now.Format("15:04:05"),
			queueBasedStartTime.Format("15:04:05"),
			entry.JoinTime.Format("15:04:05"),
			delayedStartTime.Format("15:04:05"))

		var startTime time.Time
		if queueBasedStartTime.After(delayedStartTime) {
			startTime = queueBasedStartTime
			fmt.Printf("  Using queue-based start time for %s\n", entry.Position.Name)
		} else {
			startTime = delayedStartTime
			fmt.Printf("  Using delayed join time for %s\n", entry.Position.Name)
		}

		endTime := startTime.Add(time.Duration(activity.AverageInterviewTime) * time.Minute)

		fmt.Printf("  Conflict analysis: Position=%s, QueuePos=%d, WaitTime=%d, StartTime=%s\n",
			entry.Position.Name, queuePos, waitTime, startTime.Format("15:04:05"))

		conflicts[i] = conflictInfo{
			Entry:         &entries[i],
			EstimatedTime: startTime,
			EndTime:       endTime,
			QueuePosition: queuePos,
		}
	}

	// Sort by priority and estimated time
	sort.Slice(conflicts, func(i, j int) bool {
		if conflicts[i].Entry.IsHighPriority != conflicts[j].Entry.IsHighPriority {
			return conflicts[i].Entry.IsHighPriority
		}
		return conflicts[i].EstimatedTime.Before(conflicts[j].EstimatedTime)
	})

	// Detect and resolve conflicts using a sequential approach
	hasConflicts := false
	conflictMessages := []string{}

	// Keep track of the last scheduled end time
	var lastEndTime time.Time

	for i := 0; i < len(conflicts); i++ {
		if i == 0 {
			// First position keeps its original time
			lastEndTime = conflicts[i].EndTime
		} else {
			// Check if current position conflicts with the last scheduled position
			// A conflict occurs when the current interview would start before the previous one ends
			// (including buffer time). This covers both overlapping times and simultaneous start times.
			earliestStartTime := lastEndTime.Add(time.Duration(activity.BufferTime) * time.Minute)
			fmt.Printf("  Checking conflict for %s: EstimatedTime=%s, EarliestStart=%s\n",
				conflicts[i].Entry.Position.Name,
				conflicts[i].EstimatedTime.Format("15:04:05"),
				earliestStartTime.Format("15:04:05"))

			if conflicts[i].EstimatedTime.Before(earliestStartTime) {
				fmt.Printf("  CONFLICT DETECTED for %s!\n", conflicts[i].Entry.Position.Name)
				hasConflicts = true

				// Calculate the new start time with buffer
				newStartTime := lastEndTime.Add(time.Duration(activity.BufferTime) * time.Minute)

				// Set the resolved EstimatedTime directly
				conflicts[i].Entry.EstimatedTime = &newStartTime

				// Update estimated times for this entry
				oldStartTime := conflicts[i].EstimatedTime
				conflicts[i].EstimatedTime = newStartTime
				conflicts[i].EndTime = newStartTime.Add(time.Duration(activity.AverageInterviewTime) * time.Minute)

				// Create conflict message
				msg := fmt.Sprintf("%s was scheduled at %s but conflicts with previous interview. Rescheduled to %s",
					conflicts[i].Entry.Position.Name,
					oldStartTime.Format("15:04"),
					newStartTime.Format("15:04"))
				conflictMessages = append(conflictMessages, msg)

				// Save the adjusted entry
				s.db.Save(conflicts[i].Entry)
				s.updateQueuePositions(conflicts[i].Entry.PositionID)

				// Update lastEndTime for next iteration
				lastEndTime = conflicts[i].EndTime
			} else {
				// No conflict, just update lastEndTime
				lastEndTime = conflicts[i].EndTime
			}
		}
	}

	// Send notification if conflicts were found
	if hasConflicts && s.wsHub != nil {
		message := Message{
			Type: ConflictResolved,
			Data: map[string]interface{}{
				"conflicts":    conflictMessages,
				"resolved":     true,
				"candidate_id": candidateID,
			},
			Timestamp: time.Now(),
		}
		s.wsHub.BroadcastToUser(candidateID, message)
	}

	return hasConflicts, conflictMessages
}