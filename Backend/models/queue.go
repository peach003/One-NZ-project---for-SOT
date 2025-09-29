package models

import (
	"time"
)

type QueueEntry struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	CandidateID      uint      `gorm:"not null" json:"candidate_id"`
	Candidate        User      `gorm:"foreignKey:CandidateID" json:"candidate,omitempty"`
	PositionID       uint      `gorm:"not null" json:"position_id"`
	Position         Position  `gorm:"foreignKey:PositionID" json:"position,omitempty"`
	QueuePosition    int       `json:"queue_position"`
	IsHighPriority   bool      `json:"is_high_priority"`
	PrioritySetTime  *time.Time `json:"priority_set_time"`
	JoinTime         time.Time `json:"join_time"`
	EstimatedTime    *time.Time `json:"estimated_time"`
	IsActive         bool      `json:"is_active"`
	Status           string    `json:"status"`
	JumpAheadUsed    bool      `json:"jump_ahead_used"`
	DelayUsed        int       `json:"delay_used"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type QueueOptimization struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	CandidateID uint      `gorm:"not null" json:"candidate_id"`
	Candidate   User      `gorm:"foreignKey:CandidateID" json:"-"`
	Type        string    `json:"type"`
	Details     string    `json:"details"`
	Result      string    `json:"result"`
	CreatedAt   time.Time `json:"created_at"`
}

type ActivityControl struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	StartTime            time.Time `json:"start_time"`
	EndTime              time.Time `json:"end_time"`
	Status               string    `json:"status"`
	ActiveQueueLimit     int       `json:"active_queue_limit"`
	HighPriorityQuota    int       `json:"high_priority_quota"`
	AverageInterviewTime int       `json:"average_interview_time"`
	BufferTime           int       `json:"buffer_time"`
	GroupInterviewMaxSize int      `json:"group_interview_max_size"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}