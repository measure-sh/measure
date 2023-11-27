package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func getTeams(c *gin.Context) {
	userId := c.GetString("userId")
	u := &User{
		id: userId,
	}

	teams, err := u.getTeams()
	if err != nil {
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch teams for user"})
		return
	}

	c.JSON(http.StatusOK, teams)
}

func getTeamApps(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeAppRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var apps []App

	rows, err := server.PgPool.Query(context.Background(), "select id, app_name, team_id, unique_identifier, platform, first_version, latest_version, first_seen_at, onboarded, onboarded_at, created_at, updated_at from apps where team_id = $1 order by app_name;", teamId)

	if err != nil {
		msg := "failed to execute app list read query"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	defer rows.Close()

	for rows.Next() {
		var a App
		var uniqueId pgtype.Text
		var platform pgtype.Text
		var firstVersion pgtype.Text
		var latestVersion pgtype.Text
		var firstSeenAt pgtype.Timestamptz
		var onboardedAt pgtype.Timestamptz

		if err := rows.Scan(&a.ID, &a.AppName, &a.TeamId, &uniqueId, &platform, &firstVersion, &latestVersion, &firstSeenAt, &a.Onboarded, &onboardedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			msg := "unable to scan app rows"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		if uniqueId.Valid {
			a.UniqueId = uniqueId.String
		} else {
			a.UniqueId = ""
		}

		if platform.Valid {
			a.Platform = platform.String
		} else {
			a.Platform = ""
		}

		if firstVersion.Valid {
			a.firstVersion = firstVersion.String
		} else {
			a.firstVersion = ""
		}

		if latestVersion.Valid {
			a.latestVersion = latestVersion.String
		} else {
			a.latestVersion = ""
		}

		if firstSeenAt.Valid {
			a.firstSeenAt = firstSeenAt.Time
		}

		if onboardedAt.Valid {
			a.OnboardedAt = onboardedAt.Time
		}
		apps = append(apps, a)
	}
	if err := rows.Err(); err != nil {
		msg := fmt.Sprintf("error occurred while querying apps list for team: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(apps) < 1 {
		msg := fmt.Sprintf("no apps exists under team: %s", teamId)
		c.JSON(http.StatusNotFound, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, apps)
}
