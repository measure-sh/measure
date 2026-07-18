package measure

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

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
// to each invitee's role. An invitee who is already a member is skipped and
// keeps their current role.
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
	stmt.Clause("on conflict (team_id, user_id) do nothing")

	_, err := pg.Exec(ctx, stmt.String(), args...)
	if err != nil {
		return err
	}

	return nil
}

// ErrLastOwner is returned when a removal or role change would leave a team
// with no owner. An ownerless team could never regain one: only owners can
// assign the owner role.
var ErrLastOwner = errors.New("team must have at least one owner")

// lockTeamForMembershipChange takes a write lock on the team row and holds
// it until the transaction ends. Membership changes take this lock first so
// that, for any one team, they run one at a time. Without it, two requests
// removing a team's two owners at once would each still see the other owner
// present, pass the last-owner check, and leave the team with no owner.
func lockTeamForMembershipChange(ctx context.Context, tx pgx.Tx, teamId *uuid.UUID) error {
	stmt := sqlf.PostgreSQL.
		Select("1").
		From("teams").
		Where("id = ?", teamId).
		Clause("FOR UPDATE")
	defer stmt.Close()

	_, err := tx.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// memberRoleInTeam reads a member's current role. Call with the team row
// locked so the value stays authoritative for the rest of the transaction.
func memberRoleInTeam(ctx context.Context, tx pgx.Tx, teamId, memberId *uuid.UUID) (role string, err error) {
	stmt := sqlf.PostgreSQL.
		Select("role").
		From("team_membership").
		Where("team_id = ?", teamId).
		Where("user_id = ?", memberId)
	defer stmt.Close()

	err = tx.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&role)
	return
}

// otherOwnerExists reports whether the team has an owner other than the
// given member. Call with the team row locked.
func otherOwnerExists(ctx context.Context, tx pgx.Tx, teamId, memberId *uuid.UUID) (bool, error) {
	stmt := sqlf.PostgreSQL.
		Select("count(*)").
		From("team_membership").
		Where("team_id = ?", teamId).
		Where("user_id != ?", memberId).
		Where("role = ?", "owner")
	defer stmt.Close()

	var count int
	if err := tx.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

// RemoveMember deletes a member's team membership. Removing the only owner
// of a team is rejected with ErrLastOwner.
func (t *Team) RemoveMember(ctx context.Context, pg *pgxpool.Pool, memberId *uuid.UUID) error {
	tx, err := pg.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := lockTeamForMembershipChange(ctx, tx, t.ID); err != nil {
		return err
	}

	role, err := memberRoleInTeam(ctx, tx, t.ID, memberId)
	if errors.Is(err, pgx.ErrNoRows) {
		// Already not a member, e.g. a concurrent removal won the race.
		// Treat as done so the operation stays idempotent.
		return nil
	}
	if err != nil {
		return err
	}

	if role == "owner" {
		hasOther, err := otherOwnerExists(ctx, tx, t.ID, memberId)
		if err != nil {
			return err
		}
		if !hasOther {
			return ErrLastOwner
		}
	}

	stmt := sqlf.PostgreSQL.DeleteFrom("team_membership").
		Where("team_id = ?", t.ID).
		Where("user_id = ?", memberId)
	defer stmt.Close()

	if _, err := tx.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return err
	}

	return tx.Commit(ctx)
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

// ChangeRole updates a member's role. Moving the only owner of a team to a
// lower role is rejected with ErrLastOwner.
func (t *Team) ChangeRole(ctx context.Context, pg *pgxpool.Pool, memberId *uuid.UUID, role Rank) error {
	tx, err := pg.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := lockTeamForMembershipChange(ctx, tx, t.ID); err != nil {
		return err
	}

	current, err := memberRoleInTeam(ctx, tx, t.ID, memberId)
	if errors.Is(err, pgx.ErrNoRows) {
		// Membership vanished under a concurrent change; nothing to update.
		return nil
	}
	if err != nil {
		return err
	}

	if current == "owner" && role != owner {
		hasOther, err := otherOwnerExists(ctx, tx, t.ID, memberId)
		if err != nil {
			return err
		}
		if !hasOther {
			return ErrLastOwner
		}
	}

	stmt := sqlf.PostgreSQL.Update("team_membership").
		Set("role", role).
		Set("role_updated_at", time.Now()).
		Where("team_id = ?", t.ID).
		Where("user_id = ?", memberId)
	defer stmt.Close()

	if _, err := tx.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return err
	}

	return tx.Commit(ctx)
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

// isAlphanumeric reports whether s consists only of letters and digits.
func isAlphanumeric(s string) bool {
	return !strings.ContainsFunc(s, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
}

// personalTeamName names a user's personal team: "<first name>'s team",
// falling back to the leading part of the email address when OAuth gave us
// no display name (anup@measure.sh becomes "Anup's team"), then to a
// generic name when there is no email or its leading part contains
// anything other than letters and digits.
func personalTeamName(u *User) string {
	if u.Name != nil {
		if first := u.FirstName(); first != "" {
			return fmt.Sprintf("%s's team", first)
		}
	}
	if u.Email != nil {
		if local, _, found := strings.Cut(*u.Email, "@"); found {
			if i := strings.IndexAny(local, ".+_-"); i >= 0 {
				local = local[:i]
			}
			if local != "" && isAlphanumeric(local) {
				r, size := utf8.DecodeRuneInString(local)
				return fmt.Sprintf("%s's team", string(unicode.ToUpper(r))+local[size:])
			}
		}
	}
	return "Personal team"
}

// CreatePersonalTeam creates the "<first name>'s team" a user owns, in its
// own transaction, and fires the team-created analytics event. Called at
// signup, and via EnsureDefaultTeam for a user who no longer has any team.
func CreatePersonalTeam(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, u *User) (*Team, error) {
	if u.Name == nil || u.Email == nil {
		if err := u.GetUserDetails(ctx, pg); err != nil {
			return nil, fmt.Errorf("fetch user details: %w", err)
		}
	}

	tx, err := pg.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	team, err := createPersonalTeamTx(ctx, pg, billingEnabled, u, &tx)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	FireTeamCreatedEvent(ctx, u, team)

	return team, nil
}

// createPersonalTeamTx creates the personal team inside the caller's
// transaction; the caller commits and fires the analytics event. u.Name and
// u.Email must be loaded before calling: this function runs inside the
// caller's transaction and must not query the pool.
func createPersonalTeamTx(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, u *User, tx *pgx.Tx) (*Team, error) {
	teamName := personalTeamName(u)
	team := &Team{
		Name: &teamName,
	}

	if err := team.Create(ctx, pg, billingEnabled, u, tx); err != nil {
		return nil, err
	}

	return team, nil
}

// teamProvisionLockClass is the first key of the two-key advisory lock
// around personal-team creation; the second key is a hash of the user id.
// All advisory locks in a database draw from one shared set of numbers, so
// this fixed first key keeps our per-user locks from ever matching a lock
// some other feature takes. The value itself is arbitrary; it encodes the
// ASCII letters "msmt" (measure team), and when inspecting pg_locks it
// appears in the classid column as 1836281204, identifying us as the owner.
const teamProvisionLockClass int32 = 0x6d736d74

// EnsureDefaultTeam returns the user's default team, creating a personal
// team first when the user has no team memberships at all, for example
// after being removed from every team they belonged to. Sign-in and session
// flows rely on every user resolving to some team.
func EnsureDefaultTeam(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, u *User) (*Team, error) {
	team, err := u.GetDefaultTeam(ctx, pg)
	if err == nil {
		return team, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	// The user has no team, so create one. Two requests for the same user
	// can reach this point at the same time (for example two browser tabs),
	// and each would create its own team and Autumn customer. The advisory
	// lock below prevents that by making requests take turns: the first
	// proceeds, the rest wait until it finishes.

	// fetched before Begin so the transaction below never needs a pool query
	if u.Name == nil || u.Email == nil {
		if err := u.GetUserDetails(ctx, pg); err != nil {
			return nil, fmt.Errorf("fetch user details: %w", err)
		}
	}

	// This transaction holds one pool connection until it ends, and every
	// request waiting for the lock holds one of its own. All database access
	// until the commit must therefore run on tx, not pg: if the pool were
	// empty, a query through pg would wait for a free connection while the
	// requests holding them wait for this one to finish.
	tx, err := pg.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	stmt := sqlf.PostgreSQL.
		Select("pg_advisory_xact_lock(?::int4, hashtext(?))", teamProvisionLockClass, u.ID)
	defer stmt.Close()

	if _, err := tx.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return nil, err
	}

	// While this request waited for the lock, another request may have
	// already created the team. Its work is committed by the time the lock
	// frees, so this check finds that team and returns it instead of
	// creating a second one.
	team, err = defaultTeam(ctx, tx, u.ID)
	if err == nil {
		return team, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	team, err = createPersonalTeamTx(ctx, pg, billingEnabled, u, &tx)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	FireTeamCreatedEvent(ctx, u, team)

	return team, nil
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
