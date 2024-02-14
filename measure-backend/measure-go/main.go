package main

import (
	"log"
	"os"
	"time"

	"measure-backend/measure-go/measure"
	"measure-backend/measure-go/server"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	config := server.NewConfig()

	pgDSN := os.Getenv("POSTGRES_DSN")
	if pgDSN == "" {
		log.Printf(`"POSTGRES_DSN" missing, will proceed with default "%s"`, config.PG.DSN)
	} else {
		config.PG.DSN = pgDSN
	}

	chDSN := os.Getenv("CLICKHOUSE_DSN")
	if chDSN == "" {
		log.Printf(`"CLICKHOUSE_DSN" missing, will proceed with default "%s"`, config.CH.DSN)
	} else {
		config.CH.DSN = chDSN
	}

	server.Init(config)

	defer server.Server.PgPool.Close()
	defer server.Server.ChPool.Close()

	r := gin.Default()
	cors := cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://www.measure.sh"},
		AllowMethods:     []string{"GET", "OPTIONS", "PATCH", "DELETE"},
		AllowHeaders:     []string{"Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	// SDK routes
	r.PUT("/sessions", measure.ValidateAPIKey(), measure.PutSession)
	r.PUT("/mappings", measure.ValidateAPIKey(), measure.PutMapping)

	dashboard := r.Group("/")
	dashboard.Use(cors).Use(measure.ValidateAccessToken())

	// dashboard routes
	dashboard.GET("/apps/:id/journey", measure.GetAppJourney)
	dashboard.GET("/apps/:id/metrics", measure.GetAppMetrics)
	dashboard.GET("/apps/:id/filters", measure.GetAppFilters)
	dashboard.GET("/apps/:id/crashGroups", measure.GetCrashGroups)
	dashboard.GET("/apps/:id/anrGroups", measure.GetANRGroups)
	dashboard.GET("/apps/:id/crashGroups/:crashGroupId/crashes", measure.GetCrashGroupCrashes)
	dashboard.GET("/apps/:id/anrGroups/:anrGroupId/anrs", measure.GetANRGroupANRs)
	dashboard.GET("/teams", measure.GetTeams)
	dashboard.GET("/teams/:id/apps", measure.GetTeamApps)
	dashboard.GET("/teams/:id/apps/:appId", measure.GetTeamApp)
	dashboard.POST("/teams/:id/apps", measure.CreateApp)
	dashboard.POST("/teams/:id/invite", measure.InviteMembers)
	dashboard.PATCH("/teams/:id/rename", measure.RenameTeam)
	dashboard.PATCH("/teams/:id/members/:memberId/role", measure.ChangeMemberRole)
	dashboard.GET("/teams/:id/authz", measure.GetAuthzRoles)
	dashboard.GET("/teams/:id/members", measure.GetTeamMembers)
	dashboard.DELETE("/teams/:id/members/:memberId", measure.RemoveTeamMember)

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
