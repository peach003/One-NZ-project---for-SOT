package handlers

import (
	"interview-system/models"
	"interview-system/services"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	authService *services.AuthService
	db          *gorm.DB
}

type LoginRequest struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Account    string `json:"account" binding:"required"`
	Password   string `json:"password" binding:"required,min=6"`
	Name       string `json:"name" binding:"required"`
	EmployeeID string `json:"employee_id"`
	Role       string `json:"role" binding:"required"`
	CompanyID  *uint  `json:"company_id"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
}

func NewAuthHandler(authService *services.AuthService, db *gorm.DB) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		db:          db,
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, user, err := h.authService.Login(req.Account, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	loginRecord := models.LoginRecord{
		UserID:    user.ID,
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		Status:    "success",
		CreatedAt: time.Now(),
	}
	h.db.Create(&loginRecord)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":         user.ID,
			"account":    user.Account,
			"name":       user.Name,
			"role":       user.Role,
			"company_id": user.CompanyID,
			"company":    user.Company,
		},
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user := models.User{
		Account:    req.Account,
		Password:   req.Password,
		Name:       req.Name,
		EmployeeID: req.EmployeeID,
		Role:       models.UserRole(req.Role),
		CompanyID:  req.CompanyID,
		Email:      req.Email,
		Phone:      req.Phone,
		IsActive:   true,
	}

	if err := h.authService.CreateUser(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create user: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"user_id": user.ID,
	})
}

func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user models.User
	if err := h.db.Preload("Company").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          user.ID,
		"account":     user.Account,
		"name":        user.Name,
		"employee_id": user.EmployeeID,
		"role":        user.Role,
		"company":     user.Company,
		"email":       user.Email,
		"phone":       user.Phone,
		"last_login":  user.LastLogin,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}