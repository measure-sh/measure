//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/libs/autumn"
	autumntest "backend/libs/autumn/testhelpers"
	"backend/libs/ga4"
	"backend/libs/measure"

	"github.com/google/uuid"
)

// ga4Capture captures payloads received by the test GA4 endpoint.
type ga4Capture struct {
	payload map[string]any
	hit     chan struct{}
}

// startGA4Stub spins up a test server that records the next request's payload
// and signals via the hit channel. Returns the server URL and the capture.
// The capture is set up to handle at most one request; for negative tests use
// startGA4StubExpectingNoCalls instead.
func startGA4Stub(t *testing.T) (*ga4Capture, func()) {
	t.Helper()
	cap := &ga4Capture{hit: make(chan struct{}, 1)}
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &cap.payload)
		w.WriteHeader(http.StatusNoContent)
		cap.hit <- struct{}{}
	}))

	prev := ga4.SetEndpointBase(ts.URL + "/mp/collect")
	ga4.Init("G-TEST", "secret_abc")

	cleanup := func() {
		ga4.Init("", "")
		ga4.SetEndpointBase(prev)
		ts.Close()
	}
	return cap, cleanup
}

// waitForGA4Hit blocks until the stub receives a request or times out.
func waitForGA4Hit(t *testing.T, cap *ga4Capture, d time.Duration) bool {
	t.Helper()
	select {
	case <-cap.hit:
		return true
	case <-time.After(d):
		return false
	}
}

func TestPaidConversion(t *testing.T) {
	ctx := context.Background()
	const secret = "whsec_C2FVsBQIhrscChlQIMV+b5sSYspob7oD"

	t.Run("new subscription to Pro fires paid_conversion with correct payload", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		cap, cleanup := startGA4Stub(t)
		defer cleanup()

		// Seed team + owner with attribution + autumn customer
		teamID := uuid.New()
		ownerID := uuid.New().String()
		custID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		setUserAttribution(ctx, t, ownerID, "client-xyz", "gclid-xyz")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// Autumn returns Pro on lookup (for retention reset inside applyPlanTransition).
		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: measure.AutumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		startedAt := int64(1700000000000)
		payload := []byte(fmt.Sprintf(
			`{"type":"billing.updated","data":{"customer_id":%q,"plan_changes":[{"action":"activated","subscription":{"plan_id":%q,"started_at":%d}},{"action":"expired","subscription":{"plan_id":%q}}]}}`,
			custID, measure.AutumnPlanPro, startedAt, measure.AutumnPlanFree,
		))
		headers := signSvixWebhook(t, secret, "msg_paid_new", payload)
		c, w := newTestGinContext("POST", "/autumn/webhook", strings.NewReader(string(payload)))
		for k, v := range headers {
			c.Request.Header[k] = v
		}
		h.HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("webhook status = %d, body: %s", w.Code, w.Body.String())
		}

		if !waitForGA4Hit(t, cap, 2*time.Second) {
			t.Fatal("ga4 endpoint never received the paid_conversion event")
		}

		// Assert top-level identifiers
		if cap.payload["client_id"] != "client-xyz" {
			t.Errorf("client_id = %v, want client-xyz", cap.payload["client_id"])
		}
		if cap.payload["user_id"] != "owner@example.com" {
			t.Errorf("user_id = %v, want owner@example.com", cap.payload["user_id"])
		}

		// Assert event shape and params
		events, _ := cap.payload["events"].([]any)
		if len(events) != 1 {
			t.Fatalf("events count = %d, want 1", len(events))
		}
		evt, _ := events[0].(map[string]any)
		if evt["name"] != "paid_conversion" {
			t.Errorf("event name = %v, want paid_conversion", evt["name"])
		}
		params, _ := evt["params"].(map[string]any)

		// measure_pro at $50/mo → annualized = 600
		if v, ok := params["value"].(float64); !ok || v != 600 {
			t.Errorf("value = %v (%T), want 600", params["value"], params["value"])
		}
		if params["currency"] != "USD" {
			t.Errorf("currency = %v, want USD", params["currency"])
		}

		wantTxn := fmt.Sprintf("%s:%s:%d", custID, measure.AutumnPlanPro, startedAt)
		if params["transaction_id"] != wantTxn {
			t.Errorf("transaction_id = %v, want %q", params["transaction_id"], wantTxn)
		}
	})

	t.Run("new subscription to Free does not fire paid_conversion", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		cap, cleanup := startGA4Stub(t)
		defer cleanup()

		teamID := uuid.New()
		custID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		// Only Free activates, so there is no paid transition: the handler returns
		// before applyPlanTransition, so no autumn mock is needed.

		payload := []byte(fmt.Sprintf(
			`{"type":"billing.updated","data":{"customer_id":%q,"plan_changes":[{"action":"activated","subscription":{"plan_id":%q,"started_at":1700000000000}}]}}`,
			custID, measure.AutumnPlanFree,
		))
		headers := signSvixWebhook(t, secret, "msg_paid_new_free", payload)
		c, w := newTestGinContext("POST", "/autumn/webhook", strings.NewReader(string(payload)))
		for k, v := range headers {
			c.Request.Header[k] = v
		}
		h.HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("webhook status = %d", w.Code)
		}
		if waitForGA4Hit(t, cap, 250*time.Millisecond) {
			t.Errorf("ga4 endpoint was called for free-plan transition; payload=%v", cap.payload)
		}
	})

	t.Run("team without owner does not fire paid_conversion (logs + skips)", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		cap, cleanup := startGA4Stub(t)
		defer cleanup()

		teamID := uuid.New()
		custID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeamAutumnCustomer(ctx, t, teamID, custID)
		// no team_membership owner row

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: measure.AutumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"billing.updated","data":{"customer_id":%q,"plan_changes":[{"action":"activated","subscription":{"plan_id":%q,"started_at":1700000000000}},{"action":"expired","subscription":{"plan_id":%q}}]}}`,
			custID, measure.AutumnPlanPro, measure.AutumnPlanFree,
		))
		headers := signSvixWebhook(t, secret, "msg_paid_no_owner", payload)
		c, w := newTestGinContext("POST", "/autumn/webhook", strings.NewReader(string(payload)))
		for k, v := range headers {
			c.Request.Header[k] = v
		}
		h.HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("webhook status = %d", w.Code)
		}
		if waitForGA4Hit(t, cap, 250*time.Millisecond) {
			t.Errorf("ga4 endpoint was called when no owner exists; payload=%v", cap.payload)
		}
	})

	t.Run("owner with empty ga_client_id does not hit the network (ga4 skips silently)", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withAutumnWebhookSecret(t, secret)

		cap, cleanup := startGA4Stub(t)
		defer cleanup()

		teamID := uuid.New()
		ownerID := uuid.New().String()
		custID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, ownerID, "owner@example.com")
		// no setUserAttribution — ga_client_id stays NULL → empty string
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       custID,
				Products: []autumn.CustomerProduct{{ID: measure.AutumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		payload := []byte(fmt.Sprintf(
			`{"type":"billing.updated","data":{"customer_id":%q,"plan_changes":[{"action":"activated","subscription":{"plan_id":%q,"started_at":1700000000000}},{"action":"expired","subscription":{"plan_id":%q}}]}}`,
			custID, measure.AutumnPlanPro, measure.AutumnPlanFree,
		))
		headers := signSvixWebhook(t, secret, "msg_paid_no_clientid", payload)
		c, w := newTestGinContext("POST", "/autumn/webhook", strings.NewReader(string(payload)))
		for k, v := range headers {
			c.Request.Header[k] = v
		}
		h.HandleAutumnWebhook(c)

		if w.Code != http.StatusOK {
			t.Fatalf("webhook status = %d", w.Code)
		}
		if waitForGA4Hit(t, cap, 250*time.Millisecond) {
			t.Errorf("ga4 endpoint was called with empty client_id; payload=%v", cap.payload)
		}
	})
}
