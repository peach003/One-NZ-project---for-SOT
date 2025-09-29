package handlers

import "github.com/google/uuid"

func init() {
	// Ensure uuid package is available
	_ = uuid.New()
}