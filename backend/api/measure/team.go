package measure

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"backend/api/chrono"
	"backend/api/server"
	"backend/email"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

const maxInvitees = 25

type Team struct {
	ID   *uuid.UUID `json:"id"`
	Name *string    `json:"name"`
}

type Invitee struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
	Role  rank      `json:"role"`
}

type Invite struct {
	ID              uuid.UUID `json:"id"`
	InvitedByUserId uuid.UUID `json:"invited_by_user_id"`
	InvitedByEmail  string    `json:"invited_by_email"`
	InvitedToTeamId uuid.UUID `json:"invited_to_team_id"`
	InvitedAsRole   rank      `json:"role"`
	Email           string    `json:"email"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	ValidUntil      time.Time `json:"valid_until"`
}

type MemberAuthz struct {
	CurrentUserAssignableRolesForMember []rank `json:"current_user_assignable_roles_for_member"`
	CurrentUserCanRemoveMember          bool   `json:"current_user_can_remove_member"`
}

type Member struct {
	ID           *uuid.UUID      `json:"id"`
	Name         *string         `json:"name"`
	Email        *string         `json:"email"`
	Role         *string         `json:"role"`
	LastSignInAt *chrono.ISOTime `json:"last_sign_in_at"`
	CreatedAt    *chrono.ISOTime `json:"created_at"`
}

type MemberWithAuthz struct {
	Member
	MemberAuthz `json:"authz"`
}

const teamInviteValidity = 7 * 24 * time.Hour // 7 days

func (t *Team) getApps(ctx context.Context) ([]App, error) {
	var apps []App
	stmt := sqlf.PostgreSQL.
		Select(`apps.id`, nil).
		Select(`apps.app_name`, nil).
		Select(`apps.team_id`, nil).
		Select(`apps.unique_identifier`, nil).
		Select(`apps.os_name`, nil).
		Select(`apps.first_version`, nil).
		Select(`apps.onboarded`, nil).
		Select(`apps.onboarded_at`, nil).
		Select(`api_keys.key_prefix`, nil).
		Select(`api_keys.key_value`, nil).
		Select(`api_keys.checksum`, nil).
		Select(`api_keys.last_seen`, nil).
		Select(`api_keys.created_at`, nil).
		Select(`apps.created_at`, nil).
		Select(`apps.updated_at`, nil).
		From(`apps`).
		LeftJoin(`api_keys`, `api_keys.app_Id = apps.id and api_keys.revoked = false`).
		Where(`apps.team_id = ?`, nil).
		OrderBy(`apps.app_name`)

	defer stmt.Close()
	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), &t.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var a App
		var uniqueId pgtype.Text
		var osName pgtype.Text
		var firstVersion pgtype.Text
		var onboardedAt pgtype.Timestamptz
		var apiKeyLastSeen pgtype.Timestamptz
		var apiKeyCreatedAt pgtype.Timestamptz

		apiKey := new(APIKey)

		if err := rows.Scan(&a.ID, &a.AppName, &a.TeamId, &uniqueId, &osName, &firstVersion, &a.Onboarded, &onboardedAt, &apiKey.keyPrefix, &apiKey.keyValue, &apiKey.checksum, &apiKeyLastSeen, &apiKeyCreatedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}

		if uniqueId.Valid {
			a.UniqueId = uniqueId.String
		} else {
			a.UniqueId = ""
		}

		if osName.Valid {
			a.OSName = osName.String
		} else {
			a.OSName = ""
		}

		if firstVersion.Valid {
			a.FirstVersion = firstVersion.String
		} else {
			a.FirstVersion = ""
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

func (t *Team) getMembers(ctx context.Context) ([]*Member, error) {
	stmt := sqlf.PostgreSQL.From("team_membership tm").
		Select("tm.user_id").
		Select("users.name").
		Select("users.email").
		Select("tm.role").
		Select("users.last_sign_in_at").
		Select("users.created_at").
		LeftJoin("users", "tm.user_id = users.id").
		Where("tm.team_id = $1").
		OrderBy("tm.created_at")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), t.ID)
	if err != nil {
		return nil, err
	}

	var members []*Member

	for rows.Next() {
		m := new(Member)
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.LastSignInAt, &m.CreatedAt); err != nil {
			return nil, err
		}

		members = append(members, m)
	}

	return members, nil
}

func (t *Team) getName(ctx context.Context) error {
	stmt := sqlf.PostgreSQL.From("teams").
		Select("name").
		Where("id = ?", nil)

	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), t.ID).Scan(&t.Name)
	if err != nil {
		return err
	}

	return nil
}

func (t *Team) rename(ctx context.Context) error {
	stmt := sqlf.PostgreSQL.Update("teams").
		Set("name", nil).
		Set("updated_at", nil).
		Where("id = ?", nil)
	defer stmt.Close()

	if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), *t.Name, time.Now(), t.ID); err != nil {
		return err
	}

	return nil
}

// addInvites adds invites to invites table. It skips invitees if an
// invite already exists for that email. Returns a map of email to invite ID.
func (t *Team) addInvites(ctx context.Context, userId string, invitees []Invitee) (map[string]uuid.UUID, error) {
	now := time.Now()
	inviteeEmailToInviteIdMap := make(map[string]uuid.UUID)

	// Query existing invites for the given team and emails
	existingEmails := make(map[string]bool)
	stmt := sqlf.PostgreSQL.From("invites").
		Select("email").
		Where("invited_to_team_id = ?", nil)
	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), t.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err != nil {
			return nil, err
		}
		existingEmails[email] = true
	}

	// Filter out invitees who already have invites and generate IDs
	stmt = sqlf.PostgreSQL.InsertInto("invites")
	defer stmt.Close()
	var args []any
	for _, invitee := range invitees {
		if existingEmails[invitee.Email] {
			continue
		}
		inviteId := uuid.New()
		inviteeEmailToInviteIdMap[invitee.Email] = inviteId

		stmt.NewRow().
			Set("id", nil).
			Set("invited_by_user_id", nil).
			Set("invited_to_team_id", nil).
			Set("invited_as_role", nil).
			Set("email", nil).
			Set("created_at", nil).
			Set("updated_at", nil)
		args = append(args, inviteId, userId, t.ID, invitee.Role.String(), invitee.Email, now, now)
	}

	if len(args) == 0 {
		// No new invites to add
		return nil, errors.New("already invited")
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), args...)
	if err != nil {
		return nil, err
	}

	return inviteeEmailToInviteIdMap, nil
}

func (t *Team) getValidInvites(ctx context.Context) ([]*Invite, error) {
	stmt := sqlf.PostgreSQL.From("invites inv").
		Select("inv.id").
		Select("inv.invited_by_user_id").
		Select("users.email").
		Select("inv.invited_as_role").
		Select("inv.email").
		Select("inv.created_at").
		Select("inv.updated_at").
		LeftJoin("users", "invited_by_user_id = users.id").
		Where("inv.invited_to_team_id = ?", nil).
		Where("inv.updated_at > ?", nil)

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), t.ID, time.Now().Add(-teamInviteValidity))
	if err != nil {
		return nil, err
	}

	var invites []*Invite

	for rows.Next() {
		inv := new(Invite)
		var roleStr string
		if err := rows.Scan(&inv.ID, &inv.InvitedByUserId, &inv.InvitedByEmail, &roleStr, &inv.Email, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
			return nil, err
		}
		inv.InvitedAsRole = roleMap[roleStr]
		inv.ValidUntil = inv.UpdatedAt.Add(teamInviteValidity)

		invites = append(invites, inv)
	}

	return invites, nil
}

func (t *Team) getInviteById(ctx context.Context, inviteId string) (*Invite, error) {
	stmt := sqlf.PostgreSQL.From("invites inv").
		Select("inv.id").
		Select("inv.invited_by_user_id").
		Select("users.email").
		Select("inv.invited_as_role").
		Select("inv.email").
		Select("inv.created_at").
		Select("inv.updated_at").
		LeftJoin("users", "invited_by_user_id = users.id").
		Where("inv.invited_to_team_id = ?", nil).
		Where("inv.id = ?", nil)

	defer stmt.Close()

	invite := new(Invite)
	var roleStr string
	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), t.ID, inviteId).Scan(&invite.ID, &invite.InvitedByUserId, &invite.InvitedByEmail, &roleStr, &invite.Email, &invite.CreatedAt, &invite.UpdatedAt)
	if err != nil {
		return nil, err
	}
	invite.InvitedAsRole = roleMap[roleStr]
	invite.ValidUntil = invite.UpdatedAt.Add(teamInviteValidity)

	return invite, nil
}

// resendInvite updates invite updated_at in the invites table
func (t *Team) resendInvite(ctx context.Context, inviteId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("invites").
		Set("updated_at", nil).
		Where("id = ?", nil)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), time.Now(), inviteId)
	if err != nil {
		return err
	}

	return nil
}

// removeInvite removes invite from the invites table
func (t *Team) removeInvite(ctx context.Context, inviteId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("invites").
		Where("id = ?", nil)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), inviteId)
	if err != nil {
		return err
	}

	return nil
}

// addMembers makes invitees member of the team according
// to each invitee's role.
func (t *Team) addMembers(ctx context.Context, invitees []Invitee) error {
	now := time.Now()
	stmt := sqlf.PostgreSQL.InsertInto("team_membership")
	defer stmt.Close()
	var args []any
	for _, invitee := range invitees {
		stmt.NewRow().
			Set("team_id", nil).
			Set("user_id", nil).
			Set("role", nil).
			Set("role_updated_at", nil).
			Set("created_at", nil)
		args = append(args, t.ID, invitee.ID, invitee.Role, now, now)
	}

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), args...)
	if err != nil {
		return err
	}

	return nil
}

func (t *Team) removeMember(ctx context.Context, memberId *uuid.UUID) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("team_membership").
		Where("team_id = ?", nil).
		Where("user_id = ?", nil)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), t.ID, memberId)

	if err != nil {
		return err
	}

	return nil
}

// areInviteesMember provides the index of the invitee if that invitee
// is already a legitimate member of the team.
func (t *Team) areInviteesMember(ctx context.Context, invitees []Invitee) (int, error) {
	members, err := t.getMembers(ctx)
	if err != nil {
		return -1, err
	}

	for i, invitee := range invitees {
		for _, member := range members {
			if strings.EqualFold(*member.Email, invitee.Email) {
				return i, nil
			}
		}
	}

	return -1, nil
}

func (t *Team) changeRole(ctx context.Context, memberId *uuid.UUID, role rank) error {
	stmt := sqlf.PostgreSQL.Update("team_membership").
		Set("role", nil).
		Set("role_updated_at", nil).
		Where("team_id = ? and user_id = ?", nil, nil)
	defer stmt.Close()

	if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), role, time.Now(), t.ID, memberId); err != nil {
		return err
	}

	return nil
}

// create inserts a new team into database and establishes
// user's membership with the team along with a free plan billing config.
func (t *Team) create(ctx context.Context, u *User, tx *pgx.Tx) (err error) {
	id := uuid.New()
	t.ID = &id
	now := time.Now()

	stmtTeam := sqlf.PostgreSQL.
		InsertInto("teams").
		Set("id", t.ID).
		Set("name", t.Name).
		Set("created_at", now).
		Set("updated_at", now)

	defer stmtTeam.Close()

	_, err = (*tx).Exec(ctx, stmtTeam.String(), stmtTeam.Args()...)
	if err != nil {
		return
	}

	stmtMembership := sqlf.PostgreSQL.
		InsertInto("team_membership").
		Set("team_id", t.ID).
		Set("user_id", u.ID).
		Set("role", roleMap["owner"]).
		Set("role_updated_at", now).
		Set("created_at", now)

	defer stmtMembership.Close()

	_, err = (*tx).Exec(ctx, stmtMembership.String(), stmtMembership.Args()...)
	if err != nil {
		return
	}

	stmtTeamBilling := sqlf.PostgreSQL.
		InsertInto("measure.team_billing").
		Set("team_id", t.ID).
		Set("plan", "free").
		Set("created_at", now).
		Set("updated_at", now)

	defer stmtTeamBilling.Close()

	_, err = (*tx).Exec(ctx, stmtTeamBilling.String(), stmtTeamBilling.Args()...)

	return
}

func CreateTeam(c *gin.Context) {
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	u := &User{
		ID: &userId,
	}

	ownTeam, err := u.getOwnTeam(ctx)
	if err != nil {
		msg := "failed to lookup user's team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if ownTeam == nil {
		// use does not have team
		msg := fmt.Sprintf("no associated team for user %q", *u.ID)
		fmt.Println(msg)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	newTeam := &Team{}

	if err := c.ShouldBindJSON(newTeam); err != nil {
		msg := "failed to parse create team request body"
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err})
		return
	}

	// trim team name value
	*newTeam.Name = strings.Trim(*newTeam.Name, " ")

	if *newTeam.Name == "" {
		msg := "team name cannot be empty"
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, ownTeam.ID.String(), *ScopeTeamAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := "you don't have permissions to create new teams"
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	msg := "failed to create team"
	tx, err := server.Server.PgPool.Begin(ctx)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	defer tx.Rollback(ctx)

	if err := newTeam.create(ctx, u, &tx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, newTeam)
}

func GetTeams(c *gin.Context) {
	userId := c.GetString("userId")
	u := &User{
		ID: &userId,
	}

	teams, err := u.getTeams()
	if err != nil {
		msg := "failed to fetch teams for user"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(teams) < 1 {
		msg := `no teams found`
		fmt.Println(msg)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, teams)
}

func GetTeamApps(c *gin.Context) {
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

	apps, err := team.getApps(c.Request.Context())
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

func GetTeamApp(c *gin.Context) {
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
	a, err = a.getWithTeam(appId)
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

// GetValidInvitesForEmail retrieves valid invites for a given email address
func GetValidInvitesForEmail(ctx context.Context, email string) ([]Invite, error) {
	stmt := sqlf.PostgreSQL.From("invites").
		Select("id").
		Select("invited_by_user_id").
		Select("invited_to_team_id").
		Select("invited_as_role").
		Select("email").
		Where("email = ?", nil).
		Where("updated_at > ?", nil)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), email, time.Now().Add(-teamInviteValidity))
	invites, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Invite, error) {
		var invite Invite
		var roleStr string
		err := row.Scan(&invite.ID, &invite.InvitedByUserId, &invite.InvitedToTeamId, &roleStr, &invite.Email)

		if err == nil {
			invite.InvitedAsRole = roleMap[roleStr]
		}
		return invite, err
	})

	return invites, err
}

func InviteMembers(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
	var invitees []Invitee

	if err := c.ShouldBindJSON(&invitees); err != nil {
		msg := "failed to parse invite payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if len(invitees) < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "need at least 1 invitee",
		})
		return
	}

	if len(invitees) > maxInvitees {
		msg := fmt.Sprintf("cannot invite more than %d invitee(s)", maxInvitees)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamInviteSameOrLower)
	if err != nil {
		// FIXME: improve error handling, this is quite brittle way of
		// doing errors. not ideal.
		if err.Error() == "received 'unknown' role" {
			msg := `couldn't find team, perhaps team id is invalid`
			fmt.Println(msg)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to invite in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	user := &User{
		ID: &userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if userRole == unknown {
		msg := `couldn't find team, perhaps team id is invalid`
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	var inviteeRoles []rank
	for _, r := range invitees {
		inviteeRoles = append(inviteeRoles, r.Role)
	}
	maxInviteeRole := slices.Max(inviteeRoles)

	if maxInviteeRole > userRole {
		msg := fmt.Sprintf(`you don't have permissions to invite in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	team := Team{
		ID: &teamId,
	}

	idx, err := team.areInviteesMember(c.Request.Context(), invitees)
	if err != nil {
		msg := `failed to check if invitees are already members of the team`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if idx > -1 {
		email := invitees[idx].Email
		msg := fmt.Sprintf("invitee '%s' is already a member of this team", email)
		c.JSON(http.StatusConflict, gin.H{
			"error": msg,
		})
		return
	}

	existingInvitees, newInvitees, err := GetExistingAndNewInvitees(invitees)
	if err != nil {
		msg := `failed to fetch existing and new invitees`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	err = team.getName(c.Request.Context())
	if err != nil {
		msg := `failed to fetch team name. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	err = user.getEmail(c.Request.Context())
	if err != nil {
		msg := `failed to fetch user email. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	// Handle existing invitees
	if len(existingInvitees) > 0 {
		if err := team.addMembers(c.Request.Context(), existingInvitees); err != nil {
			msg := `failed to add existing invitees to team`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		// Send emails to exisiting invitees
		for _, invitee := range existingInvitees {
			subject, body := email.AddedToTeamEmail(*team.Name, invitee.Role.String(), *user.Email, server.Server.Config.SiteOrigin, teamId.String())

			email.SendEmail(server.Server.Mail, email.EmailInfo{
				From:        server.Server.Config.TxEmailAddress,
				To:          invitee.Email,
				Subject:     subject,
				ContentType: "text/html",
				Body:        body,
			})
		}
	}

	// Handle new invitees
	if len(newInvitees) > 0 {
		inviteeEmailToInviteIdMap, err := team.addInvites(c.Request.Context(), userId, newInvitees)
		if err != nil {
			msg := `failed to create invites for new users: `
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg + ": " + err.Error(),
			})
			return
		}

		// Send emails to new invitees
		for _, invitee := range newInvitees {
			inviteId, ok := inviteeEmailToInviteIdMap[invitee.Email]
			if !ok {
				fmt.Printf("Warning: invite ID not found for %s\n", invitee.Email)
				continue
			}

			days := int(teamInviteValidity.Hours() / 24)
			subject, body := email.InviteNewUserEmail(*user.Email, invitee.Role.String(), *team.Name, days, server.Server.Config.SiteOrigin, inviteId.String())

			email.SendEmail(server.Server.Mail, email.EmailInfo{
				From:        server.Server.Config.TxEmailAddress,
				To:          invitee.Email,
				Subject:     subject,
				ContentType: "text/html",
				Body:        body,
			})
		}
	}

	existingInvitedEmails := []string{}
	newInvitedEmails := []string{}
	for i := range existingInvitees {
		existingInvitedEmails = append(existingInvitedEmails, existingInvitees[i].Email)
	}
	for i := range newInvitees {
		newInvitedEmails = append(newInvitedEmails, newInvitees[i].Email)
	}
	existingEmails := strings.Join(existingInvitedEmails, ", ")
	newEmails := strings.Join(newInvitedEmails, ", ")

	if len(existingInvitees) > 0 && len(newInvitees) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"ok": fmt.Sprintf("Added %s and invited %s", existingEmails, newEmails),
		})
	} else if len(existingInvitees) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"ok": fmt.Sprintf("Added %s", existingEmails),
		})
	} else if len(newInvitees) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"ok": fmt.Sprintf("Invited %s", newEmails),
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"ok": "No users were added or invited",
		})
	}
}

func GetValidTeamInvites(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	user := &User{
		ID: &userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole == unknown {
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

	team := &Team{
		ID: &teamId,
	}

	invites, err := team.getValidInvites(c.Request.Context())
	if err != nil {
		msg := "failed to query invites"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, invites)
}

func ResendInvite(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
	inviteId, err := uuid.Parse(c.Param("inviteId"))
	if err != nil {
		msg := `invite id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	user := &User{
		ID: &userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if userRole == unknown {
		msg := `couldn't find team, perhaps team id is invalid`
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamInviteSameOrLower)
	if err != nil {
		// FIXME: improve error handling, this is quite brittle way of
		// doing errors. not ideal.
		if err.Error() == "received 'unknown' role" {
			msg := `couldn't find team, perhaps team id is invalid`
			fmt.Println(msg)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to resend invites in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	team := Team{
		ID: &teamId,
	}

	// check if user role can resend invite
	invite, err := team.getInviteById(c.Request.Context(), inviteId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if invite.InvitedAsRole == unknown {
		msg := "couldn't perform authorization checks: 'invited as role' unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < invite.InvitedAsRole {
		msg := fmt.Sprintf("you don't have permissions to resend invite [%s] in team [%s]", inviteId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	err = team.resendInvite(c.Request.Context(), inviteId)
	if err != nil {
		msg := "failed to resend invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	err = team.getName(c.Request.Context())
	if err != nil {
		msg := `failed to fetch team name. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	err = user.getEmail(c.Request.Context())
	if err != nil {
		msg := `failed to fetch user email. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	subject, body := email.InviteExistingUserEmail(*user.Email, invite.InvitedAsRole.String(), *team.Name, server.Server.Config.SiteOrigin)

	email.SendEmail(server.Server.Mail, email.EmailInfo{
		From:        server.Server.Config.TxEmailAddress,
		To:          invite.Email,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	})

	c.JSON(http.StatusOK, gin.H{
		"ok": fmt.Sprintf("Resent invite %s", inviteId),
	})
}

func RemoveInvite(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
	inviteId, err := uuid.Parse(c.Param("inviteId"))
	if err != nil {
		msg := `invite id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	user := &User{
		ID: &userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if userRole == unknown {
		msg := `couldn't find team, perhaps team id is invalid`
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamInviteSameOrLower)
	if err != nil {
		// FIXME: improve error handling, this is quite brittle way of
		// doing errors. not ideal.
		if err.Error() == "received 'unknown' role" {
			msg := `couldn't find team, perhaps team id is invalid`
			fmt.Println(msg)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to revoke invites in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	team := Team{
		ID: &teamId,
	}

	ctx := c.Request.Context()

	// check if user role can remove invite
	invite, err := team.getInviteById(ctx, inviteId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if invite.InvitedAsRole == unknown {
		msg := "couldn't perform authorization checks: 'invited as role' unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < invite.InvitedAsRole {
		msg := fmt.Sprintf("you don't have permissions to remove invite [%s] in team [%s]", inviteId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	err = team.removeInvite(ctx, inviteId)
	if err != nil {
		msg := "failed to remove invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": fmt.Sprintf("Removed invite %s", inviteId),
	})
}

func RenameTeam(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	user := &User{
		ID: &userId,
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

	if err := team.rename(c.Request.Context()); err != nil {
		msg := "failed to rename team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "team was renamed"})
}

func GetTeamMembers(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	user := &User{
		ID: &userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole == unknown {
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

	team := &Team{
		ID: &teamId,
	}

	members, err := team.getMembers(c.Request.Context())
	if err != nil {
		msg := "failed to query team members"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, members)
}

func RemoveTeamMember(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	memberId, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		msg := `member id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	memberIdStr := memberId.String()

	user := &User{
		ID: &userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole == unknown {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamChangeRoleSameOrLower)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have modify permissions to team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	team := &Team{
		ID: &teamId,
	}

	memberUser := &User{
		ID: &memberIdStr,
	}

	// check if user role can remove member
	memberRole, err := memberUser.getRole(teamId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch member role"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if memberRole == unknown {
		msg := "couldn't perform authorization checks: member role unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < memberRole {
		msg := fmt.Sprintf("you don't have permissions to remove member [%s] from team [%s]", memberId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	// check if member is being removed from their default team
	memberOwnTeam, err := memberUser.getOwnTeam(c.Request.Context())
	if err != nil {
		msg := "couldn't perform authorization checks: failed to lookup member's default team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if memberOwnTeam.ID != nil && *memberOwnTeam.ID == teamId {
		msg := fmt.Sprintf("member [%s] cannot be removed from their default team [%s]", memberId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if err = team.removeMember(c.Request.Context(), &memberId); err != nil {
		msg := fmt.Sprintf("couldn't remove member [%s]", memberId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = team.getName(c.Request.Context())
	if err != nil {
		msg := `failed to fetch team name. Unable to send email for removed member`
		fmt.Println(msg, err)
	}

	err = user.getEmail(c.Request.Context())
	if err != nil {
		msg := `failed to fetch user email. Unable to send email for removed member`
		fmt.Println(msg, err)
	}

	err = memberUser.getEmail(c.Request.Context())
	if err != nil {
		msg := `failed to fetch member email. Unable to send email for removed member`
		fmt.Println(msg, err)
	}

	subject, body := email.RemovedFromTeamEmail(*team.Name, *user.Email, server.Server.Config.SiteOrigin, memberOwnTeam.ID.String())

	email.SendEmail(server.Server.Mail, email.EmailInfo{
		From:        server.Server.Config.TxEmailAddress,
		To:          *memberUser.Email,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	})

	c.JSON(http.StatusOK, gin.H{"ok": fmt.Sprintf("removed member [%s] from team [%s]", memberId, teamId)})
}

func ChangeMemberRole(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	memberId, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		msg := `member id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	memberIdStr := memberId.String()

	user := &User{
		ID: &userId,
	}

	userRole, err := user.getRole(teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole == unknown {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamChangeRoleSameOrLower)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have modify permissions to team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	member := &Member{
		ID: &memberId,
	}

	if err := c.ShouldBindJSON(&member); err != nil {
		msg := `failed to parse payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if role := roleMap[*member.Role]; !role.Valid() {
		msg := fmt.Sprintf("role [%s] is not valid", *member.Role)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	team := &Team{
		ID: &teamId,
	}

	memberUser := &User{
		ID: &memberIdStr,
	}

	// check if user role can change member role
	memberRole, err := memberUser.getRole(teamId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch member role"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if memberRole == unknown {
		msg := "couldn't perform authorization checks: member role unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < memberRole {
		msg := fmt.Sprintf("you don't have permissions to change role of member [%s] in team [%s]", memberId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	// check if member role is being changed in default team
	memberOwnTeam, err := memberUser.getOwnTeam(c)
	if err != nil {
		msg := "couldn't perform authorization checks: failed to lookup member's default team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if memberOwnTeam.ID != nil && *memberOwnTeam.ID == teamId {
		msg := fmt.Sprintf("cannot change role of member [%s] in their default team [%s]", memberId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if err := team.changeRole(c.Request.Context(), &memberId, roleMap[*member.Role]); err != nil {
		msg := `failed to change role`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = team.getName(c.Request.Context())
	if err != nil {
		msg := `failed to fetch team name. Unable to send email for role changed member`
		fmt.Println(msg, err)
	}

	err = user.getEmail(c.Request.Context())
	if err != nil {
		msg := `failed to fetch user email. Unable to send email for role changed member`
		fmt.Println(msg, err)
	}

	err = memberUser.getEmail(c.Request.Context())
	if err != nil {
		msg := `failed to fetch member email. Unable to send email for role changed member`
		fmt.Println(msg, err)
	}

	subject, body := email.RoleChangedEmail(*member.Role, *user.Email, *team.Name, server.Server.Config.SiteOrigin, team.ID.String())

	email.SendEmail(server.Server.Mail, email.EmailInfo{
		From:        server.Server.Config.TxEmailAddress,
		To:          *memberUser.Email,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	})

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}
