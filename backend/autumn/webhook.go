package autumn

import (
	"encoding/json"
	"fmt"
	"net/http"

	svix "github.com/svix/svix-webhooks/go"
)

// Event scenarios on customer.products.updated.
const (
	EventCustomerProductsUpdated = "customer.products.updated"
	EventBalancesLimitReached    = "balances.limit_reached"
	EventBalancesUsageAlert      = "balances.usage_alert_triggered"
)

// Scenarios on customer.products.updated events.
const (
	ScenarioNew       = "new"
	ScenarioUpgrade   = "upgrade"
	ScenarioRenew     = "renew"
	ScenarioDowngrade = "downgrade"
	ScenarioCancel    = "cancel"
	ScenarioExpired   = "expired"
	ScenarioPastDue   = "past_due"
	ScenarioScheduled = "scheduled"
)

// Event is the shape of an Autumn webhook event.
type Event struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// CustomerProductsUpdatedData is the data payload for customer.products.updated.
type CustomerProductsUpdatedData struct {
	Scenario       string          `json:"scenario"`
	Customer       Customer        `json:"customer"`
	UpdatedProduct CustomerProduct `json:"updated_product"`
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
