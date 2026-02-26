package billing

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/stripe/stripe-go/v84"
	"github.com/stripe/stripe-go/v84/checkout/session"
	"github.com/stripe/stripe-go/v84/customer"
	"github.com/stripe/stripe-go/v84/invoice"
	"github.com/stripe/stripe-go/v84/subscription"
	"github.com/valkey-io/valkey-go"
)

const (
	FreePlanMaxRetentionDays = 30
	MaxRetentionDays         = 365
	FreePlanMaxUnits         = 1000000

	ingestCacheKeyPrefix = "ingest_allowed:"
	ingestCacheAllowed   = "1"
	ingestCacheTTL       = 15 * time.Minute
)

var (
	ErrTeamBillingNotFound = fmt.Errorf("team billing not found")
	ErrAlreadyOnFreePlan   = fmt.Errorf("team is already on free plan")
	ErrAlreadyOnProPlan    = fmt.Errorf("team is already on pro plan")
	ErrNotOnProPlan        = fmt.Errorf("team is not on pro plan")

	// Stripe SDK calls — swappable in tests.
	CancelSubscriptionFn          = subscription.Cancel
	CreateStripeCustomerFn        = customer.New
	CreateStripeCheckoutSessionFn = session.New
	FindActiveSubscriptionFn      = FindActiveSubscription
	GetStripeSubscriptionFn       = subscription.Get
	CreateInvoicePreviewFn        = invoice.CreatePreview
)

// Deps bundles all external dependencies for orchestrator functions
// (RunDailyMetering, RunHourlyBillingCheck) that need more than just PgPool.
type Deps struct {
	PgPool         *pgxpool.Pool
	ChPool         driver.Conn
	SiteOrigin     string
	TxEmailAddress string
	MeterName      string

	// Mockable Stripe calls — set to real SDK functions in production.
	GetSubscription func(string, *stripe.SubscriptionParams) (*stripe.Subscription, error)
	ReportToStripe  func(*stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error)
}

// TeamBilling represents a team's billing row.
type TeamBilling struct {
	TeamID               uuid.UUID `json:"team_id" db:"team_id"`
	Plan                 string    `json:"plan" db:"plan"`
	StripeCustomerID     *string   `json:"stripe_customer_id" db:"stripe_customer_id"`
	StripeSubscriptionID *string   `json:"stripe_subscription_id" db:"stripe_subscription_id"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time `json:"updated_at" db:"updated_at"`
}

// UpcomingInvoiceInfo holds the upcoming invoice data returned to the frontend.
type UpcomingInvoiceInfo struct {
	AmountDue int64  `json:"amount_due"`
	Currency  string `json:"currency"`
}

// SubscriptionInfo holds the subscription data returned to the frontend.
type SubscriptionInfo struct {
	Status             string               `json:"status"`
	CurrentPeriodStart int64                `json:"current_period_start"`
	CurrentPeriodEnd   int64                `json:"current_period_end"`
	UpcomingInvoice    *UpcomingInvoiceInfo `json:"upcoming_invoice"`
}

// GetSubscriptionInfo fetches live subscription status and upcoming invoice
// from Stripe for the given team. The team must be on the pro plan.
func GetSubscriptionInfo(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) (*SubscriptionInfo, error) {
	cfg, err := GetTeamBilling(ctx, pool, teamID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrTeamBillingNotFound
		}
		return nil, fmt.Errorf("error querying team billing: %w", err)
	}

	if cfg.Plan != "pro" {
		return nil, ErrNotOnProPlan
	}

	if cfg.StripeSubscriptionID == nil || *cfg.StripeSubscriptionID == "" {
		return nil, ErrNotOnProPlan
	}

	sub, err := GetStripeSubscriptionFn(*cfg.StripeSubscriptionID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch stripe subscription: %w", err)
	}

	info := &SubscriptionInfo{
		Status: string(sub.Status),
	}

	// CurrentPeriodStart/End live on the first subscription item in v84.
	if sub.Items != nil && len(sub.Items.Data) > 0 {
		item := sub.Items.Data[0]
		info.CurrentPeriodStart = item.CurrentPeriodStart
		info.CurrentPeriodEnd = item.CurrentPeriodEnd
	}

	// Fetch upcoming invoice preview — best-effort, nil on failure.
	if cfg.StripeCustomerID != nil && *cfg.StripeCustomerID != "" {
		invParams := &stripe.InvoiceCreatePreviewParams{
			Customer:     stripe.String(*cfg.StripeCustomerID),
			Subscription: stripe.String(*cfg.StripeSubscriptionID),
		}
		inv, err := CreateInvoicePreviewFn(invParams)
		if err == nil {
			info.UpcomingInvoice = &UpcomingInvoiceInfo{
				AmountDue: inv.AmountDue,
				Currency:  string(inv.Currency),
			}
		} else {
			log.Printf("failed to fetch upcoming invoice for team %s: %v", teamID, err)
		}
	}

	return info, nil
}

// GetTeamBilling reads the team_billing row for the given team.
func GetTeamBilling(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) (*TeamBilling, error) {
	stmt := sqlf.PostgreSQL.
		From(`team_billing`).
		Select("team_id").
		Select("plan").
		Select("stripe_customer_id").
		Select("stripe_subscription_id").
		Select("created_at").
		Select("updated_at").
		Where("team_id = ?", teamID)
	defer stmt.Close()

	var c TeamBilling
	err := pool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&c.TeamID,
		&c.Plan,
		&c.StripeCustomerID,
		&c.StripeSubscriptionID,
		&c.CreatedAt,
		&c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ProcessUpgrade sets a team's billing to pro plan and unblocks ingestion.
func ProcessUpgrade(ctx context.Context, pool *pgxpool.Pool, teamID string, subscriptionID string) error {
	stmt := sqlf.PostgreSQL.
		Update("team_billing").
		Set("plan", "pro").
		Set("stripe_subscription_id", subscriptionID).
		Set("updated_at", time.Now()).
		Where("team_id = ?", teamID)
	defer stmt.Close()

	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	// Ensure ingest is allowed
	stmt2 := sqlf.PostgreSQL.
		Update("teams").
		Set("allow_ingest", true).
		Set("ingest_blocked_reason", nil).
		Where("id = ?", teamID)
	defer stmt2.Close()

	_, err = pool.Exec(ctx, stmt2.String(), stmt2.Args()...)
	return err
}

// DowngradeTeamBillingToFree resets a team's billing to free plan limits.
func DowngradeTeamBillingToFree(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) error {
	stmt := sqlf.PostgreSQL.
		Update("team_billing").
		Set("plan", "free").
		Set("stripe_subscription_id", nil).
		Set("updated_at", time.Now()).
		Where("team_id = ?", teamID)
	defer stmt.Close()

	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// ProcessDowngrade performs a full downgrade to free plan: updates team billing,
// resets app retention, checks current usage, and updates ingest status.
func ProcessDowngrade(ctx context.Context, deps Deps, teamID uuid.UUID) error {
	if err := DowngradeTeamBillingToFree(ctx, deps.PgPool, teamID); err != nil {
		return fmt.Errorf("downgrade team billing: %w", err)
	}

	if err := ResetTeamAppsRetention(ctx, deps.PgPool, teamID); err != nil {
		return fmt.Errorf("reset app retention: %w", err)
	}

	// Check current usage against free limits to set ingest status
	cycleStart, cycleEnd, _ := getCalendarMonthCycle()
	usage, err := getIngestionUsage(ctx, deps.ChPool, teamID.String(), cycleStart, cycleEnd)
	if err != nil {
		// Fail open — allow ingest, let next hourly check correct if needed
		log.Printf("failed to check usage for team %s during downgrade: %v", teamID, err)
		return updateTeamIngestStatus(ctx, deps.PgPool, teamID.String(), true, nil)
	}

	if usage >= uint64(FreePlanMaxUnits) {
		reason := ReasonPlanLimitExceeded
		return updateTeamIngestStatus(ctx, deps.PgPool, teamID.String(), false, &reason)
	}

	return updateTeamIngestStatus(ctx, deps.PgPool, teamID.String(), true, nil)
}

// CancelAndDowngradeToFree performs a user-initiated downgrade: validates
// team billing, cancels the Stripe subscription if present, and runs
// the full downgrade flow.
func CancelAndDowngradeToFree(ctx context.Context, deps Deps, teamID uuid.UUID) error {
	cfg, err := GetTeamBilling(ctx, deps.PgPool, teamID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrTeamBillingNotFound
		}
		return fmt.Errorf("error querying team billing: %w", err)
	}

	if cfg.Plan == "free" {
		return nil
	}

	if cfg.StripeSubscriptionID != nil && *cfg.StripeSubscriptionID != "" {
		_, err := CancelSubscriptionFn(*cfg.StripeSubscriptionID, nil)
		if err != nil {
			// If the error is "resource missing" (already deleted), manually downgrade to ensure consistency.
			if stripeErr, ok := err.(*stripe.Error); ok && stripeErr.Code == stripe.ErrorCodeResourceMissing {
				if downErr := ProcessDowngrade(ctx, deps, teamID); downErr != nil {
					return downErr
				}
				notifyManualDowngrade(ctx, deps, teamID.String())
				return nil
			}
			return fmt.Errorf("failed to cancel stripe subscription: %w", err)
		}
		// Success. We rely on the webhook (customer.subscription.deleted) to process the downgrade.
		notifyManualDowngrade(ctx, deps, teamID.String())
		return nil
	}

	// No subscription ID found, but plan is "pro". Force downgrade immediately to correct state.
	if err := ProcessDowngrade(ctx, deps, teamID); err != nil {
		return err
	}
	notifyManualDowngrade(ctx, deps, teamID.String())
	return nil
}

// CheckoutResult represents the outcome of InitiateUpgrade.
type CheckoutResult struct {
	CheckoutURL     string
	AlreadyUpgraded bool
}

// SaveStripeCustomerID persists a Stripe customer ID to the team_billing
// row for the given team.
func SaveStripeCustomerID(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID, customerID string) error {
	stmt := sqlf.PostgreSQL.
		Update("team_billing").
		Set("stripe_customer_id", customerID).
		Set("updated_at", time.Now()).
		Where("team_id = ?", teamID)
	defer stmt.Close()

	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// InitiateUpgrade handles the business logic for starting a pro upgrade. It
// reads team billing, creates a Stripe customer if needed, and checks for an
// existing active subscription (self-heal). If one is found it reconciles the
// DB and returns AlreadyUpgraded=true; otherwise it creates a new Stripe
// checkout session and returns the URL.
func InitiateUpgrade(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID uuid.UUID,
	userEmail, priceID, successURL, cancelURL string,
) (*CheckoutResult, error) {
	cfg, err := GetTeamBilling(ctx, pool, teamID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrTeamBillingNotFound
		}
		return nil, fmt.Errorf("error querying team billing: %w", err)
	}

	if cfg.Plan == "pro" {
		return nil, ErrAlreadyOnProPlan
	}

	// Get or create Stripe customer
	var customerID string
	if cfg.StripeCustomerID != nil && *cfg.StripeCustomerID != "" {
		customerID = *cfg.StripeCustomerID
	} else {
		customerParams := &stripe.CustomerParams{
			Email: stripe.String(userEmail),
			Metadata: map[string]string{
				"team_id": teamID.String(),
			},
		}
		stripeCustomer, err := CreateStripeCustomerFn(customerParams)
		if err != nil {
			return nil, fmt.Errorf("failed to create Stripe customer: %w", err)
		}
		customerID = stripeCustomer.ID

		if err := SaveStripeCustomerID(ctx, pool, teamID, customerID); err != nil {
			return nil, fmt.Errorf("failed to save Stripe customer ID: %w", err)
		}
	}

	// Check for existing active subscription (self-heal)
	existingSub, err := FindActiveSubscriptionFn(customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing subscriptions: %w", err)
	}
	if existingSub != nil {
		if err := ProcessUpgrade(ctx, pool, teamID.String(), existingSub.ID); err != nil {
			return nil, fmt.Errorf("failed to reconcile existing subscription: %w", err)
		}
		fmt.Printf("Team %s reconciled: found existing Stripe subscription %s\n", teamID, existingSub.ID)
		return &CheckoutResult{AlreadyUpgraded: true}, nil
	}

	if priceID == "" {
		return nil, fmt.Errorf("stripe pro unit days price ID not configured")
	}

	// Create checkout session
	params := &stripe.CheckoutSessionParams{
		Customer:                 stripe.String(customerID),
		ClientReferenceID:        stripe.String(teamID.String()),
		BillingAddressCollection: stripe.String(stripe.CheckoutSessionBillingAddressCollectionRequired),
		Mode:                     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price: stripe.String(priceID),
			},
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
			Metadata: map[string]string{
				"team_id": teamID.String(),
			},
		},
	}

	s, err := CreateStripeCheckoutSessionFn(params)
	if err != nil {
		return nil, fmt.Errorf("failed to create checkout session: %w", err)
	}

	return &CheckoutResult{CheckoutURL: s.URL}, nil
}

// IsTerminalSubscriptionStatus returns true if the subscription status
// indicates the subscription has permanently failed (canceled, unpaid, or
// incomplete_expired). Used by both webhook handlers and the hourly billing check.
func IsTerminalSubscriptionStatus(status stripe.SubscriptionStatus) bool {
	return status == stripe.SubscriptionStatusCanceled ||
		status == stripe.SubscriptionStatusUnpaid ||
		status == stripe.SubscriptionStatusIncompleteExpired
}

// ResetTeamAppsRetention resets all apps for a team to free plan retention.
func ResetTeamAppsRetention(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) error {
	stmt := sqlf.PostgreSQL.
		Update("apps").
		Set("retention", FreePlanMaxRetentionDays).
		Set("updated_at", time.Now()).
		Where("team_id = ?", teamID)
	defer stmt.Close()

	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// GetTeamBySubscriptionID looks up the team that owns a given Stripe subscription.
func GetTeamBySubscriptionID(ctx context.Context, pool *pgxpool.Pool, subscriptionID string) (uuid.UUID, error) {
	query := sqlf.PostgreSQL.
		Select("team_id").
		From("team_billing").
		Where("stripe_subscription_id = ?", subscriptionID)
	defer query.Close()

	var teamID uuid.UUID
	err := pool.QueryRow(ctx, query.String(), query.Args()...).Scan(&teamID)
	return teamID, err
}

// FindActiveSubscription lists Stripe subscriptions for a customer and returns
// the first active one, or nil if none exists.
func FindActiveSubscription(customerID string) (*stripe.Subscription, error) {
	listParams := &stripe.SubscriptionListParams{
		Customer: stripe.String(customerID),
	}
	listParams.Filters.AddFilter("status", "", "active")
	listParams.Filters.AddFilter("limit", "", "1")

	iter := subscription.List(listParams)
	if iter.Next() {
		return iter.Subscription(), nil
	}
	if err := iter.Err(); err != nil {
		return nil, err
	}
	return nil, nil
}

// ingestCacheKey returns the Redis key for caching an app's ingest status.
func ingestCacheKey(appID uuid.UUID) string {
	return fmt.Sprintf("%s{%s}", ingestCacheKeyPrefix, appID.String())
}

// IsIngestAllowed checks whether ingestion is allowed for the team that owns
// the given app. Results are cached in Redis for 15 minutes when a valkey
// client is provided. Returns nil if allowed, an error describing the block
// reason otherwise.
func IsIngestAllowed(ctx context.Context, pool *pgxpool.Pool, vk valkey.Client, appID uuid.UUID) error {
	key := ingestCacheKey(appID)

	// Try cache first.
	if vk != nil {
		val, err := vk.Do(ctx, vk.B().Get().Key(key).Build()).ToString()
		if err == nil {
			if val == ingestCacheAllowed {
				return nil
			}
			return fmt.Errorf("ingestion blocked: %s", val)
		}
	}

	// Cache miss — query the database.
	query := sqlf.PostgreSQL.
		Select("t.allow_ingest").
		Select("t.ingest_blocked_reason").
		From("apps a").
		Join("teams t", "a.team_id = t.id").
		Where("a.id = ?", appID)
	defer query.Close()

	var allowIngest bool
	var blockedReason *string
	err := pool.QueryRow(ctx, query.String(), query.Args()...).Scan(&allowIngest, &blockedReason)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("app not found: %s", appID)
		}
		return fmt.Errorf("error querying ingest status: %w", err)
	}

	// Build the result to cache.
	var result error
	cacheVal := ingestCacheAllowed
	if !allowIngest {
		reason := "unknown"
		if blockedReason != nil {
			reason = *blockedReason
		}
		cacheVal = reason
		result = fmt.Errorf("ingestion blocked: %s", reason)
	}

	// Populate cache.
	if vk != nil {
		cmd := vk.B().Set().Key(key).Value(cacheVal).Ex(ingestCacheTTL).Build()
		vk.Do(ctx, cmd)
	}

	return result
}

// GetUsageThreshold returns the highest free-plan usage threshold crossed
// for the current calendar month: 75, 90, or 100. Returns 0 if the team is
// not on the free plan or if usage is below 75%.
func GetUsageThreshold(ctx context.Context, pool *pgxpool.Pool, chPool driver.Conn, teamID uuid.UUID) (int, error) {
	billing, err := GetTeamBilling(ctx, pool, teamID)
	if err != nil {
		return 0, err
	}

	if billing.Plan != "free" {
		return 0, nil
	}

	start, end, _ := getCalendarMonthCycle()
	usage, err := getIngestionUsage(ctx, chPool, teamID.String(), start, end)
	if err != nil {
		return 0, err
	}

	pct := float64(usage) / float64(FreePlanMaxUnits) * 100

	switch {
	case pct >= 100:
		return 100, nil
	case pct >= 90:
		return 90, nil
	case pct >= 75:
		return 75, nil
	default:
		return 0, nil
	}
}

// IsRetentionChangeAllowed returns true if the team is on a plan that
// permits retention changes (i.e. "pro").
func IsRetentionChangeAllowed(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) (bool, error) {
	query := sqlf.PostgreSQL.
		Select("plan").
		From("team_billing").
		Where("team_id = ?", teamID)
	defer query.Close()

	var plan string
	err := pool.QueryRow(ctx, query.String(), query.Args()...).Scan(&plan)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, fmt.Errorf("team billing not found for team: %s", teamID)
		}
		return false, fmt.Errorf("error querying team billing: %w", err)
	}

	return plan == "pro", nil
}
