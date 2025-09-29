package models

import (
	"time"

	"gorm.io/gorm"
)

type Position struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"not null" json:"name"`
	CompanyID    uint           `gorm:"not null" json:"company_id"`
	Company      Company        `gorm:"foreignKey:CompanyID" json:"company,omitempty"`
	Description  string         `json:"description"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	Interviewers []User         `gorm:"many2many:position_interviewers" json:"interviewers,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type PositionInterviewer struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	PositionID   uint      `gorm:"not null" json:"position_id"`
	Position     Position  `gorm:"foreignKey:PositionID" json:"-"`
	InterviewerID uint     `gorm:"not null" json:"interviewer_id"`
	Interviewer  User      `gorm:"foreignKey:InterviewerID" json:"interviewer,omitempty"`
	AssignedAt   time.Time `json:"assigned_at"`
}

type CandidatePosition struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	CandidateID    uint       `gorm:"not null" json:"candidate_id"`
	Candidate      User       `gorm:"foreignKey:CandidateID" json:"candidate,omitempty"`
	PositionID     uint       `gorm:"not null" json:"position_id"`
	Position       Position   `gorm:"foreignKey:PositionID" json:"position,omitempty"`
	QueuePosition  int        `json:"queue_position"`
	IsHighPriority bool       `json:"is_high_priority"`
	PrioritySetAt  *time.Time `json:"priority_set_at"`
	JoinedAt       time.Time  `json:"joined_at"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}