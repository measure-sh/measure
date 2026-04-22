package autumn

// Feature IDs configured in the Autumn dashboard. Single source of truth for
// every package that calls Autumn — keep these aligned with the dashboard.
const (
	FeatureBytes         = "bytes"
	FeatureRetentionDays = "retention_days"
)

// Customer represents an Autumn customer, including their active subscriptions
// and balances. Returned by GetOrCreateCustomer and GetCustomer.
//
// The API's GET response populates Subscriptions; the webhook payload's
// embedded customer object populates Products instead. Code that determines
// the active plan should check both.
type Customer struct {
	ID            string             `json:"id"`
	Email         string             `json:"email,omitempty"`
	Name          string             `json:"name,omitempty"`
	Subscriptions []Subscription     `json:"subscriptions,omitempty"`
	Products      []CustomerProduct  `json:"products,omitempty"`
	Balances      map[string]Balance `json:"balances,omitempty"`
}

// Subscription is an active billing subscription on a customer, as returned
// by the API. PlanID is the external plan identifier (e.g. "measure_pro").
type Subscription struct {
	ID                 string `json:"id"`
	PlanID             string `json:"plan_id"`
	Status             string `json:"status,omitempty"`
	StartedAt          int64  `json:"started_at,omitempty"`
	CurrentPeriodStart int64  `json:"current_period_start,omitempty"`
	CurrentPeriodEnd   int64  `json:"current_period_end,omitempty"`
	CanceledAt         int64  `json:"canceled_at,omitempty"`
	ExpiresAt          int64  `json:"expires_at,omitempty"`
}

// CustomerProduct is an Autumn product as it appears in webhook payloads
// (customer.products[] and updated_product). The REST API uses Subscription
// instead.
type CustomerProduct struct {
	ID        string         `json:"id"`
	Name      string         `json:"name,omitempty"`
	Status    string         `json:"status,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	StartedAt int64          `json:"started_at,omitempty"`
	EndsAt    int64          `json:"ends_at,omitempty"`
}

// Balance captures per-feature usage state on a customer.
type Balance struct {
	FeatureID      string  `json:"feature_id"`
	Granted        float64 `json:"granted"`
	Remaining      float64 `json:"remaining"`
	Usage          float64 `json:"usage"`
	Unlimited      bool    `json:"unlimited"`
	OverageAllowed bool    `json:"overage_allowed"`
	NextResetAt    int64   `json:"next_reset_at,omitempty"`
}

// createCustomerRequest is the payload for POST /v1/customers.
type createCustomerRequest struct {
	ID    string `json:"id"`
	Email string `json:"email,omitempty"`
	Name  string `json:"name,omitempty"`
}

// AttachRequest is the payload for POST /v1/billing.attach.
type AttachRequest struct {
	CustomerID            string         `json:"customer_id"`
	PlanID                string         `json:"plan_id"`
	SuccessURL            string         `json:"success_url,omitempty"`
	PlanSchedule          string         `json:"plan_schedule,omitempty"` // "immediate" | "end_of_cycle"
	RedirectMode          string         `json:"redirect_mode,omitempty"` // "always" | "if_required" | "never"
	CheckoutSessionParams map[string]any `json:"checkout_session_params,omitempty"`
}

// AttachResponse is returned by POST /v1/billing.attach.
type AttachResponse struct {
	CustomerID string `json:"customer_id"`
	// PaymentURL is set when checkout is required. Empty for in-place plan changes.
	PaymentURL string `json:"payment_url,omitempty"`
}

// Cancel actions accepted by /v1/billing.update.
const (
	CancelImmediately = "cancel_immediately"
	CancelEndOfCycle  = "cancel_end_of_cycle"
	Uncancel          = "uncancel"
)

// UpdateRequest is the payload for POST /v1/billing.update.
type UpdateRequest struct {
	CustomerID   string `json:"customer_id"`
	PlanID       string `json:"plan_id,omitempty"`
	CancelAction string `json:"cancel_action,omitempty"`
}

// UpdateResponse is returned by POST /v1/billing.update.
type UpdateResponse struct {
	CustomerID string `json:"customer_id"`
}

// openCustomerPortalRequest is the payload for
// POST /v1/customers/{id}/billing_portal.
type openCustomerPortalRequest struct {
	ReturnURL string `json:"return_url,omitempty"`
}

// openCustomerPortalResponse is returned by
// POST /v1/customers/{id}/billing_portal.
type openCustomerPortalResponse struct {
	URL string `json:"url"`
}

// trackRequest is the payload for POST /v1/balances.track.
//
// Value has no omitempty: Autumn defaults Value to 1 when the field is
// missing, which would silently misreport zero-byte ingests.
type trackRequest struct {
	CustomerID string  `json:"customer_id"`
	FeatureID  string  `json:"feature_id"`
	Value      float64 `json:"value"`
}

// checkRequest is the payload for POST /v1/balances.check.
type checkRequest struct {
	CustomerID string `json:"customer_id"`
	FeatureID  string `json:"feature_id"`
}

// CheckResponse is returned by POST /v1/balances.check.
type CheckResponse struct {
	Allowed bool    `json:"allowed"`
	Balance Balance `json:"balance"`
}
