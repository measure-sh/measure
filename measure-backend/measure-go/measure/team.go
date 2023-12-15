package measure

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

const (
	maxInvitees      = 25
	queryGetTeamApps = `
select
  apps.id,
  apps.app_name,
  apps.team_id,
  apps.unique_identifier,
  apps.platform,
  apps.first_version,
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

type MemberAuthz struct {
	CanChangeRoles []rank `json:"can_change_roles"`
	CanRemove      bool   `json:"can_remove"`
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

func (t *Team) getApps() ([]App, error) {
	var apps []App
	rows, err := server.Server.PgPool.Query(context.Background(), queryGetTeamApps, &t.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var a App
		var uniqueId pgtype.Text
		var platform pgtype.Text
		var firstVersion pgtype.Text
		var onboardedAt pgtype.Timestamptz
		var apiKeyLastSeen pgtype.Timestamptz
		var apiKeyCreatedAt pgtype.Timestamptz

		apiKey := new(APIKey)

		if err := rows.Scan(&a.ID, &a.AppName, &a.TeamId, &uniqueId, &platform, &firstVersion, &a.Onboarded, &onboardedAt, &apiKey.keyPrefix, &apiKey.keyValue, &apiKey.checksum, &apiKeyLastSeen, &apiKeyCreatedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
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

func (t *Team) getMembers() ([]*Member, error) {
	ctx := context.Background()
	stmt := sqlf.PostgreSQL.From("public.team_membership tm").
		Select("tm.user_id").
		Select("auth.users.raw_user_meta_data->>'name' as name").
		Select("auth.users.email").
		Select("tm.role").
		Select("auth.users.last_sign_in_at").
		Select("auth.users.created_at").
		LeftJoin("auth.users", "tm.user_id = auth.users.id").
		Where("tm.team_id = $1")

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

func (t *Team) rename() error {
	stmt := sqlf.PostgreSQL.Update("teams").
		Set("name", nil).
		Set("updated_at", nil).
		Where("id = ?", nil)
	defer stmt.Close()

	ctx := context.Background()
	if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), *t.Name, time.Now(), t.ID); err != nil {
		return err
	}

	return nil
}

// addMembers makes invitees member of the team according
// to each invitee's role.
func (t *Team) addMembers(invitees []Invitee) error {
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

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), args...)
	if err != nil {
		return err
	}

	return nil
}

func (t *Team) removeMember(memberId *uuid.UUID) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("team_membership").
		Where("team_id = ?", nil).
		Where("user_id = ?", nil)
	defer stmt.Close()

	ctx := context.Background()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), t.ID, memberId)

	if err != nil {
		return err
	}

	return nil
}

// areInviteesMember provides the index of the invitee if that invitee
// is already a legitimate member of the team.
func (t *Team) areInviteesMember(invitees []Invitee) (int, error) {
	members, err := t.getMembers()
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

func (t *Team) changeRole(memberId *uuid.UUID, role rank) error {
	stmt := sqlf.PostgreSQL.Update("team_membership").
		Set("role", nil).
		Set("role_updated_at", nil).
		Where("team_id = ? and user_id = ?", nil, nil)
	defer stmt.Close()

	fmt.Println("stmt", stmt.String())

	ctx := context.Background()

	if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), role, time.Now(), t.ID, memberId); err != nil {
		return err
	}

	return nil
}

func GetTeams(c *gin.Context) {
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

func InviteMembers(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
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
		// FIXME: improve error handling, this is quite brittle way of
		// doing errors. not ideal.
		if err.Error() == "received 'unknown' role" {
			msg := `couldn't find team, perhaps team id is invalid`
			fmt.Println(msg)
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
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
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole == unknown {
		msg := `couldn't find team, perhaps team id is invalid`
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
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

	team := Team{
		ID: &teamId,
	}

	idx, err := team.areInviteesMember(invitees)
	if err != nil {
		msg := `failed to invite`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if idx > -1 {
		email := invitees[idx].Email
		msg := fmt.Sprintf("invitee '%s' is already a member of this team", email)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	existingUsers, newInvitees, err := GetUsersByInvitees(invitees)
	if err != nil {
		msg := `failed to invite`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(existingUsers) > 0 {
		if err := team.addMembers(existingUsers); err != nil {
			msg := `failed to invite existing users`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}
	}

	var newEmails []string

	for _, invitee := range newInvitees {
		newEmails = append(newEmails, invitee.Email)
	}

	c.JSON(http.StatusOK, gin.H{"ok": "invitee(s) authorized", "emails": newEmails})
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

func GetAuthzRoles(c *gin.Context) {
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

	team := Team{
		ID: &teamId,
	}

	members, err := team.getMembers()
	if err != nil {
		msg := `failed to retrieve team members`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	var membersWithAuthz []MemberWithAuthz

	for _, member := range members {
		var memberWithAuthz MemberWithAuthz
		memberWithAuthz.Member = *member
		memberRole := roleMap[*member.Role]
		if userRole >= memberRole {
			canChangeRoles := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(userRole)
			memberWithAuthz.CanChangeRoles = canChangeRoles
			if len(canChangeRoles) > 0 {
				memberWithAuthz.CanRemove = true
			}
		}

		membersWithAuthz = append(membersWithAuthz, memberWithAuthz)
	}

	inviteeRoles := ScopeTeamInviteSameOrLower.getRolesSameOrLower(userRole)

	c.JSON(http.StatusOK, gin.H{"can_invite": inviteeRoles, "members": membersWithAuthz})
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

	team := &Team{
		ID: &teamId,
	}

	members, err := team.getMembers()
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

	if err = team.removeMember(&memberId); err != nil {
		msg := fmt.Sprintf("couldn't remove member [%s]", memberId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

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

	if err := team.changeRole(&memberId, roleMap[*member.Role]); err != nil {
		msg := `failed to change role`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}
