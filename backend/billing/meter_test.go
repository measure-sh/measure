//go:build integration

package billing

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

// ==========================================================================
// Advance cutoff dates (high-water mark)
// ==========================================================================

func TestAdvanceCutoffDates(t *testing.T) {
	ctx := context.Background()

	t.Run("moves cutoff forward", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "CutoffTeam", true)
		seedApp(ctx, t, appID, teamID, 30)

		// Set cutoff to 60 days ago (simulating old state)
		oldCutoff := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -60)
		setAppDataCutoffDate(ctx, t, appID, oldCutoff)

		today := time.Now().UTC().Truncate(24 * time.Hour)
		if err := advanceCutoffDates(ctx, th.PgPool, today); err != nil {
			t.Fatalf("advanceCutoffDates: %v", err)
		}

		// Should have moved to today - 30
		got := getAppDataCutoffDate(ctx, t, appID)
		expected := today.AddDate(0, 0, -30)
		if !got.Equal(expected) {
			t.Errorf("cutoff = %v, want %v", got.Format("2006-01-02"), expected.Format("2006-01-02"))
		}
	})

	t.Run("stays put when retention increases", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "CutoffTeam", true)
		seedApp(ctx, t, appID, teamID, 90) // 90-day retention

		// Set cutoff to 30 days ago (simulating previous 30-day retention)
		cutoff30 := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -30)
		setAppDataCutoffDate(ctx, t, appID, cutoff30)

		today := time.Now().UTC().Truncate(24 * time.Hour)
		if err := advanceCutoffDates(ctx, th.PgPool, today); err != nil {
			t.Fatalf("advanceCutoffDates: %v", err)
		}

		// target = today - 90, which is before cutoff30. Cutoff should stay at cutoff30.
		got := getAppDataCutoffDate(ctx, t, appID)
		if !got.Equal(cutoff30) {
			t.Errorf("cutoff = %v, want %v (should stay put)", got.Format("2006-01-02"), cutoff30.Format("2006-01-02"))
		}
	})
}

// ==========================================================================
// Compute windowed usage (pure Go, no DB)
// ==========================================================================

func TestComputeWindowedUsage(t *testing.T) {
	snapshotDate := time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC)

	t.Run("per-app windowing with different retentions", func(t *testing.T) {
		teamID := "team-1"
		appA := "app-a" // 30-day retention, cutoff = Jan 1
		appB := "app-b" // 90-day retention, cutoff = Nov 3 (i.e., 90 days before Jan 31)

		appWindows := []AppRetentionWindow{
			{TeamID: teamID, AppID: appA, Retention: 30, DataCutoffDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
			{TeamID: teamID, AppID: appB, Retention: 90, DataCutoffDate: time.Date(2025, 11, 3, 0, 0, 0, 0, time.UTC)},
		}

		data := []ingestionRow{
			// App A: Jan 2 (within 30-day window) and Dec 15 (outside 30-day window)
			{TeamID: teamID, AppID: appA, Day: time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC), Events: 10, Spans: 5, BytesIn: 1000},
			{TeamID: teamID, AppID: appA, Day: time.Date(2025, 12, 15, 0, 0, 0, 0, time.UTC), Events: 99, Spans: 99, BytesIn: 9999},
			// App B: Nov 15 (within 90-day window) and Oct 1 (outside cutoff)
			{TeamID: teamID, AppID: appB, Day: time.Date(2025, 11, 15, 0, 0, 0, 0, time.UTC), Events: 20, Spans: 10, BytesIn: 2000},
			{TeamID: teamID, AppID: appB, Day: time.Date(2025, 10, 1, 0, 0, 0, 0, time.UTC), Events: 88, Spans: 88, BytesIn: 8888},
		}

		result := computeWindowedUsage(data, appWindows, snapshotDate)

		if len(result) != 1 {
			t.Fatalf("got %d teams, want 1", len(result))
		}

		u := result[teamID]
		// App A contributes: 10 events, 5 spans, 1000 bytes (Jan 2 only)
		// App B contributes: 20 events, 10 spans, 2000 bytes (Nov 15 only)
		if u.Events != 30 || u.Spans != 15 || u.BytesIn != 3000 {
			t.Errorf("usage = events=%d spans=%d bytes=%d, want 30/15/3000", u.Events, u.Spans, u.BytesIn)
		}
	})

	t.Run("orphaned data skipped", func(t *testing.T) {
		data := []ingestionRow{
			{TeamID: "t1", AppID: "unknown-app", Day: time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), Events: 10, BytesIn: 1000},
		}

		result := computeWindowedUsage(data, nil, snapshotDate)
		if len(result) != 0 {
			t.Errorf("got %d teams, want 0 (orphaned data should be skipped)", len(result))
		}
	})

	t.Run("multiple teams", func(t *testing.T) {
		appWindows := []AppRetentionWindow{
			{TeamID: "t1", AppID: "a1", Retention: 30, DataCutoffDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
			{TeamID: "t2", AppID: "a2", Retention: 30, DataCutoffDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
		}

		data := []ingestionRow{
			{TeamID: "t1", AppID: "a1", Day: time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), BytesIn: 1000},
			{TeamID: "t2", AppID: "a2", Day: time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), BytesIn: 2000},
		}

		result := computeWindowedUsage(data, appWindows, snapshotDate)
		if len(result) != 2 {
			t.Fatalf("got %d teams, want 2", len(result))
		}
		if result["t1"].BytesIn != 1000 {
			t.Errorf("t1 bytes = %d, want 1000", result["t1"].BytesIn)
		}
		if result["t2"].BytesIn != 2000 {
			t.Errorf("t2 bytes = %d, want 2000", result["t2"].BytesIn)
		}
	})
}

// ==========================================================================
// Snapshot existence check
// ==========================================================================

func TestSnapshotExists(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

	seedTeamWithBilling(ctx, t, teamID, "SnapTeam", "free", true)

	if snapshotExists(ctx, th.PgPool, date) {
		t.Error("expected false when no snapshot exists")
	}

	seedBillingMetricsReporting(ctx, t, teamID, date, 100, 50, 10, 1024*1024, false)

	if !snapshotExists(ctx, th.PgPool, date) {
		t.Error("expected true after inserting snapshot")
	}
}

// ==========================================================================
// Persist daily usage snapshots
// ==========================================================================

func TestSaveSnapshotBatch(t *testing.T) {
	ctx := context.Background()

	t.Run("insert and upsert", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		seedTeamWithBilling(ctx, t, teamID, "SnapTeam", "free", true)

		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
		usage := map[string]DailyUsage{
			teamID: {TeamID: teamID, Events: 100, Spans: 50, Metrics: 10, BytesIn: 1024 * 1024},
		}

		if err := saveSnapshotBatch(ctx, th.PgPool, date, usage); err != nil {
			t.Fatalf("saveSnapshotBatch (insert): %v", err)
		}

		var events, spans, metrics, bytesIn uint64
		err := th.PgPool.QueryRow(ctx,
			"SELECT events, spans, metrics, bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&events, &spans, &metrics, &bytesIn)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if events != 100 || spans != 50 || metrics != 10 || bytesIn != 1024*1024 {
			t.Errorf("got events=%d spans=%d metrics=%d bytesIn=%d, want 100/50/10/1048576", events, spans, metrics, bytesIn)
		}

		// Upsert with new values
		usage[teamID] = DailyUsage{TeamID: teamID, Events: 200, Spans: 100, Metrics: 20, BytesIn: 2 * 1024 * 1024}
		if err := saveSnapshotBatch(ctx, th.PgPool, date, usage); err != nil {
			t.Fatalf("saveSnapshotBatch (upsert): %v", err)
		}

		err = th.PgPool.QueryRow(ctx,
			"SELECT events, spans, metrics, bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&events, &spans, &metrics, &bytesIn)
		if err != nil {
			t.Fatalf("query after upsert: %v", err)
		}
		if events != 200 || spans != 100 || metrics != 20 || bytesIn != 2*1024*1024 {
			t.Errorf("after upsert got events=%d spans=%d metrics=%d bytesIn=%d, want 200/100/20/2097152", events, spans, metrics, bytesIn)
		}
	})

	t.Run("empty map", func(t *testing.T) {
		if err := saveSnapshotBatch(ctx, th.PgPool, time.Now(), map[string]DailyUsage{}); err != nil {
			t.Fatalf("saveSnapshotBatch with empty map: %v", err)
		}
	})
}

// ==========================================================================
// Fetch unreported usage for Stripe
// ==========================================================================

func TestGetUnreportedUsage(t *testing.T) {
	ctx := context.Background()

	t.Run("filters correctly", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		// pro + stripe_customer_id + unreported -> should appear
		proTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, proTeam, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, proTeam, "cus_pro123")
		seedBillingMetricsReporting(ctx, t, proTeam, date, 100, 50, 10, 1024*1024, false)

		// free plan -> should NOT appear
		freeTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, freeTeam, "FreeTeam", "free", true)
		setStripeCustomerID(ctx, t, freeTeam, "cus_free456")
		seedBillingMetricsReporting(ctx, t, freeTeam, date, 200, 100, 20, 2*1024*1024, false)

		// pro but no stripe_customer_id -> should NOT appear
		noStripeTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, noStripeTeam, "NoStripeTeam", "pro", true)
		seedBillingMetricsReporting(ctx, t, noStripeTeam, date, 50, 25, 5, 512*1024, false)

		// pro + stripe_customer_id + already reported -> should NOT appear
		reportedTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, reportedTeam, "ReportedTeam", "pro", true)
		setStripeCustomerID(ctx, t, reportedTeam, "cus_reported789")
		seedBillingMetricsReporting(ctx, t, reportedTeam, date, 300, 150, 30, 3*1024*1024, true)

		unreported, err := getUnreportedUsage(ctx, th.PgPool)
		if err != nil {
			t.Fatalf("getUnreportedUsage: %v", err)
		}

		if len(unreported) != 1 {
			t.Fatalf("got %d records, want 1", len(unreported))
		}

		u := unreported[0]
		if u.TeamID != proTeam {
			t.Errorf("TeamID = %q, want %q", u.TeamID, proTeam)
		}
		if u.Events != 100 || u.Spans != 50 || u.Metrics != 10 || u.BytesIn != 1024*1024 {
			t.Errorf("usage = events=%d spans=%d metrics=%d bytesIn=%d, want 100/50/10/1048576", u.Events, u.Spans, u.Metrics, u.BytesIn)
		}
		if u.StripeCustomerID == nil || *u.StripeCustomerID != "cus_pro123" {
			t.Errorf("StripeCustomerID = %v, want cus_pro123", u.StripeCustomerID)
		}
	})

	t.Run("ordered by date", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, teamID, "cus_order123")

		date1 := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
		date2 := time.Date(2026, 1, 14, 0, 0, 0, 0, time.UTC)
		seedBillingMetricsReporting(ctx, t, teamID, date1, 100, 50, 10, 1024*1024, false)
		seedBillingMetricsReporting(ctx, t, teamID, date2, 200, 100, 20, 2*1024*1024, false)

		unreported, err := getUnreportedUsage(ctx, th.PgPool)
		if err != nil {
			t.Fatalf("getUnreportedUsage: %v", err)
		}

		if len(unreported) != 2 {
			t.Fatalf("got %d records, want 2", len(unreported))
		}

		if !unreported[0].ReportDate.Equal(date2) {
			t.Errorf("first record date = %v, want %v", unreported[0].ReportDate, date2)
		}
		if !unreported[1].ReportDate.Equal(date1) {
			t.Errorf("second record date = %v, want %v", unreported[1].ReportDate, date1)
		}
	})
}

// ==========================================================================
// Mark usage as reported
// ==========================================================================

func TestMarkAsReported(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	team1 := uuid.New().String()
	team2 := uuid.New().String()
	date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

	seedTeamWithBilling(ctx, t, team1, "Team1", "pro", true)
	seedTeamWithBilling(ctx, t, team2, "Team2", "pro", true)
	seedBillingMetricsReporting(ctx, t, team1, date, 100, 50, 10, 1024*1024, false)
	seedBillingMetricsReporting(ctx, t, team2, date, 200, 100, 20, 2*1024*1024, false)

	if err := markAsReported(ctx, th.PgPool, team1, date); err != nil {
		t.Fatalf("markAsReported: %v", err)
	}

	var reportedAt *time.Time
	err := th.PgPool.QueryRow(ctx,
		"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		team1, date).Scan(&reportedAt)
	if err != nil {
		t.Fatalf("query team1: %v", err)
	}
	if reportedAt == nil {
		t.Error("team1 reported_at should not be nil")
	}

	err = th.PgPool.QueryRow(ctx,
		"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		team2, date).Scan(&reportedAt)
	if err != nil {
		t.Fatalf("query team2: %v", err)
	}
	if reportedAt != nil {
		t.Error("team2 reported_at should be nil")
	}
}

// ==========================================================================
// Stripe meter event reporting
// ==========================================================================

func TestReportToStripe(t *testing.T) {
	t.Run("correct params", func(t *testing.T) {
		var captured *stripe.BillingMeterEventParams
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			captured = params
			return &stripe.BillingMeterEvent{}, nil
		}

		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
		err := reportToStripe(deps, "cus_test123", 0.500000, date)
		if err != nil {
			t.Fatalf("reportToStripe: %v", err)
		}

		if captured == nil {
			t.Fatal("stripe was not called")
		}
		if *captured.EventName != "test_gb_days" {
			t.Errorf("EventName = %q, want %q", *captured.EventName, "test_gb_days")
		}
		if captured.Payload["stripe_customer_id"] != "cus_test123" {
			t.Errorf("Payload[stripe_customer_id] = %q, want %q", captured.Payload["stripe_customer_id"], "cus_test123")
		}
		if captured.Payload["value"] != "0.500000" {
			t.Errorf("Payload[value] = %q, want %q", captured.Payload["value"], "0.500000")
		}
		if *captured.Timestamp != date.Unix() {
			t.Errorf("Timestamp = %d, want %d", *captured.Timestamp, date.Unix())
		}

		expectedKey := fmt.Sprintf("cus_test123:%s", date.Format("2006-01-02"))
		if *captured.IdempotencyKey != expectedKey {
			t.Errorf("IdempotencyKey = %q, want %q", *captured.IdempotencyKey, expectedKey)
		}
	})

	t.Run("error propagation", func(t *testing.T) {
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			return nil, errors.New("stripe down")
		}

		err := reportToStripe(deps, "cus_test", 0.001, time.Now())
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
}

// ==========================================================================
// Daily storage snapshot (windowed)
// ==========================================================================

func TestTakeStorageSnapshot(t *testing.T) {
	ctx := context.Background()

	t.Run("skips if snapshot exists", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		seedTeamWithBilling(ctx, t, teamID, "SnapTeam", "free", true)

		yesterday := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -1)
		seedBillingMetricsReporting(ctx, t, teamID, yesterday, 999, 888, 777, 5*1024*1024, false)

		deps := testDeps()
		err := takeStorageSnapshot(ctx, deps, yesterday)
		if err != nil {
			t.Fatalf("takeStorageSnapshot: %v", err)
		}

		var events, spans, metrics uint64
		err = th.PgPool.QueryRow(ctx,
			"SELECT events, spans, metrics FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, yesterday).Scan(&events, &spans, &metrics)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if events != 999 || spans != 888 || metrics != 777 {
			t.Errorf("snapshot was overwritten: events=%d spans=%d metrics=%d", events, spans, metrics)
		}
	})

	t.Run("creates windowed snapshot", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "SnapTeam", true)
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)
		seedApp(ctx, t, appID, teamID, 30)

		yesterday := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -1)

		// Set cutoff to 30 days before yesterday
		cutoff := yesterday.AddDate(0, 0, -30)
		setAppDataCutoffDate(ctx, t, appID, cutoff)

		// Seed ingestion for 2 days within the window
		seedIngestionUsage(ctx, t, teamID.String(), appID.String(), yesterday.Add(12*time.Hour), 5, 3, 0, 1*1024*1024)
		seedIngestionUsage(ctx, t, teamID.String(), appID.String(), yesterday.AddDate(0, 0, -1).Add(12*time.Hour), 10, 7, 0, 2*1024*1024)

		deps := testDeps()
		err := takeStorageSnapshot(ctx, deps, yesterday)
		if err != nil {
			t.Fatalf("takeStorageSnapshot: %v", err)
		}

		var events, spans, bytesIn uint64
		err = th.PgPool.QueryRow(ctx,
			"SELECT events, spans, bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID.String(), yesterday).Scan(&events, &spans, &bytesIn)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		// Both days are within the 30-day window
		if events != 15 {
			t.Errorf("events = %d, want 15", events)
		}
		if spans != 10 {
			t.Errorf("spans = %d, want 10", spans)
		}
		if bytesIn != 3*1024*1024 {
			t.Errorf("bytes_in = %d, want %d", bytesIn, 3*1024*1024)
		}
	})
}

// ==========================================================================
// Report unreported usage to Stripe (simple)
// ==========================================================================

func TestReportUnreportedToStripe(t *testing.T) {
	ctx := context.Background()

	t.Run("no unreported records", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		called := false
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			called = true
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}
		if called {
			t.Error("stripe should not have been called")
		}
	})

	t.Run("reports and marks", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, teamID, "cus_report123")
		seedBillingMetricsReporting(ctx, t, teamID, date, 100, 50, 10, 1024*1024, false)

		var capturedParams *stripe.BillingMeterEventParams
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			capturedParams = params
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}

		if capturedParams == nil {
			t.Fatal("stripe was not called")
		}
		// GB-days = 1024*1024 / (1024*1024*1024) = 1/1024
		expectedValue := fmt.Sprintf("%.6f", float64(1024*1024)/float64(1024*1024*1024))
		if capturedParams.Payload["value"] != expectedValue {
			t.Errorf("Payload[value] = %q, want %q", capturedParams.Payload["value"], expectedValue)
		}

		var reportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&reportedAt)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if reportedAt == nil {
			t.Error("reported_at should be set")
		}
	})

	t.Run("skips zero-unit rows", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, teamID, "cus_zero123")
		seedBillingMetricsReporting(ctx, t, teamID, date, 0, 0, 0, 0, false)

		called := false
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			called = true
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}
		if called {
			t.Error("stripe should not be called for zero bytes")
		}

		var reportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&reportedAt)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if reportedAt == nil {
			t.Error("reported_at should be set even for zero units")
		}
	})

	t.Run("stripe error continues to next record", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		team1 := uuid.New().String()
		team2 := uuid.New().String()
		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		seedTeamWithBilling(ctx, t, team1, "Team1", "pro", true)
		setStripeCustomerID(ctx, t, team1, "cus_fail1")
		seedBillingMetricsReporting(ctx, t, team1, date, 100, 50, 10, 1024*1024, false)

		seedTeamWithBilling(ctx, t, team2, "Team2", "pro", true)
		setStripeCustomerID(ctx, t, team2, "cus_ok2")
		seedBillingMetricsReporting(ctx, t, team2, date, 200, 100, 20, 2*1024*1024, false)

		callCount := 0
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			callCount++
			if params.Payload["stripe_customer_id"] == "cus_fail1" {
				return nil, errors.New("stripe error")
			}
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}

		if callCount != 2 {
			t.Errorf("stripe called %d times, want 2", callCount)
		}

		var t1ReportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			team1, date).Scan(&t1ReportedAt)
		if err != nil {
			t.Fatalf("query team1: %v", err)
		}
		if t1ReportedAt != nil {
			t.Error("team1 should not be marked as reported after stripe error")
		}

		var t2ReportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			team2, date).Scan(&t2ReportedAt)
		if err != nil {
			t.Fatalf("query team2: %v", err)
		}
		if t2ReportedAt == nil {
			t.Error("team2 should be marked as reported")
		}
	})
}

// ==========================================================================
// Daily metering job (end-to-end)
// ==========================================================================

func TestRunDailyMetering(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	appID := uuid.New()

	seedTeam(ctx, t, teamID, "E2ETeam", true)
	seedTeamBilling(ctx, t, teamID, "pro", nil, nil)
	setStripeCustomerID(ctx, t, teamID.String(), "cus_e2e123")
	seedApp(ctx, t, appID, teamID, 30)

	yesterday := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -1)

	// Set cutoff so the window includes yesterday
	cutoff := yesterday.AddDate(0, 0, -30)
	setAppDataCutoffDate(ctx, t, appID, cutoff)

	// Seed ingestion for yesterday
	seedIngestionUsage(ctx, t, teamID.String(), appID.String(), yesterday.Add(12*time.Hour), 4, 6, 0, 10*1024*1024)

	var capturedParams *stripe.BillingMeterEventParams
	deps := testDeps()
	deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
		capturedParams = params
		return &stripe.BillingMeterEvent{}, nil
	}

	RunDailyMetering(ctx, deps)

	// Verify snapshot was created with windowed values
	var events, spans, bytesIn uint64
	err := th.PgPool.QueryRow(ctx,
		"SELECT events, spans, bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID.String(), yesterday).Scan(&events, &spans, &bytesIn)
	if err != nil {
		t.Fatalf("query snapshot: %v", err)
	}
	if events != 4 {
		t.Errorf("events = %d, want 4", events)
	}
	if spans != 6 {
		t.Errorf("spans = %d, want 6", spans)
	}
	if bytesIn != 10*1024*1024 {
		t.Errorf("bytes_in = %d, want %d", bytesIn, 10*1024*1024)
	}

	// Verify reported to stripe (simple: bytes_in from snapshot)
	if capturedParams == nil {
		t.Fatal("stripe was not called")
	}
	expectedGBDays := fmt.Sprintf("%.6f", float64(10*1024*1024)/float64(1024*1024*1024))
	if capturedParams.Payload["value"] != expectedGBDays {
		t.Errorf("Payload[value] = %q, want %q", capturedParams.Payload["value"], expectedGBDays)
	}

	// Verify marked as reported
	var reportedAt *time.Time
	err = th.PgPool.QueryRow(ctx,
		"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID.String(), yesterday).Scan(&reportedAt)
	if err != nil {
		t.Fatalf("query reported_at: %v", err)
	}
	if reportedAt == nil {
		t.Error("reported_at should be set after RunDailyMetering")
	}
}

// ==========================================================================
// Billing cycle: retention changes
// ==========================================================================

func TestBillingCycle_RetentionDecrease(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "RetDecTeam", true)
	seedTeamBilling(ctx, t, teamID, "pro", nil, nil)
	seedApp(ctx, t, appID, teamID, 5)

	today := time.Now().UTC().Truncate(24 * time.Hour)
	day1 := today.AddDate(0, 0, -1) // first snapshot date
	day2 := today                     // second snapshot date

	// Set cutoff to 5 days before day1 (full 5-day window)
	setAppDataCutoffDate(ctx, t, appID, day1.AddDate(0, 0, -5))

	// Seed 6 days of ingestion: day1-5 through day1, each 1MB
	for i := 5; i >= 0; i-- {
		ts := day1.AddDate(0, 0, -i).Add(12 * time.Hour)
		seedIngestionUsage(ctx, t, teamID.String(), appID.String(), ts, 10, 5, 0, 1024*1024)
	}

	// Snapshot day1 with retention=5 → window: (day1-5, day1] = 5 days
	deps := testDeps()
	if err := takeStorageSnapshot(ctx, deps, day1); err != nil {
		t.Fatalf("snapshot day1: %v", err)
	}

	var bytesIn uint64
	err := th.PgPool.QueryRow(ctx,
		"SELECT bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID.String(), day1).Scan(&bytesIn)
	if err != nil {
		t.Fatalf("query day1: %v", err)
	}
	if bytesIn != 5*1024*1024 {
		t.Errorf("day1 bytes_in = %d, want %d (5 days)", bytesIn, 5*1024*1024)
	}

	// Decrease retention from 5 to 2
	_, err = th.PgPool.Exec(ctx, "UPDATE apps SET retention = 2 WHERE id = $1", appID)
	if err != nil {
		t.Fatalf("update retention: %v", err)
	}

	// Advance cutoffs for day2 → cutoff should jump to day2-2
	if err := advanceCutoffDates(ctx, th.PgPool, day2); err != nil {
		t.Fatalf("advance cutoffs: %v", err)
	}

	// Seed ingestion for day2
	seedIngestionUsage(ctx, t, teamID.String(), appID.String(), day2.Add(12*time.Hour), 10, 5, 0, 1024*1024)

	// Snapshot day2 with retention=2 → window: (day2-2, day2] = 2 days
	if err := takeStorageSnapshot(ctx, deps, day2); err != nil {
		t.Fatalf("snapshot day2: %v", err)
	}

	err = th.PgPool.QueryRow(ctx,
		"SELECT bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID.String(), day2).Scan(&bytesIn)
	if err != nil {
		t.Fatalf("query day2: %v", err)
	}
	if bytesIn != 2*1024*1024 {
		t.Errorf("day2 bytes_in = %d, want %d (2 days after retention decrease)", bytesIn, 2*1024*1024)
	}
}

func TestBillingCycle_RetentionIncrease(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "RetIncTeam", true)
	seedTeamBilling(ctx, t, teamID, "pro", nil, nil)
	seedApp(ctx, t, appID, teamID, 2)

	today := time.Now().UTC().Truncate(24 * time.Hour)
	day1 := today.AddDate(0, 0, -1)
	day2 := today

	// Set cutoff to 2 days before day1 (simulating steady-state 2-day retention)
	cutoff2 := day1.AddDate(0, 0, -2)
	setAppDataCutoffDate(ctx, t, appID, cutoff2)

	// Seed 6 days of ingestion: day1-5 through day1, each 1MB
	for i := 5; i >= 0; i-- {
		ts := day1.AddDate(0, 0, -i).Add(12 * time.Hour)
		seedIngestionUsage(ctx, t, teamID.String(), appID.String(), ts, 10, 5, 0, 1024*1024)
	}

	// Snapshot day1 with retention=2 → window: (day1-2, day1] = 2 days
	deps := testDeps()
	if err := takeStorageSnapshot(ctx, deps, day1); err != nil {
		t.Fatalf("snapshot day1: %v", err)
	}

	var bytesIn uint64
	err := th.PgPool.QueryRow(ctx,
		"SELECT bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID.String(), day1).Scan(&bytesIn)
	if err != nil {
		t.Fatalf("query day1: %v", err)
	}
	if bytesIn != 2*1024*1024 {
		t.Errorf("day1 bytes_in = %d, want %d (2 days)", bytesIn, 2*1024*1024)
	}

	// Increase retention from 2 to 5
	_, err = th.PgPool.Exec(ctx, "UPDATE apps SET retention = 5 WHERE id = $1", appID)
	if err != nil {
		t.Fatalf("update retention: %v", err)
	}

	// Advance cutoffs for day2 → cutoff should STAY at cutoff2 (high-water mark prevents going back)
	if err := advanceCutoffDates(ctx, th.PgPool, day2); err != nil {
		t.Fatalf("advance cutoffs: %v", err)
	}

	gotCutoff := getAppDataCutoffDate(ctx, t, appID)
	if !gotCutoff.Equal(cutoff2) {
		t.Fatalf("cutoff moved to %v, want %v (should stay put on retention increase)",
			gotCutoff.Format("2006-01-02"), cutoff2.Format("2006-01-02"))
	}

	// Seed ingestion for day2
	seedIngestionUsage(ctx, t, teamID.String(), appID.String(), day2.Add(12*time.Hour), 10, 5, 0, 1024*1024)

	// Snapshot day2 with retention=5 but cutoff stuck at day1-2
	// Window: (cutoff2, day2] = (day1-2, day2] = 3 days (day1-1, day1, day2)
	// NOT 5 days — the deleted data doesn't come back
	if err := takeStorageSnapshot(ctx, deps, day2); err != nil {
		t.Fatalf("snapshot day2: %v", err)
	}

	err = th.PgPool.QueryRow(ctx,
		"SELECT bytes_in FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID.String(), day2).Scan(&bytesIn)
	if err != nil {
		t.Fatalf("query day2: %v", err)
	}
	// Only 3 days of data (not 5) because cutoff prevents looking back further
	if bytesIn != 3*1024*1024 {
		t.Errorf("day2 bytes_in = %d, want %d (3 days — cutoff prevents going back to 5)",
			bytesIn, 3*1024*1024)
	}
}
