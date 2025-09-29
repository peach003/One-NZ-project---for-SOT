package routes

import (
	"interview-system/config"
	"interview-system/handlers"
	"interview-system/middleware"
	"interview-system/services"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func SetupRoutes(r *gin.Engine, db *gorm.DB, redisClient *redis.Client, wsHub *services.WebSocketHub) {
	cfg := config.Load()

	authService := services.NewAuthService(db, &cfg.JWT)
	queueService := services.NewQueueService(db, wsHub)

	authHandler := handlers.NewAuthHandler(authService, db)
	queueHandler := handlers.NewQueueHandler(queueService, db)
	positionHandler := handlers.NewPositionHandler(db)
	interviewHandler := handlers.NewInterviewHandler(db, wsHub)
	adminHandler := handlers.NewAdminHandler(db, redisClient)
	wsHandler := handlers.NewWebSocketHandler(wsHub, authService)

	api := r.Group("/api")
	{
		api.POST("/login", authHandler.Login)
		api.POST("/register", authHandler.Register)
		api.GET("/activity/status", adminHandler.GetPublicActivityStatus)

		api.GET("/ws", wsHandler.HandleWebSocket)

		authenticated := api.Group("/")
		authenticated.Use(middleware.AuthMiddleware(authService))
		{
			authenticated.GET("/profile", authHandler.GetProfile)
			authenticated.POST("/logout", authHandler.Logout)

			candidate := authenticated.Group("/candidate")
			candidate.Use(middleware.RoleMiddleware("candidate"))
			{
				candidate.GET("/positions", positionHandler.GetAvailablePositions)
				candidate.POST("/queue/join", queueHandler.JoinQueue)
				candidate.POST("/queue/priority", queueHandler.SetHighPriority)
				candidate.GET("/queue/status", queueHandler.GetMyQueues)
				candidate.POST("/queue/leave", queueHandler.LeaveQueue)
				candidate.POST("/queue/delay", queueHandler.RequestDelay)
				candidate.GET("/queue/jumpahead", queueHandler.CheckJumpAhead)
				candidate.GET("/queue/conflicts", queueHandler.CheckConflicts)
				candidate.GET("/queue/optimization", queueHandler.CheckQueueOptimization)
				candidate.POST("/queue/optimize", queueHandler.ApplyQueueOptimization)
			}

			interviewer := authenticated.Group("/interviewer")
			interviewer.Use(middleware.RoleMiddleware("interviewer"))
			{
				interviewer.GET("/queue", interviewHandler.GetInterviewQueue)
				interviewer.POST("/interview/start", interviewHandler.StartInterview)
				interviewer.POST("/interview/end", interviewHandler.EndInterview)
				interviewer.GET("/interview/current", interviewHandler.GetCurrentInterview)
				interviewer.POST("/group/initiate", interviewHandler.InitiateGroupInterview)
				interviewer.GET("/stats", interviewHandler.GetInterviewerStats)
			}

			controlAdmin := authenticated.Group("/admin")
			controlAdmin.Use(middleware.RoleMiddleware("control_admin"))
			{
				controlAdmin.GET("/activity", adminHandler.GetActivityControl)
				controlAdmin.PUT("/activity", adminHandler.UpdateActivityControl)
				controlAdmin.POST("/activity/start", adminHandler.StartActivity)
				controlAdmin.POST("/activity/end", adminHandler.EndActivity)
				controlAdmin.GET("/dashboard", adminHandler.GetDashboard)
				controlAdmin.GET("/stats", adminHandler.GetStatistics)
				controlAdmin.POST("/users/import", adminHandler.ImportUsers)
				controlAdmin.GET("/logs", adminHandler.GetSystemLogs)
			}

			companyAdmin := authenticated.Group("/company")
			companyAdmin.Use(middleware.RoleMiddleware("company_admin"))
			{
				companyAdmin.GET("/positions", positionHandler.GetCompanyPositions)
				companyAdmin.POST("/positions", positionHandler.CreatePosition)
				companyAdmin.PUT("/positions/:id", positionHandler.UpdatePosition)
				companyAdmin.DELETE("/positions/:id", positionHandler.DeletePosition)
				companyAdmin.GET("/interviewers", interviewHandler.GetCompanyInterviewers)
				companyAdmin.POST("/interviewers", interviewHandler.CreateInterviewer)
				companyAdmin.PUT("/interviewers/:id", interviewHandler.UpdateInterviewer)
				companyAdmin.POST("/positions/:id/assign", positionHandler.AssignInterviewer)
				companyAdmin.POST("/positions/:id/unassign", positionHandler.UnassignInterviewer)
				companyAdmin.GET("/candidates", adminHandler.GetCompanyCandidates)
				companyAdmin.GET("/stats", adminHandler.GetCompanyStats)
			}
		}
	}
}