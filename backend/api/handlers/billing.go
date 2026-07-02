package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"

	"backend/api/server"
	"backend/libs/autumn"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ----------------------------------------------------------------------------
// HTTP handlers
// ----------------------------------------------------------------------------

func billingDisabled(c *gin.Context, deps *server.Deps) bool {
	if !deps.Config.IsBillingEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "billing is not enabled"})
		return true
	}
	return false
}

func (h Handlers) GetTeamBilling(c *gin.Context) {
	deps := h.Deps
	if billingDisabled(c, deps) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeBillingRead); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	customerID, err := measure.GetAutumnCustomerID(ctx, deps.PgPool, teamId)
	if err != nil {
		if errors.Is(err, measure.ErrTeamNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error querying team"})
		return
	}

	result := measure.BillingInfo{TeamID: teamId, Plan: measure.PlanFree}
	if customerID != "" {
		result.AutumnCustomerID = &customerID
		cust, err := autumn.GetCustomer(ctx, customerID)
		if err != nil {
			log.Printf("autumn get customer failed: %v", err)
		} else {
			result.Plan = measure.DeterminePlan(cust)
			if b, ok := cust.Balances[autumn.FeatureBytes]; ok {
				result.BytesGranted = b.Granted
				result.BytesUsed = b.Usage
				result.BytesUnlimited = b.Unlimited
				result.BytesOverageAllowed = b.OverageAllowed
			}
			if b, ok := cust.Balances[autumn.FeatureAgentTokens]; ok {
				result.TokenCreditsGranted = b.Granted
				result.TokenCreditsUsed = b.Usage
				result.TokenCreditsUnlimited = b.Unlimited
				result.TokenCreditsOverageAllowed = b.OverageAllowed
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

func (h Handlers) CreateCheckoutSession(c *gin.Context) {
	deps := h.Deps
	if billingDisabled(c, deps) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeBillingAll); err != nil {
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

	customerID, err := measure.GetAutumnCustomerID(ctx, deps.PgPool, teamId)
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
	if measure.DeterminePlan(cust) == measure.PlanPro {
		c.JSON(http.StatusOK, gin.H{"already_upgraded": true})
		return
	}

	resp, err := autumn.Attach(ctx, autumn.AttachRequest{
		CustomerID:   customerID,
		PlanID:       measure.AutumnPlanPro,
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

func (h Handlers) CancelAndDowngradeToFreePlan(c *gin.Context) {
	deps := h.Deps
	if billingDisabled(c, deps) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeBillingAll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	customerID, err := measure.GetAutumnCustomerID(ctx, deps.PgPool, teamId)
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
	// is_default in the dashboard (Free), which fires billing.updated with the
	// Pro plan expired — the webhook handler resets retention then.
	if _, err := autumn.Update(ctx, autumn.UpdateRequest{
		CustomerID:   customerID,
		PlanID:       measure.AutumnPlanPro,
		CancelAction: autumn.CancelEndOfCycle,
	}); err != nil {
		log.Println("autumn cancel end of cycle failed:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to schedule cancellation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "cancellation_scheduled"})
}

func (h Handlers) UndoDowngradeToFreePlan(c *gin.Context) {
	deps := h.Deps
	if billingDisabled(c, deps) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeBillingAll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't perform authorization checks"})
		return
	} else if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("you don't have permissions for team [%s]", teamId)})
		return
	}

	customerID, err := measure.GetAutumnCustomerID(ctx, deps.PgPool, teamId)
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
		if s.Status == "active" && s.PlanID == measure.AutumnPlanPro && s.CanceledAt > 0 {
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
		PlanID:       measure.AutumnPlanPro,
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

func (h Handlers) CreateCustomerPortalSession(c *gin.Context) {
	deps := h.Deps
	if billingDisabled(c, deps) {
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team id invalid or missing"})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeBillingAll); err != nil {
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

	customerID, err := measure.GetAutumnCustomerID(ctx, deps.PgPool, teamId)
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

func (h Handlers) HandleAutumnWebhook(c *gin.Context) {
	deps := h.Deps
	if billingDisabled(c, deps) {
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	secret := deps.Config.AutumnWebhookSecret
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
	case autumn.EventBillingUpdated:
		var data autumn.BillingUpdatedData
		if err := json.Unmarshal(ev.Data, &data); err != nil {
			log.Println("failed to parse billing.updated:", err)
			break
		}
		measure.HandleBillingUpdated(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), deps.Config.SiteOrigin, deps.Config.TxEmailAddress, data)

	case autumn.EventBalancesLimitReached:
		var data autumn.BalancesLimitReachedData
		if err := json.Unmarshal(ev.Data, &data); err != nil {
			log.Println("failed to parse balances.limit_reached:", err)
			break
		}
		measure.HandleLimitReached(ctx, deps.PgPool, deps.Config.SiteOrigin, deps.Config.TxEmailAddress, data)

	case autumn.EventBalancesUsageAlert:
		var data autumn.BalancesUsageAlertData
		if err := json.Unmarshal(ev.Data, &data); err != nil {
			log.Println("failed to parse balances.usage_alert_triggered:", err)
			break
		}
		measure.HandleUsageAlert(ctx, deps.PgPool, deps.Config.SiteOrigin, deps.Config.TxEmailAddress, data)
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}

// lookupTeamIDByAutumnCustomer finds the team with the given autumn_customer_id.
