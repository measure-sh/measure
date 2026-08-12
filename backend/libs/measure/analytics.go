package measure

import (
	"context"
	"errors"
	"fmt"
	"log"

	"backend/libs/autumn"
	"backend/libs/posthog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// Monthly price in USD by autumn plan ID. Used to compute annualized revenue
// for purchase events. Update when prices change or new paid plans are added.
var planMonthlyUSD = map[string]float64{
	AutumnPlanPro: 50,
}

// TeamOwner holds the identifiers of the owning user of a team.
type TeamOwner struct {
	UserID string
	Email  string
}

// GetTeamOwner returns the team's owning user's id and email. When the team
// has multiple owner-role members, the earliest-joined owner is returned.
// found=false (with no error) when no owner-role member exists.
func GetTeamOwner(ctx context.Context, pg *pgxpool.Pool, teamID uuid.UUID) (owner TeamOwner, found bool, err error) {
	stmt := sqlf.PostgreSQL.
		Select("u.id").
		Select("u.email").
		From("users u").
		Join("team_membership tm", "tm.user_id = u.id").
		Where("tm.team_id = ?", teamID).
		Where("tm.role = ?", "owner").
		OrderBy("tm.created_at ASC").
		Limit(1)
	defer stmt.Close()

	var userID uuid.UUID
	var email string
	err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).
		Scan(&userID, &email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TeamOwner{}, false, nil
		}
		return TeamOwner{}, false, err
	}
	owner.UserID = userID.String()
	owner.Email = email
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
// used as the PostHog subscription_id. Autumn webhook retries reproduce the
// same composite, so downstream systems dedupe naturally.
func subscriptionCompositeID(customerID string, sub autumn.Subscription) string {
	return fmt.Sprintf("%s:%s:%d", customerID, sub.PlanID, sub.StartedAt)
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
