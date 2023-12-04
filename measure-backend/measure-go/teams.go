package main

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"time"

	"measure-backend/measure-go/cipher"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

const (
	defaultInviteExpiry = 24 * time.Hour
	maxInvitees         = 25
	queryGetTeamApps    = `
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
)

type Team struct {
	ID   *uuid.UUID `json:"id"`
	Name *string    `json:"name"`
}

type Invitee struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
	Role  rank      `json:"role"`
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

func (t *Team) invite(userId string, invitees []Invitee) ([]Invitee, error) {
	expiresAt := time.Now().Add(defaultInviteExpiry)
	stmt := sqlf.PostgreSQL.InsertInto("team_invitations")
	defer stmt.Close()

	ctx := context.Background()

	var args []any

	for _, invitee := range invitees {
		code, err := cipher.InviteCode()
		if err != nil {
			fmt.Println("failed to generate invite code", err)
			return nil, err
		}

		stmt.
			NewRow().
			Set("team_id", nil).
			Set("user_id", nil).
			Set("email", nil).
			Set("role", nil).
			Set("code", nil).
			Set("invite_expires_at", nil)

		args = append(args, t.ID, userId, invitee.Email, invitee.Role.String(), code, expiresAt)
	}

	stmt.Returning("id")

	rows, _ := server.PgPool.Query(ctx, stmt.String(), args...)
	ids, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (uuid.UUID, error) {
		var id uuid.UUID
		err := row.Scan(&id)
		return id, err
	})

	if err != nil {
		fmt.Println("err collecting rows", err)
		return nil, err
	}

	for idx, id := range ids {
		invitees[idx].ID = id
	}

	return invitees, nil
}

func (t *Team) rename() error {
	stmt := sqlf.PostgreSQL.Update("teams").
		Set("name", nil).
		Set("updated_at", nil).
		Where("id = ?", nil)
	defer stmt.Close()

	ctx := context.Background()
	if _, err := server.PgPool.Exec(ctx, stmt.String(), *t.Name, time.Now(), t.ID); err != nil {
		return err
	}

	return nil
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

func inviteMembers(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	// team := &Team{
	// 	ID: &teamId,
	// }
	var invitees []Invitee

	if err := c.ShouldBindJSON(&invitees); err != nil {
		msg := "failed to parse invite payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if len(invitees) < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "need at least 1 invitee"})
		return
	}

	if len(invitees) > maxInvitees {
		msg := fmt.Sprintf("cannot invite more than %d invitee(s)", maxInvitees)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamInviteSameOrLower)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to invite in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}
	user := &User{
		id: userId,
	}
	userRole, err := user.getRole(teamId.String())
	if err != nil || userRole == unknown {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	var inviteeRoles []rank
	for _, r := range invitees {
		inviteeRoles = append(inviteeRoles, r.Role)
	}
	maxInviteeRole := slices.Max(inviteeRoles)

	if maxInviteeRole > userRole {
		msg := fmt.Sprintf(`you don't have permissions to invite in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	// invitees, err = team.invite(userId, invitees)

	// if err != nil {
	// 	msg := "failed to invite"
	// 	fmt.Println(msg, err)
	// 	c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
	// 	return
	// }

	// c.JSON(http.StatusCreated, invitees)
	c.JSON(http.StatusOK, gin.H{"ok": "invitee(s) authorized"})
}

func renameTeam(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	user := &User{
		id: userId,
	}

	userRole, err := user.getRole(teamId.String())

	if err != nil || userRole == unknown {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to rename team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var team = new(Team)
	team.ID = &teamId

	if err := c.ShouldBindJSON(&team); err != nil {
		msg := "failed to parse invite payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if err := team.rename(); err != nil {
		msg := "failed to rename team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "team was renamed"})
}

func getScopes(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	user := &User{
		id: userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if err != nil || userRole == unknown {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have read permissions to team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	// prepare roles for team invites
	inviteRoles := ScopeTeamAll.getRoles()
	inviteSameOrLowerRoles := ScopeTeamInviteSameOrLower.getRoles()
	allInviteeRoles := append(inviteRoles, inviteSameOrLowerRoles...)
	var inviteeRoles []rank
	for _, role := range allInviteeRoles {
		if role <= userRole {
			inviteeRoles = append(inviteeRoles, role)
		}
	}
	sort.Slice(inviteeRoles, func(i, j int) bool {
		return inviteeRoles[i] > inviteeRoles[j]
	})

	// preapre roles for team change roles
	changeRoles := ScopeTeamAll.getRoles()
	changeRoleSameOrLowerRoles := ScopeTeamChangeRoleSameOrLower.getRoles()
	allChangeRoleRoles := append(changeRoles, changeRoleSameOrLowerRoles...)
	var changeRoleRoles []rank
	for _, role := range allChangeRoleRoles {
		if role <= userRole {
			changeRoleRoles = append(changeRoleRoles, role)
		}
	}
	sort.Slice(changeRoleRoles, func(i, j int) bool {
		return changeRoleRoles[i] > changeRoleRoles[j]
	})

	c.JSON(http.StatusOK, gin.H{"can_invite": inviteeRoles, "can_change_roles": changeRoleRoles})
}
