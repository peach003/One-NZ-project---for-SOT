package handlers

import (
	"interview-system/models"
	"interview-system/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type QueueHandler struct {
	queueService *services.QueueService
	db           *gorm.DB
}

type JoinQueueRequest struct {
	PositionID uint `json:"position_id" binding:"required"`
}

type SetPriorityRequest struct {
	PositionID uint `json:"position_id" binding:"required"`
}

type DelayRequest struct {
	Minutes int `json:"minutes" binding:"required,min=5,max=30"`
}

func NewQueueHandler(queueService *services.QueueService, db *gorm.DB) *QueueHandler {
	return &QueueHandler{
		queueService: queueService,
		db:           db,
	}
}

func (h *QueueHandler) JoinQueue(c *gin.Context) {
	var req JoinQueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	if err := h.queueService.JoinQueue(candidateID, req.PositionID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully joined queue"})
}

func (h *QueueHandler) SetHighPriority(c *gin.Context) {
	var req SetPriorityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	if err := h.queueService.SetHighPriority(candidateID, req.PositionID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully set high priority"})
}

func (h *QueueHandler) GetMyQueues(c *gin.Context) {
	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	queues, err := h.queueService.GetCandidateQueues(candidateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"queues": queues})
}

func (h *QueueHandler) LeaveQueue(c *gin.Context) {
	var req struct {
		PositionID uint `json:"position_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	result := h.db.Model(&models.QueueEntry{}).Where("candidate_id = ? AND position_id = ? AND status = ?",
		candidateID, req.PositionID, "waiting").Update("status", "left")

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not in queue for this position"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully left queue"})
}

func (h *QueueHandler) RequestDelay(c *gin.Context) {
	var req DelayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	if err := h.queueService.ProcessDelay(candidateID, req.Minutes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Delay applied successfully"})
}

func (h *QueueHandler) CheckJumpAhead(c *gin.Context) {
	positionID := c.Query("position_id")
	if positionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "position_id required"})
		return
	}

	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	var pid uint
	pid = uint(atoi(positionID))

	success, message := h.queueService.ProcessJumpAhead(candidateID, pid)

	c.JSON(http.StatusOK, gin.H{
		"success": success,
		"message": message,
	})
}

func (h *QueueHandler) CheckConflicts(c *gin.Context) {
	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	// First check if optimization is available
	canOptimize, _ := h.queueService.CheckQueueOptimization(candidateID)

	// Only check for conflicts if no optimization is available
	if canOptimize {
		// If optimization is available, don't report conflicts
		c.JSON(http.StatusOK, gin.H{
			"has_conflicts": false,
			"messages":      []string{},
			"resolved":      false,
		})
		return
	}

	// If no optimization available, check and resolve conflicts
	hasConflicts, messages := h.queueService.ResolveConflicts(candidateID)

	c.JSON(http.StatusOK, gin.H{
		"has_conflicts": hasConflicts,
		"messages":      messages,
		"resolved":      hasConflicts,
	})
}

// CheckQueueOptimization checks if queue order can be optimized
func (h *QueueHandler) CheckQueueOptimization(c *gin.Context) {
	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	canOptimize, suggestion := h.queueService.CheckQueueOptimization(candidateID)

	if !canOptimize {
		c.JSON(http.StatusOK, gin.H{
			"can_optimize": false,
			"message":      "No optimization available",
		})
		return
	}

	c.JSON(http.StatusOK, suggestion)
}

// ApplyQueueOptimization applies the suggested queue optimization
func (h *QueueHandler) ApplyQueueOptimization(c *gin.Context) {
	userID, _ := c.Get("user_id")
	candidateID := userID.(uint)

	var req struct {
		RegularPositionID  uint `json:"regular_position_id"`
		PriorityPositionID uint `json:"priority_position_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := h.queueService.ApplyQueueOptimization(candidateID, req.RegularPositionID, req.PriorityPositionID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Queue optimized successfully",
	})
}

func atoi(s string) int {
	var n int
	for _, ch := range s {
		n = n*10 + int(ch-'0')
	}
	return n
}