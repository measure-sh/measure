package measure

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/libs/chrono"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

type Team struct {
	ID   *uuid.UUID `json:"id"`
	Name *string    `json:"name"`
}

type Invitee struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
	Role  Rank      `json:"role"`
}

type Invite struct {
	ID              uuid.UUID `json:"id"`
	InvitedByUserId uuid.UUID `json:"invited_by_user_id"`
	InvitedByEmail  string    `json:"invited_by_email"`
	InvitedToTeamId uuid.UUID `json:"invited_to_team_id"`
	InvitedAsRole   Rank      `json:"role"`
	Email           string    `json:"email"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	ValidUntil      time.Time `json:"valid_until"`
}

type MemberAuthz struct {
	CurrentUserAssignableRolesForMember []Rank `json:"current_user_assignable_roles_for_member"`
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

const TeamInviteValidity = 7 * 24 * time.Hour // 7 days

func (t *Team) GetApps(ctx context.Context, pg *pgxpool.Pool) ([]App, error) {
	var apps []App
	stmt := sqlf.PostgreSQL.
		Select(`apps.id`, nil).
		Select(`apps.app_name`, nil).
		Select(`apps.team_id`, nil).
		Select(`apps.unique_identifier`, nil).
		Select(`apps.os_names`, nil).
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
	rows, err := pg.Query(ctx, stmt.String(), &t.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var a App
		var uniqueId pgtype.Text
		var firstVersion pgtype.Text
		var onboardedAt pgtype.Timestamptz
		var apiKeyLastSeen pgtype.Timestamptz
		var apiKeyCreatedAt pgtype.Timestamptz

		apiKey := new(APIKey)

		if err := rows.Scan(&a.ID, &a.AppName, &a.TeamId, &uniqueId, &a.OSNames, &firstVersion, &a.Onboarded, &onboardedAt, &apiKey.keyPrefix, &apiKey.keyValue, &apiKey.checksum, &apiKeyLastSeen, &apiKeyCreatedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}

		if uniqueId.Valid {
			a.UniqueId = uniqueId.String
		} else {
			a.UniqueId = ""
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

func (t *Team) GetMembers(ctx context.Context, pg *pgxpool.Pool) ([]*Member, error) {
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

	rows, err := pg.Query(ctx, stmt.String(), t.ID)
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

func (t *Team) GetName(ctx context.Context, pg *pgxpool.Pool) error {
	stmt := sqlf.PostgreSQL.From("teams").
		Select("name").
		Where("id = ?", nil)

	defer stmt.Close()

	err := pg.QueryRow(ctx, stmt.String(), t.ID).Scan(&t.Name)
	if err != nil {
		return err
	}

	return nil
}

func (t *Team) Rename(ctx context.Context, pg *pgxpool.Pool) error {
	stmt := sqlf.PostgreSQL.Update("teams").
		Set("name", nil).
		Set("updated_at", nil).
		Where("id = ?", nil)
	defer stmt.Close()

	if _, err := pg.Exec(ctx, stmt.String(), *t.Name, time.Now(), t.ID); err != nil {
		return err
	}

	return nil
}

// addInvites adds invites to invites table. It skips invitees if an
// invite already exists for that email. Returns a map of email to invite ID.
func (t *Team) AddInvites(ctx context.Context, pg *pgxpool.Pool, userId string, invitees []Invitee) (map[string]uuid.UUID, error) {
	now := time.Now()
	inviteeEmailToInviteIdMap := make(map[string]uuid.UUID)

	// Query existing invites for the given team and emails
	existingEmails := make(map[string]bool)
	stmt := sqlf.PostgreSQL.From("invites").
		Select("email").
		Where("invited_to_team_id = ?", nil)
	defer stmt.Close()

	rows, err := pg.Query(ctx, stmt.String(), t.ID)
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

	_, err = pg.Exec(ctx, stmt.String(), args...)
	if err != nil {
		return nil, err
	}

	return inviteeEmailToInviteIdMap, nil
}

func (t *Team) GetValidInvites(ctx context.Context, pg *pgxpool.Pool) ([]*Invite, error) {
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

	rows, err := pg.Query(ctx, stmt.String(), t.ID, time.Now().Add(-TeamInviteValidity))
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
		inv.InvitedAsRole = RoleMap[roleStr]
		inv.ValidUntil = inv.UpdatedAt.Add(TeamInviteValidity)

		invites = append(invites, inv)
	}

	return invites, nil
}

func (t *Team) GetInviteById(ctx context.Context, pg *pgxpool.Pool, inviteId string) (*Invite, error) {
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
	err := pg.QueryRow(ctx, stmt.String(), t.ID, inviteId).Scan(&invite.ID, &invite.InvitedByUserId, &invite.InvitedByEmail, &roleStr, &invite.Email, &invite.CreatedAt, &invite.UpdatedAt)
	if err != nil {
		return nil, err
	}
	invite.InvitedAsRole = RoleMap[roleStr]
	invite.ValidUntil = invite.UpdatedAt.Add(TeamInviteValidity)

	return invite, nil
}

// resendInvite updates invite updated_at in the invites table
func (t *Team) ResendInvite(ctx context.Context, pg *pgxpool.Pool, inviteId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("invites").
		Set("updated_at", nil).
		Where("id = ?", nil)
	defer stmt.Close()

	_, err := pg.Exec(ctx, stmt.String(), time.Now(), inviteId)
	if err != nil {
		return err
	}

	return nil
}

// removeInvite removes invite from the invites table
func (t *Team) RemoveInvite(ctx context.Context, pg *pgxpool.Pool, inviteId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("invites").
		Where("id = ?", nil)
	defer stmt.Close()

	_, err := pg.Exec(ctx, stmt.String(), inviteId)
	if err != nil {
		return err
	}

	return nil
}

// addMembers makes invitees member of the team according
// to each invitee's role.
func (t *Team) AddMembers(ctx context.Context, pg *pgxpool.Pool, invitees []Invitee) error {
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

	_, err := pg.Exec(ctx, stmt.String(), args...)
	if err != nil {
		return err
	}

	return nil
}

func (t *Team) RemoveMember(ctx context.Context, pg *pgxpool.Pool, memberId *uuid.UUID) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("team_membership").
		Where("team_id = ?", nil).
		Where("user_id = ?", nil)
	defer stmt.Close()

	_, err := pg.Exec(ctx, stmt.String(), t.ID, memberId)

	if err != nil {
		return err
	}

	return nil
}

// areInviteesMember provides the index of the invitee if that invitee
// is already a legitimate member of the team.
func (t *Team) AreInviteesMember(ctx context.Context, pg *pgxpool.Pool, invitees []Invitee) (int, error) {
	members, err := t.GetMembers(ctx, pg)
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

func (t *Team) ChangeRole(ctx context.Context, pg *pgxpool.Pool, memberId *uuid.UUID, role Rank) error {
	stmt := sqlf.PostgreSQL.Update("team_membership").
		Set("role", nil).
		Set("role_updated_at", nil).
		Where("team_id = ? and user_id = ?", nil, nil)
	defer stmt.Close()

	if _, err := pg.Exec(ctx, stmt.String(), role, time.Now(), t.ID, memberId); err != nil {
		return err
	}

	return nil
}

// create inserts a new team into database, establishes the user's membership
// with the team, and (when billing is enabled) provisions an Autumn customer
// on the Free plan — all inside the provided transaction. If Autumn is
// unreachable, the whole transaction is rolled back and team creation fails.
func (t *Team) Create(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, u *User, tx *pgx.Tx) (err error) {
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
		Set("role", RoleMap["owner"]).
		Set("role_updated_at", now).
		Set("created_at", now)

	defer stmtMembership.Close()

	_, err = (*tx).Exec(ctx, stmtMembership.String(), stmtMembership.Args()...)
	if err != nil {
		return
	}

	if billingEnabled {
		if u.Email == nil {
			if err = u.GetEmail(ctx, pg); err != nil {
				return fmt.Errorf("fetch owner email: %w", err)
			}
		}
		// An Autumn customer without an email can't receive invoices or
		// dunning notifications. Refuse rather than silently create one.
		if u.Email == nil || *u.Email == "" {
			return fmt.Errorf("owner email is required to provision billing")
		}
		teamNameStr := ""
		if t.Name != nil {
			teamNameStr = *t.Name
		}
		if _, err = ProvisionAutumnCustomer(ctx, billingEnabled, *tx, *t.ID, teamNameStr, *u.Email); err != nil {
			return fmt.Errorf("provision autumn customer: %w", err)
		}
	}

	return
}

func GetValidInvitesForEmail(ctx context.Context, pg *pgxpool.Pool, email string) ([]Invite, error) {
	stmt := sqlf.PostgreSQL.From("invites").
		Select("id").
		Select("invited_by_user_id").
		Select("invited_to_team_id").
		Select("invited_as_role").
		Select("email").
		Where("email = ?", nil).
		Where("updated_at > ?", nil)

	defer stmt.Close()

	rows, _ := pg.Query(ctx, stmt.String(), email, time.Now().Add(-TeamInviteValidity))
	invites, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Invite, error) {
		var invite Invite
		var roleStr string
		err := row.Scan(&invite.ID, &invite.InvitedByUserId, &invite.InvitedToTeamId, &roleStr, &invite.Email)

		if err == nil {
			invite.InvitedAsRole = RoleMap[roleStr]
		}
		return invite, err
	})

	return invites, err
}
