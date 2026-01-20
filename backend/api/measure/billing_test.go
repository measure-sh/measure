//go:build integration

package measure

import (
	"backend/api/server"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

const (
	testNoAuthEmail    = "noauth@test.com"
	testViewerEmail    = "viewer@test.com"
	testDeveloperEmail = "dev@test.com"
	testAdminEmail     = "admin@test.com"
	testOwnerEmail     = "owner@test.com"
	testTeamName       = "test-team"
)

// --------------------------------------------------------------------------
// Handler: GetTeamBilling
// --------------------------------------------------------------------------

func TestGetTeamBilling(t *testing.T) {
	t.Run("billing disabled", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		defer func() { server.Server.Config.BillingEnabled = orig }()

		c, w := newTestGinContext("GET", "/teams/test/billing", nil)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
		wantJSON(t, w, "error", "billing is not enabled")
	})

	t.Run("no team membership", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testNoAuthEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})

	t.Run("viewer can read", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testViewerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "viewer")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result TeamBilling
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.Plan != "free" {
			t.Errorf("plan = %q, want %q", result.Plan, "free")
		}
	})

	t.Run("developer can read", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testDeveloperEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "developer")
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_dev"))

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result TeamBilling
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.Plan != "pro" {
			t.Errorf("plan = %q, want %q", result.Plan, "pro")
		}
	})

	t.Run("admin can read", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testAdminEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "admin")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result TeamBilling
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.Plan != "free" {
			t.Errorf("plan = %q, want %q", result.Plan, "free")
		}
	})

	t.Run("owner can read", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_owner"))

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result TeamBilling
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.Plan != "pro" {
			t.Errorf("plan = %q, want %q", result.Plan, "pro")
		}
	})

	t.Run("no billing config", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
		wantJSONContains(t, w, "error", "team billing not found")
	})

	t.Run("success free plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}

		var result TeamBilling
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.TeamID != teamID {
			t.Errorf("team_id = %s, want %s", result.TeamID, teamID)
		}
		if result.Plan != "free" {
			t.Errorf("plan = %q, want %q", result.Plan, "free")
		}
	})

	t.Run("success pro plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_pro"), strPtr("sub_pro"))

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/billing", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamBilling(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}

		var result TeamBilling
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.TeamID != teamID {
			t.Errorf("team_id = %s, want %s", result.TeamID, teamID)
		}
		if result.Plan != "pro" {
			t.Errorf("plan = %q, want %q", result.Plan, "pro")
		}
		if result.StripeCustomerID == nil || *result.StripeCustomerID != "cus_pro" {
			t.Errorf("stripe_customer_id = %v, want %q", result.StripeCustomerID, "cus_pro")
		}
		if result.StripeSubscriptionID == nil || *result.StripeSubscriptionID != "sub_pro" {
			t.Errorf("stripe_subscription_id = %v, want %q", result.StripeSubscriptionID, "sub_pro")
		}
	})
}

// --------------------------------------------------------------------------
// CheckIngestAllowedForApp
// --------------------------------------------------------------------------

func TestCheckIngestAllowedForApp(t *testing.T) {
	t.Run("billing disabled", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		defer func() { server.Server.Config.BillingEnabled = orig }()

		if err := CheckIngestAllowedForApp(ctx, uuid.New()); err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("ingest allowed", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "allowed-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("ingest blocked", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "blocked-team", true)
		seedApp(ctx, t, appID, teamID, 30)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		err := CheckIngestAllowedForApp(ctx, appID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if got := err.Error(); got != "ingestion blocked: usage exceeded" {
			t.Errorf("error = %q, want %q", got, "ingestion blocked: usage exceeded")
		}
	})

	t.Run("app not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		err := CheckIngestAllowedForApp(ctx, uuid.New())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("serves from cache on second call", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "cache-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		// First call populates cache.
		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Fatalf("first call: %v", err)
		}

		// Block ingest in DB — cached result should still allow.
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("cached call should allow, got: %v", err)
		}
	})

	t.Run("serves blocked from cache", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "cache-blocked-team", true)
		seedApp(ctx, t, appID, teamID, 30)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		// First call populates cache with blocked status.
		err := CheckIngestAllowedForApp(ctx, appID)
		if err == nil {
			t.Fatal("first call: expected error, got nil")
		}

		// Unblock in DB — cached result should still block.
		_, dbErr := server.Server.PgPool.Exec(ctx,
			"UPDATE teams SET allow_ingest = true, ingest_blocked_reason = NULL WHERE id = $1", teamID)
		if dbErr != nil {
			t.Fatalf("unblock team: %v", dbErr)
		}

		err = CheckIngestAllowedForApp(ctx, appID)
		if err == nil {
			t.Fatal("cached call should block, got nil")
		}
		if got := err.Error(); got != "ingestion blocked: usage exceeded" {
			t.Errorf("error = %q, want %q", got, "ingestion blocked: usage exceeded")
		}
	})
}

// --------------------------------------------------------------------------
// CheckRetentionChangeAllowedInPlan
// --------------------------------------------------------------------------

func TestCheckRetentionChangeAllowedInPlan(t *testing.T) {
	t.Run("billing disabled", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		defer func() { server.Server.Config.BillingEnabled = orig }()

		allowed, err := CheckRetentionChangeAllowedInPlan(ctx, uuid.New())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !allowed {
			t.Error("expected allowed=true when billing disabled")
		}
	})

	t.Run("pro plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_pro"))

		allowed, err := CheckRetentionChangeAllowedInPlan(ctx, teamID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !allowed {
			t.Error("expected allowed=true for pro plan")
		}
	})

	t.Run("free plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "free-team", true)
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		allowed, err := CheckRetentionChangeAllowedInPlan(ctx, teamID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if allowed {
			t.Error("expected allowed=false for free plan")
		}
	})

	t.Run("no billing config", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "no-config-team", true)

		_, err := CheckRetentionChangeAllowedInPlan(ctx, teamID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// --------------------------------------------------------------------------
// Handler: CreateCheckoutSession
// --------------------------------------------------------------------------

func TestCreateCheckoutSession(t *testing.T) {
	t.Run("billing disabled", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		defer func() { server.Server.Config.BillingEnabled = orig }()

		c, w := newTestGinContext("POST", "/teams/test/billing/checkout", nil)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}

		CreateCheckoutSession(c)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
		wantJSON(t, w, "error", "billing is not enabled")
	})

	t.Run("viewer forbidden", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testViewerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "viewer")

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		if w.Code != http.StatusForbidden {
			t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
		}
		wantJSONContains(t, w, "error", "you don't have permissions")
	})

	t.Run("developer forbidden", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testDeveloperEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "developer")

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		if w.Code != http.StatusForbidden {
			t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
		}
		wantJSONContains(t, w, "error", "you don't have permissions")
	})

	t.Run("admin authorized", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testAdminEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "admin")

		// Send nil body — handler gets past authz and fails at ShouldBindJSON.
		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		// 400 (not 403) proves the admin passed authz.
		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d (admin should pass authz)", w.Code, http.StatusBadRequest)
		}
		wantJSON(t, w, "error", "invalid request body")
	})

	t.Run("owner authorized", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")

		// Send nil body — handler gets past authz and fails at ShouldBindJSON.
		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		// 400 (not 403) proves the owner passed authz.
		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d (owner should pass authz)", w.Code, http.StatusBadRequest)
		}
		wantJSON(t, w, "error", "invalid request body")
	})

	t.Run("already on pro", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_existing"))

		body, _ := json.Marshal(CreateCheckoutSessionRequest{
			SuccessURL: "https://example.com/success",
			CancelURL:  "https://example.com/cancel",
		})
		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", bytes.NewReader(body))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
		wantJSON(t, w, "error", "team is already on pro plan")
	})

	t.Run("new customer happy path", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)
		setStripeConfig(t, "price_test_123", "")

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, "free-team", true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		mockCreateStripeCustomer(t, func(params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: "cus_new_123"}, nil
		})
		mockFindActiveSubscription(t, func(customerID string) (*stripe.Subscription, error) {
			return nil, nil
		})
		mockCreateCheckoutSession(t, func(params *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
			return &stripe.CheckoutSession{URL: "https://checkout.stripe.com/test"}, nil
		})

		body, _ := json.Marshal(CreateCheckoutSessionRequest{
			SuccessURL: "https://example.com/success",
			CancelURL:  "https://example.com/cancel",
		})
		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", bytes.NewReader(body))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}
		wantJSON(t, w, "checkout_url", "https://checkout.stripe.com/test")

		// Checkout creates a Stripe customer but does not upgrade the plan
		// (upgrade happens later via webhook).
		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q (should still be free)", bc.Plan, "free")
		}
		if bc.StripeCustomerID == nil || *bc.StripeCustomerID != "cus_new_123" {
			t.Errorf("stripe_customer_id = %v, want %q", bc.StripeCustomerID, "cus_new_123")
		}
	})

	t.Run("existing active subscription self-heals", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, "free-team", false)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_existing"), nil)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		mockFindActiveSubscription(t, func(customerID string) (*stripe.Subscription, error) {
			return &stripe.Subscription{ID: "sub_existing_456"}, nil
		})

		body, _ := json.Marshal(CreateCheckoutSessionRequest{
			SuccessURL: "https://example.com/success",
			CancelURL:  "https://example.com/cancel",
		})
		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", bytes.NewReader(body))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}
		wantJSON(t, w, "already_upgraded", true)

		// Self-heal performs a full upgrade.
		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_existing_456" {
			t.Errorf("stripe_subscription_id = %v, want %q", bc.StripeSubscriptionID, "sub_existing_456")
		}
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true after self-heal")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})

	t.Run("stripe customer creation fails", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, "free-team", true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		mockCreateStripeCustomer(t, func(params *stripe.CustomerParams) (*stripe.Customer, error) {
			return nil, errors.New("stripe unavailable")
		})

		body, _ := json.Marshal(CreateCheckoutSessionRequest{
			SuccessURL: "https://example.com/success",
			CancelURL:  "https://example.com/cancel",
		})
		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/checkout", bytes.NewReader(body))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CreateCheckoutSession(c)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSON(t, w, "error", "failed to create checkout session")

		// DB should be unchanged after failure.
		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q (unchanged after failure)", bc.Plan, "free")
		}
		if bc.StripeCustomerID != nil {
			t.Errorf("stripe_customer_id = %v, want nil (unchanged after failure)", *bc.StripeCustomerID)
		}
	})
}

// --------------------------------------------------------------------------
// Handler: CancelAndDowngradeToFreePlan
// --------------------------------------------------------------------------

func TestCancelAndDowngradeToFreePlan(t *testing.T) {
	t.Run("billing disabled", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		defer func() { server.Server.Config.BillingEnabled = orig }()

		c, w := newTestGinContext("POST", "/teams/test/billing/downgrade", nil)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}

		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
		wantJSON(t, w, "error", "billing is not enabled")
	})

	t.Run("viewer forbidden", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testViewerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "viewer")

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusForbidden {
			t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
		}
		wantJSONContains(t, w, "error", "you don't have permissions")
	})

	t.Run("developer forbidden", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testDeveloperEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "developer")

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusForbidden {
			t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
		}
		wantJSONContains(t, w, "error", "you don't have permissions")
	})

	t.Run("admin authorized", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testAdminEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "admin")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CancelAndDowngradeToFreePlan(c)

		// Should return 200 OK as downgrade is idempotent.
		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
		wantJSON(t, w, "status", "downgraded to free")
	})

	t.Run("owner authorized", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, testTeamName, true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CancelAndDowngradeToFreePlan(c)

		// Should return 200 OK as downgrade is idempotent.
		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
		wantJSON(t, w, "status", "downgraded to free")
	})

	t.Run("already on free", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, "free-team", true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CancelAndDowngradeToFreePlan(c)

		// Should return 200 OK as downgrade is idempotent.
		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
		}
		wantJSON(t, w, "status", "downgraded to free")
	})

	t.Run("success with subscription", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		appID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_111"), strPtr("sub_789"))
		seedApp(ctx, t, appID, teamID, 180)

		mockCancelStripeSubscription(t, func(id string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
			if id != "sub_789" {
				t.Errorf("cancel called with id = %q, want %q", id, "sub_789")
			}
			return &stripe.Subscription{}, nil
		})

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}
		wantJSON(t, w, "status", "downgraded to free")

		bc := getTeamBilling(ctx, t, teamID)
		// In async flow, the plan remains "pro" until the webhook processes the cancellation.
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_789" {
			t.Errorf("stripe_subscription_id = %v, want %q", bc.StripeSubscriptionID, "sub_789")
		}
		// Ingest status remains unchanged until downgrade processing.
		if getTeamIngestBlockedReason(ctx, t, teamID) != nil {
			t.Error("ingest blocked reason should be nil")
		}
	})

	t.Run("stripe cancel fails", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, testOwnerEmail)
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_fail"))

		mockCancelStripeSubscription(t, func(id string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
			return nil, errors.New("stripe unavailable")
		})

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/billing/downgrade", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		CancelAndDowngradeToFreePlan(c)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSON(t, w, "error", "failed to downgrade to free plan")

		// DB should be unchanged after Stripe failure.
		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q (unchanged after failure)", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_fail" {
			t.Errorf("stripe_subscription_id = %v, want %q (unchanged)", bc.StripeSubscriptionID, "sub_fail")
		}
	})
}

// --------------------------------------------------------------------------
// Handler: HandleStripeWebhook
// --------------------------------------------------------------------------

func TestHandleStripeWebhook(t *testing.T) {
	t.Run("billing disabled", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		defer func() { server.Server.Config.BillingEnabled = orig }()

		c, w := newTestGinContext("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))

		HandleStripeWebhook(c)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
		wantJSON(t, w, "error", "billing is not enabled")
	})

	t.Run("checkout.session.completed upgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)
		setStripeConfig(t, "", "whsec_test")

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", false)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		raw, _ := json.Marshal(map[string]any{
			"client_reference_id": teamID.String(),
			"subscription":        map[string]any{"id": "sub_checkout_123"},
		})
		mockConstructWebhookEvent(t, func([]byte, string, string) (stripe.Event, error) {
			return stripe.Event{
				Type: "checkout.session.completed",
				Data: &stripe.EventData{Raw: raw},
			}, nil
		})

		c, w := newTestGinContext("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
		c.Request.Header.Set("Stripe-Signature", "test_sig")

		HandleStripeWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}
		wantJSON(t, w, "received", true)

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_checkout_123" {
			t.Errorf("stripe_subscription_id = %v, want %q", bc.StripeSubscriptionID, "sub_checkout_123")
		}
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true after checkout")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})

	t.Run("customer.subscription.deleted downgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)
		setStripeConfig(t, "", "whsec_test")

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_to_delete"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_to_delete"})
		mockConstructWebhookEvent(t, func([]byte, string, string) (stripe.Event, error) {
			return stripe.Event{
				Type: "customer.subscription.deleted",
				Data: &stripe.EventData{Raw: raw},
			}, nil
		})

		c, w := newTestGinContext("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
		c.Request.Header.Set("Stripe-Signature", "test_sig")

		HandleStripeWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}
		wantJSON(t, w, "received", true)

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if bc.StripeSubscriptionID != nil {
			t.Errorf("stripe_subscription_id = %v, want nil", *bc.StripeSubscriptionID)
		}
		if r := getAppRetention(ctx, t, appID); r != FREE_PLAN_MAX_RETENTION_DAYS {
			t.Errorf("app retention = %d, want %d", r, FREE_PLAN_MAX_RETENTION_DAYS)
		}
		// ProcessDowngrade updates ingest status based on usage (0 in test = under limit)
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true after downgrade with no usage")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})

	t.Run("customer.subscription.updated canceled downgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)
		setStripeConfig(t, "", "whsec_test")

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_to_cancel"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_to_cancel", "status": "canceled"})
		mockConstructWebhookEvent(t, func([]byte, string, string) (stripe.Event, error) {
			return stripe.Event{
				Type: "customer.subscription.updated",
				Data: &stripe.EventData{Raw: raw},
			}, nil
		})

		c, w := newTestGinContext("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
		c.Request.Header.Set("Stripe-Signature", "test_sig")

		HandleStripeWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		wantJSON(t, w, "received", true)

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if bc.StripeSubscriptionID != nil {
			t.Errorf("stripe_subscription_id = %v, want nil", *bc.StripeSubscriptionID)
		}
		if r := getAppRetention(ctx, t, appID); r != FREE_PLAN_MAX_RETENTION_DAYS {
			t.Errorf("app retention = %d, want %d", r, FREE_PLAN_MAX_RETENTION_DAYS)
		}
		// ProcessDowngrade updates ingest status based on usage (0 in test = under limit)
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true after downgrade with no usage")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})

	t.Run("customer.subscription.updated active no change", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)
		setStripeConfig(t, "", "whsec_test")

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_active"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_active", "status": "active"})
		mockConstructWebhookEvent(t, func([]byte, string, string) (stripe.Event, error) {
			return stripe.Event{
				Type: "customer.subscription.updated",
				Data: &stripe.EventData{Raw: raw},
			}, nil
		})

		c, w := newTestGinContext("POST", "/stripe/webhook", bytes.NewReader([]byte(`{}`)))
		c.Request.Header.Set("Stripe-Signature", "test_sig")

		HandleStripeWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		wantJSON(t, w, "received", true)

		// Active subscription should leave everything unchanged.
		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_active" {
			t.Errorf("stripe_subscription_id = %v, want %q (unchanged)", bc.StripeSubscriptionID, "sub_active")
		}
		if r := getAppRetention(ctx, t, appID); r != 180 {
			t.Errorf("app retention = %d, want %d (unchanged)", r, 180)
		}
	})
}
