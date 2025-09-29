package handlers

import (
	"errors"
	"interview-system/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db          *gorm.DB
	redisClient *redis.Client
}

func NewAdminHandler(db *gorm.DB, redisClient *redis.Client) *AdminHandler {
	return &AdminHandler{
		db:          db,
		redisClient: redisClient,
	}
}

func (h *AdminHandler) GetPublicActivityStatus(c *gin.Context) {
	var activity models.ActivityControl
	if err := h.db.First(&activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	now := time.Now()
	minutesUntilStart := int(activity.StartTime.Sub(now).Minutes())
	minutesUntilEnd := int(activity.EndTime.Sub(now).Minutes())

	response := gin.H{
		"is_active":            activity.Status == "active",
		"start_time":           activity.StartTime,
		"end_time":             activity.EndTime,
		"current_time":         now,
		"is_started":           now.After(activity.StartTime),
		"is_ended":             now.After(activity.EndTime),
		"minutes_until_start":  minutesUntilStart,
		"minutes_until_end":    minutesUntilEnd,
		"can_join_queue":       activity.Status == "active" && now.After(activity.StartTime) && now.Before(activity.EndTime),
	}

	c.JSON(http.StatusOK, response)
}

func (h *AdminHandler) GetActivityControl(c *gin.Context) {
	var activity models.ActivityControl
	if err := h.db.First(&activity).Error; err != nil {
		// If no record exists, create a default one
		if errors.Is(err, gorm.ErrRecordNotFound) {
			activity = models.ActivityControl{
				Status:               "active",
				ActiveQueueLimit:     6,
				HighPriorityQuota:    2,
				AverageInterviewTime: 8,
				BufferTime:           5,
				GroupInterviewMaxSize: 4,
				StartTime:            time.Now(),
				EndTime:              time.Now().Add(8 * time.Hour),
			}
			h.db.Create(&activity)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
	}

	// Return with formatted times for frontend
	response := gin.H{
		"id":                        activity.ID,
		"status":                    activity.Status,
		"active_queue_limit":        activity.ActiveQueueLimit,
		"high_priority_quota":       activity.HighPriorityQuota,
		"average_interview_time":    activity.AverageInterviewTime,
		"buffer_time":               activity.BufferTime,
		"group_interview_max_size":  activity.GroupInterviewMaxSize,
		"start_time":                activity.StartTime,
		"end_time":                  activity.EndTime,
		"activity_start_time":       activity.StartTime.Format("15:04"),
		"activity_end_time":         activity.EndTime.Format("15:04"),
	}

	c.JSON(http.StatusOK, response)
}

func (h *AdminHandler) UpdateActivityControl(c *gin.Context) {
	var activity models.ActivityControl
	if err := h.db.First(&activity).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activity control not found"})
		return
	}

	var req struct {
		ActiveQueueLimit      int    `json:"active_queue_limit"`
		HighPriorityQuota     int    `json:"high_priority_quota"`
		AverageInterviewTime  int    `json:"average_interview_time"`
		BufferTime            int    `json:"buffer_time"`
		GroupInterviewMaxSize int    `json:"group_interview_max_size"`
		Status                string `json:"status"`
		StartTime             string `json:"start_time"`
		EndTime               string `json:"end_time"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ActiveQueueLimit > 0 {
		activity.ActiveQueueLimit = req.ActiveQueueLimit
	}
	if req.HighPriorityQuota > 0 {
		activity.HighPriorityQuota = req.HighPriorityQuota
	}
	if req.AverageInterviewTime > 0 {
		activity.AverageInterviewTime = req.AverageInterviewTime
	}
	if req.BufferTime > 0 {
		activity.BufferTime = req.BufferTime
	}
	if req.GroupInterviewMaxSize > 0 {
		activity.GroupInterviewMaxSize = req.GroupInterviewMaxSize
	}
	if req.Status != "" {
		activity.Status = req.Status
	}

	// Handle start time
	if req.StartTime != "" {
		today := time.Now().Format("2006-01-02")
		startTimeStr := today + " " + req.StartTime + ":00"
		if startTime, err := time.Parse("2006-01-02 15:04:05", startTimeStr); err == nil {
			activity.StartTime = startTime
		}
	}

	// Handle end time
	if req.EndTime != "" {
		today := time.Now().Format("2006-01-02")
		endTimeStr := today + " " + req.EndTime + ":00"
		if endTime, err := time.Parse("2006-01-02 15:04:05", endTimeStr); err == nil {
			activity.EndTime = endTime
		}
	}

	if err := h.db.Save(&activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activity": activity})
}

func (h *AdminHandler) StartActivity(c *gin.Context) {
	var activity models.ActivityControl
	if err := h.db.First(&activity).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activity control not found"})
		return
	}

	activity.StartTime = time.Now()
	activity.EndTime = time.Now().Add(4 * time.Hour)
	activity.Status = "active"

	if err := h.db.Save(&activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Activity started successfully"})
}

func (h *AdminHandler) EndActivity(c *gin.Context) {
	var activity models.ActivityControl
	if err := h.db.First(&activity).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activity control not found"})
		return
	}

	activity.Status = "completed"
	activity.EndTime = time.Now()

	if err := h.db.Save(&activity).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Activity ended successfully"})
}

func (h *AdminHandler) GetDashboard(c *gin.Context) {
	var stats struct {
		OnlineCandidates  int64
		ActiveInterviews  int64
		WaitingQueue      int64
		CompletedInterviews int64
		AverageWaitTime   float64
		InterviewerCount  int64
	}

	h.db.Model(&models.User{}).Where("role = ? AND last_login > ?",
		models.RoleCandidate, time.Now().Add(-30*time.Minute)).Count(&stats.OnlineCandidates)

	h.db.Model(&models.Interview{}).Where("status = ?",
		models.InterviewInProgress).Count(&stats.ActiveInterviews)

	h.db.Model(&models.QueueEntry{}).Where("status = ?", "waiting").Count(&stats.WaitingQueue)

	h.db.Model(&models.Interview{}).Where("status = ?",
		models.InterviewCompleted).Count(&stats.CompletedInterviews)

	h.db.Model(&models.User{}).Where("role = ?",
		models.RoleInterviewer).Count(&stats.InterviewerCount)

	c.JSON(http.StatusOK, gin.H{"dashboard": stats})
}

func (h *AdminHandler) GetStatistics(c *gin.Context) {
	var stats struct {
		TotalCandidates      int64
		TotalInterviews      int64
		CompletionRate       float64
		HighPriorityUsage    int64
		JumpAheadSuccessRate float64
		GroupInterviews      int64
	}

	h.db.Model(&models.User{}).Where("role = ?", models.RoleCandidate).Count(&stats.TotalCandidates)
	h.db.Model(&models.Interview{}).Count(&stats.TotalInterviews)

	var completed int64
	h.db.Model(&models.Interview{}).Where("status = ?", models.InterviewCompleted).Count(&completed)
	if stats.TotalInterviews > 0 {
		stats.CompletionRate = float64(completed) / float64(stats.TotalInterviews) * 100
	}

	h.db.Model(&models.QueueEntry{}).Where("is_high_priority = ?", true).Count(&stats.HighPriorityUsage)
	h.db.Model(&models.GroupInterview{}).Count(&stats.GroupInterviews)

	c.JSON(http.StatusOK, gin.H{"statistics": stats})
}

func (h *AdminHandler) ImportUsers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Import users endpoint"})
}

func (h *AdminHandler) GetSystemLogs(c *gin.Context) {
	var logs []models.LoginRecord
	h.db.Order("created_at DESC").Limit(100).Find(&logs)

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

func (h *AdminHandler) GetCompanyCandidates(c *gin.Context) {
	companyID, _ := c.Get("company_id")

	var candidates []models.User

	if companyID != nil {
		h.db.Preload("CandidatePositions.Position").
			Where("role = ?", models.RoleCandidate).Find(&candidates)
	}

	c.JSON(http.StatusOK, gin.H{"candidates": candidates})
}

func (h *AdminHandler) GetCompanyStats(c *gin.Context) {
	companyID, _ := c.Get("company_id")

	var stats struct {
		TotalPositions    int64
		TotalInterviewers int64
		TotalCandidates   int64
		TotalInterviews   int64
	}

	if companyID != nil {
		h.db.Model(&models.Position{}).Where("company_id = ?", companyID).Count(&stats.TotalPositions)
		h.db.Model(&models.User{}).Where("company_id = ? AND role = ?",
			companyID, models.RoleInterviewer).Count(&stats.TotalInterviewers)
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}