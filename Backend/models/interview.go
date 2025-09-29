package models

import (
	"time"

	"gorm.io/gorm"
)

type InterviewStatus string

const (
	InterviewPending    InterviewStatus = "pending"
	InterviewInProgress InterviewStatus = "in_progress"
	InterviewCompleted  InterviewStatus = "completed"
	InterviewCancelled  InterviewStatus = "cancelled"
)

type Interview struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	CandidateID   uint            `gorm:"not null" json:"candidate_id"`
	Candidate     User            `gorm:"foreignKey:CandidateID" json:"candidate,omitempty"`
	InterviewerID uint            `gorm:"not null" json:"interviewer_id"`
	Interviewer   User            `gorm:"foreignKey:InterviewerID" json:"interviewer,omitempty"`
	PositionID    uint            `gorm:"not null" json:"position_id"`
	Position      Position        `gorm:"foreignKey:PositionID" json:"position,omitempty"`
	Status        InterviewStatus `gorm:"not null" json:"status"`
	StartTime     *time.Time      `json:"start_time"`
	EndTime       *time.Time      `json:"end_time"`
	Duration      int             `json:"duration"`
	IsGroupInterview bool         `json:"is_group_interview"`
	Notes         string          `json:"notes"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	DeletedAt     gorm.DeletedAt  `gorm:"index" json:"-"`
}

type GroupInterview struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	InterviewerID uint           `gorm:"not null" json:"interviewer_id"`
	Interviewer   User           `gorm:"foreignKey:InterviewerID" json:"interviewer,omitempty"`
	PositionID    uint           `gorm:"not null" json:"position_id"`
	Position      Position       `gorm:"foreignKey:PositionID" json:"position,omitempty"`
	MaxParticipants int          `json:"max_participants"`
	Participants  []User         `gorm:"many2many:group_interview_participants" json:"participants,omitempty"`
	Status        string         `json:"status"`
	StartTime     *time.Time     `json:"start_time"`
	EndTime       *time.Time     `json:"end_time"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}