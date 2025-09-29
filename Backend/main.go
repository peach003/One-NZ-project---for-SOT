package main

import (
	"interview-system/config"
	"interview-system/database"
	"interview-system/middleware"
	"interview-system/routes"
	"interview-system/services"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := database.Initialize(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	redisClient := database.InitializeRedis(cfg.Redis)

	wsHub := services.NewWebSocketHub()
	go wsHub.Run()

	r := gin.Default()

	r.Use(middleware.CORS())
	r.Use(middleware.RequestLogger())

	routes.SetupRoutes(r, db, redisClient, wsHub)

	log.Printf("Server starting on port %s", cfg.Server.Port)
	if err := r.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}