package handlers

import (
	"interview-system/models"
	"interview-system/services"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InterviewHandler struct {
	db    *gorm.DB
	wsHub *services.WebSocketHub
}

func NewInterviewHandler(db *gorm.DB, wsHub *services.WebSocketHub) *InterviewHandler {
	return &InterviewHandler{db: db, wsHub: wsHub}
}

func (h *InterviewHandler) GetInterviewQueue(c *gin.Context) {
	interviewerID, _ := c.Get("user_id")

	var assignments []models.PositionInterviewer
	h.db.Where("interviewer_id = ?", interviewerID).Find(&assignments)

	var queue []models.QueueEntry

	if len(assignments) == 0 {
		// If interviewer has no assigned positions, show ALL waiting candidates
		// Group by candidate to avoid duplicates when a candidate is in multiple position queues
		h.db.Preload("Candidate").Preload("Position").
			Where("status = ?", "waiting").
			Order("is_high_priority DESC, priority_set_time ASC, join_time ASC").
			Find(&queue)

		// Deduplicate by candidate - keep only the highest priority entry per candidate
		candidateMap := make(map[uint]models.QueueEntry)
		for _, entry := range queue {
			existing, exists := candidateMap[entry.CandidateID]
			if !exists {
				candidateMap[entry.CandidateID] = entry
			} else {
				// Keep the entry with higher priority or earlier join time
				if entry.IsHighPriority && !existing.IsHighPriority {
					candidateMap[entry.CandidateID] = entry
				} else if entry.IsHighPriority == existing.IsHighPriority && entry.JoinTime.Before(existing.JoinTime) {
					candidateMap[entry.CandidateID] = entry
				}
			}
		}

		// Convert map back to slice
		dedupQueue := make([]models.QueueEntry, 0, len(candidateMap))
		for _, entry := range candidateMap {
			dedupQueue = append(dedupQueue, entry)
		}

		// Sort the deduplicated queue
		sort.Slice(dedupQueue, func(i, j int) bool {
			if dedupQueue[i].IsHighPriority != dedupQueue[j].IsHighPriority {
				return dedupQueue[i].IsHighPriority
			}
			if dedupQueue[i].IsHighPriority && dedupQueue[j].IsHighPriority {
				if dedupQueue[i].PrioritySetTime != nil && dedupQueue[j].PrioritySetTime != nil {
					return dedupQueue[i].PrioritySetTime.Before(*dedupQueue[j].PrioritySetTime)
				}
			}
			return dedupQueue[i].JoinTime.Before(dedupQueue[j].JoinTime)
		})

		c.JSON(http.StatusOK, gin.H{
			"queue": dedupQueue,
			"message": "Showing all queues - no specific position assigned",
		})
		return
	}

	// Get queues for the first assigned position
	positionID := assignments[0].PositionID

	h.db.Preload("Candidate").Preload("Position").
		Where("position_id = ? AND status = ?", positionID, "waiting").
		Order("is_high_priority DESC, priority_set_time ASC, join_time ASC").
		Find(&queue)

	c.JSON(http.StatusOK, gin.H{
		"queue": queue,
		"position_id": positionID,
	})
}

func (h *InterviewHandler) StartInterview(c *gin.Context) {
	var req struct {
		CandidateID uint `json:"candidate_id" binding:"required"`
		PositionID  uint `json:"position_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	interviewerID, _ := c.Get("user_id")
	now := time.Now()

	// Validate that the position exists
	var position models.Position
	if err := h.db.First(&position, req.PositionID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid position ID"})
		return
	}

	// Validate that the candidate exists
	var candidate models.User
	if err := h.db.First(&candidate, req.CandidateID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid candidate ID"})
		return
	}

	interview := models.Interview{
		CandidateID:   req.CandidateID,
		InterviewerID: interviewerID.(uint),
		PositionID:    req.PositionID,
		Status:        models.InterviewInProgress,
		StartTime:     &now,
	}

	if err := h.db.Create(&interview).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.db.Model(&models.QueueEntry{}).
		Where("candidate_id = ? AND position_id = ?", req.CandidateID, req.PositionID).
		Update("status", "interviewing")

	message := services.Message{
		Type: services.InterviewStatus,
		Data: map[string]interface{}{
			"interview_id": interview.ID,
			"status":       "started",
		},
		Timestamp: time.Now(),
	}
	h.wsHub.BroadcastToUser(req.CandidateID, message)

	c.JSON(http.StatusOK, gin.H{"interview": interview})
}

func (h *InterviewHandler) EndInterview(c *gin.Context) {
	var req struct {
		InterviewID uint   `json:"interview_id" binding:"required"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var interview models.Interview
	if err := h.db.First(&interview, req.InterviewID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Interview not found"})
		return
	}

	now := time.Now()
	duration := int(now.Sub(*interview.StartTime).Minutes())

	interview.EndTime = &now
	interview.Duration = duration
	interview.Status = models.InterviewCompleted
	interview.Notes = req.Notes

	h.db.Save(&interview)

	h.db.Model(&models.QueueEntry{}).
		Where("candidate_id = ? AND position_id = ?", interview.CandidateID, interview.PositionID).
		Update("status", "completed")

	c.JSON(http.StatusOK, gin.H{"message": "Interview ended successfully"})
}

func (h *InterviewHandler) GetCurrentInterview(c *gin.Context) {
	interviewerID, _ := c.Get("user_id")

	var interview models.Interview
	if err := h.db.Preload("Candidate").Preload("Position").
		Where("interviewer_id = ? AND status = ?", interviewerID, models.InterviewInProgress).
		First(&interview).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"interview": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"interview": interview})
}

func (h *InterviewHandler) InitiateGroupInterview(c *gin.Context) {
	var req struct {
		PositionID      uint   `json:"position_id" binding:"required"`
		MaxParticipants int    `json:"max_participants"`
		CandidateIDs    []uint `json:"candidate_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	interviewerID, _ := c.Get("user_id")

	groupInterview := models.GroupInterview{
		InterviewerID:   interviewerID.(uint),
		PositionID:      req.PositionID,
		MaxParticipants: req.MaxParticipants,
		Status:          "inviting",
	}

	if err := h.db.Create(&groupInterview).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, candidateID := range req.CandidateIDs {
		message := services.Message{
			Type: services.GroupInvitation,
			Data: map[string]interface{}{
				"group_interview_id": groupInterview.ID,
				"position_id":        req.PositionID,
			},
			Timestamp: time.Now(),
		}
		h.wsHub.BroadcastToUser(candidateID, message)
	}

	c.JSON(http.StatusOK, gin.H{"group_interview": groupInterview})
}

func (h *InterviewHandler) GetInterviewerStats(c *gin.Context) {
	interviewerID, _ := c.Get("user_id")

	var stats struct {
		TotalInterviews   int64
		AverageDuration   float64
		TodayInterviews   int64
		CurrentQueueSize  int64
	}

	h.db.Model(&models.Interview{}).
		Where("interviewer_id = ? AND status = ?", interviewerID, models.InterviewCompleted).
		Count(&stats.TotalInterviews)

	h.db.Model(&models.Interview{}).
		Where("interviewer_id = ? AND status = ?", interviewerID, models.InterviewCompleted).
		Select("AVG(duration)").Scan(&stats.AverageDuration)

	today := time.Now().Truncate(24 * time.Hour)
	h.db.Model(&models.Interview{}).
		Where("interviewer_id = ? AND created_at >= ?", interviewerID, today).
		Count(&stats.TodayInterviews)

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

func (h *InterviewHandler) GetCompanyInterviewers(c *gin.Context) {
	companyID, _ := c.Get("company_id")

	var interviewers []models.User
	query := h.db.Where("role = ?", models.RoleInterviewer)

	if companyID != nil {
		query = query.Where("company_id = ?", companyID)
	}

	if err := query.Find(&interviewers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"interviewers": interviewers})
}

func (h *InterviewHandler) CreateInterviewer(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Create interviewer endpoint"})
}

func (h *InterviewHandler) UpdateInterviewer(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Update interviewer endpoint"})
}