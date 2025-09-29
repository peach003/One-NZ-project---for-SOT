package database

import (
	"fmt"
	"interview-system/config"
	"interview-system/models"
	"log"

	"github.com/redis/go-redis/v9"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Initialize(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := db.AutoMigrate(
		&models.Company{},
		&models.User{},
		&models.LoginRecord{},
		&models.Position{},
		&models.PositionInterviewer{},
		&models.CandidatePosition{},
		&models.Interview{},
		&models.GroupInterview{},
		&models.QueueEntry{},
		&models.QueueOptimization{},
		&models.ActivityControl{},
	); err != nil {
		return nil, fmt.Errorf("failed to auto migrate: %w", err)
	}

	seedData(db)

	log.Println("Database initialized successfully")
	return db, nil
}

func InitializeRedis(cfg config.RedisConfig) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	log.Println("Redis client initialized successfully")
	return client
}

func seedData(db *gorm.DB) {
	var companyCount int64
	db.Model(&models.Company{}).Count(&companyCount)
	if companyCount == 0 {
		companies := []models.Company{
			{Name: "Tencent", Code: "TC", IsActive: true},
			{Name: "ByteDance", Code: "BD", IsActive: true},
			{Name: "Alibaba", Code: "ALB", IsActive: true},
		}
		db.Create(&companies)
		log.Println("Seeded company data")
	}

	var adminCount int64
	db.Model(&models.User{}).Where("role = ?", models.RoleControlAdmin).Count(&adminCount)
	if adminCount == 0 {
		admin := models.User{
			Account:  "admin",
			Password: "$2a$10$YKxVKFNPHrW7VzWgZK2nYuSMbNORzqFrCZedvQxG7pVe5RrJxJiGa",
			Name:     "System Administrator",
			Role:     models.RoleControlAdmin,
			IsActive: true,
		}
		db.Create(&admin)
		log.Println("Created default admin user (password: admin123)")
	}

	var activityCount int64
	db.Model(&models.ActivityControl{}).Count(&activityCount)
	if activityCount == 0 {
		activity := models.ActivityControl{
			ActiveQueueLimit:     6,
			HighPriorityQuota:    2,
			AverageInterviewTime: 8,
			BufferTime:           5,
			GroupInterviewMaxSize: 4,
			Status:               "pending",
		}
		db.Create(&activity)
		log.Println("Created default activity control settings")
	}
}