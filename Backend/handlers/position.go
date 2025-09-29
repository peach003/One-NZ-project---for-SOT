package handlers

import (
	"interview-system/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PositionHandler struct {
	db *gorm.DB
}

func NewPositionHandler(db *gorm.DB) *PositionHandler {
	return &PositionHandler{db: db}
}

func (h *PositionHandler) GetAvailablePositions(c *gin.Context) {
	var positions []models.Position
	if err := h.db.Preload("Company").Where("is_active = ?", true).Find(&positions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"positions": positions})
}

func (h *PositionHandler) GetCompanyPositions(c *gin.Context) {
	companyID, _ := c.Get("company_id")

	var positions []models.Position
	query := h.db.Preload("Company").Preload("Interviewers")

	if companyID != nil {
		query = query.Where("company_id = ?", companyID)
	}

	if err := query.Find(&positions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"positions": positions})
}

func (h *PositionHandler) CreatePosition(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		CompanyID   uint   `json:"company_id" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	position := models.Position{
		Name:        req.Name,
		CompanyID:   req.CompanyID,
		Description: req.Description,
		IsActive:    true,
	}

	if err := h.db.Create(&position).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"position": position})
}

func (h *PositionHandler) UpdatePosition(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid position ID"})
		return
	}

	var position models.Position
	if err := h.db.First(&position, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Position not found"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		IsActive    *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		position.Name = req.Name
	}
	if req.Description != "" {
		position.Description = req.Description
	}
	if req.IsActive != nil {
		position.IsActive = *req.IsActive
	}

	if err := h.db.Save(&position).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"position": position})
}

func (h *PositionHandler) DeletePosition(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid position ID"})
		return
	}

	if err := h.db.Delete(&models.Position{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Position deleted successfully"})
}

func (h *PositionHandler) AssignInterviewer(c *gin.Context) {
	positionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid position ID"})
		return
	}

	var req struct {
		InterviewerID uint `json:"interviewer_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if interviewer exists and has the right role
	var interviewer models.User
	if err := h.db.First(&interviewer, req.InterviewerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Interviewer not found"})
		return
	}

	if interviewer.Role != "interviewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not an interviewer"})
		return
	}

	// Check if interviewer is already assigned to another position
	var existingAssignment models.PositionInterviewer
	if err := h.db.Where("interviewer_id = ?", req.InterviewerID).First(&existingAssignment).Error; err == nil {
		// Interviewer is already assigned to a position
		if existingAssignment.PositionID != uint(positionID) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Interviewer is already assigned to another position. Please unassign them first.",
				"current_position_id": existingAssignment.PositionID,
			})
			return
		}
		// Already assigned to this position
		c.JSON(http.StatusOK, gin.H{"message": "Interviewer is already assigned to this position"})
		return
	}

	// Check if position exists
	var position models.Position
	if err := h.db.First(&position, positionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Position not found"})
		return
	}

	// Create the assignment
	assignment := models.PositionInterviewer{
		PositionID:    uint(positionID),
		InterviewerID: req.InterviewerID,
		AssignedAt:    time.Now(),
	}

	if err := h.db.Create(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also update the many-to-many relationship
	h.db.Model(&position).Association("Interviewers").Append(&interviewer)

	c.JSON(http.StatusOK, gin.H{
		"message": "Interviewer assigned successfully",
		"assignment": assignment,
	})
}

func (h *PositionHandler) UnassignInterviewer(c *gin.Context) {
	positionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid position ID"})
		return
	}

	var req struct {
		InterviewerID uint `json:"interviewer_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if the assignment exists
	var assignment models.PositionInterviewer
	if err := h.db.Where("position_id = ? AND interviewer_id = ?",
		positionID, req.InterviewerID).First(&assignment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}

	// Delete from PositionInterviewer table
	if err := h.db.Delete(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also remove from many-to-many relationship
	var position models.Position
	var interviewer models.User
	h.db.First(&position, positionID)
	h.db.First(&interviewer, req.InterviewerID)
	h.db.Model(&position).Association("Interviewers").Delete(&interviewer)

	c.JSON(http.StatusOK, gin.H{"message": "Interviewer unassigned successfully"})
}