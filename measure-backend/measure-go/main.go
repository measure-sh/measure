package main

import (
	"log"
	"net/http"
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
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	// SDK routes
	r.PUT("/sessions", measure.ValidateAPIKey(), measure.PutSession)
	r.PUT("/mappings", measure.ValidateAPIKey(), measure.PutMapping)

	// Dashboard rotues
	r.Use(cors).Use(measure.ValidateAccessToken())
	apps := r.Group("/apps")
	{
		apps.GET(":id/journey", measure.GetAppJourney)
		apps.GET(":id/metrics", measure.GetAppMetrics)
		apps.GET(":id/filters", measure.GetAppFilters)
		apps.GET(":id/crashGroups", measure.GetCrashGroups)
		apps.GET(":id/anrGroups", measure.GetANRGroups)
		apps.GET(":id/crashGroups/:crashGroupId/crashes", measure.GetCrashGroupCrashes)
		apps.GET(":id/anrGroups/:anrGroupId/anrs", measure.GetANRGroupANRs)
	}

	teams := r.Group("/teams")
	{
		teams.GET("", measure.GetTeams)
		teams.GET(":id/apps", measure.GetTeamApps)
		teams.GET(":id/apps/:appId", measure.GetTeamApp)
		teams.POST(":id/apps", measure.CreateApp)
		teams.POST(":id/invite", measure.InviteMembers)
		teams.PATCH(":id/rename", measure.RenameTeam)
		teams.PATCH(":id/members/:memberId/role", measure.ChangeMemberRole)
		teams.GET(":id/authz", measure.GetAuthzRoles)
		teams.GET(":id/members", measure.GetTeamMembers)
		teams.DELETE(":id/members/:memberId", measure.RemoveTeamMember)
	}

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
