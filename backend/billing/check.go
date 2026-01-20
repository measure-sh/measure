package billing

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/stripe/stripe-go/v84"
)

const (
	ReasonPlanLimitExceeded = "plan_limit_exceeded"
	ReasonNoSubscription    = "no_subscription"
	ReasonSubscriptionError = "subscription_error"
)

// TeamBillingInfo is the joined teams + team_billing row used by the
// hourly billing check.
type TeamBillingInfo struct {
	TeamID                 string
	TeamName               string
	Plan                   string
	UsageNotifiedThreshold int
	UsageNotifiedCycle     *string
	StripeCustomerID       *string
	StripeSubscriptionID   *string
	AllowIngest            bool
	IngestBlockedReason    *string
}

// RunHourlyBillingCheck evaluates every team's billing status and
// blocks/unblocks ingestion as needed.
func RunHourlyBillingCheck(ctx context.Context, deps Deps) {
	fmt.Println("Running hourly billing check...")

	teams, err := fetchTeamsWithTeamBilling(ctx, deps.PgPool)
	if err != nil {
		log.Printf("failed to fetch teams: %v", err)
		return
	}

	for _, team := range teams {
		allow, reason := checkTeamBilling(ctx, deps, team)

		if allow != team.AllowIngest || !stringPtrEqual(reason, team.IngestBlockedReason) {
			err := updateTeamIngestStatus(ctx, deps.PgPool, team.TeamID, allow, reason)
			if err != nil {
				log.Printf("failed to update ingest status for team %s: %v", team.TeamID, err)
				continue
			}

			if !allow && team.AllowIngest {
				log.Printf("BLOCKED: Team %s (%s) - reason: %s", team.TeamID, team.TeamName, *reason)
			} else if allow && !team.AllowIngest {
				log.Printf("UNBLOCKED: Team %s (%s)", team.TeamID, team.TeamName)
			}
		}
	}

	fmt.Println("Hourly billing check completed.")
}

func fetchTeamsWithTeamBilling(ctx context.Context, pool *pgxpool.Pool) ([]TeamBillingInfo, error) {
	query := sqlf.
		Select("t.id").
		Select("t.name").
		Select("tb.plan").
		Select("tb.usage_notified_threshold").
		Select("tb.usage_notified_cycle").
		Select("tb.stripe_customer_id").
		Select("tb.stripe_subscription_id").
		Select("t.allow_ingest").
		Select("t.ingest_blocked_reason").
		From("teams t").
		Join("team_billing tb", "t.id = tb.team_id")
	defer query.Close()

	rows, err := pool.Query(ctx, query.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []TeamBillingInfo
	for rows.Next() {
		var team TeamBillingInfo
		if err := rows.Scan(
			&team.TeamID,
			&team.TeamName,
			&team.Plan,
			&team.UsageNotifiedThreshold,
			&team.UsageNotifiedCycle,
			&team.StripeCustomerID,
			&team.StripeSubscriptionID,
			&team.AllowIngest,
			&team.IngestBlockedReason,
		); err != nil {
			return nil, err
		}
		teams = append(teams, team)
	}

	return teams, nil
}

func checkTeamBilling(ctx context.Context, deps Deps, team TeamBillingInfo) (bool, *string) {
	switch team.Plan {
	case "free":
		return checkFreePlan(ctx, deps, team)
	case "pro":
		return checkProPlan(ctx, deps, team)
	default:
		return true, nil
	}
}

func updateTeamIngestStatus(ctx context.Context, pool *pgxpool.Pool, teamID string, allow bool, reason *string) error {
	stmt := sqlf.Update("teams").
		Set("allow_ingest", allow).
		Set("ingest_blocked_reason", reason).
		Where("id = ?", teamID)
	defer stmt.Close()

	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

func readTeamIngestStatus(ctx context.Context, pool *pgxpool.Pool, teamID string) (bool, *string, error) {
	query := sqlf.Select("allow_ingest").Select("ingest_blocked_reason").From("teams").Where("id = ?", teamID)
	defer query.Close()

	var allow bool
	var reason *string
	if err := pool.QueryRow(ctx, query.String(), query.Args()...).Scan(&allow, &reason); err != nil {
		return false, nil, err
	}
	return allow, reason, nil
}

// ----------------------------------------------------------------------------
// Free plan
// ----------------------------------------------------------------------------

func checkFreePlan(ctx context.Context, deps Deps, team TeamBillingInfo) (bool, *string) {
	const maxUnits = FreePlanMaxUnits

	cycleStart, cycleEnd, currentCycle := getCalendarMonthCycle()

	usage, err := getIngestionUsage(ctx, deps.ChPool, team.TeamID, cycleStart, cycleEnd)
	if err != nil {
		log.Printf("failed to get usage for team %s: %v", team.TeamID, err)
		return true, nil // Fail open
	}

	// Send notification emails at 75%, 90%, and 100% thresholds
	notifyUsageThresholds(ctx, deps, team, usage, maxUnits, currentCycle)

	// Block ingestion when limit is reached
	if usage >= maxUnits {
		reason := ReasonPlanLimitExceeded
		return false, &reason
	}

	return true, nil
}

func getCalendarMonthCycle() (start time.Time, end time.Time, cycle string) {
	now := time.Now().UTC()
	start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	end = start.AddDate(0, 1, 0)
	cycle = start.Format("2006-01")
	return
}

func getIngestionUsage(ctx context.Context, chPool driver.Conn, teamID string, start, end time.Time) (uint64, error) {
	query := sqlf.
		Select("COALESCE(sumMerge(events), 0) + COALESCE(sumMerge(spans), 0) + COALESCE(sumMerge(metrics), 0) as total").
		From("ingestion_metrics").
		Where("team_id = ?", teamID).
		Where("timestamp >= ?", start).
		Where("timestamp < ?", end)
	defer query.Close()

	var total uint64
	err := chPool.QueryRow(ctx, query.String(), query.Args()...).Scan(&total)
	if err != nil {
		return 0, err
	}

	return total, nil
}

// ----------------------------------------------------------------------------
// Pro plan
// ----------------------------------------------------------------------------

func checkProPlan(ctx context.Context, deps Deps, team TeamBillingInfo) (bool, *string) {
	if team.StripeSubscriptionID == nil {
		log.Printf("team %s (%s) on pro plan has no subscription ID — auto-downgrading", team.TeamID, team.TeamName)
		reason := ReasonNoSubscription
		return downgradeProTeam(ctx, deps, team, false, &reason)
	}

	// if we can't get subscription, we block but don't downgrade yet since it might be a transient error
	sub, err := deps.GetSubscription(*team.StripeSubscriptionID, nil)
	if err != nil {
		log.Printf("failed to get subscription for team %s: %v", team.TeamID, err)
		reason := ReasonSubscriptionError
		return false, &reason
	}

	allow, reason := checkSubscriptionStatus(sub)
	if !allow {
		if IsTerminalSubscriptionStatus(sub.Status) {
			return downgradeProTeam(ctx, deps, team, allow, reason)
		}
	}

	return allow, reason
}

// downgradeProTeam runs ProcessDowngrade for a pro team, notifies of the subscription failure,
// and returns the persisted post-downgrade ingest state so the caller does not overwrite it.
// fallbackAllow/fallbackReason are returned on any internal error.
func downgradeProTeam(ctx context.Context, deps Deps, team TeamBillingInfo, fallbackAllow bool, fallbackReason *string) (bool, *string) {
	teamID, parseErr := uuid.Parse(team.TeamID)
	if parseErr != nil {
		log.Printf("invalid team ID %s: %v", team.TeamID, parseErr)
		return fallbackAllow, fallbackReason
	}
	if downErr := ProcessDowngrade(ctx, deps, teamID); downErr != nil {
		log.Printf("failed to downgrade team %s: %v", team.TeamID, downErr)
		return fallbackAllow, fallbackReason
	}
	notifySubscriptionFailure(ctx, deps, team)
	allowAfter, reasonAfter, statusErr := readTeamIngestStatus(ctx, deps.PgPool, team.TeamID)
	if statusErr != nil {
		log.Printf("failed to fetch ingest status after downgrade for team %s: %v", team.TeamID, statusErr)
		return fallbackAllow, fallbackReason
	}
	return allowAfter, reasonAfter
}

func checkSubscriptionStatus(sub *stripe.Subscription) (bool, *string) {
	switch sub.Status {
	case stripe.SubscriptionStatusActive, stripe.SubscriptionStatusPastDue:
		return true, nil

	default:
		reason := string(sub.Status)
		return false, &reason
	}
}
