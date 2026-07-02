package autumn

import (
	"encoding/json"
	"fmt"
	"net/http"

	svix "github.com/svix/svix-webhooks/go"
)

// Event types Autumn sends to our webhook.
const (
	EventBillingUpdated       = "billing.updated"
	EventBalancesLimitReached = "balances.limit_reached"
	EventBalancesUsageAlert   = "balances.usage_alert_triggered"
)

// Actions on a billing.updated plan change.
const (
	ActionActivated = "activated" // a plan is now active on the customer
	ActionScheduled = "scheduled" // a plan is queued to start in the future
	ActionUpdated   = "updated"   // a plan's state changed in place
	ActionExpired   = "expired"   // a plan ended and is no longer in effect
)

// Event is the shape of an Autumn webhook event.
type Event struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// BillingUpdatedData is the data payload for billing.updated. plan_changes
// carries the transitions in this event: each is one plan being activated,
// scheduled, updated in place, or expired.
type BillingUpdatedData struct {
	CustomerID  string       `json:"customer_id"`
	EntityID    string       `json:"entity_id,omitempty"`
	PlanChanges []PlanChange `json:"plan_changes"`
}

// PlanChange is one plan transition inside a billing.updated event.
// Subscription is the plan's state after the change; it reuses the shared
// Subscription type, whose plan_id/started_at/status fields match the webhook's
// subscription object.
type PlanChange struct {
	Action       string       `json:"action"`
	Subscription Subscription `json:"subscription"`
}

// BalancesLimitReachedData is the data payload for balances.limit_reached.
type BalancesLimitReachedData struct {
	CustomerID string `json:"customer_id"`
	FeatureID  string `json:"feature_id"`
	EntityID   string `json:"entity_id,omitempty"`
	LimitType  string `json:"limit_type"`
}

// BalancesUsageAlertData is the data payload for balances.usage_alert_triggered.
type BalancesUsageAlertData struct {
	CustomerID string     `json:"customer_id"`
	FeatureID  string     `json:"feature_id"`
	UsageAlert UsageAlert `json:"usage_alert"`
}

// UsageAlert is a named threshold configured in the Autumn dashboard.
type UsageAlert struct {
	Name          string  `json:"name"`
	Threshold     float64 `json:"threshold"`
	ThresholdType string  `json:"threshold_type"` // "usage" | "usage_percentage"
}

// VerifyWebhook validates the Svix signature on an Autumn webhook payload
// and returns the parsed Event on success.
//
// The secret is Autumn's dashboard-provided webhook signing secret
// (starts with "whsec_").
func VerifyWebhook(headers http.Header, body []byte, secret string) (*Event, error) {
	wh, err := svix.NewWebhook(secret)
	if err != nil {
		return nil, fmt.Errorf("svix: new webhook: %w", err)
	}
	if err := wh.Verify(body, headers); err != nil {
		return nil, fmt.Errorf("svix: verify signature: %w", err)
	}

	var ev Event
	if err := json.Unmarshal(body, &ev); err != nil {
		return nil, fmt.Errorf("autumn: decode event: %w", err)
	}
	return &ev, nil
}
