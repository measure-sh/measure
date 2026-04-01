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

// DailyUsage holds per-team windowed usage for a snapshot day.
type DailyUsage struct {
	TeamID  string
	Events  uint64
	Spans   uint64
	Metrics uint64
	BytesIn uint64
}

// UnreportedUsage represents a billing_metrics_reporting row that has not yet been
// sent to Stripe.
type UnreportedUsage struct {
	TeamID           string
	ReportDate       time.Time
	Events           uint64
	Spans            uint64
	Metrics          uint64
	BytesIn          uint64
	StripeCustomerID *string
}

// AppRetentionWindow holds per-app retention settings for windowed billing.
type AppRetentionWindow struct {
	TeamID         string
	AppID          string
	Retention      int
	DataCutoffDate time.Time
}

// ingestionRow holds a single (team, app, day) aggregation from ingestion_metrics.
type ingestionRow struct {
	TeamID  string
	AppID   string
	Day     time.Time
	Events  uint64
	Spans   uint64
	BytesIn uint64
}

// RunDailyMetering advances cutoff dates, takes a storage snapshot, and
// reports unreported usage to Stripe.
func RunDailyMetering(ctx context.Context, deps Deps) {
	fmt.Println("Running daily metering job...")

	today := time.Now().UTC().Truncate(24 * time.Hour)
	yesterday := today.AddDate(0, 0, -1)

	// 1. Advance cutoff dates for all apps
	if err := advanceCutoffDates(ctx, deps.PgPool, yesterday); err != nil {
		log.Printf("failed to advance cutoff dates: %v", err)
	}

	// 2. Take snapshot for yesterday (if not already done)
	err := takeStorageSnapshot(ctx, deps, yesterday)
	if err != nil {
		log.Printf("failed to take storage snapshot: %v", err)
	}

	// 3. Report all unreported usage to Stripe
	err = ReportUnreportedToStripe(ctx, deps)
	if err != nil {
		log.Printf("failed to report to Stripe: %v", err)
	}

	fmt.Println("Daily metering job completed.")
}

// advanceCutoffDates moves each app's data_cutoff_date forward using the
// high-water mark rule: new_cutoff = MAX(stored_cutoff, date - retention).
func advanceCutoffDates(ctx context.Context, pool *pgxpool.Pool, date time.Time) error {
	_, err := pool.Exec(ctx,
		"UPDATE apps SET data_cutoff_date = GREATEST(data_cutoff_date, $1::date - retention) WHERE data_cutoff_date < $1::date - retention",
		date)
	return err
}

func takeStorageSnapshot(ctx context.Context, deps Deps, snapshotDate time.Time) error {
	if snapshotExists(ctx, deps.PgPool, snapshotDate) {
		log.Printf("Snapshot for %s already exists, skipping.", snapshotDate.Format("2006-01-02"))
		return nil
	}

	log.Printf("Taking snapshot for %s", snapshotDate.Format("2006-01-02"))

	// Fetch per-app retention windows from postgres.
	appWindows, err := getAppRetentionWindows(ctx, deps.PgPool)
	if err != nil {
		return fmt.Errorf("failed to get app retention windows: %w", err)
	}

	if len(appWindows) == 0 {
		log.Println("No apps found, skipping snapshot.")
		return nil
	}

	// Find the earliest cutoff across all apps for the ClickHouse query.
	minCutoff := snapshotDate
	for _, aw := range appWindows {
		effectiveCutoff := aw.DataCutoffDate
		if computed := snapshotDate.AddDate(0, 0, -aw.Retention); computed.After(effectiveCutoff) {
			effectiveCutoff = computed
		}
		if effectiveCutoff.Before(minCutoff) {
			minCutoff = effectiveCutoff
		}
	}

	// Single ClickHouse query for all teams/apps within the widest window.
	ingestionData, err := queryIngestionByDate(ctx, deps.ChPool, minCutoff, snapshotDate)
	if err != nil {
		return fmt.Errorf("failed to query ingestion data: %w", err)
	}

	// Compute per-team windowed usage.
	usageByTeam := computeWindowedUsage(ingestionData, appWindows, snapshotDate)

	err = saveSnapshotBatch(ctx, deps.PgPool, snapshotDate, usageByTeam)
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

// getAppRetentionWindows returns all apps with their retention and cutoff date.
func getAppRetentionWindows(ctx context.Context, pool *pgxpool.Pool) ([]AppRetentionWindow, error) {
	query := sqlf.PostgreSQL.
		Select("a.team_id").
		Select("a.id").
		Select("a.retention").
		Select("a.data_cutoff_date").
		From("apps a").
		Join("team_billing tb", "a.team_id = tb.team_id").
		Where("tb.plan = 'pro'").
		Where("tb.stripe_customer_id IS NOT NULL")
	defer query.Close()

	rows, err := pool.Query(ctx, query.String(), query.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []AppRetentionWindow
	for rows.Next() {
		var aw AppRetentionWindow
		if err := rows.Scan(&aw.TeamID, &aw.AppID, &aw.Retention, &aw.DataCutoffDate); err != nil {
			return nil, err
		}
		results = append(results, aw)
	}

	return results, nil
}

// queryIngestionByDate fetches per-(team, app, day) aggregations from
// ingestion_metrics between minCutoff and snapshotDate (inclusive).
func queryIngestionByDate(ctx context.Context, chPool driver.Conn, minCutoff, snapshotDate time.Time) ([]ingestionRow, error) {
	dayEnd := snapshotDate.Truncate(24*time.Hour).AddDate(0, 0, 1)

	query := sqlf.From("ingestion_metrics").
		Select("toString(team_id) as team_id").
		Select("toString(app_id) as app_id").
		Select("toDate(timestamp) as day").
		Select("COALESCE(sumMerge(events), 0) as events").
		Select("COALESCE(sumMerge(spans), 0) as spans").
		Select("COALESCE(sumMerge(bytes_in), 0) as bytes_in").
		Where("timestamp >= ?", minCutoff).
		Where("timestamp < ?", dayEnd).
		GroupBy("team_id, app_id, day")
	defer query.Close()

	rows, err := chPool.Query(ctx, query.String(), query.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ingestionRow
	for rows.Next() {
		var r ingestionRow
		if err := rows.Scan(&r.TeamID, &r.AppID, &r.Day, &r.Events, &r.Spans, &r.BytesIn); err != nil {
			return nil, err
		}
		results = append(results, r)
	}

	return results, nil
}

// computeWindowedUsage filters ingestion data per-app using each app's
// effective window and aggregates into per-team totals.
func computeWindowedUsage(data []ingestionRow, appWindows []AppRetentionWindow, snapshotDate time.Time) map[string]DailyUsage {
	// Build lookup: appID -> AppRetentionWindow
	windowByApp := make(map[string]AppRetentionWindow, len(appWindows))
	for _, aw := range appWindows {
		windowByApp[aw.AppID] = aw
	}

	results := make(map[string]DailyUsage)
	for _, row := range data {
		aw, ok := windowByApp[row.AppID]
		if !ok {
			continue // orphaned data, skip
		}

		// Effective cutoff: MAX(data_cutoff_date, snapshotDate - retention)
		effectiveCutoff := aw.DataCutoffDate
		if computed := snapshotDate.AddDate(0, 0, -aw.Retention); computed.After(effectiveCutoff) {
			effectiveCutoff = computed
		}

		// Window is (effectiveCutoff, snapshotDate]
		if !row.Day.After(effectiveCutoff) {
			continue
		}
		if row.Day.After(snapshotDate) {
			continue
		}

		usage := results[aw.TeamID]
		usage.TeamID = aw.TeamID
		usage.Events += row.Events
		usage.Spans += row.Spans
		usage.BytesIn += row.BytesIn
		results[aw.TeamID] = usage
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
			Set("bytes_in", usage.BytesIn).
			Clause("ON CONFLICT (team_id, report_date) DO UPDATE SET events = EXCLUDED.events, spans = EXCLUDED.spans, metrics = EXCLUDED.metrics, bytes_in = EXCLUDED.bytes_in")

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

		// Convert bytes to GB-days: bytes / (1024^3) gives GB for one day
		gbDays := float64(usage.BytesIn) / (1024 * 1024 * 1024)

		if gbDays > 0 {
			err = reportToStripe(deps, *usage.StripeCustomerID, gbDays, usage.ReportDate)
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

		log.Printf("Reported team %s for %s: %.6f GB-days",
			usage.TeamID, usage.ReportDate.Format("2006-01-02"), gbDays)
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
		Select("mr.bytes_in").
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
			&u.BytesIn,
			&u.StripeCustomerID,
		); err != nil {
			return nil, err
		}
		results = append(results, u)
	}

	return results, nil
}

func reportToStripe(deps Deps, customerID string, gbDays float64, reportDate time.Time) error {
	idempotencyKey := fmt.Sprintf("%s:%s", customerID, reportDate.Format("2006-01-02"))

	params := &stripe.BillingMeterEventParams{
		EventName: stripe.String(deps.MeterName),
		Payload: map[string]string{
			"stripe_customer_id": customerID,
			"value":              fmt.Sprintf("%.6f", gbDays),
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
