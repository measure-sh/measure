package measure

import (
	"context"
	"errors"
	"fmt"
	"log"
	"slices"
	"strings"
	"time"

	"backend/libs/autumn"
	"backend/libs/email"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// Retention bounds enforced server-side. Per-plan retention lives in Autumn's
// retention_days feature; these only bound what we accept, and the minimum
// doubles as the self-host default.
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

// Autumn plan IDs, matching the slugs configured in the Autumn dashboard.
const (
	AutumnPlanFree = "measure_free"
	AutumnPlanPro  = "measure_pro"
)

// BillingInfo is the payload for GET /teams/{id}/billing/info. Subscription
// fields are filled in only when the customer has an Autumn subscription.
// CurrentPeriodStart and CurrentPeriodEnd are seconds since epoch, which the
// frontend multiplies by 1000 for JS Date.
type BillingInfo struct {
	TeamID              uuid.UUID `json:"team_id"`
	Plan                string    `json:"plan"`
	AutumnCustomerID    *string   `json:"autumn_customer_id"`
	BytesGranted        float64   `json:"bytes_granted"`
	BytesUsed           float64   `json:"bytes_used"`
	BytesUnlimited      bool      `json:"bytes_unlimited"`
	BytesOverageAllowed bool      `json:"bytes_overage_allowed"`
	// DataPurchaseSpent is true when a plan the team holds as a one-off
	// purchase has no data left of its own grant, leaving the team on the
	// limits of the free plan they hold alongside it.
	DataPurchaseSpent bool `json:"data_purchase_spent"`
	// IngestionBlocked mirrors the verdict Autumn gives the ingest path, so the
	// dashboard does not have to infer it from a percentage.
	IngestionBlocked bool `json:"ingestion_blocked"`
	// agent_tokens is an Autumn credit system: token usage is priced through
	// Autumn's model catalog into credits, so these are credits rather than
	// raw token counts.
	TokenCreditsGranted        float64 `json:"token_credits_granted,omitempty"`
	TokenCreditsUsed           float64 `json:"token_credits_used,omitempty"`
	TokenCreditsUnlimited      bool    `json:"token_credits_unlimited,omitempty"`
	TokenCreditsOverageAllowed bool    `json:"token_credits_overage_allowed,omitempty"`
	// RetentionDays is 0 when billing is disabled or the customer has no Autumn
	// record yet.
	RetentionDays      int    `json:"retention_days,omitempty"`
	Status             string `json:"status,omitempty"`
	CurrentPeriodStart int64  `json:"current_period_start,omitempty"`
	CurrentPeriodEnd   int64  `json:"current_period_end,omitempty"`
	// CanceledAt is non-zero when a cancellation at end of cycle is pending on
	// the active subscription, which stays usable until CurrentPeriodEnd.
	CanceledAt int64 `json:"canceled_at,omitempty"`
}

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

// DeterminePlan returns the plan name we surface to the frontend (free, pro,
// enterprise) for the plans a customer holds today.
//
// Attaching an enterprise plan from the Autumn dashboard does not detach the
// free plan unless the two share a plan group, so a customer can hold several
// plans at once and the highest tier has to win. The order matches planRank:
// any plan that is neither free nor pro counts as enterprise.
func DeterminePlan(c *autumn.Customer) string {
	var activePlans []string
	for _, s := range c.Subscriptions {
		if s.Status != "active" {
			continue
		}
		activePlans = append(activePlans, s.PlanID)
	}
	now := time.Now().UnixMilli()
	for _, p := range c.Purchases {
		if !purchaseInEffect(p, now) {
			continue
		}
		activePlans = append(activePlans, p.PlanID)
	}

	if slices.ContainsFunc(activePlans, func(id string) bool {
		return id != AutumnPlanFree && id != AutumnPlanPro
	}) {
		return PlanEnterprise
	}
	if slices.Contains(activePlans, AutumnPlanPro) {
		return PlanPro
	}
	return PlanFree
}

// purchaseInEffect reports whether a purchase is running at nowMillis, given in
// milliseconds since epoch to match the timestamps on a purchase. Autumn returns
// purchases that have not begun yet, and ones whose term has ended, alongside
// the running ones, so without this test they would count as plans the customer
// holds today.
func purchaseInEffect(p autumn.Purchase, nowMillis int64) bool {
	if p.StartedAt > nowMillis {
		return false
	}
	if p.ExpiresAt != 0 && p.ExpiresAt <= nowMillis {
		return false
	}
	return true
}

// saveAutumnCustomerID persists an Autumn customer ID on the teams row. Pass a
// non-nil tx to enroll the update in a caller-managed transaction.
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
// returns the new autumn_customer_id. It runs inside the team-creation
// transaction so team creation fails when Autumn is unreachable. Autumn
// auto-attaches the free plan on customer create, so no Attach call follows.
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

// SyncBillingEmailOnOwnerExit points a team's Autumn customer email at a
// remaining owner after the member it belonged to was removed or demoted.
// Autumn and Stripe send invoices, receipts and dunning notices to that
// address, so a departed owner's address must not stay on the record. An
// address that does not match the departing member, a finance inbox set through
// the billing portal for instance, is left alone.
func SyncBillingEmailOnOwnerExit(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, teamID uuid.UUID, departedEmail string) error {
	if !billingEnabled || departedEmail == "" {
		return nil
	}

	customerID, err := GetAutumnCustomerID(ctx, pg, teamID)
	if err != nil {
		return err
	}
	// A self-hosted team has no Autumn customer and so no billing email.
	if customerID == "" {
		return nil
	}

	cust, err := autumn.GetCustomer(ctx, customerID)
	if err != nil {
		return err
	}
	if !strings.EqualFold(cust.Email, departedEmail) {
		return nil
	}

	owner, found, err := GetTeamOwner(ctx, pg, teamID)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("no owner left on team %s to receive billing email", teamID)
	}

	return autumn.UpdateCustomer(ctx, customerID, owner.Email)
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

// GetPlanRetentionDays returns the retention in days a team's current Autumn
// plans grant. With billing disabled the user controls retention directly, so
// this returns the free plan default.
//
// Every plan in Autumn must have the retention_days feature configured; a
// missing one is an error rather than a silent downgrade to no retention.
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
	return RetentionDaysFromBalance(b), nil
}

// RetentionDaysFromBalance returns the longest retention any single plan on the
// balance grants. The pooled Granted is right for a data quota and wrong for
// retention: a team holding the free plan alongside an enterprise plan would get
// the two retention periods added together. A balance the API returns without a
// per-plan breakdown falls back to Granted.
//
// Retention follows the grant, not the balance, so a team that has spent an
// enterprise plan's data keeps its retention until the plan is detached or
// expires, indefinitely for a one-off enterprise plan that never expires.
func RetentionDaysFromBalance(b autumn.Balance) int {
	if len(b.Breakdown) == 0 {
		return int(b.Granted)
	}
	longest := 0.0
	for _, source := range b.Breakdown {
		longest = max(longest, source.IncludedGrant)
	}
	return int(longest)
}

// DataPurchaseSpent reports whether a team has used up the data granted by a
// plan they hold as a one-off purchase, which is what lets the dashboard tell
// them they are back on free plan limits. The pooled bytes figures cannot
// express "the purchase is spent while the monthly free grant still admits
// data"; only the per-plan breakdown can.
//
// The plan ids are matched against the purchases the customer holds today
// rather than read off the breakdown alone, because the breakdown says nothing
// about when a plan's term runs.
func DataPurchaseSpent(c *autumn.Customer) bool {
	b, ok := c.Balances[autumn.FeatureBytes]
	if !ok {
		return false
	}
	now := time.Now().UnixMilli()
	for _, source := range b.Breakdown {
		if source.Remaining > 0 {
			continue
		}
		if slices.ContainsFunc(c.Purchases, func(p autumn.Purchase) bool {
			return p.PlanID == source.PlanID && purchaseInEffect(p, now)
		}) {
			return true
		}
	}
	return false
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
// event. A transition is one plan activating in place of another expiring in
// the same event, and comparing their ranks tells an upgrade from a downgrade.
// Anything else resets retention and announces nothing.
func HandleBillingUpdated(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, siteOrigin, txEmail string, data autumn.BillingUpdatedData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, pg, data.CustomerID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.CustomerID, err)
		return
	}

	var activated, expired *autumn.PlanChange
	for i := range data.PlanChanges {
		pc := &data.PlanChanges[i]
		switch pc.Action {
		case autumn.ActionActivated:
			activated = pc
		case autumn.ActionExpired:
			expired = pc
		}
	}
	// A change scheduled for later, or an in-place update such as a priced
	// feature being added, has no plan starting and none ending.
	if activated == nil && expired == nil {
		return
	}

	// Autumn expires a plan only when a recurring plan replaces it, so attaching
	// a plan sold as a one-off purchase on top of the free plan a team already
	// holds arrives as a lone activation. Retention still has to follow the
	// plans the team now holds, but one side of a change on its own gives no
	// direction to announce, so no email goes out.
	if activated == nil || expired == nil {
		resetTeamRetentionFromPlan(ctx, pg, billingEnabled, teamID)
		return
	}

	switch {
	case planRank(activated.PlanID()) > planRank(expired.PlanID()):
		if err := applyPlanTransition(ctx, pg, billingEnabled, teamID, func(ctx context.Context, tx pgx.Tx) error {
			return notifyUpgrade(ctx, pg, tx, siteOrigin, txEmail, teamID)
		}); err != nil {
			return
		}
		owner, ok := lookupOwnerForAnalytics(ctx, pg, teamID)
		if !ok {
			return
		}
		firePurchaseEvent(teamID, owner, data.CustomerID, activated.Subscription)
		fireSubscriptionUpgradedEvent(teamID, owner, data.CustomerID, activated.Subscription)

	case planRank(activated.PlanID()) < planRank(expired.PlanID()):
		applyPlanTransition(ctx, pg, billingEnabled, teamID, func(ctx context.Context, tx pgx.Tx) error {
			return notifyDowngrade(ctx, pg, tx, siteOrigin, txEmail, teamID)
		})
		owner, ok := lookupOwnerForAnalytics(ctx, pg, teamID)
		if !ok {
			return
		}
		fireSubscriptionDowngradedEvent(teamID, owner, data.CustomerID, activated.Subscription)

	default:
		// Every enterprise plan shares a rank, so a contract re-issued at new
		// terms ties, as does a plan Autumn re-attaches to itself. Retention
		// still has to follow the plan that activated, and a tie gives no
		// direction to announce, so no email goes out.
		resetTeamRetentionFromPlan(ctx, pg, billingEnabled, teamID)
	}
}

// resetTeamRetentionFromPlan re-reads the retention the team's current Autumn
// plans grant and writes it to every app the team owns, with no email. Failures
// are logged rather than returned, since the webhook handler acks the event
// either way.
func resetTeamRetentionFromPlan(ctx context.Context, pg *pgxpool.Pool, billingEnabled bool, teamID uuid.UUID) {
	retention, err := GetPlanRetentionDays(ctx, pg, billingEnabled, teamID)
	if err != nil {
		log.Printf("webhook: resolve retention for team %s failed: %v", teamID, err)
		return
	}
	if err := resetAppsRetention(ctx, pg, nil, teamID, retention); err != nil {
		log.Printf("webhook: reset retention for team %s failed: %v", teamID, err)
	}
}

// planRank orders plans by tier so a transition's direction can be read from
// the plans that activated and expired: free < pro < every enterprise plan,
// which all share the top rank.
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

// applyPlanTransition runs the retention reset and email enqueue for a plan
// change in one transaction so a failure in either leaves no half-applied
// state. The webhook still acks 200 and Svix does not retry, so recovery is the
// next plan event reconciling retention; the missed email is a soft failure.
//
// The returned error lets callers gate downstream side effects such as
// analytics events. It is already logged here.
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
	notifyLimitReached(ctx, pg, siteOrigin, txEmail, teamID, isEnterpriseCustomer(ctx, data.CustomerID))
}

func HandleUsageAlert(ctx context.Context, pg *pgxpool.Pool, siteOrigin, txEmail string, data autumn.BalancesUsageAlertData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, pg, data.CustomerID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.CustomerID, err)
		return
	}
	notifyUsageAlert(ctx, pg, siteOrigin, txEmail, teamID, int(data.UsageAlert.Threshold), isEnterpriseCustomer(ctx, data.CustomerID))
}

// isEnterpriseCustomer reports whether the Autumn customer is on an enterprise
// plan. A failed lookup reports false so the email still goes out, with the
// standard upgrade copy.
func isEnterpriseCustomer(ctx context.Context, customerID string) bool {
	cust, err := autumn.GetCustomer(ctx, customerID)
	if err != nil {
		log.Printf("webhook: autumn get customer %s failed: %v", customerID, err)
		return false
	}
	return DeterminePlan(cust) == PlanEnterprise
}

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

func notifyLimitReached(ctx context.Context, pg *pgxpool.Pool, siteOrigin, txEmail string, teamID uuid.UUID, isEnterprise bool) {
	name := teamName(ctx, pg, teamID)
	subject, body := email.UsageLimitEmail(name, teamID.String(), siteOrigin, 100, isEnterprise)
	if err := queueTeamEmail(ctx, pg, nil, txEmail, teamID, subject, body); err != nil {
		log.Printf("failed to queue email for team %s: %v", teamID, err)
	}
}

func notifyUsageAlert(ctx context.Context, pg *pgxpool.Pool, siteOrigin, txEmail string, teamID uuid.UUID, threshold int, isEnterprise bool) {
	name := teamName(ctx, pg, teamID)
	subject, body := email.UsageLimitEmail(name, teamID.String(), siteOrigin, threshold, isEnterprise)
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
