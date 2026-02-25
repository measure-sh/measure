package measure

import (
	"backend/api/server"
	"backend/billing"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stripe/stripe-go/v84/webhook"
)

// Constants — aliases to billing module for backward compatibility.
const (
	FREE_PLAN_MAX_RETENTION_DAYS = billing.FreePlanMaxRetentionDays
	MAX_RETENTION_DAYS           = billing.MaxRetentionDays
	FREE_PLAN_MAX_UNITS          = billing.FreePlanMaxUnits
)

// Mockable Stripe SDK calls — overridden in tests.
var (
	constructWebhookEventFn = webhook.ConstructEvent
)

// TeamBilling is an alias for billing.TeamBilling used in JSON responses.
type TeamBilling = billing.TeamBilling

// billingDeps constructs a billing.Deps from the server's configuration.
func billingDeps() billing.Deps {
	return billing.Deps{
		PgPool:         server.Server.PgPool,
		ChPool:         server.Server.RchPool,
		SiteOrigin:     server.Server.Config.SiteOrigin,
		TxEmailAddress: server.Server.Config.TxEmailAddress,
	}
}

func GetTeamBilling(c *gin.Context) {
	if !server.Server.Config.IsBillingEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "billing is not enabled"})
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	result, err := billing.GetTeamBilling(ctx, server.Server.PgPool, teamId)
	if err != nil {
		if err == pgx.ErrNoRows {
			msg := fmt.Sprintf("team billing not found for team: %s", teamId)
			c.JSON(http.StatusNotFound, gin.H{"error": msg})
			return
		}
		msg := fmt.Sprintf("error occurred while querying team billing: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}

func CheckIngestAllowedForApp(ctx context.Context, appId uuid.UUID) error {
	if !server.Server.Config.IsBillingEnabled() {
		return nil
	}
	return billing.IsIngestAllowed(ctx, server.Server.PgPool, server.Server.VK, appId)
}

func CheckRetentionChangeAllowedInPlan(ctx context.Context, teamId uuid.UUID) (bool, error) {
	if !server.Server.Config.IsBillingEnabled() {
		return true, nil
	}
	return billing.IsRetentionChangeAllowed(ctx, server.Server.PgPool, teamId)
}

type CreateCheckoutSessionRequest struct {
	SuccessURL string `json:"success_url"`
	CancelURL  string `json:"cancel_url"`
}

func CreateCheckoutSession(c *gin.Context) {
	if !server.Server.Config.IsBillingEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "billing is not enabled"})
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var req CreateCheckoutSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.SuccessURL == "" || req.CancelURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "success_url and cancel_url are required"})
		return
	}

	user := &User{ID: &userId}
	if err := user.getEmail(ctx); err != nil {
		msg := "failed to get user email"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	result, err := billing.InitiateUpgrade(
		ctx,
		server.Server.PgPool,
		teamId,
		*user.Email,
		server.Server.Config.StripeProUnitDaysPriceID,
		req.SuccessURL,
		req.CancelURL,
	)
	if err != nil {
		switch {
		case errors.Is(err, billing.ErrTeamBillingNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "team billing not found"})
		case errors.Is(err, billing.ErrAlreadyOnProPlan):
			c.JSON(http.StatusBadRequest, gin.H{"error": "team is already on pro plan"})
		default:
			fmt.Println("checkout session failed:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create checkout session"})
		}
		return
	}

	if result.AlreadyUpgraded {
		c.JSON(http.StatusOK, gin.H{"already_upgraded": true})
		return
	}

	c.JSON(http.StatusOK, gin.H{"checkout_url": result.CheckoutURL})
}

func CancelAndDowngradeToFreePlan(c *gin.Context) {
	if !server.Server.Config.IsBillingEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "billing is not enabled"})
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	deps := billingDeps()
	if err := billing.CancelAndDowngradeToFree(ctx, deps, teamId); err != nil {
		switch {
		case errors.Is(err, billing.ErrTeamBillingNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "team billing not found"})
		default:
			fmt.Println("failed to downgrade:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to downgrade to free plan"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "downgraded to free"})
}

func GetBillingUsageThreshold(c *gin.Context) {
	if !server.Server.Config.IsBillingEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "billing is not enabled"})
		return
	}

	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeBillingRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	threshold, err := billing.GetUsageThreshold(ctx, server.Server.PgPool, server.Server.RchPool, teamId)
	if err != nil {
		if err == pgx.ErrNoRows {
			msg := fmt.Sprintf("team billing not found for team: %s", teamId)
			c.JSON(http.StatusNotFound, gin.H{"error": msg})
			return
		}
		msg := fmt.Sprintf("error occurred while querying usage threshold: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"threshold": threshold})
}

func HandleStripeWebhook(c *gin.Context) {
	if !server.Server.Config.IsBillingEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "billing is not enabled"})
		return
	}

	ctx := c.Request.Context()

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		fmt.Println("failed to read webhook body:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	webhookSecret := server.Server.Config.StripeWebhookSecret
	if webhookSecret == "" {
		fmt.Println("STRIPE_WEBHOOK_SECRET not set")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook secret not configured"})
		return
	}

	event, err := constructWebhookEventFn(payload, signature, webhookSecret)
	if err != nil {
		fmt.Println("webhook signature verification failed:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	fmt.Printf("Stripe webhook received: %s\n", event.Type)

	deps := billingDeps()
	switch event.Type {
	case "checkout.session.completed":
		billing.HandleCheckoutCompleted(ctx, deps, event)

	case "customer.subscription.deleted":
		billing.HandleSubscriptionDeleted(ctx, deps, event)

	case "customer.subscription.updated":
		billing.HandleSubscriptionUpdated(ctx, deps, event)
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}
