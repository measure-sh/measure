package measure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"backend/autumn"
	"backend/email"

	"backend/api/server"

	"github.com/gin-gonic/gin"
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
	planFree       = "free"
	planPro        = "pro"
	planEnterprise = "enterprise"
)

// Autumn plan IDs — match the slugs configured in the Autumn dashboard.
const (
	autumnPlanFree = "measure_free"
	autumnPlanPro  = "measure_pro"
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

var errTeamNotFound = errors.New("team not found")

// getAutumnCustomerID reads the autumn_customer_id for a team. Returns
// errTeamNotFound if no such team, and empty string if the column is NULL.
func getAutumnCustomerID(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) (string, error) {
	stmt := sqlf.PostgreSQL.
		Select("autumn_customer_id").
		From("teams").
		Where("id = ?", teamID)
	defer stmt.Close()

	var customerID *string
	err := pool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errTeamNotFound
		}
		return "", err
	}
	if customerID == nil {
		return "", nil
	}
	return *customerID, nil
}

// determinePlan inspects a customer's active subscriptions/products and
// returns the plan name we surface to the frontend (free, pro, enterprise).
//
// API responses populate Subscriptions[].PlanID; webhook payloads populate
// Products[].ID. We check both so the same helper works on either source.
// Subscriptions with status != "active" (e.g. a Free that's "scheduled" to
// take over after a Pro cancellation) are ignored — we only report on the
// plan currently in effect.
func determinePlan(c *autumn.Customer) string {
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

	if hasPlan(autumnPlanPro) {
		return planPro
	}
	if hasPlan(autumnPlanFree) {
		return planFree
	}
	// Any attached non-free, non-pro plan counts as Enterprise (bespoke plan).
	if hasActiveSub || hasActiveProduct {
		return planEnterprise
	}
	return planFree
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
func ProvisionAutumnCustomer(ctx context.Context, tx pgx.Tx, teamID uuid.UUID, teamName, ownerEmail string) (string, error) {
	if !server.Server.Config.IsBillingEnabled() {
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
func GetPlanRetentionDays(ctx context.Context, teamID uuid.UUID) (int, error) {
	if !server.Server.Config.IsBillingEnabled() {
		return MIN_RETENTION_DAYS, nil
	}
	customerID, err := getAutumnCustomerID(ctx, server.Server.PgPool, teamID)
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

// ----------------------------------------------------------------------------
// HTTP handlers
// ----------------------------------------------------------------------------

func billingDisabled(c *gin.Context) bool {
	if !server.Server.Config.IsBillingEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "billing is not enabled"})
		return true
	}
	return false
}

func GetTeamBilling(c *gin.Context) {
	if billingDisabled(c) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingRead); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	customerID, err := getAutumnCustomerID(ctx, server.Server.PgPool, teamId)
	if err != nil {
		if errors.Is(err, errTeamNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error querying team"})
		return
	}

	result := BillingInfo{TeamID: teamId, Plan: planFree}
	if customerID != "" {
		result.AutumnCustomerID = &customerID
		cust, err := autumn.GetCustomer(ctx, customerID)
		if err != nil {
			log.Printf("autumn get customer failed: %v", err)
		} else {
			result.Plan = determinePlan(cust)
			if b, ok := cust.Balances[autumn.FeatureBytes]; ok {
				result.BytesGranted = b.Granted
				result.BytesUsed = b.Usage
				result.BytesUnlimited = b.Unlimited
				result.BytesOverageAllowed = b.OverageAllowed
			}
			if b, ok := cust.Balances[autumn.FeatureRetentionDays]; ok && b.Granted > 0 {
				result.RetentionDays = int(b.Granted)
			}
			// Pick the active subscription. During a scheduled cancel, the
			// customer also has a Free sub with status="scheduled" — we want
			// the still-running Pro one, not whichever is index 0.
			for i := range cust.Subscriptions {
				if cust.Subscriptions[i].Status == "active" {
					s := &cust.Subscriptions[i]
					result.Status = s.Status
					result.CurrentPeriodStart = s.CurrentPeriodStart / 1000
					result.CurrentPeriodEnd = s.CurrentPeriodEnd / 1000
					result.CanceledAt = s.CanceledAt / 1000
					break
				}
			}
		}
	}

	c.JSON(http.StatusOK, result)
}

type CreateCheckoutSessionRequest struct {
	SuccessURL string `json:"success_url"`
}

func CreateCheckoutSession(c *gin.Context) {
	if billingDisabled(c) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingAll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	var req CreateCheckoutSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.SuccessURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "success_url is required"})
		return
	}

	customerID, err := getAutumnCustomerID(ctx, server.Server.PgPool, teamId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error querying team"})
		return
	}
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team billing not provisioned"})
		return
	}

	// Refuse if already Pro. Distinguish Autumn outage (503) from a 4xx
	// (likely a missing customer record or config bug) so we don't proceed
	// to Attach blindly and create a duplicate Stripe Checkout session.
	cust, err := autumn.GetCustomer(ctx, customerID)
	if err != nil {
		log.Println("autumn get customer failed (checkout pre-check):", err)
		if autumn.IsServerOrNetworkError(err) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "billing service temporarily unavailable"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "billing customer record is unavailable"})
		return
	}
	if determinePlan(cust) == planPro {
		c.JSON(http.StatusOK, gin.H{"already_upgraded": true})
		return
	}

	resp, err := autumn.Attach(ctx, autumn.AttachRequest{
		CustomerID:   customerID,
		PlanID:       autumnPlanPro,
		SuccessURL:   req.SuccessURL,
		RedirectMode: "always",
		CheckoutSessionParams: map[string]any{
			"billing_address_collection": "required",
		},
	})
	if err != nil {
		log.Println("autumn attach failed:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create checkout session"})
		return
	}

	if resp.PaymentURL == "" {
		c.JSON(http.StatusOK, gin.H{"already_upgraded": true})
		return
	}
	c.JSON(http.StatusOK, gin.H{"checkout_url": resp.PaymentURL})
}

func CancelAndDowngradeToFreePlan(c *gin.Context) {
	if billingDisabled(c) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingAll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	customerID, err := getAutumnCustomerID(ctx, server.Server.PgPool, teamId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error querying team"})
		return
	}
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team billing not provisioned"})
		return
	}

	// Schedule cancellation at end of cycle. Pro stays usable until
	// CurrentPeriodEnd. After expiry, Autumn auto-activates the plan marked
	// is_default in the dashboard (Free), which fires
	// customer.products.updated (scenario=expired) — the existing webhook
	// handler resets retention then.
	if _, err := autumn.Update(ctx, autumn.UpdateRequest{
		CustomerID:   customerID,
		PlanID:       autumnPlanPro,
		CancelAction: autumn.CancelEndOfCycle,
	}); err != nil {
		log.Println("autumn cancel end of cycle failed:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to schedule cancellation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "cancellation_scheduled"})
}

func UndoDowngradeToFreePlan(c *gin.Context) {
	if billingDisabled(c) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingAll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	customerID, err := getAutumnCustomerID(ctx, server.Server.PgPool, teamId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error querying team"})
		return
	}
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team billing not provisioned"})
		return
	}

	// Verify there's actually a pending cancellation to undo. Calling
	// update(uncancel) on a customer with no scheduled cancel returns an
	// opaque 4xx from Autumn; we'd rather give a clear 400 here.
	cust, err := autumn.GetCustomer(ctx, customerID)
	if err != nil {
		log.Println("autumn get customer failed (uncancel pre-check):", err)
		if autumn.IsServerOrNetworkError(err) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "billing service temporarily unavailable"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "billing customer record is unavailable"})
		return
	}
	hasPending := false
	for _, s := range cust.Subscriptions {
		if s.Status == "active" && s.PlanID == autumnPlanPro && s.CanceledAt > 0 {
			hasPending = true
			break
		}
	}
	if !hasPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no cancellation pending to undo"})
		return
	}

	if _, err := autumn.Update(ctx, autumn.UpdateRequest{
		CustomerID:   customerID,
		PlanID:       autumnPlanPro,
		CancelAction: autumn.Uncancel,
	}); err != nil {
		log.Println("autumn uncancel failed:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to undo cancellation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "cancellation_reverted"})
}

type CreateCustomerPortalSessionRequest struct {
	ReturnURL string `json:"return_url"`
}

func CreateCustomerPortalSession(c *gin.Context) {
	if billingDisabled(c) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingAll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	var req CreateCustomerPortalSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.ReturnURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "return_url is required"})
		return
	}

	customerID, err := getAutumnCustomerID(ctx, server.Server.PgPool, teamId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error querying team"})
		return
	}
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team billing not provisioned"})
		return
	}

	url, err := autumn.OpenCustomerPortal(ctx, customerID, req.ReturnURL)
	if err != nil {
		log.Println("autumn open portal failed:", err)
		if autumn.IsServerOrNetworkError(err) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "billing service temporarily unavailable"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create customer portal session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// ----------------------------------------------------------------------------
// Webhook
// ----------------------------------------------------------------------------

func HandleAutumnWebhook(c *gin.Context) {
	if billingDisabled(c) {
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	secret := server.Server.Config.AutumnWebhookSecret
	if secret == "" {
		log.Println("AUTUMN_WEBHOOK_SECRET not set")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook secret not configured"})
		return
	}

	ev, err := autumn.VerifyWebhook(c.Request.Header, payload, secret)
	if err != nil {
		log.Println("autumn webhook verification failed:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	ctx := c.Request.Context()

	switch ev.Type {
	case autumn.EventCustomerProductsUpdated:
		var data autumn.CustomerProductsUpdatedData
		if err := json.Unmarshal(ev.Data, &data); err != nil {
			log.Println("failed to parse customer.products.updated:", err)
			break
		}
		handleProductsUpdated(ctx, data)

	case autumn.EventBalancesLimitReached:
		var data autumn.BalancesLimitReachedData
		if err := json.Unmarshal(ev.Data, &data); err != nil {
			log.Println("failed to parse balances.limit_reached:", err)
			break
		}
		handleLimitReached(ctx, data)

	case autumn.EventBalancesUsageAlert:
		var data autumn.BalancesUsageAlertData
		if err := json.Unmarshal(ev.Data, &data); err != nil {
			log.Println("failed to parse balances.usage_alert_triggered:", err)
			break
		}
		handleUsageAlert(ctx, data)
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}

// lookupTeamIDByAutumnCustomer finds the team with the given autumn_customer_id.
func lookupTeamIDByAutumnCustomer(ctx context.Context, customerID string) (uuid.UUID, error) {
	stmt := sqlf.PostgreSQL.
		Select("id").
		From("teams").
		Where("autumn_customer_id = ?", customerID)
	defer stmt.Close()

	var teamID uuid.UUID
	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&teamID)
	return teamID, err
}

func handleProductsUpdated(ctx context.Context, data autumn.CustomerProductsUpdatedData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, data.Customer.ID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.Customer.ID, err)
		return
	}

	switch data.Scenario {
	case autumn.ScenarioNew, autumn.ScenarioUpgrade:
		// new+free fires on team creation when we auto-attach Free. The user
		// just signed up; sending an "Upgraded to Pro" email would be wrong,
		// and there are no apps yet whose retention needs resetting.
		if data.Scenario == autumn.ScenarioNew && data.UpdatedProduct.ID == autumnPlanFree {
			return
		}
		applyPlanTransition(ctx, teamID, notifyUpgrade)

	case autumn.ScenarioDowngrade, autumn.ScenarioExpired:
		applyPlanTransition(ctx, teamID, notifyDowngrade)

	case autumn.ScenarioCancel:
		// Normally fires from our backend's cancel_end_of_cycle action — Pro
		// is still active until expiry, no plan change yet, no work to do.
		// But Autumn fires the same scenario for cancel_immediately (e.g. if
		// the Stripe customer portal ever has "Cancel plan" enabled). In
		// that case Pro is gone, Free is now active, and we DO need the
		// retention reset + email. Detect by checking whether Pro is still
		// active in the customer state.
		if proIsStillActive(data.Customer, data.UpdatedProduct.ID) {
			return
		}
		applyPlanTransition(ctx, teamID, notifyDowngrade)

	case autumn.ScenarioRenew, autumn.ScenarioPastDue:
		// No-op. renew = uncancel or cycle-boundary renewal (plan unchanged);
		// past_due = payment retry (ingest gating handles it).
		// The actual plan transition fires expired/downgrade later.
	}
}

// proIsStillActive reports whether the cancelled product is still active in
// the customer's product list (i.e. an end-of-cycle cancel scheduled, not yet
// taken effect). Webhook payloads populate Customer.Products with current state.
func proIsStillActive(c autumn.Customer, cancelledProductID string) bool {
	for _, p := range c.Products {
		if p.ID == cancelledProductID && p.Status == "active" {
			return true
		}
	}
	return false
}

// applyPlanTransition runs the retention reset and email enqueue for a real
// plan change inside a single tx so they atomically commit. If either step
// fails, the whole webhook ack stays 200 (Svix won't retry) but we don't
// leave the database in a half-applied state — the next plan event will
// reconcile retention, and the missed email is a soft failure.
func applyPlanTransition(ctx context.Context, teamID uuid.UUID, notify func(ctx context.Context, tx pgx.Tx, teamID uuid.UUID) error) {
	retention, err := GetPlanRetentionDays(ctx, teamID)
	if err != nil {
		log.Printf("webhook: resolve retention for team %s failed: %v", teamID, err)
		return
	}

	tx, err := server.Server.PgPool.Begin(ctx)
	if err != nil {
		log.Printf("webhook: begin tx for team %s failed: %v", teamID, err)
		return
	}
	defer tx.Rollback(ctx)

	if err := resetAppsRetention(ctx, nil, tx, teamID, retention); err != nil {
		log.Printf("webhook: reset retention for team %s failed: %v", teamID, err)
		return
	}
	if err := notify(ctx, tx, teamID); err != nil {
		log.Printf("webhook: notify for team %s failed: %v", teamID, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("webhook: commit for team %s failed: %v", teamID, err)
	}
}

func handleLimitReached(ctx context.Context, data autumn.BalancesLimitReachedData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, data.CustomerID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.CustomerID, err)
		return
	}
	notifyLimitReached(ctx, teamID)
}

func handleUsageAlert(ctx context.Context, data autumn.BalancesUsageAlertData) {
	teamID, err := lookupTeamIDByAutumnCustomer(ctx, data.CustomerID)
	if err != nil {
		log.Printf("webhook: team not found for autumn customer %s: %v", data.CustomerID, err)
		return
	}
	notifyUsageAlert(ctx, teamID, int(data.UsageAlert.Threshold))
}

// ----------------------------------------------------------------------------
// Email notifications
// ----------------------------------------------------------------------------

func teamName(ctx context.Context, teamID uuid.UUID) string {
	stmt := sqlf.PostgreSQL.Select("name").From("teams").Where("id = ?", teamID)
	defer stmt.Close()
	var name string
	_ = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&name)
	return name
}

func notifyUpgrade(ctx context.Context, tx pgx.Tx, teamID uuid.UUID) error {
	name := teamName(ctx, teamID)
	subject, body := email.UpgradeEmail(name, teamID.String(), server.Server.Config.SiteOrigin)
	return queueTeamEmail(ctx, tx, teamID, subject, body)
}

func notifyDowngrade(ctx context.Context, tx pgx.Tx, teamID uuid.UUID) error {
	name := teamName(ctx, teamID)
	subject, body := email.ManualDowngradeEmail(name, teamID.String(), server.Server.Config.SiteOrigin)
	return queueTeamEmail(ctx, tx, teamID, subject, body)
}

func notifyLimitReached(ctx context.Context, teamID uuid.UUID) {
	name := teamName(ctx, teamID)
	subject, body := email.UsageLimitEmail(name, teamID.String(), server.Server.Config.SiteOrigin, 100)
	if err := queueTeamEmail(ctx, nil, teamID, subject, body); err != nil {
		log.Printf("failed to queue email for team %s: %v", teamID, err)
	}
}

func notifyUsageAlert(ctx context.Context, teamID uuid.UUID, threshold int) {
	name := teamName(ctx, teamID)
	subject, body := email.UsageLimitEmail(name, teamID.String(), server.Server.Config.SiteOrigin, threshold)
	if err := queueTeamEmail(ctx, nil, teamID, subject, body); err != nil {
		log.Printf("failed to queue email for team %s: %v", teamID, err)
	}
}

// queueTeamEmail enqueues an email for every team member. Pass a non-nil tx
// to enroll the inserts in a caller-managed transaction.
func queueTeamEmail(ctx context.Context, tx pgx.Tx, teamID uuid.UUID, subject, body string) error {
	pending := email.EmailInfo{
		From:        server.Server.Config.TxEmailAddress,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	}
	return email.QueueEmailForTeam(ctx, server.Server.PgPool, tx, teamID.String(), nil, pending)
}
