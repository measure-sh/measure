package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const queryGetTeamApps = `
select
  apps.id,
  apps.app_name,
  apps.team_id,
  apps.unique_identifier,
  apps.platform,
  apps.first_version,
  apps.latest_version,
  apps.first_seen_at,
  apps.onboarded,
  apps.onboarded_at,
  api_keys.key_prefix,
  api_keys.key_value,
  api_keys.checksum,
  api_keys.last_seen,
  api_keys.created_at,
  apps.created_at,
  apps.updated_at
from apps
left outer join api_keys on api_keys.app_id = apps.id
where apps.team_id = $1
order by apps.app_name;
`

type Team struct {
	ID   *uuid.UUID `json:"id"`
	Name *string    `json:"name"`
}

func (t *Team) getApps() ([]App, error) {
	var apps []App
	rows, err := server.PgPool.Query(context.Background(), queryGetTeamApps, &t.ID)
	if err != nil {
		return nil, err
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
		var apiKeyLastSeen pgtype.Timestamptz
		var apiKeyCreatedAt pgtype.Timestamptz

		apiKey := new(APIKey)

		if err := rows.Scan(&a.ID, &a.AppName, &a.TeamId, &uniqueId, &platform, &firstVersion, &latestVersion, &firstSeenAt, &a.Onboarded, &onboardedAt, &apiKey.keyPrefix, &apiKey.keyValue, &apiKey.checksum, &apiKeyLastSeen, &apiKeyCreatedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
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

		if apiKeyLastSeen.Valid {
			apiKey.lastSeen = apiKeyLastSeen.Time
		}

		if apiKeyCreatedAt.Valid {
			apiKey.createdAt = apiKeyCreatedAt.Time
		}

		a.APIKey = apiKey

		apps = append(apps, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return apps, nil
}

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

	var team = new(Team)
	team.ID = &teamId

	apps, err := team.getApps()
	if err != nil {
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

func getTeamApp(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	appId, err := uuid.Parse(c.Param("appId"))
	if err != nil {
		msg := `app id invalid or missing`
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

	a := NewApp(teamId)
	a, err = a.get(appId)
	if err != nil {
		msg := fmt.Sprintf("failed to fetch app: %s", appId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if a == nil {
		msg := fmt.Sprintf("no app found with id: %s", appId)
		c.JSON(http.StatusNotFound, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, &a)
}
