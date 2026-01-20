package billing

import (
	"backend/email"
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// ----------------------------------------------------------------------------
// Usage notifications
// ----------------------------------------------------------------------------

func notifyUsageThresholds(ctx context.Context, deps Deps, team TeamBillingInfo, usage, maxUnits uint64, currentCycle string) {
	if maxUnits == 0 {
		log.Printf("notifyUsageThresholds called with maxUnits=0 for team %s, skipping", team.TeamID)
		return
	}

	// Reset notification tracking if we're in a new billing cycle
	lastNotifiedThreshold := team.UsageNotifiedThreshold
	if team.UsageNotifiedCycle == nil || *team.UsageNotifiedCycle != currentCycle {
		lastNotifiedThreshold = 0
	}

	usagePercent := float64(usage) / float64(maxUnits) * 100

	// Determine which threshold we've crossed
	var currentThreshold int
	if usagePercent >= 100 {
		currentThreshold = 100
	} else if usagePercent >= 90 {
		currentThreshold = 90
	} else if usagePercent >= 75 {
		currentThreshold = 75
	}

	// Only send notification if we've crossed a new threshold
	if currentThreshold > lastNotifiedThreshold {
		log.Printf("Team %s (%s) reached %d%% usage (%.2f%% actual)", team.TeamID, team.TeamName, currentThreshold, usagePercent)

		err := sendUsageNotificationEmails(ctx, deps, team, currentThreshold, usage, maxUnits)
		if err != nil {
			log.Printf("failed to send usage notification emails for team %s: %v", team.TeamID, err)
			return
		}

		// Update the notification tracking
		err = updateUsageNotificationTracking(ctx, deps.PgPool, team.TeamID, currentThreshold, currentCycle)
		if err != nil {
			log.Printf("failed to update usage notification tracking for team %s: %v", team.TeamID, err)
		}
	}
}

func sendUsageNotificationEmails(ctx context.Context, deps Deps, team TeamBillingInfo, threshold int, usage, maxUnits uint64) error {
	subject, body := email.UsageLimitEmail(team.TeamName, team.TeamID, deps.SiteOrigin, threshold, usage, maxUnits)
	return sendEmailToTeamMembers(ctx, deps, team.TeamID, subject, body)
}

func updateUsageNotificationTracking(ctx context.Context, pool *pgxpool.Pool, teamID string, threshold int, cycle string) error {
	stmt := sqlf.Update("team_billing").
		Set("usage_notified_threshold", threshold).
		Set("usage_notified_cycle", cycle).
		Set("updated_at", time.Now()).
		Where("team_id = ?", teamID)
	defer stmt.Close()

	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// ----------------------------------------------------------------------------
// Subscription failure notifications
// ----------------------------------------------------------------------------

func notifySubscriptionFailure(ctx context.Context, deps Deps, team TeamBillingInfo) {
	subject, body := email.SubscriptionFailureEmail(team.TeamName, team.TeamID, deps.SiteOrigin)
	if err := sendEmailToTeamMembers(ctx, deps, team.TeamID, subject, body); err != nil {
		log.Printf("failed to send subscription failure emails for team %s: %v", team.TeamID, err)
	}
}

// ----------------------------------------------------------------------------
// Upgrade notifications
// ----------------------------------------------------------------------------

func notifyUpgrade(ctx context.Context, deps Deps, teamID string) {
	teamName, err := getTeamName(ctx, deps.PgPool, teamID)
	if err != nil {
		log.Printf("failed to get team name for upgrade notification (team %s): %v", teamID, err)
		return
	}
	subject, body := email.UpgradeEmail(teamName, teamID, deps.SiteOrigin, MaxRetentionDays)
	if err := sendEmailToTeamMembers(ctx, deps, teamID, subject, body); err != nil {
		log.Printf("failed to send upgrade notification emails for team %s: %v", teamID, err)
	}
}

// ----------------------------------------------------------------------------
// Manual downgrade notifications
// ----------------------------------------------------------------------------

func notifyManualDowngrade(ctx context.Context, deps Deps, teamID string) {
	teamName, err := getTeamName(ctx, deps.PgPool, teamID)
	if err != nil {
		log.Printf("failed to get team name for downgrade notification (team %s): %v", teamID, err)
		return
	}
	subject, body := email.ManualDowngradeEmail(teamName, teamID, deps.SiteOrigin, FreePlanMaxUnits, FreePlanMaxRetentionDays)
	if err := sendEmailToTeamMembers(ctx, deps, teamID, subject, body); err != nil {
		log.Printf("failed to send downgrade notification emails for team %s: %v", teamID, err)
	}
}

// ----------------------------------------------------------------------------
// Common email
// ----------------------------------------------------------------------------

func sendEmailToTeamMembers(ctx context.Context, deps Deps, teamID, subject, body string) error {
	pendingEmail := email.EmailInfo{
		From:        deps.TxEmailAddress,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	}

	if err := email.QueueEmailForTeam(ctx, deps.PgPool, teamID, nil, pendingEmail); err != nil {
		return fmt.Errorf("failed to queue team emails: %w", err)
	}

	log.Printf("Queued team emails (team %s): %s", teamID, subject)
	return nil
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

func getTeamName(ctx context.Context, pool *pgxpool.Pool, teamID string) (string, error) {
	stmt := sqlf.PostgreSQL.Select("name").From("teams").Where("id = ?", teamID)
	defer stmt.Close()
	var name string
	err := pool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&name)
	return name, err
}

func stringPtrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

