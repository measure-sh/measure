package measure

import (
	"context"
	"errors"
	"fmt"
	"log"

	"backend/libs/autumn"
	"backend/libs/ga4"
	"backend/libs/posthog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// Monthly price in USD by autumn plan ID. Used to compute annualized value
// for paid conversion events. Update when prices change or new paid plans
// are added.
var planMonthlyUSD = map[string]float64{
	AutumnPlanPro: 50,
}

// TeamOwner holds the contact and tracking identifiers of the owning user
// of a team.
type TeamOwner struct {
	UserID     string
	Email      string
	GAClientID string
	GCLID      string
}

// GetTeamOwner returns the team's owning user's id, email, ga_client_id and
// gclid. Attribution is LEFT-joined from user_attribution so users without a
// captured ga_client_id/gclid still return with empty strings for those
// fields. When the team has multiple owner-role members, the earliest-joined
// owner is returned. found=false (with no error) when no owner-role member
// exists.
func GetTeamOwner(ctx context.Context, pg *pgxpool.Pool, teamID uuid.UUID) (owner TeamOwner, found bool, err error) {
	stmt := sqlf.PostgreSQL.
		Select("u.id").
		Select("u.email").
		Select("ua.ga_client_id").
		Select("ua.gclid").
		From("users u").
		Join("team_membership tm", "tm.user_id = u.id").
		LeftJoin("user_attribution ua", "ua.user_id = u.id").
		Where("tm.team_id = ?", teamID).
		Where("tm.role = ?", "owner").
		OrderBy("tm.created_at ASC").
		Limit(1)
	defer stmt.Close()

	var userID uuid.UUID
	var email string
	var gaClientIDVal, gclidVal *string
	err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).
		Scan(&userID, &email, &gaClientIDVal, &gclidVal)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TeamOwner{}, false, nil
		}
		return TeamOwner{}, false, err
	}
	owner.UserID = userID.String()
	owner.Email = email
	if gaClientIDVal != nil {
		owner.GAClientID = *gaClientIDVal
	}
	if gclidVal != nil {
		owner.GCLID = *gclidVal
	}
	return owner, true, nil
}

// lookupOwnerForAnalytics is the convenience wrapper used by the billing
// webhook to fetch the team owner once and fire several analytics events
// against the same result. Returns ok=false (logged) on a DB error or when
// no owner row exists, so the caller can early-return.
func lookupOwnerForAnalytics(ctx context.Context, pg *pgxpool.Pool, teamID uuid.UUID) (TeamOwner, bool) {
	owner, found, err := GetTeamOwner(ctx, pg, teamID)
	if err != nil {
		log.Printf("analytics: lookup team owner for team %s failed: %v", teamID, err)
		return TeamOwner{}, false
	}
	if !found {
		log.Printf("analytics: no owner for team %s, skipping events", teamID)
		return TeamOwner{}, false
	}
	return owner, true
}

// FireSignupEvent fires the GA4 `signup` event for a newly created user.
// gaClientID is passed explicitly (rather than looked up from the
// user_attribution row we just wrote) to avoid a needless round-trip.
// Best-effort: ga4.Send silently skips when gaClientID is empty.
func FireSignupEvent(ctx context.Context, user *User, method, gaClientID string) {
	if user == nil || user.Email == nil {
		return
	}
	ga4.Send(ctx, gaClientID, *user.Email, "signup", map[string]any{
		"value":    10,
		"currency": "USD",
		"method":   method,
	})
}

// FireTeamCreatedEvent fires the PostHog `team_created` event after a team
// is successfully created during signup or via the dashboard.
func FireTeamCreatedEvent(ctx context.Context, user *User, team *Team) {
	if user == nil || user.ID == nil || team == nil || team.ID == nil {
		return
	}
	teamID := team.ID.String()
	teamName := ""
	if team.Name != nil {
		teamName = *team.Name
	}
	posthog.Capture(*user.ID, "team_created", map[string]any{
		"schema_version": "v1",
		"team_id":        teamID,
		"team_name":      teamName,
	}, map[string]string{"team": teamID})
}

// subscriptionCompositeID returns a stable identifier for a plan transition
// used as transaction_id (GA4) and subscription_id (PostHog). Autumn webhook
// retries reproduce the same composite, so downstream systems dedupe naturally.
func subscriptionCompositeID(customerID string, sub autumn.Subscription) string {
	return fmt.Sprintf("%s:%s:%d", customerID, sub.PlanID, sub.StartedAt)
}

// firePaidConversionEvent fires the GA4 `paid_conversion` event after a
// successful new/upgrade plan transition.
//
// The transaction_id is composed from autumn customer ID + plan + started_at
// so Autumn webhook retries deduplicate naturally on the GA4 side without us
// maintaining a local dedup table.
func firePaidConversionEvent(ctx context.Context, owner TeamOwner, customerID string, sub autumn.Subscription) {
	planID := sub.PlanID
	if planID == AutumnPlanFree {
		return
	}
	monthlyUSD, ok := planMonthlyUSD[planID]
	if !ok {
		log.Printf("ga4: no price map entry for plan %q, skipping paid_conversion", planID)
		return
	}
	value := monthlyUSD * 12
	ga4.Send(ctx, owner.GAClientID, owner.Email, "paid_conversion", map[string]any{
		"value":          value,
		"currency":       "USD",
		"transaction_id": subscriptionCompositeID(customerID, sub),
	})
}

// firePurchaseEvent fires the PostHog `purchase` event for a paid transition.
// Skips when no price-map entry exists for the plan (e.g. Enterprise).
func firePurchaseEvent(teamID uuid.UUID, owner TeamOwner, customerID string, sub autumn.Subscription) {
	planID := sub.PlanID
	if planID == AutumnPlanFree {
		return
	}
	monthlyUSD, ok := planMonthlyUSD[planID]
	if !ok {
		log.Printf("posthog: no price map entry for plan %q, skipping purchase", planID)
		return
	}
	posthog.Capture(owner.UserID, "purchase", map[string]any{
		"schema_version":  "v1",
		"revenue":         monthlyUSD * 12,
		"currency":        "USD",
		"product":         planID,
		"subscription_id": subscriptionCompositeID(customerID, sub),
		"contract_length": "monthly",
	}, map[string]string{"team": teamID.String()})
}

// fireSubscriptionUpgradedEvent fires the PostHog `subscription_upgraded`
// event on any upgrade scenario.
func fireSubscriptionUpgradedEvent(teamID uuid.UUID, owner TeamOwner, customerID string, sub autumn.Subscription) {
	planID := sub.PlanID
	if planID == AutumnPlanFree {
		return
	}
	monthlyUSD, ok := planMonthlyUSD[planID]
	if !ok {
		log.Printf("posthog: no price map entry for plan %q, skipping subscription_upgraded", planID)
		return
	}
	posthog.Capture(owner.UserID, "subscription_upgraded", map[string]any{
		"schema_version":  "v1",
		"product":         planID,
		"revenue":         monthlyUSD * 12,
		"currency":        "USD",
		"subscription_id": subscriptionCompositeID(customerID, sub),
	}, map[string]string{"team": teamID.String()})
}

// fireSubscriptionDowngradedEvent fires the PostHog `subscription_downgraded`
// event when a team's paid plan ends and Free takes over (a downgrade, cancel,
// or expiry — billing.updated reports all three as the paid plan expiring).
func fireSubscriptionDowngradedEvent(teamID uuid.UUID, owner TeamOwner, customerID string, sub autumn.Subscription) {
	posthog.Capture(owner.UserID, "subscription_downgraded", map[string]any{
		"schema_version":  "v1",
		"product":         sub.PlanID,
		"subscription_id": subscriptionCompositeID(customerID, sub),
	}, map[string]string{"team": teamID.String()})
}
