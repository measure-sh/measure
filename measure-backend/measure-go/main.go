package main

import (
	"log"
	"os"
	"time"

	srv "measure-backend/measure-go/server"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var serverConfig srv.ServerConfig
var server srv.Server

func main() {
	serverConfig = *srv.NewServerConfig()

	pgDSN := os.Getenv("POSTGRES_DSN")
	if pgDSN == "" {
		log.Printf(`"POSTGRES_DSN" missing, will proceed with default "%s"`, serverConfig.PG.DSN)
	} else {
		serverConfig.PG.DSN = pgDSN
	}

	chDSN := os.Getenv("CLICKHOUSE_DSN")
	if chDSN == "" {
		log.Printf(`"CLICKHOUSE_DSN" missing, will proceed with default "%s"`, serverConfig.CH.DSN)
	} else {
		serverConfig.CH.DSN = chDSN
	}

	server = *new(srv.Server).Configure(&serverConfig)

	defer server.PgPool.Close()
	defer server.ChPool.Close()

	r := gin.Default()
	cors := cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://www.measure.sh"},
		AllowMethods:     []string{"GET", "OPTIONS"},
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
	r.Use(cors).GET("/teams/:id/authz", validateAccessToken(), getScopes)

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
