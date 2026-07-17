//go:build integration

package measure

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// getMembershipRole returns the member's role in a team, or "" when the
// membership row does not exist.
func getMembershipRole(ctx context.Context, t *testing.T, teamID uuid.UUID, userID string) string {
	t.Helper()
	var role string
	err := th.PgPool.QueryRow(ctx,
		`SELECT role FROM team_membership WHERE team_id = $1 AND user_id = $2`, teamID, userID).Scan(&role)
	if err != nil {
		return ""
	}
	return role
}

// setUserName sets users.name, which SeedUser leaves NULL.
func setUserName(ctx context.Context, t *testing.T, userID, name string) {
	t.Helper()
	if _, err := th.PgPool.Exec(ctx, `UPDATE users SET name = $1 WHERE id = $2`, name, userID); err != nil {
		t.Fatalf("set user name: %v", err)
	}
}

func TestRemoveMember(t *testing.T) {
	ctx := context.Background()

	t.Run("removing the last owner returns ErrLastOwner", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		ownerID := uuid.New().String()
		viewerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		seedUser(ctx, t, viewerID, "viewer@example.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		seedTeamMembership(ctx, t, teamID, viewerID, "viewer")

		team := &Team{ID: &teamID}
		memberID := uuid.MustParse(ownerID)
		err := team.RemoveMember(ctx, deps.PgPool, &memberID)
		if !errors.Is(err, ErrLastOwner) {
			t.Fatalf("err = %v, want ErrLastOwner", err)
		}
		if role := getMembershipRole(ctx, t, teamID, ownerID); role != "owner" {
			t.Errorf("owner membership = %q, want intact", role)
		}
	})

	t.Run("removing an owner succeeds when another owner remains", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		firstOwnerID := uuid.New().String()
		secondOwnerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, firstOwnerID, "first-owner@example.com")
		seedUser(ctx, t, secondOwnerID, "second-owner@example.com")
		seedTeamMembership(ctx, t, teamID, firstOwnerID, "owner")
		seedTeamMembership(ctx, t, teamID, secondOwnerID, "owner")

		team := &Team{ID: &teamID}
		memberID := uuid.MustParse(firstOwnerID)
		if err := team.RemoveMember(ctx, deps.PgPool, &memberID); err != nil {
			t.Fatalf("RemoveMember: %v", err)
		}
		if role := getMembershipRole(ctx, t, teamID, firstOwnerID); role != "" {
			t.Errorf("membership still present with role %q, want removed", role)
		}
	})

	t.Run("removing a non-owner member succeeds with a sole owner", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		ownerID := uuid.New().String()
		devID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		seedUser(ctx, t, devID, "dev@example.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		seedTeamMembership(ctx, t, teamID, devID, "developer")

		team := &Team{ID: &teamID}
		memberID := uuid.MustParse(devID)
		if err := team.RemoveMember(ctx, deps.PgPool, &memberID); err != nil {
			t.Fatalf("RemoveMember: %v", err)
		}
		if role := getMembershipRole(ctx, t, teamID, devID); role != "" {
			t.Errorf("membership still present with role %q, want removed", role)
		}
	})

	t.Run("removing a non-member is an idempotent no-op", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		ownerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")

		// stands in for a member a concurrent request already removed
		stranger := uuid.New()
		team := &Team{ID: &teamID}
		if err := team.RemoveMember(ctx, deps.PgPool, &stranger); err != nil {
			t.Fatalf("RemoveMember on non-member: %v, want nil", err)
		}
		if role := getMembershipRole(ctx, t, teamID, ownerID); role != "owner" {
			t.Errorf("owner membership = %q, want intact", role)
		}
	})
}

func TestChangeRole(t *testing.T) {
	ctx := context.Background()

	t.Run("demoting the last owner returns ErrLastOwner", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		ownerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")

		team := &Team{ID: &teamID}
		memberID := uuid.MustParse(ownerID)
		err := team.ChangeRole(ctx, deps.PgPool, &memberID, RoleMap["admin"])
		if !errors.Is(err, ErrLastOwner) {
			t.Fatalf("err = %v, want ErrLastOwner", err)
		}
		if role := getMembershipRole(ctx, t, teamID, ownerID); role != "owner" {
			t.Errorf("role = %q, want owner", role)
		}
	})

	t.Run("keeping the last owner at owner succeeds", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		ownerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")

		team := &Team{ID: &teamID}
		memberID := uuid.MustParse(ownerID)
		if err := team.ChangeRole(ctx, deps.PgPool, &memberID, RoleMap["owner"]); err != nil {
			t.Fatalf("ChangeRole: %v", err)
		}
		if role := getMembershipRole(ctx, t, teamID, ownerID); role != "owner" {
			t.Errorf("role = %q, want owner", role)
		}
	})

	t.Run("demoting a co-owner succeeds when another owner remains", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		firstOwnerID := uuid.New().String()
		secondOwnerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, firstOwnerID, "first-owner@example.com")
		seedUser(ctx, t, secondOwnerID, "second-owner@example.com")
		seedTeamMembership(ctx, t, teamID, firstOwnerID, "owner")
		seedTeamMembership(ctx, t, teamID, secondOwnerID, "owner")

		team := &Team{ID: &teamID}
		memberID := uuid.MustParse(firstOwnerID)
		if err := team.ChangeRole(ctx, deps.PgPool, &memberID, RoleMap["viewer"]); err != nil {
			t.Fatalf("ChangeRole: %v", err)
		}
		if role := getMembershipRole(ctx, t, teamID, firstOwnerID); role != "viewer" {
			t.Errorf("role = %q, want viewer", role)
		}
	})

	t.Run("changing the role of a non-member is an idempotent no-op", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		ownerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")

		stranger := uuid.New()
		team := &Team{ID: &teamID}
		if err := team.ChangeRole(ctx, deps.PgPool, &stranger, RoleMap["admin"]); err != nil {
			t.Fatalf("ChangeRole on non-member: %v, want nil", err)
		}
	})
}

func TestCreatePersonalTeam(t *testing.T) {
	ctx := context.Background()

	t.Run("names the team after the user's first name", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "ada@example.com")
		setUserName(ctx, t, userID, "Ada Lovelace")

		team, err := CreatePersonalTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), &User{ID: &userID})
		if err != nil {
			t.Fatalf("CreatePersonalTeam: %v", err)
		}
		if team.Name == nil || *team.Name != "Ada's team" {
			t.Errorf("team name = %v, want Ada's team", team.Name)
		}
		if role := getMembershipRole(ctx, t, *team.ID, userID); role != "owner" {
			t.Errorf("role = %q, want owner", role)
		}
		if id := getTeamAutumnCustomerID(ctx, t, *team.ID); id == nil || *id == "" {
			t.Error("autumn customer not provisioned")
		}
	})

	t.Run("derives the name from the email when the user has no name", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "john.doe+work@example.com")

		team, err := CreatePersonalTeam(ctx, deps.PgPool, false, &User{ID: &userID})
		if err != nil {
			t.Fatalf("CreatePersonalTeam: %v", err)
		}
		if team.Name == nil || *team.Name != "John's team" {
			t.Errorf("team name = %v, want John's team", team.Name)
		}
	})

	t.Run("email-derived names", func(t *testing.T) {
		empty := ""
		cases := []struct {
			email string
			want  string
		}{
			{"anup@measure.sh", "Anup's team"},
			{"john.doe@example.com", "John's team"},
			{"mary_jane@example.com", "Mary's team"},
			{"jean-pierre@example.com", "Jean's team"},
			{"dev+staging@example.com", "Dev's team"},
			{"josé@example.com", "José's team"},
			{`"john doe"@example.com`, "Personal team"},
			{"notanemail", "Personal team"},
			{"@example.com", "Personal team"},
			{"", "Personal team"},
		}
		for _, c := range cases {
			email := c.email
			if got := personalTeamName(&User{Name: &empty, Email: &email}); got != c.want {
				t.Errorf("personalTeamName(%q) = %q, want %q", c.email, got, c.want)
			}
		}
		if got := personalTeamName(&User{}); got != "Personal team" {
			t.Errorf("personalTeamName with nil fields = %q, want Personal team", got)
		}
	})
}

func TestGetDefaultTeam(t *testing.T) {
	ctx := context.Background()

	t.Run("returns ErrNoRows when the user has no memberships", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "orphan@example.com")

		_, err := (&User{ID: &userID}).GetDefaultTeam(ctx, deps.PgPool)
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Fatalf("err = %v, want pgx.ErrNoRows", err)
		}
	})
}

func TestEnsureDefaultTeam(t *testing.T) {
	ctx := context.Background()

	t.Run("prefers an owned team over an earlier membership", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "member@example.com")

		memberTeamID := uuid.New()
		seedTeam(ctx, t, memberTeamID, "someone-elses-team")
		ownedTeamID := uuid.New()
		seedTeam(ctx, t, ownedTeamID, "owned-team")

		now := time.Now()
		seedMembershipAt(ctx, t, memberTeamID.String(), userID, "viewer", now.Add(-24*time.Hour))
		seedMembershipAt(ctx, t, ownedTeamID.String(), userID, "owner", now)

		team, err := EnsureDefaultTeam(ctx, deps.PgPool, false, &User{ID: &userID})
		if err != nil {
			t.Fatalf("EnsureDefaultTeam: %v", err)
		}
		if team.ID == nil || *team.ID != ownedTeamID {
			t.Errorf("default team = %v, want owned team %v", team.ID, ownedTeamID)
		}
	})

	t.Run("falls back to a membership team when the user owns none", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "member@example.com")

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "someone-elses-team")
		seedTeamMembership(ctx, t, teamID, userID, "viewer")

		team, err := EnsureDefaultTeam(ctx, deps.PgPool, false, &User{ID: &userID})
		if err != nil {
			t.Fatalf("EnsureDefaultTeam: %v", err)
		}
		if team.ID == nil || *team.ID != teamID {
			t.Errorf("default team = %v, want membership team %v", team.ID, teamID)
		}
	})

	t.Run("creates a personal team when the user has no memberships", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "orphan@example.com")

		team, err := EnsureDefaultTeam(ctx, deps.PgPool, false, &User{ID: &userID})
		if err != nil {
			t.Fatalf("EnsureDefaultTeam: %v", err)
		}
		if team.ID == nil {
			t.Fatal("EnsureDefaultTeam returned team without id")
		}
		if role := getMembershipRole(ctx, t, *team.ID, userID); role != "owner" {
			t.Errorf("role in created team = %q, want owner", role)
		}
	})

	t.Run("concurrent calls for a teamless user create exactly one team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "racer@example.com")

		const callers = 8
		teamIDs := make([]uuid.UUID, callers)
		errs := make([]error, callers)

		var wg sync.WaitGroup
		for i := range callers {
			wg.Add(1)
			go func() {
				defer wg.Done()
				team, err := EnsureDefaultTeam(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), &User{ID: &userID})
				if err != nil {
					errs[i] = err
					return
				}
				teamIDs[i] = *team.ID
			}()
		}
		wg.Wait()

		for i, err := range errs {
			if err != nil {
				t.Fatalf("caller %d: %v", i, err)
			}
		}
		for i, id := range teamIDs {
			if id != teamIDs[0] {
				t.Errorf("caller %d got team %v, want %v (all callers must agree)", i, id, teamIDs[0])
			}
		}

		var memberships int
		if err := th.PgPool.QueryRow(ctx,
			`SELECT count(*) FROM team_membership WHERE user_id = $1`, userID).Scan(&memberships); err != nil {
			t.Fatalf("count memberships: %v", err)
		}
		if memberships != 1 {
			t.Errorf("memberships = %d, want exactly 1 team created", memberships)
		}
	})
}

// --------------------------------------------------------------------------
// Helpers for invite and team assertions
// --------------------------------------------------------------------------

// seedInviteAt inserts an invites row with an explicit updated_at so tests
// can control invite validity (valid = updated_at within TeamInviteValidity).
func seedInviteAt(ctx context.Context, t *testing.T, inviteID, teamID uuid.UUID, byUserID, role, email string, updatedAt time.Time) {
	t.Helper()
	_, err := th.PgPool.Exec(ctx,
		`INSERT INTO invites (id, invited_by_user_id, invited_to_team_id, invited_as_role, email, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		inviteID, byUserID, teamID, role, email, updatedAt)
	if err != nil {
		t.Fatalf("seed invite: %v", err)
	}
}

func countTeamInvites(ctx context.Context, t *testing.T, teamID uuid.UUID) int {
	t.Helper()
	var count int
	if err := th.PgPool.QueryRow(ctx,
		`SELECT count(*) FROM invites WHERE invited_to_team_id = $1`, teamID).Scan(&count); err != nil {
		t.Fatalf("count invites: %v", err)
	}
	return count
}

func getInviteUpdatedAt(ctx context.Context, t *testing.T, inviteID uuid.UUID) time.Time {
	t.Helper()
	var updatedAt time.Time
	if err := th.PgPool.QueryRow(ctx,
		`SELECT updated_at FROM invites WHERE id = $1`, inviteID).Scan(&updatedAt); err != nil {
		t.Fatalf("get invite updated_at: %v", err)
	}
	return updatedAt
}

func readTeamName(ctx context.Context, t *testing.T, teamID uuid.UUID) string {
	t.Helper()
	var name string
	if err := th.PgPool.QueryRow(ctx,
		`SELECT name FROM teams WHERE id = $1`, teamID).Scan(&name); err != nil {
		t.Fatalf("read team name: %v", err)
	}
	return name
}

// --------------------------------------------------------------------------
// GetApps
// --------------------------------------------------------------------------

func TestGetApps(t *testing.T) {
	ctx := context.Background()

	t.Run("returns only the team's apps", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		otherTeamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeam(ctx, t, otherTeamID, "other-team")

		appA := uuid.New()
		appB := uuid.New()
		outsideApp := uuid.New()
		seedApp(ctx, t, appA, teamID, 90)
		seedApp(ctx, t, appB, teamID, 90)
		seedApp(ctx, t, outsideApp, otherTeamID, 90)

		seedAPIKey(ctx, t, appA, "msrsh", "key-a", "checksum-a", false, nil, time.Now())
		seedAPIKey(ctx, t, appB, "msrsh", "key-b", "checksum-b", false, nil, time.Now())
		seedAPIKey(ctx, t, outsideApp, "msrsh", "key-c", "checksum-c", false, nil, time.Now())

		team := &Team{ID: &teamID}
		apps, err := team.GetApps(ctx, deps.PgPool)
		if err != nil {
			t.Fatalf("GetApps: %v", err)
		}
		if len(apps) != 2 {
			t.Fatalf("len(apps) = %d, want 2", len(apps))
		}
		got := map[uuid.UUID]bool{}
		for _, a := range apps {
			if a.TeamId != teamID {
				t.Errorf("app %v team = %v, want %v", a.ID, a.TeamId, teamID)
			}
			got[*a.ID] = true
		}
		if !got[appA] || !got[appB] {
			t.Errorf("apps = %v, want both %v and %v", got, appA, appB)
		}
	})

	t.Run("returns empty for a team with no apps", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		team := &Team{ID: &teamID}
		apps, err := team.GetApps(ctx, deps.PgPool)
		if err != nil {
			t.Fatalf("GetApps: %v", err)
		}
		if len(apps) != 0 {
			t.Errorf("len(apps) = %d, want 0", len(apps))
		}
	})

}

// --------------------------------------------------------------------------
// GetMembers
// --------------------------------------------------------------------------

func TestGetMembers(t *testing.T) {
	ctx := context.Background()

	t.Run("returns members ordered by membership age with roles", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		otherTeamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeam(ctx, t, otherTeamID, "other-team")

		ownerID := uuid.New().String()
		viewerID := uuid.New().String()
		outsiderID := uuid.New().String()
		seedUser(ctx, t, ownerID, "owner@example.com")
		seedUser(ctx, t, viewerID, "viewer@example.com")
		seedUser(ctx, t, outsiderID, "outsider@example.com")

		now := time.Now()
		seedMembershipAt(ctx, t, teamID.String(), ownerID, "owner", now.Add(-time.Hour))
		seedMembershipAt(ctx, t, teamID.String(), viewerID, "viewer", now)
		seedTeamMembership(ctx, t, otherTeamID, outsiderID, "owner")

		team := &Team{ID: &teamID}
		members, err := team.GetMembers(ctx, deps.PgPool)
		if err != nil {
			t.Fatalf("GetMembers: %v", err)
		}
		if len(members) != 2 {
			t.Fatalf("len(members) = %d, want 2", len(members))
		}
		if *members[0].Email != "owner@example.com" || *members[0].Role != "owner" {
			t.Errorf("members[0] = %s/%s, want owner@example.com/owner", *members[0].Email, *members[0].Role)
		}
		if *members[1].Email != "viewer@example.com" || *members[1].Role != "viewer" {
			t.Errorf("members[1] = %s/%s, want viewer@example.com/viewer", *members[1].Email, *members[1].Role)
		}
	})
}

// --------------------------------------------------------------------------
// GetName / Rename
// --------------------------------------------------------------------------

func TestGetName(t *testing.T) {
	ctx := context.Background()

	t.Run("fills the team name", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		team := &Team{ID: &teamID}
		if err := team.GetName(ctx, deps.PgPool); err != nil {
			t.Fatalf("GetName: %v", err)
		}
		if team.Name == nil || *team.Name != testTeamName {
			t.Errorf("name = %v, want %q", team.Name, testTeamName)
		}
	})

	t.Run("unknown team returns an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		unknownID := uuid.New()
		team := &Team{ID: &unknownID}
		if err := team.GetName(ctx, deps.PgPool); err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestRename(t *testing.T) {
	ctx := context.Background()

	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)

	newName := "renamed-team"
	team := &Team{ID: &teamID, Name: &newName}
	if err := team.Rename(ctx, deps.PgPool); err != nil {
		t.Fatalf("Rename: %v", err)
	}
	if got := readTeamName(ctx, t, teamID); got != "renamed-team" {
		t.Errorf("name = %q, want renamed-team", got)
	}
}

// --------------------------------------------------------------------------
// Invites
// --------------------------------------------------------------------------

func TestAddInvites(t *testing.T) {
	ctx := context.Background()

	t.Run("inserts invites and returns email to id map", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		inviterID := uuid.New().String()
		seedUser(ctx, t, inviterID, "inviter@example.com")

		team := &Team{ID: &teamID}
		invitees := []Invitee{{Email: "new@example.com", Role: RoleMap["admin"]}}
		m, err := team.AddInvites(ctx, deps.PgPool, inviterID, invitees)
		if err != nil {
			t.Fatalf("AddInvites: %v", err)
		}
		if _, ok := m["new@example.com"]; !ok || len(m) != 1 {
			t.Errorf("map = %v, want one entry for new@example.com", m)
		}
		if n := countTeamInvites(ctx, t, teamID); n != 1 {
			t.Errorf("invites = %d, want 1", n)
		}
	})

	t.Run("all invitees already invited returns an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		inviterID := uuid.New().String()
		seedUser(ctx, t, inviterID, "inviter@example.com")

		team := &Team{ID: &teamID}
		invitees := []Invitee{{Email: "new@example.com", Role: RoleMap["viewer"]}}
		if _, err := team.AddInvites(ctx, deps.PgPool, inviterID, invitees); err != nil {
			t.Fatalf("AddInvites: %v", err)
		}
		_, err := team.AddInvites(ctx, deps.PgPool, inviterID, invitees)
		if !errContains(err, "already invited") {
			t.Fatalf("err = %v, want already invited", err)
		}
		if n := countTeamInvites(ctx, t, teamID); n != 1 {
			t.Errorf("invites = %d, want 1", n)
		}
	})

	t.Run("skips already invited emails and adds the rest", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		inviterID := uuid.New().String()
		seedUser(ctx, t, inviterID, "inviter@example.com")

		team := &Team{ID: &teamID}
		if _, err := team.AddInvites(ctx, deps.PgPool, inviterID, []Invitee{{Email: "dup@example.com", Role: RoleMap["viewer"]}}); err != nil {
			t.Fatalf("AddInvites: %v", err)
		}

		m, err := team.AddInvites(ctx, deps.PgPool, inviterID, []Invitee{
			{Email: "dup@example.com", Role: RoleMap["viewer"]},
			{Email: "fresh@example.com", Role: RoleMap["viewer"]},
		})
		if err != nil {
			t.Fatalf("AddInvites: %v", err)
		}
		if _, ok := m["fresh@example.com"]; !ok || len(m) != 1 {
			t.Errorf("map = %v, want only fresh@example.com", m)
		}
		if n := countTeamInvites(ctx, t, teamID); n != 2 {
			t.Errorf("invites = %d, want 2", n)
		}
	})
}

func TestGetValidInvites(t *testing.T) {
	ctx := context.Background()

	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	inviterID := uuid.New().String()
	seedUser(ctx, t, inviterID, "inviter@example.com")

	freshID := uuid.New()
	staleID := uuid.New()
	seedInviteAt(ctx, t, freshID, teamID, inviterID, "admin", "fresh@example.com", time.Now())
	seedInviteAt(ctx, t, staleID, teamID, inviterID, "viewer", "stale@example.com", time.Now().Add(-8*24*time.Hour))

	team := &Team{ID: &teamID}
	invites, err := team.GetValidInvites(ctx, deps.PgPool)
	if err != nil {
		t.Fatalf("GetValidInvites: %v", err)
	}
	if len(invites) != 1 {
		t.Fatalf("len(invites) = %d, want 1 (stale excluded)", len(invites))
	}
	inv := invites[0]
	if inv.Email != "fresh@example.com" || inv.InvitedAsRole != RoleMap["admin"] {
		t.Errorf("invite = %s/%s, want fresh@example.com/admin", inv.Email, inv.InvitedAsRole.String())
	}
	if inv.InvitedByEmail != "inviter@example.com" {
		t.Errorf("invited by = %q, want inviter@example.com", inv.InvitedByEmail)
	}
	if !inv.ValidUntil.After(time.Now()) {
		t.Errorf("ValidUntil = %v, want in the future", inv.ValidUntil)
	}
}

func TestGetInviteById(t *testing.T) {
	ctx := context.Background()

	t.Run("returns the invite", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		inviterID := uuid.New().String()
		seedUser(ctx, t, inviterID, "inviter@example.com")

		inviteID := uuid.New()
		seedInviteAt(ctx, t, inviteID, teamID, inviterID, "developer", "dev@example.com", time.Now())

		team := &Team{ID: &teamID}
		inv, err := team.GetInviteById(ctx, deps.PgPool, inviteID.String())
		if err != nil {
			t.Fatalf("GetInviteById: %v", err)
		}
		if inv.Email != "dev@example.com" || inv.InvitedAsRole != RoleMap["developer"] {
			t.Errorf("invite = %s/%s, want dev@example.com/developer", inv.Email, inv.InvitedAsRole.String())
		}
	})

	t.Run("invite of another team is not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		otherTeamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeam(ctx, t, otherTeamID, "other-team")
		inviterID := uuid.New().String()
		seedUser(ctx, t, inviterID, "inviter@example.com")

		inviteID := uuid.New()
		seedInviteAt(ctx, t, inviteID, teamID, inviterID, "viewer", "dev@example.com", time.Now())

		otherTeam := &Team{ID: &otherTeamID}
		if _, err := otherTeam.GetInviteById(ctx, deps.PgPool, inviteID.String()); err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestResendInvite(t *testing.T) {
	ctx := context.Background()

	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	inviterID := uuid.New().String()
	seedUser(ctx, t, inviterID, "inviter@example.com")

	inviteID := uuid.New()
	seedInviteAt(ctx, t, inviteID, teamID, inviterID, "viewer", "dev@example.com", time.Now().Add(-8*24*time.Hour))

	before := getInviteUpdatedAt(ctx, t, inviteID)

	team := &Team{ID: &teamID}
	if err := team.ResendInvite(ctx, deps.PgPool, inviteID); err != nil {
		t.Fatalf("ResendInvite: %v", err)
	}

	after := getInviteUpdatedAt(ctx, t, inviteID)
	if !after.After(before) {
		t.Errorf("updated_at not bumped: before %v, after %v", before, after)
	}

	// a resent stale invite becomes valid again
	invites, err := team.GetValidInvites(ctx, deps.PgPool)
	if err != nil {
		t.Fatalf("GetValidInvites: %v", err)
	}
	if len(invites) != 1 {
		t.Errorf("len(invites) = %d, want 1 after resend", len(invites))
	}
}

func TestRemoveInvite(t *testing.T) {
	ctx := context.Background()

	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	inviterID := uuid.New().String()
	seedUser(ctx, t, inviterID, "inviter@example.com")

	inviteID := uuid.New()
	seedInviteAt(ctx, t, inviteID, teamID, inviterID, "viewer", "dev@example.com", time.Now())

	team := &Team{ID: &teamID}
	if err := team.RemoveInvite(ctx, deps.PgPool, inviteID); err != nil {
		t.Fatalf("RemoveInvite: %v", err)
	}
	if n := countTeamInvites(ctx, t, teamID); n != 0 {
		t.Errorf("invites = %d, want 0", n)
	}
}

// --------------------------------------------------------------------------
// AddMembers / AreInviteesMember
// --------------------------------------------------------------------------

func TestAddMembers(t *testing.T) {
	ctx := context.Background()

	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	adminID := uuid.New()
	viewerID := uuid.New()
	seedUser(ctx, t, adminID.String(), "admin@example.com")
	seedUser(ctx, t, viewerID.String(), "viewer@example.com")

	team := &Team{ID: &teamID}
	err := team.AddMembers(ctx, deps.PgPool, []Invitee{
		{ID: adminID, Email: "admin@example.com", Role: RoleMap["admin"]},
		{ID: viewerID, Email: "viewer@example.com", Role: RoleMap["viewer"]},
	})
	if err != nil {
		t.Fatalf("AddMembers: %v", err)
	}
	if role := getMembershipRole(ctx, t, teamID, adminID.String()); role != "admin" {
		t.Errorf("admin role = %q, want admin", role)
	}
	if role := getMembershipRole(ctx, t, teamID, viewerID.String()); role != "viewer" {
		t.Errorf("viewer role = %q, want viewer", role)
	}
}

func TestAreInviteesMember(t *testing.T) {
	ctx := context.Background()

	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	memberID := uuid.New().String()
	seedUser(ctx, t, memberID, "member@example.com")
	seedTeamMembership(ctx, t, teamID, memberID, "viewer")

	team := &Team{ID: &teamID}

	// email match is case-insensitive
	idx, err := team.AreInviteesMember(ctx, deps.PgPool, []Invitee{
		{Email: "nobody@example.com"},
		{Email: "MEMBER@example.com"},
	})
	if err != nil {
		t.Fatalf("AreInviteesMember: %v", err)
	}
	if idx != 1 {
		t.Errorf("idx = %d, want 1", idx)
	}

	idx, err = team.AreInviteesMember(ctx, deps.PgPool, []Invitee{{Email: "nobody@example.com"}})
	if err != nil {
		t.Fatalf("AreInviteesMember: %v", err)
	}
	if idx != -1 {
		t.Errorf("idx = %d, want -1", idx)
	}
}

// --------------------------------------------------------------------------
// Create
// --------------------------------------------------------------------------

func TestTeamCreate(t *testing.T) {
	ctx := context.Background()

	create := func(t *testing.T, billingEnabled bool, userID string) *Team {
		t.Helper()
		name := "created-team"
		team := &Team{Name: &name}
		u := &User{ID: &userID}

		tx, err := deps.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin: %v", err)
		}
		defer tx.Rollback(ctx)

		if err := team.Create(ctx, deps.PgPool, billingEnabled, u, &tx); err != nil {
			t.Fatalf("Create: %v", err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatalf("commit: %v", err)
		}
		return team
	}

	t.Run("billing enabled provisions an autumn customer", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "creator@example.com")

		team := create(t, true, userID)
		if got := readTeamName(ctx, t, *team.ID); got != "created-team" {
			t.Errorf("name = %q, want created-team", got)
		}
		if role := getMembershipRole(ctx, t, *team.ID, userID); role != "owner" {
			t.Errorf("creator role = %q, want owner", role)
		}
		if id := getTeamAutumnCustomerID(ctx, t, *team.ID); id == nil || *id == "" {
			t.Error("autumn customer not provisioned")
		}
	})

	t.Run("billing disabled skips autumn", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "creator@example.com")

		team := create(t, false, userID)
		if id := getTeamAutumnCustomerID(ctx, t, *team.ID); id != nil {
			t.Errorf("autumn customer id = %v, want nil with billing disabled", *id)
		}
	})
}

// --------------------------------------------------------------------------
// GetValidInvitesForEmail
// --------------------------------------------------------------------------

func TestGetValidInvitesForEmail(t *testing.T) {
	ctx := context.Background()

	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	staleTeamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	seedTeam(ctx, t, staleTeamID, "stale-team")
	inviterID := uuid.New().String()
	seedUser(ctx, t, inviterID, "inviter@example.com")

	seedInviteAt(ctx, t, uuid.New(), teamID, inviterID, "admin", "invitee@example.com", time.Now())
	seedInviteAt(ctx, t, uuid.New(), staleTeamID, inviterID, "viewer", "invitee@example.com", time.Now().Add(-8*24*time.Hour))
	seedInviteAt(ctx, t, uuid.New(), teamID, inviterID, "viewer", "someone-else@example.com", time.Now())

	invites, err := GetValidInvitesForEmail(ctx, deps.PgPool, "invitee@example.com")
	if err != nil {
		t.Fatalf("GetValidInvitesForEmail: %v", err)
	}
	if len(invites) != 1 {
		t.Fatalf("len(invites) = %d, want 1 (stale and other emails excluded)", len(invites))
	}
	if invites[0].InvitedToTeamId != teamID || invites[0].InvitedAsRole != RoleMap["admin"] {
		t.Errorf("invite = %v/%s, want %v/admin", invites[0].InvitedToTeamId, invites[0].InvitedAsRole.String(), teamID)
	}
}
