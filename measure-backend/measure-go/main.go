package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var serverConfig ServerConfig
var server Server

func main() {
	serverConfig = *NewServerConfig()

	pgDSN := os.Getenv("POSTGRES_DSN")
	if pgDSN == "" {
		log.Printf(`"POSTGRES_DSN" missing, will proceed with default "%s"`, serverConfig.pg.dsn)
	} else {
		serverConfig.pg.dsn = pgDSN
	}

	chDSN := os.Getenv("CLICKHOUSE_DSN")
	if chDSN == "" {
		log.Printf(`"CLICKHOUSE_DSN" missing, will proceed with default "%s"`, serverConfig.ch.dsn)
	} else {
		serverConfig.ch.dsn = chDSN
	}

	server = *new(Server).Configure(&serverConfig)

	defer server.pgPool.Close()
	defer server.chPool.Close()

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
	r.Use(cors).GET("/teams", authorize(), getTeams)
	r.Use(cors).GET("/teams/:id/apps", authorize(), getTeamApps)

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
