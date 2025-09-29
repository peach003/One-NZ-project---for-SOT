package models

import (
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	RoleCandidate      UserRole = "candidate"
	RoleInterviewer    UserRole = "interviewer"
	RoleControlAdmin   UserRole = "control_admin"
	RoleCompanyAdmin   UserRole = "company_admin"
)

type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Account      string         `gorm:"uniqueIndex;not null" json:"account"`
	Password     string         `gorm:"not null" json:"-"`
	Name         string         `gorm:"not null" json:"name"`
	EmployeeID   string         `json:"employee_id"`
	Role         UserRole       `gorm:"not null" json:"role"`
	CompanyID    *uint          `json:"company_id"`
	Company      *Company       `gorm:"foreignKey:CompanyID" json:"company,omitempty"`
	Email        string         `json:"email"`
	Phone        string         `json:"phone"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	LastLogin    *time.Time     `json:"last_login"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type Company struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"uniqueIndex;not null" json:"name"`
	Code      string         `gorm:"uniqueIndex;not null" json:"code"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type LoginRecord struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
	IP        string    `json:"ip"`
	UserAgent string    `json:"user_agent"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}