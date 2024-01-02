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

	// dashboard routes
	r.Use(cors).GET("/apps/:id/journey", measure.ValidateAccessToken(), measure.GetAppJourney)
	r.Use(cors).GET("/apps/:id/metrics", measure.ValidateAccessToken(), measure.GetAppMetrics)
	r.Use(cors).GET("/apps/:id/filters", measure.ValidateAccessToken(), measure.GetAppFilters)
	r.Use(cors).GET("/apps/:id/filters/crashes", measure.ValidateAccessToken(), measure.GetCrashFilters)
	r.Use(cors).GET("/apps/:id/filters/anrs", measure.ValidateAccessToken(), measure.GetANRFilters)
	r.Use(cors).GET("/apps/:id/filters/crashGroups/:crashGroupId", measure.ValidateAccessToken(), measure.GetCrashGroupFilters)
	r.Use(cors).GET("/apps/:id/crashGroups", measure.ValidateAccessToken(), measure.GetCrashGroups)
	r.Use(cors).GET("/apps/:id/anrGroups", measure.ValidateAccessToken(), measure.GetANRGroups)
	r.Use(cors).GET("/teams", measure.ValidateAccessToken(), measure.GetTeams)
	r.Use(cors).GET("/teams/:id/apps", measure.ValidateAccessToken(), measure.GetTeamApps)
	r.Use(cors).GET("/teams/:id/apps/:appId", measure.ValidateAccessToken(), measure.GetTeamApp)
	r.Use(cors).POST("/teams/:id/apps", measure.ValidateAccessToken(), measure.CreateApp)
	r.Use(cors).POST("/teams/:id/invite", measure.ValidateAccessToken(), measure.InviteMembers)
	r.Use(cors).PATCH("/teams/:id/rename", measure.ValidateAccessToken(), measure.RenameTeam)
	r.Use(cors).PATCH("/teams/:id/members/:memberId/role", measure.ValidateAccessToken(), measure.ChangeMemberRole)
	r.Use(cors).GET("/teams/:id/authz", measure.ValidateAccessToken(), measure.GetAuthzRoles)
	r.Use(cors).GET("/teams/:id/members", measure.ValidateAccessToken(), measure.GetTeamMembers)
	r.Use(cors).DELETE("/teams/:id/members/:memberId", measure.ValidateAccessToken(), measure.RemoveTeamMember)

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
