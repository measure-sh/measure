package measure

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"backend/libs/autumn"
	"backend/libs/email"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// Retention bounds enforced server-side. Per-plan retention values live in
// Autumn (read via the retention_days feature); these constants only define
// the floor we accept and the self-host default.
const (
	MIN_RETENTION_DAYS = 30
	MAX_RETENTION_DAYS = 365
)

// Plan identifiers surfaced to the frontend.
const (
	PlanFree       = "free"
	PlanPro        = "pro"
	PlanEnterprise = "enterprise"
)

// Autumn plan IDs — match the slugs configured in the Autumn dashboard.
const (
	AutumnPlanFree = "measure_free"
	AutumnPlanPro  = "measure_pro"
)

// BillingInfo is the payload for GET /teams/{id}/billing/info.
//
// Single source for plan + bytes + subscription state used by the dashboard.
// Subscription fields are only populated when the customer has at least one
// Autumn subscription. CurrentPeriodStart/End are seconds since epoch (the
// frontend multiplies by 1000 for JS Date).
type BillingInfo struct {
	TeamID           uuid.UUID `json:"team_id"`
	Plan             string    `json:"plan"`
	AutumnCustomerID *string   `json:"autumn_customer_id"`
	BytesGranted     float64   `json:"bytes_granted"`
	BytesUsed        float64   `json:"bytes_used"`
	// BytesUnlimited is true when the customer's bytes feature is configured
	// as unlimited in Autumn — typically only on bespoke Enterprise plans.
	BytesUnlimited bool `json:"bytes_unlimited"`
	// BytesOverageAllowed is true when the customer's plan permits going
	// over BytesGranted (Pro: yes, Free: no, Enterprise: depends).
	BytesOverageAllowed bool `json:"bytes_overage_allowed"`
	// TokenCreditsGranted and TokenCreditsUsed describe the agent_tokens
	// feature balance from Autumn. agent_tokens is a credit system: token usage
	// is priced through Autumn's model catalog into credits, so these are
	// denominated in credits, not raw token counts.
	TokenCreditsGranted float64 `json:"token_credits_granted,omitempty"`
	TokenCreditsUsed    float64 `json:"token_credits_used,omitempty"`
	// TokenCreditsUnlimited is true when the agent_tokens feature is configured
	// as unlimited in Autumn.
	TokenCreditsUnlimited bool `json:"token_credits_unlimited,omitempty"`
	// TokenCreditsOverageAllowed is true when the customer's plan permits going
	// over TokenCreditsGranted.
	TokenCreditsOverageAllowed bool `json:"token_credits_overage_allowed,omitempty"`
	// RetentionDays is the retention entitlement on the customer's current
	// plan, read from the retention_days feature in Autumn. 0 when billing
	// is disabled or the customer has no Autumn record yet.
	RetentionDays      int    `json:"retention_days,omitempty"`
	Status             string `json:"status,omitempty"`
	CurrentPeriodStart int64  `json:"current_period_start,omitempty"`
	CurrentPeriodEnd   int64  `json:"current_period_end,omitempty"`
	// CanceledAt is non-zero when a cancel_end_of_cycle is pending on the
	// active subscription. The subscription remains usable until
	// CurrentPeriodEnd; the frontend reads this to swap the downgrade button
	// to "Undo Cancellation".
	CanceledAt int64 `json:"canceled_at,omitempty"`
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

var ErrTeamNotFound = errors.New("team not found")

// GetAutumnCustomerID reads the autumn_customer_id for a team. Returns
// ErrTeamNotFound if no such team, and empty string if the column is NULL.
func GetAutumnCustomerID(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) (string, error) {
	stmt := sqlf.PostgreSQL.
		Select("autumn_customer_id").
		From("teams").
		Where("id = ?", teamID)
	defer stmt.Close()

	var customerID *string
	err := pool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrTeamNotFound
		}
		return "", err
	}
	if customerID == nil {
		return "", nil
	}
	return *customerID, nil
}

// DeterminePlan inspects a customer's active subscriptions/products and
// returns the plan name we surface to the frontend (free, pro, enterprise).
//
// API responses populate Subscriptions[].PlanID; webhook payloads populate
// Products[].ID. We check both so the same helper works on either source.
// Subscriptions with status != "active" (e.g. a Free that's "scheduled" to
// take over after a Pro cancellation) are ignored — we only report on the
// plan currently in effect.
func DeterminePlan(c *autumn.Customer) string {
	hasActiveSub := false
	hasActiveProduct := false
	hasPlan := func(id string) bool {
		for _, s := range c.Subscriptions {
			if s.Status != "active" {
				continue
			}
			hasActiveSub = true
			if s.PlanID == id {
				return true
			}
		}
		for _, p := range c.Products {
			// Webhook payloads sometimes omit status — treat empty as active
			// for back-compat. Otherwise skip non-active (e.g. scheduled).
			if p.Status != "" && p.Status != "active" {
				continue
			}
			hasActiveProduct = true
			if p.ID == id {
				return true
			}
		}
		return false
	}

	if hasPlan(AutumnPlanPro) {
		return PlanPro
	}
	if hasPlan(AutumnPlanFree) {
		return PlanFree
	}
	// Any attached non-free, non-pro plan counts as Enterprise (bespoke plan).
	if hasActiveSub || hasActiveProduct {
		return PlanEnterprise
	}
	return PlanFree
}

// saveAutumnCustomerID persists an Autumn customer ID on the teams row.
// Accepts an optional transaction handle; pass nil to use the pool directly.
func saveAutumnCustomerID(ctx context.Context, pool *pgxpool.Pool, tx pgx.Tx, teamID uuid.UUID, customerID string) error {
	stmt := sqlf.PostgreSQL.
		Update("teams").
		Set("autumn_customer_id", customerID).
		Set("updated_at", time.Now()).
		Where("id = ?", teamID)
	defer stmt.Close()

	if tx != nil {
		_, err := tx.Exec(ctx, stmt.String(), stmt.Args()...)
		return err
	}
	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// ProvisionAutumnCustomer creates an Autumn customer for the given team and
// returns the newly created autumn_customer_id. Called inside the
// team-creation transaction so that team creation fails if Autumn is
// unreachable. Autumn auto-attaches the Free plan on customer create — no
// explicit Attach call is needed.
func ProvisionAutumnCustomer(ctx context.Context, billingEnabled bool, tx pgx.Tx, teamID uuid.UUID, teamName, ownerEmail string) (string, error) {
	if !billingEnabled {
		return "", nil
	}
	autumnCustomerID := uuid.New().String()
	cust, err := autumn.GetOrCreateCustomer(ctx, autumnCustomerID, ownerEmail, teamName)
	if err != nil {
		return "", fmt.Errorf("autumn create customer: %w", err)
	}
	if err := saveAutumnCustomerID(ctx, nil, tx, teamID, cust.ID); err != nil {
		return "", fmt.Errorf("save autumn customer id: %w", err)
	}
	return cust.ID, nil
}

// resetAppsRetention resets all apps for a team to the given retention.
// Pass a non-nil tx to enroll the update in a caller-managed transaction.
func resetAppsRetention(ctx context.Context, pool *pgxpool.Pool, tx pgx.Tx, teamID uuid.UUID, days int) error {
	stmt := sqlf.PostgreSQL.
		Update("apps").
		Set("retention", days).
		Set("updated_at", time.Now()).
		Where("team_id = ?", teamID)
	defer stmt.Close()

	if tx != nil {
		_, err := tx.Exec(ctx, stmt.String(), stmt.Args()...)
		return err
	}
	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// ----------------------------------------------------------------------------
// Retention checks (called from other handlers in this package)
// ----------------------------------------------------------------------------

// GetPlanRetentionDays returns the retention in days for a team's current
// Autumn plan, read from the retention_days feature entitlement. In
// self-hosted mode (billing disabled), returns the Free plan default — the
// user controls retention directly in that mode.
//
// Every plan in Autumn (Free, Pro, Enterprise) must have the retention_days
// feature configured; if it's missing, this returns an error rather than
// silently downgrading retention.
func GetPlanRetentionDays(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, teamID uuid.UUID) (int, error) {
	if !billingEnabled {
		return MIN_RETENTION_DAYS, nil
	}
	customerID, err := GetAutumnCustomerID(ctx, pg, teamID)
	if err != nil {
		return 0, err
	}
	if customerID == "" {
		return MIN_RETENTION_DAYS, nil
	}
	cust, err := autumn.GetCustomer(ctx, customerID)
	if err != nil {
		return 0, fmt.Errorf("autumn get customer: %w", err)
	}
	b, ok := cust.Balances[autumn.FeatureRetentionDays]
	if !ok || b.Granted <= 0 {
		return 0, fmt.Errorf("retention_days feature not configured for customer %s", customerID)
	}
	return int(b.Granted), nil
}

func lookupTeamIDByAutumnCustomer(ctx context.Context, pg *pgxpool.Pool, customerID string) (uuid.UUID, error) {
	stmt := sqlf.PostgreSQL.
		Select("id").
		From("teams").
		Where("autumn_customer_id = ?", customerID)
	defer stmt.Close()

	var teamID uuid.UUID
	err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&teamID)
	return teamID, err
}

// HandleBillingUpdated applies a plan transition from an Autumn billing.updated
// event. A transition is one plan activating in place of another expiring in the
// same event; comparing their ranks tells an upgrade from a downgrade. In-place
// "updated"/"scheduled" changes, a same-rank swap (e.g. re-attaching a plan when
// a priced feature is added), and a lone Free activation (new-team signup) carry
// no transition.
func HandleBillingUpdated(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, siteOrigin, txEmail string, data autumn.BillingUpdatedData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, pg, data.CustomerID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.CustomerID, err)
		return
	}

	var activated, expired *autumn.Subscription
	for i := range data.PlanChanges {
		pc := &data.PlanChanges[i]
		switch pc.Action {
		case autumn.ActionActivated:
			activated = &pc.Subscription
		case autumn.ActionExpired:
			expired = &pc.Subscription
		}
	}
	// Without both a plan starting and one ending there is no transition to
	// apply: an in-place update (a priced feature added), a scheduled change, or
	// a new team's first Free attach.
	if activated == nil || expired == nil {
		return
	}

	switch {
	case planRank(activated.PlanID) > planRank(expired.PlanID):
		if err := applyPlanTransition(ctx, pg, billingEnabled, teamID, func(ctx context.Context, tx pgx.Tx) error {
			return notifyUpgrade(ctx, pg, tx, siteOrigin, txEmail, teamID)
		}); err != nil {
			return
		}
		owner, ok := lookupOwnerForAnalytics(ctx, pg, teamID)
		if !ok {
			return
		}
		firePaidConversionEvent(ctx, owner, data.CustomerID, *activated)
		firePurchaseEvent(teamID, owner, data.CustomerID, *activated)
		fireSubscriptionUpgradedEvent(teamID, owner, data.CustomerID, *activated)

	case planRank(activated.PlanID) < planRank(expired.PlanID):
		applyPlanTransition(ctx, pg, billingEnabled, teamID, func(ctx context.Context, tx pgx.Tx) error {
			return notifyDowngrade(ctx, pg, tx, siteOrigin, txEmail, teamID)
		})
		owner, ok := lookupOwnerForAnalytics(ctx, pg, teamID)
		if !ok {
			return
		}
		fireSubscriptionDowngradedEvent(teamID, owner, data.CustomerID, *activated)
	}
}

// planRank orders plans by tier so a transition's direction can be read from the
// plans that activated and expired: Free < Pro < everything else (custom
// Enterprise plans).
func planRank(planID string) int {
	switch planID {
	case AutumnPlanFree:
		return 0
	case AutumnPlanPro:
		return 1
	default:
		return 2
	}
}

// applyPlanTransition runs the retention reset and email enqueue for a real
// plan change inside a single tx so they atomically commit. If either step
// fails, the whole webhook ack stays 200 (Svix won't retry) but we don't
// leave the database in a half-applied state — the next plan event will
// reconcile retention, and the missed email is a soft failure.
//
// Returns the underlying error so callers can gate downstream side effects
// (e.g. analytics events) on a successful transition. The error is already
// logged here; callers should not log it again.
func applyPlanTransition(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, teamID uuid.UUID, notify func(ctx context.Context, tx pgx.Tx) error) error {
	retention, err := GetPlanRetentionDays(ctx, pg, billingEnabled, teamID)
	if err != nil {
		log.Printf("webhook: resolve retention for team %s failed: %v", teamID, err)
		return err
	}

	tx, err := pg.Begin(ctx)
	if err != nil {
		log.Printf("webhook: begin tx for team %s failed: %v", teamID, err)
		return err
	}
	defer tx.Rollback(ctx)

	if err := resetAppsRetention(ctx, nil, tx, teamID, retention); err != nil {
		log.Printf("webhook: reset retention for team %s failed: %v", teamID, err)
		return err
	}
	if err := notify(ctx, tx); err != nil {
		log.Printf("webhook: notify for team %s failed: %v", teamID, err)
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("webhook: commit for team %s failed: %v", teamID, err)
		return err
	}
	return nil
}

func HandleLimitReached(ctx context.Context, pg *pgxpool.Pool, siteOrigin, txEmail string, data autumn.BalancesLimitReachedData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, pg, data.CustomerID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.CustomerID, err)
		return
	}
	notifyLimitReached(ctx, pg, siteOrigin, txEmail, teamID)
}

func HandleUsageAlert(ctx context.Context, pg *pgxpool.Pool, siteOrigin, txEmail string, data autumn.BalancesUsageAlertData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, pg, data.CustomerID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.CustomerID, err)
		return
	}
	notifyUsageAlert(ctx, pg, siteOrigin, txEmail, teamID, int(data.UsageAlert.Threshold))
}

// ----------------------------------------------------------------------------
// Email notifications
// ----------------------------------------------------------------------------

func teamName(ctx context.Context, pg *pgxpool.Pool, teamID uuid.UUID) string {
	stmt := sqlf.PostgreSQL.Select("name").From("teams").Where("id = ?", teamID)
	defer stmt.Close()
	var name string
	_ = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&name)
	return name
}

func notifyUpgrade(ctx context.Context, pg *pgxpool.Pool, tx pgx.Tx, siteOrigin, txEmail string, teamID uuid.UUID) error {
	name := teamName(ctx, pg, teamID)
	subject, body := email.UpgradeEmail(name, teamID.String(), siteOrigin)
	return queueTeamEmail(ctx, pg, tx, txEmail, teamID, subject, body)
}

func notifyDowngrade(ctx context.Context, pg *pgxpool.Pool, tx pgx.Tx, siteOrigin, txEmail string, teamID uuid.UUID) error {
	name := teamName(ctx, pg, teamID)
	subject, body := email.ManualDowngradeEmail(name, teamID.String(), siteOrigin)
	return queueTeamEmail(ctx, pg, tx, txEmail, teamID, subject, body)
}

func notifyLimitReached(ctx context.Context, pg *pgxpool.Pool, siteOrigin, txEmail string, teamID uuid.UUID) {
	name := teamName(ctx, pg, teamID)
	subject, body := email.UsageLimitEmail(name, teamID.String(), siteOrigin, 100)
	if err := queueTeamEmail(ctx, pg, nil, txEmail, teamID, subject, body); err != nil {
		log.Printf("failed to queue email for team %s: %v", teamID, err)
	}
}

func notifyUsageAlert(ctx context.Context, pg *pgxpool.Pool, siteOrigin, txEmail string, teamID uuid.UUID, threshold int) {
	name := teamName(ctx, pg, teamID)
	subject, body := email.UsageLimitEmail(name, teamID.String(), siteOrigin, threshold)
	if err := queueTeamEmail(ctx, pg, nil, txEmail, teamID, subject, body); err != nil {
		log.Printf("failed to queue email for team %s: %v", teamID, err)
	}
}

// queueTeamEmail enqueues an email for every team member. Pass a non-nil tx
// to enroll the inserts in a caller-managed transaction.
func queueTeamEmail(ctx context.Context, pg *pgxpool.Pool, tx pgx.Tx, txEmail string, teamID uuid.UUID, subject, body string) error {
	pending := email.EmailInfo{
		From:        txEmail,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	}
	return email.QueueEmailForTeam(ctx, pg, tx, teamID.String(), nil, pending)
}
