package billing

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/stripe/stripe-go/v84"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

// DailyUsage holds per-team counts from the ClickHouse snapshot.
type DailyUsage struct {
	TeamID  string
	Events  uint64
	Spans   uint64
	Metrics uint64
}

// UnreportedUsage represents a billing_metrics_reporting row that has not yet been
// sent to Stripe.
type UnreportedUsage struct {
	TeamID           string
	ReportDate       time.Time
	Events           uint64
	Spans            uint64
	Metrics          uint64
	StripeCustomerID *string
}

// RunDailyMetering takes a storage snapshot and reports unreported usage to Stripe.
func RunDailyMetering(ctx context.Context, deps Deps) {
	fmt.Println("Running daily metering job...")

	// 1. Take snapshot for yesterday (if not already done)
	err := takeStorageSnapshot(ctx, deps)
	if err != nil {
		log.Printf("failed to take storage snapshot: %v", err)
	}

	// 2. Report all unreported usage to Stripe
	err = ReportUnreportedToStripe(ctx, deps)
	if err != nil {
		log.Printf("failed to report to Stripe: %v", err)
	}

	fmt.Println("Daily metering job completed.")
}

func takeStorageSnapshot(ctx context.Context, deps Deps) error {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	yesterday := today.AddDate(0, 0, -1)

	if snapshotExists(ctx, deps.PgPool, yesterday) {
		log.Printf("Snapshot for %s already exists, skipping.", yesterday.Format("2006-01-02"))
		return nil
	}

	log.Printf("Taking snapshot for %s", yesterday.Format("2006-01-02"))

	// Count events per team
	eventCounts, err := countAllEvents(ctx, deps.ChPool)
	if err != nil {
		return fmt.Errorf("failed to count events: %w", err)
	}

	// Count spans per team
	spanCounts, err := countAllSpans(ctx, deps.ChPool)
	if err != nil {
		return fmt.Errorf("failed to count spans: %w", err)
	}

	// TODO: Count metrics when table exists
	metricCounts := make(map[string]uint64)

	// Merge and save
	usageByTeam := mergeUsage(eventCounts, spanCounts, metricCounts)

	err = saveSnapshotBatch(ctx, deps.PgPool, yesterday, usageByTeam)
	if err != nil {
		return fmt.Errorf("failed to save snapshot: %w", err)
	}

	log.Printf("Snapshot saved for %d teams", len(usageByTeam))
	return nil
}

func snapshotExists(ctx context.Context, pool *pgxpool.Pool, date time.Time) bool {
	query := sqlf.From("billing_metrics_reporting").
		Select("1").
		Where("report_date = ?", date).
		Limit(1)
	defer query.Close()

	var exists int
	err := pool.QueryRow(ctx, query.String(), query.Args()...).Scan(&exists)
	return err == nil
}

func countAllEvents(ctx context.Context, chPool driver.Conn) (map[string]uint64, error) {
	query := sqlf.From("measure.events").
		Select("toString(team_id) as team_id").
		Select("count(*) as cnt").
		GroupBy("team_id")
	defer query.Close()

	rows, err := chPool.Query(ctx, query.String(), query.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make(map[string]uint64)
	for rows.Next() {
		var teamID string
		var count uint64
		if err := rows.Scan(&teamID, &count); err != nil {
			return nil, err
		}
		results[teamID] = count
	}

	return results, nil
}

func countAllSpans(ctx context.Context, chPool driver.Conn) (map[string]uint64, error) {
	query := sqlf.From("measure.spans").
		Select("toString(team_id) as team_id").
		Select("count(*) as cnt").
		GroupBy("team_id")
	defer query.Close()

	rows, err := chPool.Query(ctx, query.String(), query.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make(map[string]uint64)
	for rows.Next() {
		var teamID string
		var count uint64
		if err := rows.Scan(&teamID, &count); err != nil {
			return nil, err
		}
		results[teamID] = count
	}

	return results, nil
}

func mergeUsage(events, spans, metrics map[string]uint64) map[string]DailyUsage {
	teamIDs := make(map[string]bool)
	for id := range events {
		teamIDs[id] = true
	}
	for id := range spans {
		teamIDs[id] = true
	}
	for id := range metrics {
		teamIDs[id] = true
	}

	results := make(map[string]DailyUsage)
	for teamID := range teamIDs {
		results[teamID] = DailyUsage{
			TeamID:  teamID,
			Events:  events[teamID],
			Spans:   spans[teamID],
			Metrics: metrics[teamID],
		}
	}

	return results
}

func saveSnapshotBatch(ctx context.Context, pool *pgxpool.Pool, date time.Time, usageByTeam map[string]DailyUsage) error {
	for teamID, usage := range usageByTeam {
		stmt := sqlf.InsertInto("billing_metrics_reporting").
			Set("team_id", teamID).
			Set("report_date", date).
			Set("events", usage.Events).
			Set("spans", usage.Spans).
			Set("metrics", usage.Metrics).
			Clause("ON CONFLICT (team_id, report_date) DO UPDATE SET events = EXCLUDED.events, spans = EXCLUDED.spans, metrics = EXCLUDED.metrics")

		_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
		stmt.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

// ReportUnreportedToStripe sends all unreported usage records to Stripe as
// meter events, then marks them as reported.
func ReportUnreportedToStripe(ctx context.Context, deps Deps) error {
	unreported, err := getUnreportedUsage(ctx, deps.PgPool)
	if err != nil {
		return fmt.Errorf("failed to get unreported usage: %w", err)
	}

	if len(unreported) == 0 {
		log.Println("No unreported usage found.")
		return nil
	}

	log.Printf("Reporting %d unreported records to Stripe", len(unreported))

	for _, usage := range unreported {
		if usage.StripeCustomerID == nil {
			continue
		}

		// We add up events, spans, and metrics as "events" for billing purposes
		totalUnits := usage.Events + usage.Spans + usage.Metrics

		if totalUnits > 0 {
			err = reportToStripe(deps, *usage.StripeCustomerID, totalUnits, usage.ReportDate)
			if err != nil {
				log.Printf("failed to report to Stripe for team %s: %v", usage.TeamID, err)
				continue
			}
		}

		err = markAsReported(ctx, deps.PgPool, usage.TeamID, usage.ReportDate)
		if err != nil {
			log.Printf("failed to mark as reported for team %s: %v", usage.TeamID, err)
			continue
		}

		log.Printf("Reported team %s for %s: %d units",
			usage.TeamID, usage.ReportDate.Format("2006-01-02"), totalUnits)
	}

	return nil
}

func getUnreportedUsage(ctx context.Context, pool *pgxpool.Pool) ([]UnreportedUsage, error) {
	query := sqlf.
		Select("mr.team_id").
		Select("mr.report_date").
		Select("mr.events").
		Select("mr.spans").
		Select("mr.metrics").
		Select("tb.stripe_customer_id").
		From("billing_metrics_reporting mr").
		Join("team_billing tb", "mr.team_id = tb.team_id").
		Where("mr.reported_at IS NULL").
		Where("tb.plan = 'pro'"). // Only PRO plans
		Where("tb.stripe_customer_id IS NOT NULL").
		OrderBy("mr.report_date ASC")
	defer query.Close()

	rows, err := pool.Query(ctx, query.String(), query.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []UnreportedUsage
	for rows.Next() {
		var u UnreportedUsage
		if err := rows.Scan(
			&u.TeamID,
			&u.ReportDate,
			&u.Events,
			&u.Spans,
			&u.Metrics,
			&u.StripeCustomerID,
		); err != nil {
			return nil, err
		}
		results = append(results, u)
	}

	return results, nil
}

func reportToStripe(deps Deps, customerID string, value uint64, reportDate time.Time) error {
	idempotencyKey := fmt.Sprintf("%s:%s", customerID, reportDate.Format("2006-01-02"))

	params := &stripe.BillingMeterEventParams{
		EventName: stripe.String(deps.MeterName),
		Payload: map[string]string{
			"stripe_customer_id": customerID,
			"value":              fmt.Sprintf("%d", value),
		},
		Timestamp: stripe.Int64(reportDate.Unix()),
	}
	params.IdempotencyKey = stripe.String(idempotencyKey)

	_, err := deps.ReportToStripe(params)
	return err
}

func markAsReported(ctx context.Context, pool *pgxpool.Pool, teamID string, reportDate time.Time) error {
	stmt := sqlf.Update("billing_metrics_reporting").
		Set("reported_at", time.Now()).
		Where("team_id = ?", teamID).
		Where("report_date = ?", reportDate)
	defer stmt.Close()

	_, err := pool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}
