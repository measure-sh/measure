package billing

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/stripe/stripe-go/v84"
)

// HandleCheckoutCompleted processes a checkout.session.completed webhook event.
// It upgrades the team referenced in the session to the pro plan.
func HandleCheckoutCompleted(ctx context.Context, deps Deps, event stripe.Event) {
	var sess stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
		fmt.Println("failed to parse checkout session:", err)
		return
	}

	teamId := sess.ClientReferenceID
	if teamId == "" {
		fmt.Println("no team_id in checkout session")
		return
	}

	var subscriptionId string
	if sess.Subscription != nil {
		subscriptionId = sess.Subscription.ID
	}
	if subscriptionId == "" {
		fmt.Println("no subscription_id in checkout session")
		return
	}

	if err := ProcessUpgrade(ctx, deps.PgPool, teamId, subscriptionId); err != nil {
		fmt.Printf("failed to upgrade team %s: %v\n", teamId, err)
		return
	}

	notifyUpgrade(ctx, deps, teamId)
	fmt.Printf("Team %s upgraded to pro\n", teamId)
}

// HandleSubscriptionDeleted processes a customer.subscription.deleted webhook event.
// It downgrades the owning team to the free plan and resets app retention.
func HandleSubscriptionDeleted(ctx context.Context, deps Deps, event stripe.Event) {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		fmt.Println("failed to parse subscription:", err)
		return
	}

	teamId, err := GetTeamBySubscriptionID(ctx, deps.PgPool, sub.ID)
	if err != nil {
		fmt.Printf("failed to find team for subscription %s: %v\n", sub.ID, err)
		return
	}

	if err := ProcessDowngrade(ctx, deps, teamId); err != nil {
		fmt.Printf("failed to downgrade team %s: %v\n", teamId, err)
		return
	}

	fmt.Printf("Team %s downgraded to free\n", teamId)
}

// HandleSubscriptionUpdated processes a customer.subscription.updated webhook event.
// It downgrades the owning team if the subscription status is terminal.
func HandleSubscriptionUpdated(ctx context.Context, deps Deps, event stripe.Event) {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		fmt.Println("failed to parse subscription:", err)
		return
	}

	teamId, err := GetTeamBySubscriptionID(ctx, deps.PgPool, sub.ID)
	if err != nil {
		fmt.Printf("failed to find team for subscription %s: %v\n", sub.ID, err)
		return
	}

	if IsTerminalSubscriptionStatus(sub.Status) {
		if err := ProcessDowngrade(ctx, deps, teamId); err != nil {
			fmt.Printf("failed to downgrade team %s: %v\n", teamId, err)
			return
		}

		fmt.Printf("Team %s downgraded due to subscription status: %s\n", teamId, sub.Status)
	}
}
