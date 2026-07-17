//go:build integration

package measure

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/libs/autumn"
	autumntest "backend/libs/autumn/testhelpers"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	svix "github.com/svix/svix-webhooks/go"
)

// withAutumnWebhookSecret sets the webhook secret for the duration of a test.
func withAutumnWebhookSecret(t *testing.T, secret string) {
	t.Helper()
	orig := deps.Config.AutumnWebhookSecret
	deps.Config.AutumnWebhookSecret = secret
	t.Cleanup(func() { deps.Config.AutumnWebhookSecret = orig })
}

// signSvixWebhook signs a payload with the given Svix secret and returns the
// headers that HandleAutumnWebhook will verify.
func signSvixWebhook(t *testing.T, secret, msgID string, payload []byte) http.Header {
	t.Helper()
	wh, err := svix.NewWebhook(secret)
	if err != nil {
		t.Fatalf("svix new webhook: %v", err)
	}
	ts := time.Now()
	sig, err := wh.Sign(msgID, ts, payload)
	if err != nil {
		t.Fatalf("svix sign: %v", err)
	}
	hdr := http.Header{}
	hdr.Set("svix-id", msgID)
	hdr.Set("svix-timestamp", strconv.FormatInt(ts.Unix(), 10))
	hdr.Set("svix-signature", sig)
	return hdr
}

// --------------------------------------------------------------------------
// DeterminePlan
// --------------------------------------------------------------------------

func TestDeterminePlan(t *testing.T) {
	cases := []struct {
		name string
		cust autumn.Customer
		want string
	}{
		{
			name: "active pro subscription → pro",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{{PlanID: AutumnPlanPro, Status: "active"}},
			},
			want: PlanPro,
		},
		{
			name: "active free subscription → free",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{{PlanID: AutumnPlanFree, Status: "active"}},
			},
			want: PlanFree,
		},
		{
			name: "scheduled pro is ignored, active free wins → free",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{
					{PlanID: AutumnPlanPro, Status: "scheduled"},
					{PlanID: AutumnPlanFree, Status: "active"},
				},
			},
			want: PlanFree,
		},
		{
			name: "active pro + scheduled free (post-cancel state) → pro",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{
					{PlanID: AutumnPlanPro, Status: "active", CanceledAt: 1700000000000},
					{PlanID: AutumnPlanFree, Status: "scheduled"},
				},
			},
			want: PlanPro,
		},
		{
			name: "only scheduled subs (no active) → free fallback",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{
					{PlanID: AutumnPlanPro, Status: "scheduled"},
				},
			},
			want: PlanFree,
		},
		{
			name: "active enterprise plan id → enterprise",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{{PlanID: "plan_ent_acme", Status: "active"}},
			},
			want: PlanEnterprise,
		},
		{
			name: "webhook-style products fallback (no subs) → pro",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{{ID: AutumnPlanPro}},
			},
			want: PlanPro,
		},
		{
			name: "products with empty status treated as active (back-compat)",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{{ID: AutumnPlanPro, Status: ""}},
			},
			want: PlanPro,
		},
		{
			name: "scheduled product is ignored, falls back to free",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{{ID: AutumnPlanFree, Status: "scheduled"}},
			},
			want: PlanFree,
		},
		{
			name: "active free + scheduled pro in products → free (skip scheduled)",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{
					{ID: AutumnPlanPro, Status: "scheduled"},
					{ID: AutumnPlanFree, Status: "active"},
				},
			},
			want: PlanFree,
		},
		{
			name: "empty customer → free",
			cust: autumn.Customer{},
			want: PlanFree,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := DeterminePlan(&tc.cust); got != tc.want {
				t.Errorf("DeterminePlan = %q, want %q", got, tc.want)
			}
		})
	}
}

// --------------------------------------------------------------------------
// planRank (upgrade/downgrade direction)
// --------------------------------------------------------------------------

func TestPlanRank(t *testing.T) {
	// Free < Pro < Enterprise (any custom plan), so a transition's direction can
	// be read from the plans that activated and expired.
	if planRank(AutumnPlanFree) >= planRank(AutumnPlanPro) {
		t.Error("Free should rank below Pro")
	}
	if planRank(AutumnPlanPro) >= planRank("plan_ent_acme") {
		t.Error("Pro should rank below a custom Enterprise plan")
	}
}

// --------------------------------------------------------------------------
// applyPlanTransition (tx wrap on retention reset + email enqueue)
// --------------------------------------------------------------------------

func TestApplyPlanTransition(t *testing.T) {
	ctx := context.Background()

	t.Run("notify failure rolls back retention reset", func(t *testing.T) {
		// If email enqueue fails, retention must NOT have been changed.
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 30) // existing retention
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		failingNotify := func(_ context.Context, _ pgx.Tx) error {
			return errors.New("simulated email enqueue failure")
		}

		applyPlanTransition(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID, failingNotify)

		// Retention should still be 30 — the tx rolled back.
		if got := getAppRetention(ctx, t, appID); got != 30 {
			t.Errorf("retention = %d, want 30 (tx must roll back when notify fails)", got)
		}
	})

	t.Run("happy path commits both retention reset and email", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		var notifyCalled bool
		notify := func(_ context.Context, tx pgx.Tx) error {
			notifyCalled = true
			if tx == nil {
				t.Error("notify should receive a non-nil tx for atomic commit")
			}
			return nil
		}

		applyPlanTransition(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID, notify)

		if !notifyCalled {
			t.Error("notify should have been called")
		}
		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention = %d, want 90 (committed)", got)
		}
	})
}

// --------------------------------------------------------------------------
// GetPlanRetentionDays
// --------------------------------------------------------------------------

func TestGetPlanRetentionDays(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → free default", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := deps.Config.BillingEnabled
		deps.Config.BillingEnabled = false
		t.Cleanup(func() { deps.Config.BillingEnabled = orig })

		got, err := GetPlanRetentionDays(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), uuid.New())
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if got != MIN_RETENTION_DAYS {
			t.Errorf("want %d, got %d", MIN_RETENTION_DAYS, got)
		}
	})

	t.Run("no autumn customer → free default", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		got, err := GetPlanRetentionDays(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID)
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if got != MIN_RETENTION_DAYS {
			t.Errorf("want %d, got %d", MIN_RETENTION_DAYS, got)
		}
	})

	t.Run("pro plan → reads retention_days feature", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: AutumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		got, err := GetPlanRetentionDays(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID)
		if err != nil || got != 90 {
			t.Errorf("want (90, nil), got (%d, %v)", got, err)
		}
	})

	t.Run("enterprise plan → reads its own retention_days value", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: "plan_ent_acme"}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 180},
				},
			}, nil
		})

		got, err := GetPlanRetentionDays(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID)
		if err != nil || got != 180 {
			t.Errorf("want (180, nil), got (%d, %v)", got, err)
		}
	})

	t.Run("plan without retention_days feature → error", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: "plan_missing_feature"}},
				// no Balances["retention_days"]
			}, nil
		})

		got, err := GetPlanRetentionDays(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID)
		if err == nil {
			t.Errorf("want error, got (%d, nil)", got)
		}
		if got != 0 {
			t.Errorf("want 0 on error, got %d", got)
		}
	})

	t.Run("free plan → reads retention_days feature", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: AutumnPlanFree}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		got, err := GetPlanRetentionDays(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID)
		if err != nil || got != 30 {
			t.Errorf("want (30, nil), got (%d, %v)", got, err)
		}
	})

	t.Run("autumn.GetCustomer fails → 0 + error (no silent default)", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return nil, fmt.Errorf("autumn unreachable")
		})

		got, err := GetPlanRetentionDays(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), teamID)
		if err == nil {
			t.Fatalf("want error, got nil (got=%d)", got)
		}
		if got != 0 {
			t.Errorf("want 0 on error, got %d", got)
		}
	})
}

// --------------------------------------------------------------------------
// GetTeamBilling
// --------------------------------------------------------------------------

func TestProvisionAutumnCustomer(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → no-op", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := deps.Config.BillingEnabled
		deps.Config.BillingEnabled = false
		t.Cleanup(func() { deps.Config.BillingEnabled = orig })

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		tx, err := deps.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}
		defer tx.Rollback(ctx)

		id, err := ProvisionAutumnCustomer(ctx, deps.Config.IsBillingEnabled(), tx, teamID, "name", "email@x.com")
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if id != "" {
			t.Errorf("want empty id when billing disabled, got %q", id)
		}
	})

	t.Run("happy path creates + attaches + persists", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		var gotCreate bool
		var generatedCustID string
		autumntest.MockGetOrCreateCustomer(t, func(_ context.Context, id, email, name string) (*autumn.Customer, error) {
			gotCreate = true
			if _, err := uuid.Parse(id); err != nil {
				t.Errorf("customer id = %q, want a UUID: %v", id, err)
			}
			if id == teamID.String() {
				t.Errorf("customer id must not equal teamID — the team UUID should never leak to Autumn")
			}
			generatedCustID = id
			return &autumn.Customer{ID: id}, nil
		})
		// Autumn auto-attaches Free on customer create, so ProvisionAutumnCustomer
		// must not call Attach itself. Fail loudly if it ever starts to.
		autumntest.MockAttach(t, func(_ context.Context, req autumn.AttachRequest) (*autumn.AttachResponse, error) {
			t.Errorf("Attach should not be called during provisioning, got: %+v", req)
			return &autumn.AttachResponse{CustomerID: req.CustomerID}, nil
		})

		tx, err := deps.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}

		id, err := ProvisionAutumnCustomer(ctx, deps.Config.IsBillingEnabled(), tx, teamID, "test-team", "owner@x.com")
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if id != generatedCustID {
			t.Errorf("id = %q, want %q (the UUID we generated and Autumn echoed back)", id, generatedCustID)
		}
		if !gotCreate {
			t.Errorf("GetOrCreateCustomer was not called")
		}

		if err := tx.Commit(ctx); err != nil {
			t.Fatalf("commit: %v", err)
		}
		if saved := getTeamAutumnCustomerID(ctx, t, teamID); saved == nil || *saved != generatedCustID {
			t.Errorf("saved = %v, want %q", saved, generatedCustID)
		}
	})

	t.Run("autumn failure rolls back team creation", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		autumntest.MockGetOrCreateCustomer(t, func(_ context.Context, _, _, _ string) (*autumn.Customer, error) {
			return nil, errors.New("autumn is down")
		})

		tx, err := deps.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}

		if _, err := ProvisionAutumnCustomer(ctx, deps.Config.IsBillingEnabled(), tx, teamID, "test-team", "owner@x.com"); err == nil {
			t.Fatal("expected error, got nil")
			tx.Rollback(ctx)
		} else {
			tx.Rollback(ctx)
		}

		if saved := getTeamAutumnCustomerID(ctx, t, teamID); saved != nil {
			t.Errorf("autumn_customer_id should be nil after rollback, got %v", *saved)
		}
	})

}

// --------------------------------------------------------------------------
// Team.create — billing-related guards
// --------------------------------------------------------------------------

func TestTeamCreateEmptyOwnerEmail(t *testing.T) {
	ctx := context.Background()

	t.Run("billing enabled + owner has empty email → error, no autumn provisioning", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "")

		autumntest.MockGetOrCreateCustomer(t, func(_ context.Context, _, _, _ string) (*autumn.Customer, error) {
			t.Errorf("autumn.GetOrCreateCustomer must not be called when owner has no email")
			return nil, errors.New("unexpected")
		})
		autumntest.MockAttach(t, func(_ context.Context, _ autumn.AttachRequest) (*autumn.AttachResponse, error) {
			t.Errorf("autumn.Attach must not be called when owner has no email")
			return nil, errors.New("unexpected")
		})

		tx, err := deps.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}
		defer tx.Rollback(ctx)

		teamName := "test-team"
		team := &Team{Name: &teamName}
		u := &User{ID: &userID}

		err = team.Create(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), u, &tx)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errContains(err, "email") {
			t.Errorf("expected email-related error, got: %v", err)
		}
	})
}

func errContains(err error, s string) bool {
	return err != nil && strings.Contains(err.Error(), s)
}

// --------------------------------------------------------------------------
// SyncBillingEmailOnOwnerExit
// --------------------------------------------------------------------------

func TestSyncBillingEmailOnOwnerExit(t *testing.T) {
	ctx := context.Background()

	seedTeamWithOwner := func(t *testing.T, ownerEmail string) uuid.UUID {
		t.Helper()
		teamID := uuid.New()
		ownerID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, ownerEmail)
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		return teamID
	}

	t.Run("billing disabled is a no-op", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := seedTeamWithOwner(t, "owner@example.com")

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			t.Error("GetCustomer called with billing disabled")
			return nil, nil
		})

		if err := SyncBillingEmailOnOwnerExit(ctx, deps.PgPool, false, teamID, "departed@example.com"); err != nil {
			t.Fatalf("SyncBillingEmailOnOwnerExit: %v", err)
		}
	})

	t.Run("team without autumn customer is a no-op", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := seedTeamWithOwner(t, "owner@example.com")

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			t.Error("GetCustomer called without an autumn customer")
			return nil, nil
		})

		if err := SyncBillingEmailOnOwnerExit(ctx, deps.PgPool, true, teamID, "departed@example.com"); err != nil {
			t.Fatalf("SyncBillingEmailOnOwnerExit: %v", err)
		}
	})

	t.Run("customer email differing from the departed member is left alone", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := seedTeamWithOwner(t, "owner@example.com")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Email: "finance@example.com"}, nil
		})
		autumntest.MockUpdateCustomer(t, func(_ context.Context, _, _ string) error {
			t.Error("UpdateCustomer called for a non-matching email")
			return nil
		})

		if err := SyncBillingEmailOnOwnerExit(ctx, deps.PgPool, true, teamID, "departed@example.com"); err != nil {
			t.Fatalf("SyncBillingEmailOnOwnerExit: %v", err)
		}
	})

	t.Run("matching email moves to the earliest remaining owner", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		earlierID := uuid.New().String()
		laterID := uuid.New().String()
		seedUser(ctx, t, earlierID, "earlier-owner@example.com")
		seedUser(ctx, t, laterID, "later-owner@example.com")
		now := time.Now()
		seedMembershipAt(ctx, t, teamID.String(), earlierID, "owner", now.Add(-time.Hour))
		seedMembershipAt(ctx, t, teamID.String(), laterID, "owner", now)

		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// mixed case exercises the case-insensitive match
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Email: "Departed@Example.com"}, nil
		})
		var gotCustomerID, gotEmail string
		autumntest.MockUpdateCustomer(t, func(_ context.Context, customerID, email string) error {
			gotCustomerID = customerID
			gotEmail = email
			return nil
		})

		if err := SyncBillingEmailOnOwnerExit(ctx, deps.PgPool, true, teamID, "departed@example.com"); err != nil {
			t.Fatalf("SyncBillingEmailOnOwnerExit: %v", err)
		}
		if gotCustomerID != custID {
			t.Errorf("customer = %q, want %q", gotCustomerID, custID)
		}
		if gotEmail != "earlier-owner@example.com" {
			t.Errorf("email = %q, want earlier-owner@example.com", gotEmail)
		}
	})

	t.Run("no remaining owner returns an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Email: "departed@example.com"}, nil
		})
		autumntest.MockUpdateCustomer(t, func(_ context.Context, _, _ string) error {
			t.Error("UpdateCustomer called with no remaining owner")
			return nil
		})

		if err := SyncBillingEmailOnOwnerExit(ctx, deps.PgPool, true, teamID, "departed@example.com"); err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
