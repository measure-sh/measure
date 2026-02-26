//go:build integration

package alerts

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// testCrashFingerprint and testAnrFingerprint are exactly 32 characters to
// match the FixedString(32) column type used in exception/ANR group tables.
const (
	testCrashFingerprint = "aabbccdd11223344aabbccdd11223344"
	testAnrFingerprint   = "bbccddee22334455bbccddee22334455"
)

// --------------------------------------------------------------------------
// Tests — Crash and ANR Spike Alerts
// --------------------------------------------------------------------------

// seedCrashSpike seeds enough events to trigger a crash spike alert.
// It creates sessionCount generic sessions and crashCount exception events
// all sharing testCrashFingerprint, then seeds the corresponding group-info row.
func seedCrashSpike(ctx context.Context, t *testing.T, teamID, appID string, sessionCount, crashCount int) {
	t.Helper()
	now := time.Now().UTC()
	th.SeedGenericEvents(ctx, t, teamID, appID, sessionCount, now.Add(-30*time.Minute))
	for i := 0; i < crashCount; i++ {
		th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
	}
	th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)
}

// seedAnrSpike seeds enough events to trigger an ANR spike alert.
func seedAnrSpike(ctx context.Context, t *testing.T, teamID, appID string, sessionCount, anrCount int) {
	t.Helper()
	now := time.Now().UTC()
	th.SeedGenericEvents(ctx, t, teamID, appID, sessionCount, now.Add(-30*time.Minute))
	for i := 0; i < anrCount; i++ {
		th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
	}
	th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)
}

func TestCreateCrashAndAnrAlerts(t *testing.T) {
	t.Run("no events creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Empty Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Empty App", 30)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts with no events, got %d", got)
		}
	})

	t.Run("crash group count below minimum threshold creates no alert", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		// Seed 50 crashes — below minCrashOrAnrCountThreshold (100)
		for i := 0; i < 50; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 0 {
			t.Errorf("want 0 crash alerts (count below threshold), got %d", got)
		}
	})

	t.Run("crash spike fires when count and rate thresholds are both met", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Crash Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Crash App", 30)

		// 110 crashes / 200 sessions = 55% rate (>> 0.5% threshold)
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash spike alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email for crash spike, got %d", got)
		}
	})

	t.Run("anr spike fires when count and rate thresholds are both met", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "ANR Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "ANR App", 30)

		// 110 ANRs / 200 sessions = 55% rate (>> 0.5% threshold)
		seedAnrSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Errorf("want 1 ANR spike alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email for ANR spike, got %d", got)
		}
	})

	t.Run("crash and anr spikes both fire in the same run", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Spike Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Spike App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		for i := 0; i < 110; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
		}
		for i := 0; i < 110; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)
		th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash spike alert, got %d", got)
		}
		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Errorf("want 1 ANR spike alert, got %d", got)
		}
	})

	t.Run("cooldown prevents duplicate crash alert within one week", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Cooldown Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Cooldown App", 30)
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		// First run — alert created
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Fatalf("first run: want 1 crash alert, got %d", got)
		}

		// Second run — suppressed by cooldown (errorAlertCooldownPeriod = 1 week)
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("cooldown failed: want 1 crash alert after second run, got %d", got)
		}
	})

	t.Run("cooldown prevents duplicate anr alert within one week", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "ANR Cooldown Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "ANR Cooldown App", 30)
		seedAnrSpike(ctx, t, teamID, appID, 200, 110)

		// First run — alert created
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Fatalf("first run: want 1 ANR alert, got %d", got)
		}

		// Second run — suppressed by cooldown
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Errorf("cooldown failed: want 1 ANR alert after second run, got %d", got)
		}
	})

	t.Run("crash spike with slack integration also queues a slack message", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Slack Crash Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Slack Crash App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0CRASHCHAN"})
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Errorf("want 1 slack message for crash spike, got %d", got)
		}
	})

	t.Run("multiple apps checked independently: spike in one does not affect other", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi App Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "App With Spike", 30)
		th.SeedApp(ctx, t, app2, teamID, "App Without Spike", 30)

		// Only app1 has a spike; app2 has no events at all
		seedCrashSpike(ctx, t, teamID, app1, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert (for app1 only), got %d", got)
		}
	})

	t.Run("each app uses its own threshold prefs for spike alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi Prefs Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "High Threshold App", 30)
		th.SeedApp(ctx, t, app2, teamID, "Default Threshold App", 30)

		// app1 has a very high minimum count threshold — 110 crashes won't meet it
		th.SeedAppThresholdPrefs(ctx, t, app1, 95.0, 85.0, 500, 0.5)
		// app2 has no prefs row — uses defaults (minCount=100, rate=0.5%)

		// Both apps have 110 crashes / 200 sessions (55% rate)
		seedCrashSpike(ctx, t, teamID, app1, 200, 110)
		seedCrashSpike(ctx, t, teamID, app2, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		// Only app2 fires — app1 requires 500 crashes but only 110 occurred
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert (app2 only, app1 suppressed by high count threshold), got %d", got)
		}
	})

	t.Run("team with no apps creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "No Apps Team", true)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts, got %d", got)
		}
	})

	t.Run("anr group count below minimum threshold creates no alert", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// 50 ANRs < minCrashOrAnrCountThreshold (100) — no alert should fire
		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		for i := 0; i < 50; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 0 {
			t.Errorf("want 0 ANR alerts when count < threshold, got %d", got)
		}
	})

	t.Run("crash spike does not fire when rate is below 0.5% threshold", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// 100 crashes / 20 101 total sessions ≈ 0.497% < 0.5% threshold
		now := time.Now().UTC()
		for i := 0; i < 100; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedGenericEvents(ctx, t, teamID, appID, 20001, now.Add(-30*time.Minute))
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 0 {
			t.Errorf("want 0 crash alerts when rate < threshold, got %d", got)
		}
	})

	t.Run("anr spike does not fire when rate is below 0.5% threshold", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// 100 ANRs / 20 101 total sessions ≈ 0.497% < 0.5% threshold
		now := time.Now().UTC()
		for i := 0; i < 100; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedGenericEvents(ctx, t, teamID, appID, 20001, now.Add(-30*time.Minute))
		th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 0 {
			t.Errorf("want 0 ANR alerts when rate < threshold, got %d", got)
		}
	})

	t.Run("multiple crash fingerprints each trigger a separate alert", func(t *testing.T) {
		const testCrashFingerprint2 = "ccddee0033445566ccddee0033445566"

		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		for i := 0; i < 110; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint2, false, now.Add(-5*time.Minute))
		}
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint2)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 2 {
			t.Errorf("want 2 crash alerts (one per fingerprint), got %d", got)
		}
	})

	t.Run("handled exceptions are not counted toward crash count", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		// 150 handled exceptions — these must NOT count toward the crash threshold
		for i := 0; i < 150; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", "", true, now.Add(-5*time.Minute))
		}

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 0 {
			t.Errorf("want 0 crash alerts for handled exceptions, got %d", got)
		}
	})

	t.Run("crash alert fires again after cooldown period has expired", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// Insert a stale alert (8 days ago) so isInCooldown returns false
		staleTime := time.Now().UTC().Add(-8 * 24 * time.Hour)
		_, err := th.PgPool.Exec(ctx,
			`INSERT INTO alerts (id, team_id, app_id, entity_id, type, message, url, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, 'old alert', 'http://example.com', $6, $6)`,
			uuid.New(), teamID, appID, testCrashFingerprint, string(AlertTypeCrashSpike), staleTime)
		if err != nil {
			t.Fatalf("insert stale alert: %v", err)
		}

		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		// Expect 2 total crash alerts: the stale one + the new one
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 2 {
			t.Errorf("want 2 crash alerts (stale + new after cooldown expiry), got %d", got)
		}
	})

	t.Run("crash spike with two slack channels queues one message per channel", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0CHAN1", "C0CHAN2"})

		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 2 {
			t.Errorf("want 2 pending slack messages (one per channel), got %d", got)
		}
	})

	t.Run("crash spike with active slack but empty channel list queues no slack messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{})

		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 0 {
			t.Errorf("want 0 slack messages when channel list is empty, got %d", got)
		}
	})
}

// --------------------------------------------------------------------------
// Tests — Bug Report Alerts
// --------------------------------------------------------------------------

func TestCreateBugReportAlerts(t *testing.T) {
	t.Run("single recent bug report creates one alert and one email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Button crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 bug report alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email, got %d", got)
		}
	})

	t.Run("bug report outside time window is not alerted", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		// bugReportTimePeriod = 15 minutes; seed report 20 minutes ago
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Old crash", time.Now().UTC().Add(-20*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts for out-of-window report, got %d", got)
		}
	})

	t.Run("recent and old bug reports in same app: only recent is alerted", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Recent crash", now.Add(-5*time.Minute))
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Old crash", now.Add(-20*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 alert (only recent report), got %d", got)
		}
	})

	t.Run("multiple recent bug reports each create a separate alert", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Crash %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 3 {
			t.Errorf("want 3 alerts, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 3 {
			t.Errorf("want 3 pending emails, got %d", got)
		}
	})

	t.Run("second run deduplicates already-alerted bug reports", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()
		reportID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedBugReport(ctx, t, teamID, appID, reportID, "Crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)
		CreateBugReportAlerts(ctx) // second run

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("deduplication failed: want 1 alert after second run, got %d", got)
		}
	})

	t.Run("two team members each receive a separate email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		user1 := uuid.New().String()
		user2 := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, user1, "owner@example.com")
		th.SeedUser(ctx, t, user2, "member@example.com")
		th.SeedTeamMembership(ctx, t, teamID, user1, "owner")
		th.SeedTeamMembership(ctx, t, teamID, user2, "viewer")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 alert, got %d", got)
		}
		// QueueEmailForTeam sends one email per team member
		if got := countPendingByChannel(ctx, t, "email"); got != 2 {
			t.Errorf("want 2 pending emails (one per team member), got %d", got)
		}
	})

	t.Run("team with slack integration also creates a pending slack message", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Slack Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Slack App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0TESTCHAN"})
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Slack crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Errorf("want 1 pending slack message, got %d", got)
		}
	})

	t.Run("multiple apps each produce their own alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi App Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "App One", 30)
		th.SeedApp(ctx, t, app2, teamID, "App Two", 30)

		now := time.Now().UTC()
		th.SeedBugReport(ctx, t, teamID, app1, uuid.New().String(), "App1 crash", now.Add(-5*time.Minute))
		th.SeedBugReport(ctx, t, teamID, app2, uuid.New().String(), "App2 crash", now.Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 2 {
			t.Errorf("want 2 alerts (one per app), got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 2 {
			t.Errorf("want 2 pending emails, got %d", got)
		}
	})

	t.Run("team with no apps creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "No Apps Team", true)

		CreateBugReportAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts, got %d", got)
		}
	})

	t.Run("no teams creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		CreateBugReportAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts, got %d", got)
		}
	})

	t.Run("bug report with two slack channels queues one message per channel", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0BUG1", "C0BUG2"})
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Two-channel bug", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 bug report alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 2 {
			t.Errorf("want 2 pending slack messages (one per channel), got %d", got)
		}
	})

	t.Run("bug report with active slack but empty channel list queues no slack messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{})
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Empty channel bug", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 0 {
			t.Errorf("want 0 slack messages when channel list is empty, got %d", got)
		}
	})
}

// --------------------------------------------------------------------------
// Tests — getDailySummaryMetrics SQL logic
// --------------------------------------------------------------------------

// TestGetDailySummaryMetrics exercises every branch of the getDailySummaryMetrics
// SQL query directly. The function is package-private, so we can call it from
// the same package test.
//
// Metric slice layout returned by getDailySummaryMetrics:
//
//	[0] Sessions
//	[1] Crash-free sessions
//	[2] ANR-free sessions
//	[3] Cold launch time (p95)
//	[4] Warm launch time (p95)
//	[5] Hot launch time (p95)
//	[6] Bug reports (only present when count > 0)
func TestGetDailySummaryMetrics(t *testing.T) {
	// makeApp builds an App value from pre-seeded string IDs.
	makeApp := func(teamID, appID string) App {
		return App{
			ID:     uuid.MustParse(appID),
			TeamID: uuid.MustParse(teamID),
		}
	}

	// ---------- error when no data ----------

	t.Run("returns error when no today events exist", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		app := makeApp(teamID, appID)
		_, err := getDailySummaryMetrics(ctx, time.Now().UTC(), &app)
		if err == nil {
			t.Error("expected error when no data, got nil")
		}
	})

	// ---------- Sessions ----------

	t.Run("sessions: value equals seeded session count", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[0].Value != "5" {
			t.Errorf("sessions value: want %q, got %q", "5", metrics[0].Value)
		}
		if metrics[0].Label != "Sessions" {
			t.Errorf("sessions label: want %q, got %q", "Sessions", metrics[0].Label)
		}
		if metrics[0].HasWarning {
			t.Error("sessions should never have warning")
		}
		if metrics[0].HasError {
			t.Error("sessions should never have error")
		}
	})

	t.Run("sessions: subtitle is no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[0].Subtitle != "No previous day data" {
			t.Errorf("sessions subtitle: want %q, got %q", "No previous day data", metrics[0].Subtitle)
		}
	})

	t.Run("sessions: subtitle shows greater when today exceeds yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 7, 0, 0)       // today: 7
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 5, 0, 0) // yesterday: 5

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[0].Subtitle != "2 greater than yesterday" {
			t.Errorf("sessions subtitle: want %q, got %q", "2 greater than yesterday", metrics[0].Subtitle)
		}
	})

	t.Run("sessions: subtitle shows less when today is below yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 3, 0, 0)       // today: 3
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 5, 0, 0) // yesterday: 5

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[0].Subtitle != "2 less than yesterday" {
			t.Errorf("sessions subtitle: want %q, got %q", "2 less than yesterday", metrics[0].Subtitle)
		}
	})

	t.Run("sessions: subtitle shows no change when today equals yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 5, 0, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[0].Subtitle != "No change from yesterday" {
			t.Errorf("sessions subtitle: want %q, got %q", "No change from yesterday", metrics[0].Subtitle)
		}
	})

	// ---------- Crash-free sessions ----------

	t.Run("crash-free: 100% with no crashes, no warning or error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 10, 0, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[1].Value != "100%" {
			t.Errorf("crash-free value: want %q, got %q", "100%", metrics[1].Value)
		}
		if metrics[1].HasWarning {
			t.Error("crash-free should have no warning at 100%")
		}
		if metrics[1].HasError {
			t.Error("crash-free should have no error at 100%")
		}
	})

	t.Run("crash-free: warning but no error when rate is 90-95%", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 9 generic + 1 crash = 10 total, 1 crash → 90% crash-free
		// 90 < 95 → warning; 90 >= 90 → no error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 1, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[1].Value != "90%" {
			t.Errorf("crash-free value: want %q, got %q", "90%", metrics[1].Value)
		}
		if !metrics[1].HasWarning {
			t.Error("crash-free should have warning at 90%")
		}
		if metrics[1].HasError {
			t.Error("crash-free should not have error at 90%")
		}
	})

	t.Run("crash-free: warning and error when rate is below 90%", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 8 generic + 2 crash = 10 total, 2 crash → 80% crash-free
		// 80 < 95 → warning; 80 < 90 → error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 8, 2, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[1].Value != "80%" {
			t.Errorf("crash-free value: want %q, got %q", "80%", metrics[1].Value)
		}
		if !metrics[1].HasWarning {
			t.Error("crash-free should have warning at 80%")
		}
		if !metrics[1].HasError {
			t.Error("crash-free should have error at 80%")
		}
	})

	t.Run("crash-free: subtitle is no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 1, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[1].Subtitle != "No previous day data" {
			t.Errorf("crash-free subtitle: want %q, got %q", "No previous day data", metrics[1].Subtitle)
		}
	})

	t.Run("crash-free: subtitle shows better when crash rate improved from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 2 crashes → 50% crash-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 2, 2, 0)
		// Today: 4 sessions, 0 crashes → 100% crash-free
		// ratio = today_rate / yesterday_rate = 1.0 / 0.5 = 2.0 → "2x better than yesterday"
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 4, 0, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[1].Subtitle != "2x better than yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "2x better than yesterday", metrics[1].Subtitle)
		}
	})

	t.Run("crash-free: subtitle shows worse when crash rate degraded from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 0 crashes → 100% crash-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 4, 0, 0)
		// Today: 4 sessions, 2 crashes → 50% crash-free
		// ratio = today_rate / yesterday_rate = 0.5 / 1.0 = 0.5 → "0.5x worse than yesterday"
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 2, 2, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[1].Subtitle != "0.5x worse than yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "0.5x worse than yesterday", metrics[1].Subtitle)
		}
	})

	t.Run("crash-free: subtitle shows no change when crash rate unchanged from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Both days: 10 sessions, 1 crash → 90% crash-free (identical rate)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 9, 1, 0)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 1, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[1].Subtitle != "No change from yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "No change from yesterday", metrics[1].Subtitle)
		}
	})

	// ---------- ANR-free sessions ----------

	t.Run("anr-free: 100% with no ANRs, no warning or error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 10, 0, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[2].Value != "100%" {
			t.Errorf("anr-free value: want %q, got %q", "100%", metrics[2].Value)
		}
		if metrics[2].HasWarning {
			t.Error("anr-free should have no warning at 100%")
		}
		if metrics[2].HasError {
			t.Error("anr-free should have no error at 100%")
		}
	})

	t.Run("anr-free: warning but no error when rate is 85-95%", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 90 generic + 10 ANR = 100 total, 10 ANR → 90% ANR-free
		// 90 <= 95 → warning; 90 > 85 → no error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 90, 0, 10)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[2].Value != "90%" {
			t.Errorf("anr-free value: want %q, got %q", "90%", metrics[2].Value)
		}
		if !metrics[2].HasWarning {
			t.Error("anr-free should have warning at 90%")
		}
		if metrics[2].HasError {
			t.Error("anr-free should not have error at 90%")
		}
	})

	t.Run("anr-free: warning and error when rate is 85% or below", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 8 generic + 2 ANR = 10 total, 2 ANR → 80% ANR-free
		// 80 <= 95 → warning; 80 <= 85 → error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 8, 0, 2)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[2].Value != "80%" {
			t.Errorf("anr-free value: want %q, got %q", "80%", metrics[2].Value)
		}
		if !metrics[2].HasWarning {
			t.Error("anr-free should have warning at 80%")
		}
		if !metrics[2].HasError {
			t.Error("anr-free should have error at 80%")
		}
	})

	t.Run("anr-free: subtitle shows better when ANR rate improved from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 2 ANRs → 50% ANR-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 2, 0, 2)
		// Today: 4 sessions, 0 ANRs → 100% ANR-free
		// ratio = 1.0 / 0.5 = 2.0 → "2x better than yesterday"
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 4, 0, 0)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[2].Subtitle != "2x better than yesterday" {
			t.Errorf("anr-free subtitle: want %q, got %q", "2x better than yesterday", metrics[2].Subtitle)
		}
	})

	t.Run("anr-free: subtitle shows worse when ANR rate degraded from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 0 ANRs → 100% ANR-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 4, 0, 0)
		// Today: 4 sessions, 2 ANRs → 50% ANR-free
		// ratio = 0.5 / 1.0 = 0.5 → "0.5x worse than yesterday"
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 2, 0, 2)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[2].Subtitle != "0.5x worse than yesterday" {
			t.Errorf("anr-free subtitle: want %q, got %q", "0.5x worse than yesterday", metrics[2].Subtitle)
		}
	})

	t.Run("anr-free: subtitle is no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// Seed today with an ANR; no yesterday data at all
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 0, 1)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[2].Subtitle != "No previous day data" {
			t.Errorf("anr-free subtitle: want %q, got %q", "No previous day data", metrics[2].Subtitle)
		}
	})

	t.Run("anr-free: subtitle shows no change when ANR rate unchanged from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Both days: 10 sessions, 1 ANR → 90% ANR-free (identical rate)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 9, 0, 1)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 0, 1)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[2].Subtitle != "No change from yesterday" {
			t.Errorf("anr-free subtitle: want %q, got %q", "No change from yesterday", metrics[2].Subtitle)
		}
	})

	t.Run("spike uses default thresholds when no prefs row exists for app", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Default Prefs Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "No Prefs App", 30)
		// Deliberately no SeedAppThresholdPrefs — getAppThresholdPrefs returns ErrNoRows and falls back to defaults

		// 110 crashes / 200 sessions = 55% — meets default minCount=100 and rate=0.5%
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert using default thresholds (no prefs row seeded), got %d", got)
		}
	})

	t.Run("team threshold prefs override default warning/error thresholds", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		now := time.Now().UTC()
		// total=50 => generic=48, crash=1, anr=1
		// crash-free=(48+1)/50=98%, anr-free=(48+1)/50=98%
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 48, 1, 1)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// With custom thresholds good=99, caution=97, 98% should be warning and not error.
		if !metrics[1].HasWarning || metrics[1].HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,false)", metrics[1].HasWarning, metrics[1].HasError)
		}
		if !metrics[2].HasWarning || metrics[2].HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,false)", metrics[2].HasWarning, metrics[2].HasError)
		}
	})

	t.Run("custom thresholds: value below good threshold is warning", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 98.5, 95.0, 100, 0.5)

		now := time.Now().UTC()
		// total=100 => generic=96, crash=2, anr=2
		// crash-free=(100-2)/100=98%, anr-free=(100-2)/100=98%
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 96, 2, 2)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !metrics[1].HasWarning || metrics[1].HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,false)", metrics[1].HasWarning, metrics[1].HasError)
		}
		if !metrics[2].HasWarning || metrics[2].HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,false)", metrics[2].HasWarning, metrics[2].HasError)
		}
	})

	t.Run("custom thresholds: clearly poor values are warning and error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		now := time.Now().UTC()
		// total=30 => generic=10, crash=10, anr=10
		// crash-free=(30-10)/30=66.6%, anr-free=(30-10)/30=66.6%
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 10, 10, 10)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !metrics[1].HasWarning || !metrics[1].HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,true)", metrics[1].HasWarning, metrics[1].HasError)
		}
		if !metrics[2].HasWarning || !metrics[2].HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,true)", metrics[2].HasWarning, metrics[2].HasError)
		}
	})

	t.Run("custom thresholds: value equal to good threshold is warning and not error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 98.0, 95.0, 100, 0.5)

		now := time.Now().UTC()
		// total=100 => generic=96, crash=2, anr=2
		// crash-free/anr-free=(100-2)/100=98% (exactly good threshold)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 96, 2, 2)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !metrics[1].HasWarning || metrics[1].HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,false)", metrics[1].HasWarning, metrics[1].HasError)
		}
		if !metrics[2].HasWarning || metrics[2].HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,false)", metrics[2].HasWarning, metrics[2].HasError)
		}
	})

	t.Run("custom thresholds: value equal to caution threshold is warning and error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 98.0, 95.0, 100, 0.5)

		now := time.Now().UTC()
		// total=100 => generic=90, crash=5, anr=5
		// crash-free/anr-free=(100-5)/100=95% (exactly caution threshold)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 90, 5, 5)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !metrics[1].HasWarning || !metrics[1].HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,true)", metrics[1].HasWarning, metrics[1].HasError)
		}
		if !metrics[2].HasWarning || !metrics[2].HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,true)", metrics[2].HasWarning, metrics[2].HasError)
		}
	})

	// ---------- Launch times ----------

	t.Run("launch: all values are 0ms when no launch events seeded", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0) // generic only, no launch events

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for i, name := range []string{"cold", "warm", "hot"} {
			if metrics[3+i].Value != "0ms" {
				t.Errorf("%s launch value: want %q, got %q", name, "0ms", metrics[3+i].Value)
			}
		}
	})

	t.Run("launch: values show p95 duration when launch events are present", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "warm_launch", 200, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "hot_launch", 100, now)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[3].Value != "500ms" {
			t.Errorf("cold launch value: want %q, got %q", "500ms", metrics[3].Value)
		}
		if metrics[4].Value != "200ms" {
			t.Errorf("warm launch value: want %q, got %q", "200ms", metrics[4].Value)
		}
		if metrics[5].Value != "100ms" {
			t.Errorf("hot launch value: want %q, got %q", "100ms", metrics[5].Value)
		}
	})

	t.Run("launch: subtitles are no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "warm_launch", 200, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "hot_launch", 100, now)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for i, name := range []string{"cold", "warm", "hot"} {
			if metrics[3+i].Subtitle != "No previous day data" {
				t.Errorf("%s launch subtitle: want %q, got %q", name, "No previous day data", metrics[3+i].Subtitle)
			}
		}
	})

	t.Run("launch: subtitle shows better when today is faster than yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: cold_launch 1000ms; today: 500ms
		// ratio = round(500 / 1000, 2) = 0.5 → "0.5x better than yesterday"
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 1000, yesterday)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[3].Subtitle != "0.5x better than yesterday" {
			t.Errorf("cold launch subtitle: want %q, got %q", "0.5x better than yesterday", metrics[3].Subtitle)
		}
	})

	t.Run("launch: subtitle shows worse when today is slower than yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: cold_launch 500ms; today: 1000ms
		// ratio = round(1000 / 500, 2) = 2 → "2x worse than yesterday"
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, yesterday)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 1000, now)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[3].Subtitle != "2x worse than yesterday" {
			t.Errorf("cold launch subtitle: want %q, got %q", "2x worse than yesterday", metrics[3].Subtitle)
		}
	})

	t.Run("launch: subtitle shows no change when today equals yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Same cold_launch duration both days: 500ms → no change
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, yesterday)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if metrics[3].Subtitle != "No change from yesterday" {
			t.Errorf("cold launch subtitle: want %q, got %q", "No change from yesterday", metrics[3].Subtitle)
		}
	})

	t.Run("launch: never has warning or error regardless of duration", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 5000, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "warm_launch", 5000, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "hot_launch", 5000, now)

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for i, name := range []string{"cold", "warm", "hot"} {
			if metrics[3+i].HasWarning {
				t.Errorf("%s launch should never have warning", name)
			}
			if metrics[3+i].HasError {
				t.Errorf("%s launch should never have error", name)
			}
		}
	})

	// ---------- Bug reports ----------

	t.Run("bug report metric is included when reports exist today", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Seed 3 bug reports today, none yesterday → subtitle is "No previous day data"
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(metrics) != 7 {
			t.Fatalf("want 7 metrics (6 standard + bug reports), got %d", len(metrics))
		}
		if metrics[6].Value != "3" {
			t.Errorf("bug report count: want %q, got %q", "3", metrics[6].Value)
		}
		if metrics[6].Label != "Bug reports" {
			t.Errorf("bug report label: want %q, got %q", "Bug reports", metrics[6].Label)
		}
		if metrics[6].Subtitle != "No previous day data" {
			t.Errorf("bug report subtitle: want %q, got %q", "No previous day data", metrics[6].Subtitle)
		}
		if metrics[6].HasWarning {
			t.Error("bug report metric should not have warning")
		}
		if metrics[6].HasError {
			t.Error("bug report metric should not have error")
		}
	})

	t.Run("bug report metric is absent when no reports today", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// No bug reports seeded

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(metrics) != 6 {
			t.Errorf("want 6 metrics when no bug reports today, got %d", len(metrics))
		}
	})

	t.Run("bug report: subtitle shows greater when today exceeds yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Today: 5 reports, yesterday: 3 reports → "2 greater than yesterday"
		for i := 0; i < 5; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Today bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Yesterday bug %d", i), yesterday.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(metrics) != 7 {
			t.Fatalf("want 7 metrics, got %d", len(metrics))
		}
		if metrics[6].Subtitle != "2 greater than yesterday" {
			t.Errorf("bug report subtitle: want %q, got %q", "2 greater than yesterday", metrics[6].Subtitle)
		}
	})

	t.Run("bug report: subtitle shows less when today is below yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Today: 3 reports, yesterday: 5 reports → "2 less than yesterday"
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Today bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}
		for i := 0; i < 5; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Yesterday bug %d", i), yesterday.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(metrics) != 7 {
			t.Fatalf("want 7 metrics, got %d", len(metrics))
		}
		if metrics[6].Subtitle != "2 less than yesterday" {
			t.Errorf("bug report subtitle: want %q, got %q", "2 less than yesterday", metrics[6].Subtitle)
		}
	})

	t.Run("bug report: subtitle shows no change when counts are equal", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T", true)
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Today: 4 reports, yesterday: 4 reports → "No change from yesterday"
		for i := 0; i < 4; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Today bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}
		for i := 0; i < 4; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Yesterday bug %d", i), yesterday.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(metrics) != 7 {
			t.Fatalf("want 7 metrics, got %d", len(metrics))
		}
		if metrics[6].Subtitle != "No change from yesterday" {
			t.Errorf("bug report subtitle: want %q, got %q", "No change from yesterday", metrics[6].Subtitle)
		}
	})
}

// --------------------------------------------------------------------------
// Tests — Daily Summary
// --------------------------------------------------------------------------

func TestCreateDailySummary(t *testing.T) {
	t.Run("no app metrics data creates no pending messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		// No events seeded → app_metrics empty → getDailySummaryMetrics returns error

		CreateDailySummary(ctx)

		if got := countPending(ctx, t); got != 0 {
			t.Errorf("want 0 pending messages when no data, got %d", got)
		}
	})

	t.Run("events yesterday populate metrics and produce a summary email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)

		// Seed events for the previous UTC day; CreateDailySummary reports yesterday.
		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 daily summary email, got %d", got)
		}
	})

	t.Run("team with slack integration also receives a slack summary message", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Slack Summary Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Slack Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUMMARY"})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 daily summary email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Errorf("want 1 daily summary slack message, got %d", got)
		}
	})

	t.Run("team with no apps creates no pending messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "No Apps Team", true)

		CreateDailySummary(ctx)

		if got := countPending(ctx, t); got != 0 {
			t.Errorf("want 0 pending messages, got %d", got)
		}
	})

	t.Run("multiple apps each get their own daily summary email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi App Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "App One", 30)
		th.SeedApp(ctx, t, app2, teamID, "App Two", 30)

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, app1, 5, summaryDate)
		th.SeedGenericEvents(ctx, t, teamID, app2, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 2 {
			t.Errorf("want 2 daily summary emails (one per app), got %d", got)
		}
	})

	t.Run("daily summary with two slack channels queues one message per channel", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUM1", "C0SUM2"})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 2 {
			t.Errorf("want 2 pending slack summary messages (one per channel), got %d", got)
		}
	})

	t.Run("daily summary with active slack but empty channel list queues no slack messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 0 {
			t.Errorf("want 0 slack messages when channel list is empty, got %d", got)
		}
	})

	t.Run("custom threshold prefs are reflected in queued daily summary email and slack status icons", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUMMARY"})
		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		// total=100 => generic=96, crash=2, anr=2 => 98% for both error-rate metrics
		// Under custom thresholds (good=99, caution=97), this should be warning.
		th.SeedAppMetrics(ctx, t, teamID, appID, summaryDate, 96, 2, 2)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Fatalf("want 1 daily summary email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Fatalf("want 1 daily summary slack message, got %d", got)
		}

		var emailBody string
		err := th.PgPool.QueryRow(ctx, `
			SELECT data->>'body'
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id = $2::uuid AND channel = 'email'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID, appID).Scan(&emailBody)
		if err != nil {
			t.Fatalf("query daily summary email body: %v", err)
		}
		if !strings.Contains(emailBody, "#d08700") {
			t.Fatalf("expected daily summary email body to include warning icon color for custom thresholds")
		}

		var slackRaw string
		err = th.PgPool.QueryRow(ctx, `
			SELECT data::text
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id = $2::uuid AND channel = 'slack'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID, appID).Scan(&slackRaw)
		if err != nil {
			t.Fatalf("query daily summary slack payload: %v", err)
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(slackRaw), &payload); err != nil {
			t.Fatalf("unmarshal slack payload: %v", err)
		}
		payloadJSON, _ := json.Marshal(payload)
		if !strings.Contains(string(payloadJSON), "🟡") {
			t.Fatalf("expected slack payload to include warning status icon for custom thresholds")
		}
	})

	t.Run("custom threshold prefs are reflected as error in queued daily summary email and slack status icons", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUMMARY"})
		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		// total=100 => generic=90, crash=5, anr=5 => 95% for both error-rate metrics
		// Under custom thresholds (good=99, caution=97), this should be error.
		th.SeedAppMetrics(ctx, t, teamID, appID, summaryDate, 90, 5, 5)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Fatalf("want 1 daily summary email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Fatalf("want 1 daily summary slack message, got %d", got)
		}

		var emailBody string
		err := th.PgPool.QueryRow(ctx, `
			SELECT data->>'body'
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id = $2::uuid AND channel = 'email'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID, appID).Scan(&emailBody)
		if err != nil {
			t.Fatalf("query daily summary email body: %v", err)
		}
		if !strings.Contains(emailBody, "#e7000b") {
			t.Fatalf("expected daily summary email body to include error icon color for custom thresholds")
		}

		var slackRaw string
		err = th.PgPool.QueryRow(ctx, `
			SELECT data::text
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id = $2::uuid AND channel = 'slack'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID, appID).Scan(&slackRaw)
		if err != nil {
			t.Fatalf("query daily summary slack payload: %v", err)
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(slackRaw), &payload); err != nil {
			t.Fatalf("unmarshal slack payload: %v", err)
		}
		payloadJSON, _ := json.Marshal(payload)
		if !strings.Contains(string(payloadJSON), "🔴") {
			t.Fatalf("expected slack payload to include error status icon for custom thresholds")
		}
	})
}

// --------------------------------------------------------------------------
// Tests — internal helper coverage
// --------------------------------------------------------------------------

// TestScheduleInternalHelpers exercises code paths that are unreachable from
// the public API but accessible within the same package.
func TestScheduleInternalHelpers(t *testing.T) {
	t.Run("scheduleEmailAlertsForteamMembers uses generic subject for unknown alert type", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team", true)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		alert := Alert{
			ID:       uuid.New(),
			TeamID:   uuid.MustParse(teamID),
			AppID:    uuid.MustParse(appID),
			EntityID: uuid.New().String(),
			Type:     "custom_unknown_type",
		}

		scheduleEmailAlertsForteamMembers(ctx, alert, "Something happened", "https://test.measure.sh/dashboard", "Test App")

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email for unknown alert type, got %d", got)
		}
	})
}
