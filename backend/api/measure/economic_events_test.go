//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"backend/autumn"
	"backend/libs/posthog"

	"github.com/google/uuid"
)

// posthogCapture collects PostHog events received by the stub across however
// many batches the SDK chooses to send.
type posthogCapture struct {
	mu     sync.Mutex
	events []map[string]any
}

func (c *posthogCapture) findEvent(name string) (map[string]any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, e := range c.events {
		if e["event"] == name {
			return e, true
		}
	}
	return nil, false
}

func (c *posthogCapture) hasEvent(name string) bool {
	_, ok := c.findEvent(name)
	return ok
}

// startPostHogStub stands up a test server that captures PostHog batch
// requests, points the posthog package at it, and returns the capture plus a
// cleanup closure. The cleanup calls posthog.Close to force a final flush.
func startPostHogStub(t *testing.T) (*posthogCapture, func()) {
	t.Helper()
	cap := &posthogCapture{}
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		batch, _ := body["batch"].([]any)
		cap.mu.Lock()
		for _, m := range batch {
			if evt, ok := m.(map[string]any); ok {
				cap.events = append(cap.events, evt)
			}
		}
		cap.mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	posthog.Init("phc_test_key", ts.URL)
	cleanup := func() {
		posthog.Close()
		ts.Close()
	}
	return cap, cleanup
}

// flushPostHog forces the SDK to flush pending events and gives the HTTP
// stub a moment to receive them. Safe to call before the deferred cleanup
// runs Close again — Close is idempotent.
func flushPostHog() {
	posthog.Close()
	time.Sleep(200 * time.Millisecond)
}

func newTestProductData(customerID, planID string, startedAt int64) autumn.CustomerProductsUpdatedData {
	return autumn.CustomerProductsUpdatedData{
		Customer: autumn.Customer{ID: customerID},
		UpdatedProduct: autumn.CustomerProduct{
			ID:        planID,
			StartedAt: startedAt,
		},
	}
}

// expectGroups asserts that the PostHog event's $groups contains the team.
func expectGroups(t *testing.T, props map[string]any, teamID uuid.UUID) {
	t.Helper()
	groups, _ := props["$groups"].(map[string]any)
	if groups["team"] != teamID.String() {
		t.Errorf("$groups.team = %v, want %s", groups["team"], teamID.String())
	}
}

func TestFirePurchaseEvent(t *testing.T) {
	teamID := uuid.New()
	owner := TeamOwner{UserID: uuid.New().String(), Email: "owner@example.com"}
	const customerID = "cust-purchase"
	const startedAt = int64(1700000000000)

	t.Run("fires for Pro plan with full payload", func(t *testing.T) {
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		data := newTestProductData(customerID, autumnPlanPro, startedAt)
		firePurchaseEvent(context.Background(), teamID, owner, data)
		flushPostHog()

		evt, found := cap.findEvent("purchase")
		if !found {
			t.Fatal("purchase event not captured")
		}
		if evt["distinct_id"] != owner.UserID {
			t.Errorf("distinct_id = %v, want %s", evt["distinct_id"], owner.UserID)
		}
		props, _ := evt["properties"].(map[string]any)
		if v, _ := props["revenue"].(float64); v != 600 {
			t.Errorf("revenue = %v, want 600", props["revenue"])
		}
		if props["currency"] != "USD" {
			t.Errorf("currency = %v, want USD", props["currency"])
		}
		if props["product"] != autumnPlanPro {
			t.Errorf("product = %v, want %s", props["product"], autumnPlanPro)
		}
		if props["contract_length"] != "monthly" {
			t.Errorf("contract_length = %v, want monthly", props["contract_length"])
		}
		if props["schema_version"] != "v1" {
			t.Errorf("schema_version = %v, want v1", props["schema_version"])
		}
		wantSubID := customerID + ":" + autumnPlanPro + ":1700000000000"
		if props["subscription_id"] != wantSubID {
			t.Errorf("subscription_id = %v, want %s", props["subscription_id"], wantSubID)
		}
		expectGroups(t, props, teamID)
	})

	t.Run("skips for Free plan", func(t *testing.T) {
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		data := newTestProductData(customerID, autumnPlanFree, startedAt)
		firePurchaseEvent(context.Background(), teamID, owner, data)
		flushPostHog()

		if cap.hasEvent("purchase") {
			t.Error("purchase event should not fire for Free plan")
		}
	})

	t.Run("skips for plan with no price-map entry", func(t *testing.T) {
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		data := newTestProductData(customerID, "measure_enterprise_custom", startedAt)
		firePurchaseEvent(context.Background(), teamID, owner, data)
		flushPostHog()

		if cap.hasEvent("purchase") {
			t.Error("purchase event should not fire when plan has no price-map entry")
		}
	})
}

func TestFireSubscriptionUpgradedEvent(t *testing.T) {
	teamID := uuid.New()
	owner := TeamOwner{UserID: uuid.New().String(), Email: "owner@example.com"}
	const customerID = "cust-upgrade"
	const startedAt = int64(1700000000000)

	t.Run("fires for Pro plan with full payload", func(t *testing.T) {
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		data := newTestProductData(customerID, autumnPlanPro, startedAt)
		fireSubscriptionUpgradedEvent(context.Background(), teamID, owner, data)
		flushPostHog()

		evt, found := cap.findEvent("subscription_upgraded")
		if !found {
			t.Fatal("subscription_upgraded event not captured")
		}
		if evt["distinct_id"] != owner.UserID {
			t.Errorf("distinct_id = %v, want %s", evt["distinct_id"], owner.UserID)
		}
		props, _ := evt["properties"].(map[string]any)
		if v, _ := props["revenue"].(float64); v != 600 {
			t.Errorf("revenue = %v, want 600", props["revenue"])
		}
		if props["currency"] != "USD" {
			t.Errorf("currency = %v, want USD", props["currency"])
		}
		if props["product"] != autumnPlanPro {
			t.Errorf("product = %v, want %s", props["product"], autumnPlanPro)
		}
		if props["schema_version"] != "v1" {
			t.Errorf("schema_version = %v, want v1", props["schema_version"])
		}
		wantSubID := customerID + ":" + autumnPlanPro + ":1700000000000"
		if props["subscription_id"] != wantSubID {
			t.Errorf("subscription_id = %v, want %s", props["subscription_id"], wantSubID)
		}
		expectGroups(t, props, teamID)
	})

	t.Run("skips for Free plan", func(t *testing.T) {
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		data := newTestProductData(customerID, autumnPlanFree, startedAt)
		fireSubscriptionUpgradedEvent(context.Background(), teamID, owner, data)
		flushPostHog()

		if cap.hasEvent("subscription_upgraded") {
			t.Error("subscription_upgraded should not fire for Free plan")
		}
	})
}

func TestFireSubscriptionDowngradedEvent(t *testing.T) {
	teamID := uuid.New()
	owner := TeamOwner{UserID: uuid.New().String(), Email: "owner@example.com"}
	const customerID = "cust-downgrade"
	const startedAt = int64(1700000000000)

	cap, cleanup := startPostHogStub(t)
	defer cleanup()

	data := newTestProductData(customerID, autumnPlanFree, startedAt)
	fireSubscriptionDowngradedEvent(context.Background(), teamID, owner, data)
	flushPostHog()

	evt, found := cap.findEvent("subscription_downgraded")
	if !found {
		t.Fatal("subscription_downgraded event not captured")
	}
	if evt["distinct_id"] != owner.UserID {
		t.Errorf("distinct_id = %v, want %s", evt["distinct_id"], owner.UserID)
	}
	props, _ := evt["properties"].(map[string]any)
	if props["product"] != autumnPlanFree {
		t.Errorf("product = %v, want %s", props["product"], autumnPlanFree)
	}
	if props["schema_version"] != "v1" {
		t.Errorf("schema_version = %v, want v1", props["schema_version"])
	}
	wantSubID := customerID + ":" + autumnPlanFree + ":1700000000000"
	if props["subscription_id"] != wantSubID {
		t.Errorf("subscription_id = %v, want %s", props["subscription_id"], wantSubID)
	}
	expectGroups(t, props, teamID)
}

func TestFireSubscriptionCancelledEvent(t *testing.T) {
	teamID := uuid.New()
	owner := TeamOwner{UserID: uuid.New().String(), Email: "owner@example.com"}
	const customerID = "cust-cancel"
	const startedAt = int64(1700000000000)

	cap, cleanup := startPostHogStub(t)
	defer cleanup()

	data := newTestProductData(customerID, autumnPlanPro, startedAt)
	fireSubscriptionCancelledEvent(context.Background(), teamID, owner, data)
	flushPostHog()

	evt, found := cap.findEvent("subscription_cancelled")
	if !found {
		t.Fatal("subscription_cancelled event not captured")
	}
	if evt["distinct_id"] != owner.UserID {
		t.Errorf("distinct_id = %v, want %s", evt["distinct_id"], owner.UserID)
	}
	props, _ := evt["properties"].(map[string]any)
	if props["product"] != autumnPlanPro {
		t.Errorf("product = %v, want %s", props["product"], autumnPlanPro)
	}
	if props["schema_version"] != "v1" {
		t.Errorf("schema_version = %v, want v1", props["schema_version"])
	}
	wantSubID := customerID + ":" + autumnPlanPro + ":1700000000000"
	if props["subscription_id"] != wantSubID {
		t.Errorf("subscription_id = %v, want %s", props["subscription_id"], wantSubID)
	}
	expectGroups(t, props, teamID)
}
