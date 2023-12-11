package main

import (
	"log"
	"os"
	"time"

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
	r.PUT("/sessions", authorize(), putSession)
	r.PUT("/mappings", authorize(), putMapping)

	// dashboard routes
	r.Use(cors).GET("/apps/:id/journey", authorize(), getAppJourney)
	r.Use(cors).GET("/apps/:id/metrics", authorize(), getAppMetrics)
	r.Use(cors).GET("/apps/:id/filters", authorize(), getAppFilters)
	r.Use(cors).GET("/teams", validateAccessToken(), getTeams)
	r.Use(cors).GET("/teams/:id/apps", validateAccessToken(), getTeamApps)
	r.Use(cors).GET("/teams/:id/apps/:appId", validateAccessToken(), getTeamApp)
	r.Use(cors).POST("/teams/:id/apps", validateAccessToken(), createApp)
	r.Use(cors).POST("/teams/:id/invite", validateAccessToken(), inviteMembers)
	r.Use(cors).PATCH("/teams/:id/rename", validateAccessToken(), renameTeam)
	r.Use(cors).PATCH("/teams/:id/members/:memberId/role", validateAccessToken(), changeMemberRole)
	r.Use(cors).GET("/teams/:id/authz", validateAccessToken(), getAuthzRoles)
	r.Use(cors).GET("/teams/:id/members", validateAccessToken(), getTeamMembers)
	r.Use(cors).DELETE("/teams/:id/members/:memberId", validateAccessToken(), removeTeamMember)

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
