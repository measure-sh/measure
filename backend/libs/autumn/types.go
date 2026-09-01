package autumn

// Feature IDs configured in the Autumn dashboard. Keep these in sync with it.
const (
	FeatureBytes         = "bytes"
	FeatureRetentionDays = "retention_days"
	FeatureAgentTokens   = "agent_tokens"
)

// Customer is an Autumn customer with their plans and balances.
//
// Recurring plans arrive in Subscriptions and plans sold as a one-off purchase
// arrive in Purchases, and a customer can hold both at once, so anything
// deciding which plan a customer is on has to read the two together.
type Customer struct {
	ID            string             `json:"id"`
	Email         string             `json:"email,omitempty"`
	Name          string             `json:"name,omitempty"`
	Subscriptions []Subscription     `json:"subscriptions,omitempty"`
	Purchases     []Purchase         `json:"purchases,omitempty"`
	Balances      map[string]Balance `json:"balances,omitempty"`
}

// Subscription is a recurring plan on a customer. PlanID is the plan slug
// configured in the Autumn dashboard (e.g. "measure_pro").
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

// Purchase is a plan sold as a one-off rather than as a recurring subscription,
// such as an enterprise plan sold for a fixed term. It carries no status field
// the way a subscription does, so StartedAt and ExpiresAt, both milliseconds
// since epoch, are what say whether it is in effect.
type Purchase struct {
	PlanID    string `json:"plan_id"`
	StartedAt int64  `json:"started_at,omitempty"`
	ExpiresAt int64  `json:"expires_at,omitempty"`
}

// Balance is a customer's usage state for one feature. Autumn sums the feature's
// grants across every plan the customer holds into Granted, and Breakdown says
// what each plan granted on its own.
type Balance struct {
	FeatureID      string          `json:"feature_id"`
	Granted        float64         `json:"granted"`
	Remaining      float64         `json:"remaining"`
	Usage          float64         `json:"usage"`
	Unlimited      bool            `json:"unlimited"`
	OverageAllowed bool            `json:"overage_allowed"`
	NextResetAt    int64           `json:"next_reset_at,omitempty"`
	Breakdown      []BalanceSource `json:"breakdown,omitempty"`
}

// BalanceSource is one plan's own contribution to a pooled Balance.
// IncludedGrant is what the plan grants, apart from any extra quantity bought on
// top of it, and Remaining is what is left of that plan's grant.
type BalanceSource struct {
	PlanID        string  `json:"plan_id"`
	IncludedGrant float64 `json:"included_grant"`
	Remaining     float64 `json:"remaining"`
}

// createCustomerRequest is the payload for POST /v1/customers.
type createCustomerRequest struct {
	ID    string `json:"id"`
	Email string `json:"email,omitempty"`
	Name  string `json:"name,omitempty"`
}

// updateCustomerRequest is the payload for POST /v1/customers.update.
type updateCustomerRequest struct {
	CustomerID string `json:"customer_id"`
	Email      string `json:"email,omitempty"`
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
	// PaymentURL is set when checkout is required, empty for in-place changes.
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

// trackRequest is the payload for POST /v1/balances.track. Value has no
// omitempty because Autumn defaults a missing Value to 1, which would
// misreport zero-byte ingests.
type trackRequest struct {
	CustomerID string  `json:"customer_id"`
	FeatureID  string  `json:"feature_id"`
	Value      float64 `json:"value"`
}

// TrackTokensRequest is the payload for POST /v1/balances.track_tokens, one
// model call's token usage, which Autumn prices from its model catalog. ModelID
// is "provider/model", or "openrouter/<provider>/<model>" for OpenRouter-served
// models. An empty FeatureID leaves Autumn to use the customer's sole token
// feature.
//
// The counts are exclusive pools, each priced at its own rate, so the caller
// subtracts the cache and reasoning counts from the prompt and completion totals
// before filling these in. A token counted in two pools is billed twice.
type TrackTokensRequest struct {
	CustomerID       string `json:"customer_id"`
	ModelID          string `json:"model_id"`
	InputTokens      int    `json:"input_tokens"`
	OutputTokens     int    `json:"output_tokens"`
	CacheReadTokens  int    `json:"cache_read_tokens,omitempty"`
	CacheWriteTokens int    `json:"cache_write_tokens,omitempty"`
	ReasoningTokens  int    `json:"reasoning_tokens,omitempty"`
	FeatureID        string `json:"feature_id,omitempty"`
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
