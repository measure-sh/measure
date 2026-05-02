//go:build integration

package measure

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/api/server"
	"backend/autumn"
	autumntest "backend/autumn/testhelpers"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	svix "github.com/svix/svix-webhooks/go"
)

// withAutumnWebhookSecret sets the webhook secret for the duration of a test.
func withAutumnWebhookSecret(t *testing.T, secret string) {
	t.Helper()
	orig := server.Server.Config.AutumnWebhookSecret
	server.Server.Config.AutumnWebhookSecret = secret
	t.Cleanup(func() { server.Server.Config.AutumnWebhookSecret = orig })
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
	h := http.Header{}
	h.Set("svix-id", msgID)
	h.Set("svix-timestamp", strconv.FormatInt(ts.Unix(), 10))
	h.Set("svix-signature", sig)
	return h
}

// --------------------------------------------------------------------------
// determinePlan
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
				Subscriptions: []autumn.Subscription{{PlanID: autumnPlanPro, Status: "active"}},
			},
			want: planPro,
		},
		{
			name: "active free subscription → free",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{{PlanID: autumnPlanFree, Status: "active"}},
			},
			want: planFree,
		},
		{
			name: "scheduled pro is ignored, active free wins → free",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{
					{PlanID: autumnPlanPro, Status: "scheduled"},
					{PlanID: autumnPlanFree, Status: "active"},
				},
			},
			want: planFree,
		},
		{
			name: "active pro + scheduled free (post-cancel state) → pro",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{
					{PlanID: autumnPlanPro, Status: "active", CanceledAt: 1700000000000},
					{PlanID: autumnPlanFree, Status: "scheduled"},
				},
			},
			want: planPro,
		},
		{
			name: "only scheduled subs (no active) → free fallback",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{
					{PlanID: autumnPlanPro, Status: "scheduled"},
				},
			},
			want: planFree,
		},
		{
			name: "active enterprise plan id → enterprise",
			cust: autumn.Customer{
				Subscriptions: []autumn.Subscription{{PlanID: "plan_ent_acme", Status: "active"}},
			},
			want: planEnterprise,
		},
		{
			name: "webhook-style products fallback (no subs) → pro",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
			},
			want: planPro,
		},
		{
			name: "products with empty status treated as active (back-compat)",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro, Status: ""}},
			},
			want: planPro,
		},
		{
			name: "scheduled product is ignored, falls back to free",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{{ID: autumnPlanFree, Status: "scheduled"}},
			},
			want: planFree,
		},
		{
			name: "active free + scheduled pro in products → free (skip scheduled)",
			cust: autumn.Customer{
				Products: []autumn.CustomerProduct{
					{ID: autumnPlanPro, Status: "scheduled"},
					{ID: autumnPlanFree, Status: "active"},
				},
			},
			want: planFree,
		},
		{
			name: "empty customer → free",
			cust: autumn.Customer{},
			want: planFree,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := determinePlan(&tc.cust); got != tc.want {
				t.Errorf("determinePlan = %q, want %q", got, tc.want)
			}
		})
	}
}

// --------------------------------------------------------------------------
// proIsStillActive (cancel-scenario disambiguation)
// --------------------------------------------------------------------------

func TestProIsStillActive(t *testing.T) {
	cases := []struct {
		name      string
		products  []autumn.CustomerProduct
		productID string
		want      bool
	}{
		{
			name: "active pro present (end-of-cycle cancel scheduled)",
			products: []autumn.CustomerProduct{
				{ID: autumnPlanPro, Status: "active"},
				{ID: autumnPlanFree, Status: "scheduled"},
			},
			productID: autumnPlanPro,
			want:      true,
		},
		{
			name: "pro absent (immediate cancel — Free took over)",
			products: []autumn.CustomerProduct{
				{ID: autumnPlanFree, Status: "active"},
			},
			productID: autumnPlanPro,
			want:      false,
		},
		{
			name: "pro present but status is canceled",
			products: []autumn.CustomerProduct{
				{ID: autumnPlanPro, Status: "canceled"},
			},
			productID: autumnPlanPro,
			want:      false,
		},
		{
			name: "pro present but status is scheduled (queued, not active yet)",
			products: []autumn.CustomerProduct{
				{ID: autumnPlanPro, Status: "scheduled"},
			},
			productID: autumnPlanPro,
			want:      false,
		},
		{
			name:      "empty products list (e.g. malformed payload)",
			products:  nil,
			productID: autumnPlanPro,
			want:      false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := proIsStillActive(autumn.Customer{Products: tc.products}, tc.productID)
			if got != tc.want {
				t.Errorf("proIsStillActive = %v, want %v", got, tc.want)
			}
		})
	}
}

// --------------------------------------------------------------------------
// applyPlanTransition (B2: tx wrap on retention reset + email enqueue)
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

		failingNotify := func(_ context.Context, _ pgx.Tx, _ uuid.UUID) error {
			return errors.New("simulated email enqueue failure")
		}

		applyPlanTransition(ctx, teamID, failingNotify)

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
		notify := func(_ context.Context, tx pgx.Tx, _ uuid.UUID) error {
			notifyCalled = true
			if tx == nil {
				t.Error("notify should receive a non-nil tx for atomic commit")
			}
			return nil
		}

		applyPlanTransition(ctx, teamID, notify)

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
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		got, err := GetPlanRetentionDays(ctx, uuid.New())
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

		got, err := GetPlanRetentionDays(ctx, teamID)
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
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		got, err := GetPlanRetentionDays(ctx, teamID)
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

		got, err := GetPlanRetentionDays(ctx, teamID)
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

		got, err := GetPlanRetentionDays(ctx, teamID)
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
				Products: []autumn.CustomerProduct{{ID: autumnPlanFree}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		got, err := GetPlanRetentionDays(ctx, teamID)
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

		got, err := GetPlanRetentionDays(ctx, teamID)
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

func TestGetTeamBilling(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		c, w := newTestGinContext("GET", "/teams/"+uuid.New().String()+"/billing/info", nil)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		GetTeamBilling(c)
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("returns free plan when team has no autumn customer", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["plan"] != "free" {
			t.Errorf("plan = %v, want free", got["plan"])
		}
	})

	t.Run("returns pro plan when autumn says so", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Products: []autumn.CustomerProduct{{ID: autumnPlanPro}}}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["plan"] != "pro" {
			t.Errorf("plan = %v, want pro", got["plan"])
		}
		if got["autumn_customer_id"] != custID {
			t.Errorf("autumn_customer_id = %v, want %q", got["autumn_customer_id"], custID)
		}
	})

	t.Run("includes bytes balance and subscription state from autumn", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// Autumn returns ms timestamps; backend converts to seconds for the frontend.
		startedAtSec := int64(1700000000)
		endsAtSec := int64(1702592000)
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
				Subscriptions: []autumn.Subscription{{
					PlanID:             autumnPlanPro,
					Status:             "active",
					CurrentPeriodStart: startedAtSec * 1000,
					CurrentPeriodEnd:   endsAtSec * 1000,
				}},
				Balances: map[string]autumn.Balance{
					"bytes": {FeatureID: "bytes", Granted: 25_000_000_000, Usage: 1_000_000_000},
				},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["bytes_granted"] != float64(25_000_000_000) {
			t.Errorf("bytes_granted = %v, want 25000000000", got["bytes_granted"])
		}
		if got["bytes_used"] != float64(1_000_000_000) {
			t.Errorf("bytes_used = %v, want 1000000000", got["bytes_used"])
		}
		if got["status"] != "active" {
			t.Errorf("status = %v, want active", got["status"])
		}
		if got["current_period_start"] != float64(startedAtSec) {
			t.Errorf("current_period_start = %v, want %d (seconds)", got["current_period_start"], startedAtSec)
		}
		if got["current_period_end"] != float64(endsAtSec) {
			t.Errorf("current_period_end = %v, want %d (seconds)", got["current_period_end"], endsAtSec)
		}
		// canceled_at should be omitted (zero) when no cancellation is pending.
		if v, present := got["canceled_at"]; present && v != float64(0) {
			t.Errorf("canceled_at = %v, want absent or 0", v)
		}
	})

	t.Run("picks the active subscription, not whichever is index 0", func(t *testing.T) {
		// During a scheduled cancellation, the customer has TWO subscriptions:
		// the still-active Pro (with canceled_at set) and a scheduled Free
		// queued for the cycle boundary. Autumn doesn't document an order;
		// even if Free lands at index 0, we must read the active Pro.
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		canceledAtSec := int64(1700100000)
		startedAtSec := int64(1700000000)
		endsAtSec := int64(1702592000)
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Subscriptions: []autumn.Subscription{
					// scheduled Free at index 0 — we should NOT pick this one.
					{
						PlanID:    autumnPlanFree,
						Status:    "scheduled",
						StartedAt: endsAtSec * 1000,
					},
					// active Pro at index 1 with the data we want surfaced.
					{
						PlanID:             autumnPlanPro,
						Status:             "active",
						CurrentPeriodStart: startedAtSec * 1000,
						CurrentPeriodEnd:   endsAtSec * 1000,
						CanceledAt:         canceledAtSec * 1000,
					},
				},
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["status"] != "active" {
			t.Errorf("status = %v, want active (must skip scheduled sub at index 0)", got["status"])
		}
		if got["canceled_at"] != float64(canceledAtSec) {
			t.Errorf("canceled_at = %v, want %d (from active Pro sub, not scheduled Free)", got["canceled_at"], canceledAtSec)
		}
		if got["current_period_start"] != float64(startedAtSec) {
			t.Errorf("current_period_start = %v, want %d (from active Pro sub)", got["current_period_start"], startedAtSec)
		}
		if got["current_period_end"] != float64(endsAtSec) {
			t.Errorf("current_period_end = %v, want %d (from active Pro sub)", got["current_period_end"], endsAtSec)
		}
		if got["plan"] != planPro {
			t.Errorf("plan = %v, want %q", got["plan"], planPro)
		}
	})

	t.Run("predictable when current_period_end is in the past", func(t *testing.T) {
		// Defensive: if Autumn briefly reports a stale subscription whose
		// period has already ended, our handler should still return 200
		// with the values as-is. The frontend hides the scheduled-for line
		// based on the date.
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		pastSec := int64(1)
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Subscriptions: []autumn.Subscription{{
					PlanID:             autumnPlanPro,
					Status:             "active",
					CurrentPeriodStart: 0,
					CurrentPeriodEnd:   pastSec * 1000,
					CanceledAt:         pastSec * 1000,
				}},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["current_period_end"] != float64(pastSec) {
			t.Errorf("current_period_end = %v, want %d (passed through)", got["current_period_end"], pastSec)
		}
		if got["canceled_at"] != float64(pastSec) {
			t.Errorf("canceled_at = %v, want %d (passed through)", got["canceled_at"], pastSec)
		}
	})

	t.Run("enterprise plan exposes retention_days and bytes_unlimited", func(t *testing.T) {
		// A bespoke Enterprise plan typically has unlimited bytes and a
		// custom retention entitlement (e.g. 365 days). Note that Autumn
		// hardcodes balance.usage=0 for any feature marked unlimited, so
		// even though the customer may be ingesting data, BytesUsed comes
		// through as 0.
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: "measure_enterprise_acme"}},
				Subscriptions: []autumn.Subscription{{
					PlanID: "measure_enterprise_acme",
					Status: "active",
				}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureBytes:         {FeatureID: autumn.FeatureBytes, Unlimited: true, Usage: 0},
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 365},
				},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["plan"] != planEnterprise {
			t.Errorf("plan = %v, want %q", got["plan"], planEnterprise)
		}
		if got["bytes_unlimited"] != true {
			t.Errorf("bytes_unlimited = %v, want true", got["bytes_unlimited"])
		}
		if got["retention_days"] != float64(365) {
			t.Errorf("retention_days = %v, want 365", got["retention_days"])
		}
	})

	t.Run("non-unlimited bytes balance leaves bytes_unlimited=false and populates retention_days + bytes_overage_allowed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureBytes:         {FeatureID: autumn.FeatureBytes, Granted: 25_000_000_000, Usage: 100, Unlimited: false, OverageAllowed: true},
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["bytes_unlimited"] != false {
			t.Errorf("bytes_unlimited = %v, want false", got["bytes_unlimited"])
		}
		if got["bytes_overage_allowed"] != true {
			t.Errorf("bytes_overage_allowed = %v, want true (Pro allows overage)", got["bytes_overage_allowed"])
		}
		if got["retention_days"] != float64(90) {
			t.Errorf("retention_days = %v, want 90", got["retention_days"])
		}
	})

	t.Run("bespoke Enterprise plan with bounded quota + overage_allowed flows through correctly", func(t *testing.T) {
		// Some Enterprise plans aren't unlimited — they have a
		// quota with overage permitted (Autumn returns Granted > 0,
		// Unlimited=false, OverageAllowed=true).
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: "measure_enterprise_acme"}},
				Subscriptions: []autumn.Subscription{{
					PlanID: "measure_enterprise_acme",
					Status: "active",
				}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureBytes:         {FeatureID: autumn.FeatureBytes, Granted: 100_000_000_000, Usage: 110_000_000_000, Unlimited: false, OverageAllowed: true},
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 180},
				},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["plan"] != planEnterprise {
			t.Errorf("plan = %v, want %q", got["plan"], planEnterprise)
		}
		if got["bytes_unlimited"] != false {
			t.Errorf("bytes_unlimited = %v, want false (bounded plan)", got["bytes_unlimited"])
		}
		if got["bytes_overage_allowed"] != true {
			t.Errorf("bytes_overage_allowed = %v, want true", got["bytes_overage_allowed"])
		}
		if got["bytes_granted"] != float64(100_000_000_000) {
			t.Errorf("bytes_granted = %v, want 100GB", got["bytes_granted"])
		}
		if got["bytes_used"] != float64(110_000_000_000) {
			t.Errorf("bytes_used = %v, want 110GB", got["bytes_used"])
		}
		if got["retention_days"] != float64(180) {
			t.Errorf("retention_days = %v, want 180", got["retention_days"])
		}
	})

	t.Run("bytes_overage_allowed=false flows through (e.g. Free, hard-capped Enterprise)", func(t *testing.T) {
		// The Free plan and any bespoke Enterprise plan with a hard byte
		// cap configure bytes with overage_allowed=false.
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanFree}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureBytes: {FeatureID: autumn.FeatureBytes, Granted: 5_000_000_000, Usage: 0, Unlimited: false, OverageAllowed: false},
				},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["bytes_overage_allowed"] != false {
			t.Errorf("bytes_overage_allowed = %v, want false (Free is hard-capped)", got["bytes_overage_allowed"])
		}
	})

	t.Run("populates canceled_at when subscription has a pending cancellation", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		canceledAtSec := int64(1700100000)
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
				Subscriptions: []autumn.Subscription{{
					PlanID:             autumnPlanPro,
					Status:             "active",
					CurrentPeriodStart: 1700000000 * 1000,
					CurrentPeriodEnd:   1702592000 * 1000,
					CanceledAt:         canceledAtSec * 1000, // ms
				}},
			}, nil
		})

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing/info", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["canceled_at"] != float64(canceledAtSec) {
			t.Errorf("canceled_at = %v, want %d (seconds)", got["canceled_at"], canceledAtSec)
		}
		if got["plan"] != planPro {
			t.Errorf("plan = %v, want %q (subscription is still active until cycle end)", got["plan"], planPro)
		}
	})
}

// --------------------------------------------------------------------------
// CreateCheckoutSession
// --------------------------------------------------------------------------

func TestCreateCheckoutSession(t *testing.T) {
	ctx := context.Background()

	body := func(success string) *bytes.Buffer {
		b, _ := json.Marshal(map[string]string{"success_url": success})
		return bytes.NewBuffer(b)
	}

	t.Run("billing disabled → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		c, w := newTestGinContext("PATCH", "/teams/"+uuid.New().String()+"/billing/checkout", body("https://s"))
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		CreateCheckoutSession(c)
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
	})

	t.Run("missing success_url → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/checkout", body(""))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCheckoutSession(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("no autumn customer → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/checkout", body("https://s"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCheckoutSession(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("already on pro → already_upgraded:true", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Products: []autumn.CustomerProduct{{ID: autumnPlanPro}}}, nil
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/checkout", body("https://s"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCheckoutSession(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["already_upgraded"] != true {
			t.Errorf("already_upgraded = %v, want true", got["already_upgraded"])
		}
	})

	t.Run("happy path returns checkout url", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Products: []autumn.CustomerProduct{{ID: autumnPlanFree}}}, nil
		})
		autumntest.MockAttach(t, func(_ context.Context, req autumn.AttachRequest) (*autumn.AttachResponse, error) {
			if req.PlanID != autumnPlanPro {
				t.Errorf("plan = %q, want %q", req.PlanID, autumnPlanPro)
			}
			if req.SuccessURL != "https://s" {
				t.Errorf("success_url = %q", req.SuccessURL)
			}
			if req.CheckoutSessionParams["billing_address_collection"] != "required" {
				t.Errorf("billing_address_collection = %v, want %q",
					req.CheckoutSessionParams["billing_address_collection"], "required")
			}
			return &autumn.AttachResponse{CustomerID: req.CustomerID, PaymentURL: "https://checkout.example"}, nil
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/checkout", body("https://s"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCheckoutSession(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["checkout_url"] != "https://checkout.example" {
			t.Errorf("checkout_url = %v", got["checkout_url"])
		}
	})

	t.Run("autumn 5xx during pre-check → 503 (no checkout attempted)", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return nil, &autumn.APIError{StatusCode: 503, Body: "unavailable"}
		})
		autumntest.MockAttach(t, func(_ context.Context, _ autumn.AttachRequest) (*autumn.AttachResponse, error) {
			t.Errorf("autumn.Attach must not be called when GetCustomer pre-check returned 5xx")
			return nil, errors.New("unexpected")
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/checkout", body("https://s"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCheckoutSession(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503", w.Code)
		}
	})

	t.Run("autumn 4xx during pre-check → 400 (no Attach attempted)", func(t *testing.T) {
		// Falling through to Attach on a 4xx pre-check would mask a real
		// problem (missing customer in Autumn) and risks duplicate Stripe
		// Checkout sessions. Surface the 4xx as a 400 to the client.
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return nil, &autumn.APIError{StatusCode: 404, Body: "customer not found"}
		})
		autumntest.MockAttach(t, func(_ context.Context, _ autumn.AttachRequest) (*autumn.AttachResponse, error) {
			t.Errorf("autumn.Attach must not be called when GetCustomer pre-check returned 4xx")
			return nil, errors.New("unexpected")
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/checkout", body("https://s"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCheckoutSession(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("attach returns empty payment url → already_upgraded", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Products: []autumn.CustomerProduct{{ID: autumnPlanFree}}}, nil
		})
		autumntest.MockAttach(t, func(_ context.Context, req autumn.AttachRequest) (*autumn.AttachResponse, error) {
			return &autumn.AttachResponse{CustomerID: req.CustomerID, PaymentURL: ""}, nil
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/checkout", body("https://s"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCheckoutSession(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d", w.Code)
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["already_upgraded"] != true {
			t.Errorf("already_upgraded = %v, want true", got["already_upgraded"])
		}
	})
}

// --------------------------------------------------------------------------
// CancelAndDowngradeToFreePlan
// --------------------------------------------------------------------------

func TestCancelAndDowngradeToFreePlan(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		c, w := newTestGinContext("PATCH", "/teams/"+uuid.New().String()+"/billing/downgrade", nil)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		CancelAndDowngradeToFreePlan(c)
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
	})

	t.Run("no customer → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CancelAndDowngradeToFreePlan(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("DB error during customer-id lookup → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		// Cancelled request context forces pool.QueryRow to error.
		dead, cancel := context.WithCancel(context.Background())
		cancel()
		c.Request = c.Request.WithContext(dead)

		CancelAndDowngradeToFreePlan(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", w.Code)
		}
	})

	t.Run("happy path schedules cancellation at end of cycle", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		var gotReq autumn.UpdateRequest
		autumntest.MockUpdate(t, func(_ context.Context, req autumn.UpdateRequest) (*autumn.UpdateResponse, error) {
			gotReq = req
			return &autumn.UpdateResponse{CustomerID: req.CustomerID}, nil
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if gotReq.PlanID != autumnPlanPro {
			t.Errorf("plan = %q, want %q (we cancel the active Pro subscription)", gotReq.PlanID, autumnPlanPro)
		}
		if gotReq.CancelAction != autumn.CancelEndOfCycle {
			t.Errorf("cancel_action = %q, want %q", gotReq.CancelAction, autumn.CancelEndOfCycle)
		}
		if gotReq.CustomerID != custID {
			t.Errorf("customer_id = %q, want %q", gotReq.CustomerID, custID)
		}
	})

	t.Run("autumn update failure → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockUpdate(t, func(_ context.Context, _ autumn.UpdateRequest) (*autumn.UpdateResponse, error) {
			return nil, errors.New("boom")
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", w.Code)
		}
	})

	t.Run("non-owner → 403", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})
}

// --------------------------------------------------------------------------
// UndoDowngradeToFreePlan
// --------------------------------------------------------------------------

func TestUndoDowngradeToFreePlan(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		c, w := newTestGinContext("PATCH", "/teams/"+uuid.New().String()+"/billing/undo-downgrade", nil)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		UndoDowngradeToFreePlan(c)
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
	})

	t.Run("no customer → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("DB error during customer-id lookup → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		dead, cancel := context.WithCancel(context.Background())
		cancel()
		c.Request = c.Request.WithContext(dead)

		UndoDowngradeToFreePlan(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", w.Code)
		}
	})

	// mockProWithPendingCancel returns a customer object that satisfies the
	// uncancel pre-check (active Pro sub with canceled_at set).
	mockProWithPendingCancel := func(custID string) *autumn.Customer {
		return &autumn.Customer{
			ID: custID,
			Subscriptions: []autumn.Subscription{{
				PlanID:     autumnPlanPro,
				Status:     "active",
				CanceledAt: 1700100000 * 1000,
			}},
		}
	}

	t.Run("happy path uncancels the Pro subscription", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return mockProWithPendingCancel(custID), nil
		})
		var gotReq autumn.UpdateRequest
		autumntest.MockUpdate(t, func(_ context.Context, req autumn.UpdateRequest) (*autumn.UpdateResponse, error) {
			gotReq = req
			return &autumn.UpdateResponse{CustomerID: req.CustomerID}, nil
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if gotReq.PlanID != autumnPlanPro {
			t.Errorf("plan = %q, want %q", gotReq.PlanID, autumnPlanPro)
		}
		if gotReq.CancelAction != autumn.Uncancel {
			t.Errorf("cancel_action = %q, want %q", gotReq.CancelAction, autumn.Uncancel)
		}
		if gotReq.CustomerID != custID {
			t.Errorf("customer_id = %q, want %q", gotReq.CustomerID, custID)
		}
	})

	t.Run("autumn update failure → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return mockProWithPendingCancel(custID), nil
		})
		autumntest.MockUpdate(t, func(_ context.Context, _ autumn.UpdateRequest) (*autumn.UpdateResponse, error) {
			return nil, errors.New("boom")
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", w.Code)
		}
	})

	t.Run("no cancellation pending → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// Active Pro but canceled_at is zero — nothing to undo.
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Subscriptions: []autumn.Subscription{{
					PlanID: autumnPlanPro,
					Status: "active",
				}},
			}, nil
		})
		autumntest.MockUpdate(t, func(_ context.Context, _ autumn.UpdateRequest) (*autumn.UpdateResponse, error) {
			t.Errorf("autumn.Update must not be called when nothing is scheduled")
			return nil, errors.New("unexpected")
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("on Free plan → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Subscriptions: []autumn.Subscription{{
					PlanID: autumnPlanFree,
					Status: "active",
				}},
			}, nil
		})
		autumntest.MockUpdate(t, func(_ context.Context, _ autumn.UpdateRequest) (*autumn.UpdateResponse, error) {
			t.Errorf("autumn.Update must not be called when on Free")
			return nil, errors.New("unexpected")
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("autumn unreachable on pre-check → 503", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return nil, &autumn.APIError{StatusCode: 503, Body: "unavailable"}
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503", w.Code)
		}
	})

	t.Run("autumn 4xx on pre-check → 400 (no Update attempted)", func(t *testing.T) {
		// 4xx from GetCustomer means a state mismatch (e.g. customer record
		// missing in Autumn). Surface it as 400 so the user knows retrying
		// won't help, instead of masking it as a 503 transient outage.
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return nil, &autumn.APIError{StatusCode: 404, Body: "customer not found"}
		})
		autumntest.MockUpdate(t, func(_ context.Context, _ autumn.UpdateRequest) (*autumn.UpdateResponse, error) {
			t.Errorf("autumn.Update must not be called when GetCustomer pre-check returned 4xx")
			return nil, errors.New("unexpected")
		})

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("non-owner → 403", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/billing/undo-downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UndoDowngradeToFreePlan(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})
}

// --------------------------------------------------------------------------
// CreateCustomerPortalSession
// --------------------------------------------------------------------------

func TestCreateCustomerPortalSession(t *testing.T) {
	ctx := context.Background()

	body := func(ret string) *bytes.Buffer {
		b, _ := json.Marshal(map[string]string{"return_url": ret})
		return bytes.NewBuffer(b)
	}

	t.Run("billing disabled → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		c, w := newTestGinContext("POST", "/teams/"+uuid.New().String()+"/billing/portal", body("https://r"))
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		CreateCustomerPortalSession(c)
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
	})

	t.Run("missing return_url → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/portal", body(""))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCustomerPortalSession(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("DB error during customer-id lookup → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/portal", body("https://r"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		dead, cancel := context.WithCancel(context.Background())
		cancel()
		c.Request = c.Request.WithContext(dead)

		CreateCustomerPortalSession(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", w.Code)
		}
	})

	t.Run("autumn 5xx on portal open → 503", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockOpenCustomerPortal(t, func(_ context.Context, _, _ string) (string, error) {
			return "", &autumn.APIError{StatusCode: 503, Body: "unavailable"}
		})

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/portal", body("https://r"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCustomerPortalSession(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503", w.Code)
		}
	})

	t.Run("autumn 4xx on portal open → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockOpenCustomerPortal(t, func(_ context.Context, _, _ string) (string, error) {
			return "", &autumn.APIError{StatusCode: 400, Body: "bad request"}
		})

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/portal", body("https://r"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCustomerPortalSession(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", w.Code)
		}
	})

	t.Run("happy path returns portal url", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockOpenCustomerPortal(t, func(_ context.Context, cid, ret string) (string, error) {
			if cid != custID {
				t.Errorf("customerID = %q", cid)
			}
			if ret != "https://r" {
				t.Errorf("return = %q", ret)
			}
			return "https://portal.example", nil
		})

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/portal", body("https://r"))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateCustomerPortalSession(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		var got map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["url"] != "https://portal.example" {
			t.Errorf("url = %v", got["url"])
		}
	})
}

// --------------------------------------------------------------------------
// HandleAutumnWebhook
// --------------------------------------------------------------------------

func TestHandleAutumnWebhook(t *testing.T) {
	ctx := context.Background()
	const secret = "whsec_C2FVsBQIhrscChlQIMV+b5sSYspob7oD"

	webhookReq := func(payload []byte, headers http.Header) (*gin.Context, *httptest.ResponseRecorder) {
		c, w := newTestGinContext("POST", "/autumn/webhook", bytes.NewBuffer(payload))
		for k, v := range headers {
			c.Request.Header[k] = v
		}
		return c, w
	}

	t.Run("billing disabled → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		c, w := webhookReq([]byte(`{}`), nil)
		HandleAutumnWebhook(c)
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d", w.Code)
		}
	})

	t.Run("missing secret → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, "")

		c, w := webhookReq([]byte(`{}`), nil)
		HandleAutumnWebhook(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d", w.Code)
		}
	})

	t.Run("invalid signature → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		h := http.Header{}
		h.Set("svix-id", "msg_1")
		h.Set("svix-timestamp", strconv.FormatInt(time.Now().Unix(), 10))
		h.Set("svix-signature", "v1,invalid")

		c, w := webhookReq([]byte(`{}`), h)
		HandleAutumnWebhook(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d", w.Code)
		}
	})

	t.Run("customer.products.updated:upgrade to Pro resets retention to value from retention_days feature", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, MIN_RETENTION_DAYS)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"upgrade","customer":{"id":%q},"updated_product":{"id":%q}}}`,
			custID, autumnPlanPro,
		))
		headers := signSvixWebhook(t, secret, "msg_upgrade", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}

		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention after upgrade = %d, want 90", got)
		}
	})

	t.Run("customer.products.updated:upgrade to Enterprise reads retention from feature entitlement", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, MIN_RETENTION_DAYS)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: "plan_ent_acme"}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 240},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"upgrade","customer":{"id":%q},"updated_product":{"id":"plan_ent_acme"}}}`,
			custID,
		))
		headers := signSvixWebhook(t, secret, "msg_ent_up", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != 240 {
			t.Errorf("retention after Enterprise upgrade = %d, want 240", got)
		}
	})

	t.Run("customer.products.updated:upgrade with Autumn unreachable leaves retention unchanged, returns 200", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 180) // value the failed lookup must not clobber
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return nil, fmt.Errorf("autumn unreachable")
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"upgrade","customer":{"id":%q},"updated_product":{"id":"plan_ent_whatever"}}}`,
			custID,
		))
		headers := signSvixWebhook(t, secret, "msg_ent_err", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		// Log-and-ack (returning non-2xx would make Svix retry and resend the
		// upgrade email). Drift is fixed manually if this ever happens.
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != 180 {
			t.Errorf("retention after failed lookup = %d, want 180 (unchanged)", got)
		}
	})

	t.Run("customer.products.updated:downgrade to Free resets retention to 30d", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 180)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanFree}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"downgrade","customer":{"id":%q},"updated_product":{"id":%q}}}`,
			custID, autumnPlanFree,
		))
		headers := signSvixWebhook(t, secret, "msg_down", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}

		if got := getAppRetention(ctx, t, appID); got != MIN_RETENTION_DAYS {
			t.Errorf("retention = %d, want %d", got, MIN_RETENTION_DAYS)
		}
	})

	t.Run("customer.products.updated:downgrade to Pro resets retention to 90d", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		// Simulate an app that had an Enterprise 365d retention.
		seedApp(ctx, t, appID, teamID, 365)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"downgrade","customer":{"id":%q},"updated_product":{"id":%q}}}`,
			custID, autumnPlanPro,
		))
		headers := signSvixWebhook(t, secret, "msg_ent_to_pro", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}

		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention = %d, want 90", got)
		}
	})

	t.Run("customer.products.updated:new with measure_free is a no-op (auto-attach during team creation)", func(t *testing.T) {
		// Free is auto-attached for every new cloud team, firing scenario=new.
		// We must NOT send "Upgraded to Pro" emails on signup, and there are
		// no apps yet to reset retention on.
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 90)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			t.Errorf("autumn.GetCustomer must not be called for scenario=new+measure_free")
			return nil, errors.New("unexpected")
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"new","customer":{"id":%q},"updated_product":{"id":%q}}}`,
			custID, autumnPlanFree,
		))
		headers := signSvixWebhook(t, secret, "msg_new_free", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention after new+free = %d, want 90 (unchanged)", got)
		}
	})

	t.Run("customer.products.updated:expired (end-of-cycle cancellation took effect) resets retention to Free", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 90) // was on Pro
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			// After Pro expires, Autumn auto-activates the is_default Free plan.
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanFree}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"expired","customer":{"id":%q},"updated_product":{"id":%q}}}`,
			custID, autumnPlanPro,
		))
		headers := signSvixWebhook(t, secret, "msg_expired", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != MIN_RETENTION_DAYS {
			t.Errorf("retention after Pro expired = %d, want %d", got, MIN_RETENTION_DAYS)
		}
	})

	t.Run("customer.products.updated:cancel with Pro still active is a no-op (end-of-cycle cancel scheduled)", func(t *testing.T) {
		// scenario=cancel fires immediately when a user clicks Downgrade and
		// schedules end-of-cycle cancellation. Pro is still active, no plan
		// transition has occurred — so we must not reset retention or send
		// a downgrade email here. The real transition fires expired later.
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 90)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// Returning Free retention here would trip the test — if the handler
		// (mistakenly) called resetAppsRetention, the app would drop to 30d.
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		// products[] still includes Pro with status=active → cancel is a no-op.
		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"cancel","customer":{"id":%q,"products":[{"id":%q,"status":"active"},{"id":%q,"status":"scheduled"}]},"updated_product":{"id":%q}}}`,
			custID, autumnPlanPro, autumnPlanFree, autumnPlanPro,
		))
		headers := signSvixWebhook(t, secret, "msg_cancel", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention after cancel = %d, want 90 (unchanged — Pro still active)", got)
		}
	})

	t.Run("customer.products.updated:cancel with Pro NO LONGER active is treated as a real downgrade", func(t *testing.T) {
		// Defensive: covers the Stripe-portal "Cancel plan" path. If Pro is
		// gone from the customer state when we receive scenario=cancel, the
		// cancellation took effect immediately — reset retention + email.
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 90)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			// Customer is now on Free post-cancel.
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: autumnPlanFree, Status: "active"}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		// products[] does NOT include Pro as active anymore.
		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"cancel","customer":{"id":%q,"products":[{"id":%q,"status":"active"}]},"updated_product":{"id":%q}}}`,
			custID, autumnPlanFree, autumnPlanPro,
		))
		headers := signSvixWebhook(t, secret, "msg_cancel_now", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != MIN_RETENTION_DAYS {
			t.Errorf("retention after immediate cancel = %d, want %d", got, MIN_RETENTION_DAYS)
		}
	})

	t.Run("customer.products.updated:renew is a no-op (uncancel or routine renewal)", func(t *testing.T) {
		// scenario=renew fires on uncancel and on routine cycle-boundary
		// renewal. Plan is unchanged in both cases — no email or retention
		// reset.
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 90)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// Wrong-value retention proof: if the handler called
		// resetAppsRetention, the app would drop to this 30d value.
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID: custID,
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"renew","customer":{"id":%q},"updated_product":{"id":%q}}}`,
			custID, autumnPlanPro,
		))
		headers := signSvixWebhook(t, secret, "msg_renew", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention after renew = %d, want 90 (unchanged)", got)
		}
	})

	t.Run("customer.products.updated:past_due is a no-op", func(t *testing.T) {
		// past_due fires when a renewal payment fails. Ingest gating is
		// driven by autumn.Check; we don't reset retention or notify here.
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		seedApp(ctx, t, appID, teamID, 90)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// Should never be called for past_due.
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			t.Errorf("autumn.GetCustomer must not be called for past_due")
			return nil, errors.New("unexpected")
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"customer.products.updated","data":{"scenario":"past_due","customer":{"id":%q},"updated_product":{"id":%q}}}`,
			custID, autumnPlanPro,
		))
		headers := signSvixWebhook(t, secret, "msg_pd", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention after past_due = %d, want 90 (unchanged)", got)
		}
	})

	t.Run("balances.limit_reached → 200", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		payload := []byte(fmt.Sprintf(
			`{"type":"balances.limit_reached","data":{"customer_id":%q,"feature_id":"bytes","limit_type":"included"}}`,
			custID,
		))
		headers := signSvixWebhook(t, secret, "msg_limit", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("balances.usage_alert_triggered → 200", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		payload := []byte(fmt.Sprintf(
			`{"type":"balances.usage_alert_triggered","data":{"customer_id":%q,"feature_id":"bytes","usage_alert":{"name":"75","threshold":75,"threshold_type":"usage_percentage"}}}`,
			custID,
		))
		headers := signSvixWebhook(t, secret, "msg_alert", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("signed but malformed data payload → 200 without crash", func(t *testing.T) {
		// A well-signed event whose data section doesn't match our expected
		// shape should be handled gracefully (logged + skipped).
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		payload := []byte(`{"type":"customer.products.updated","data":{"scenario":"garbage","customer":null}}`)
		headers := signSvixWebhook(t, secret, "msg_malformed", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("signed but unknown event type → 200 (ignored)", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		payload := []byte(`{"type":"some.future.event","data":{}}`)
		headers := signSvixWebhook(t, secret, "msg_unknown", payload)
		c, w := webhookReq(payload, headers)
		HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// ProvisionAutumnCustomer (team-create path)
// --------------------------------------------------------------------------

func TestProvisionAutumnCustomer(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → no-op", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}
		defer tx.Rollback(ctx)

		id, err := ProvisionAutumnCustomer(ctx, tx, teamID, "name", "email@x.com")
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

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}

		id, err := ProvisionAutumnCustomer(ctx, tx, teamID, "test-team", "owner@x.com")
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

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}

		if _, err := ProvisionAutumnCustomer(ctx, tx, teamID, "test-team", "owner@x.com"); err == nil {
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

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}
		defer tx.Rollback(ctx)

		teamName := "test-team"
		team := &Team{Name: &teamName}
		u := &User{ID: &userID}

		err = team.create(ctx, u, &tx)
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
