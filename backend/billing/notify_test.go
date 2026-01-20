//go:build integration

package billing

import (
	"backend/email"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"
)

const (
	testOwnerEmail     = "owner@example.com"
	testAdminEmail     = "admin@example.com"
	testDeveloperEmail = "dev@example.com"
)

// ==========================================================================
// Usage notifications
// ==========================================================================

func TestFormatUsageLimitEmail(t *testing.T) {
	tests := []struct {
		threshold int
		subPart   string
	}{
		{75, "75%"},
		{90, "90%"},
		{100, "Usage Limit Reached"},
	}

	deps := testDeps()

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%d%%", tt.threshold), func(t *testing.T) {
			subject, body := email.UsageLimitEmail("TestTeam", "test-team-id", deps.SiteOrigin, tt.threshold, 750000, 1000000)

			if !strings.Contains(subject, tt.subPart) {
				t.Errorf("subject %q should contain %q", subject, tt.subPart)
			}
			if !strings.Contains(body, "TestTeam") {
				t.Error("body should contain team name")
			}
			if !strings.Contains(body, "Upgrade to Measure Pro") {
				t.Error("body should contain upgrade CTA")
			}
		})
	}
}

func TestUpdateUsageNotificationTracking(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)

	if err := updateUsageNotificationTracking(ctx, th.PgPool, teamID, 75, "2026-02"); err != nil {
		t.Fatalf("updateUsageNotificationTracking: %v", err)
	}

	var threshold int
	var cycle *string
	err := th.PgPool.QueryRow(ctx,
		"SELECT usage_notified_threshold, usage_notified_cycle FROM team_billing WHERE team_id = $1", teamID).
		Scan(&threshold, &cycle)
	if err != nil {
		t.Fatalf("query: %v", err)
	}

	if threshold != 75 {
		t.Errorf("threshold = %d, want 75", threshold)
	}
	if cycle == nil || *cycle != "2026-02" {
		t.Errorf("cycle = %v, want %q", cycle, "2026-02")
	}
}

func TestNotifyUsageThresholds(t *testing.T) {
	tests := []struct {
		name           string
		usage          uint64
		maxUnits       uint64
		notifiedThresh int
		notifiedCycle  *string
		currentCycle   string
		wantEmails     int
		wantThreshold  int
		wantCycle      *string
	}{
		{
			name:           "below_75",
			usage:          700,
			maxUnits:       1000,
			notifiedThresh: 0,
			notifiedCycle:  nil,
			currentCycle:   "2026-02",
			wantEmails:     0,
			wantThreshold:  0,
			wantCycle:      nil,
		},
		{
			name:           "at_75",
			usage:          750,
			maxUnits:       1000,
			notifiedThresh: 0,
			notifiedCycle:  nil,
			currentCycle:   "2026-02",
			wantEmails:     1,
			wantThreshold:  75,
			wantCycle:      strPtr("2026-02"),
		},
		{
			name:           "at_90",
			usage:          900,
			maxUnits:       1000,
			notifiedThresh: 75,
			notifiedCycle:  strPtr("2026-02"),
			currentCycle:   "2026-02",
			wantEmails:     1,
			wantThreshold:  90,
			wantCycle:      strPtr("2026-02"),
		},
		{
			name:           "at_100",
			usage:          1000,
			maxUnits:       1000,
			notifiedThresh: 90,
			notifiedCycle:  strPtr("2026-02"),
			currentCycle:   "2026-02",
			wantEmails:     1,
			wantThreshold:  100,
			wantCycle:      strPtr("2026-02"),
		},
		{
			name:           "already_notified",
			usage:          800,
			maxUnits:       1000,
			notifiedThresh: 75,
			notifiedCycle:  strPtr("2026-02"),
			currentCycle:   "2026-02",
			wantEmails:     0,
			wantThreshold:  75,
			wantCycle:      strPtr("2026-02"),
		},
		{
			name:           "new_cycle_resets",
			usage:          800,
			maxUnits:       1000,
			notifiedThresh: 75,
			notifiedCycle:  strPtr("2026-01"),
			currentCycle:   "2026-02",
			wantEmails:     1,
			wantThreshold:  75,
			wantCycle:      strPtr("2026-02"),
		},
		{
			name:           "zero_max_units",
			usage:          500,
			maxUnits:       0,
			notifiedThresh: 0,
			notifiedCycle:  nil,
			currentCycle:   "2026-02",
			wantEmails:     0,
			wantThreshold:  0,
			wantCycle:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			t.Cleanup(func() { cleanupAll(ctx, t) })

			teamID := uuid.New().String()
			userID := uuid.New().String()

			seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)
			seedUser(ctx, t, userID, "user@example.com")
			seedTeamMembership(ctx, t, teamID, userID, "owner")

			// Set pre-existing notification tracking state.
			if tt.notifiedThresh > 0 || tt.notifiedCycle != nil {
				_, err := th.PgPool.Exec(ctx,
					"UPDATE team_billing SET usage_notified_threshold = $1, usage_notified_cycle = $2 WHERE team_id = $3",
					tt.notifiedThresh, tt.notifiedCycle, teamID)
				if err != nil {
					t.Fatalf("setup notification tracking: %v", err)
				}
			}

			team := TeamBillingInfo{
				TeamID:                 teamID,
				TeamName:               "TestTeam",
				Plan:                   "free",
				UsageNotifiedThreshold: tt.notifiedThresh,
				UsageNotifiedCycle:     tt.notifiedCycle,
			}

			deps := testDeps()
			notifyUsageThresholds(ctx, deps, team, tt.usage, tt.maxUnits, tt.currentCycle)

			// Assert email count.
			var emailCount int
			err := th.PgPool.QueryRow(ctx,
				"SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1", teamID).
				Scan(&emailCount)
			if err != nil {
				t.Fatalf("query email count: %v", err)
			}
			if emailCount != tt.wantEmails {
				t.Errorf("emails = %d, want %d", emailCount, tt.wantEmails)
			}

			// Assert notification tracking in team_billing.
			var threshold int
			var cycle *string
			err = th.PgPool.QueryRow(ctx,
				"SELECT usage_notified_threshold, usage_notified_cycle FROM team_billing WHERE team_id = $1", teamID).
				Scan(&threshold, &cycle)
			if err != nil {
				t.Fatalf("query tracking: %v", err)
			}
			if threshold != tt.wantThreshold {
				t.Errorf("threshold = %d, want %d", threshold, tt.wantThreshold)
			}
			if !stringPtrEqual(cycle, tt.wantCycle) {
				t.Errorf("cycle = %v, want %v", cycle, tt.wantCycle)
			}
		})
	}
}

// ==========================================================================
// Subscription failure notifications
// ==========================================================================

func TestFormatSubscriptionFailureEmail(t *testing.T) {
	subject, body := email.SubscriptionFailureEmail("TestTeam", "test-team-id", "https://test.measure.sh")

	if subject != "TestTeam - Subscription Canceled" {
		t.Errorf("subject = %q, want %q", subject, "TestTeam - Subscription Canceled")
	}
	if !strings.Contains(body, "Subscription Canceled") {
		t.Error("body should contain 'Subscription Canceled'")
	}
	if !strings.Contains(body, "TestTeam") {
		t.Error("body should contain team name")
	}
	if !strings.Contains(body, "downgraded to the free plan") {
		t.Error("body should mention downgrade to free plan")
	}
	if !strings.Contains(body, "Subscribe to Measure Pro") {
		t.Error("body should contain 'Subscribe to Measure Pro'")
	}
}

// ==========================================================================
// Email scheduling
// ==========================================================================

func TestSendEmailToTeamMembers(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	user1ID := uuid.New().String()
	user2ID := uuid.New().String()
	user3ID := uuid.New().String()

	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)
	seedUser(ctx, t, user1ID, testOwnerEmail)
	seedUser(ctx, t, user2ID, testAdminEmail)
	seedUser(ctx, t, user3ID, testDeveloperEmail)
	seedTeamMembership(ctx, t, teamID, user1ID, "owner")
	seedTeamMembership(ctx, t, teamID, user2ID, "admin")
	seedTeamMembership(ctx, t, teamID, user3ID, "developer")

	deps := testDeps()

	subject := "Test Subject"
	body := "<h1>Test Body</h1>"

	if err := sendEmailToTeamMembers(ctx, deps, teamID, subject, body); err != nil {
		t.Fatalf("sendEmailToTeamMembers: %v", err)
	}

	// Verify row count — one per member.
	var count int
	err := th.PgPool.QueryRow(ctx,
		"SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1", teamID).
		Scan(&count)
	if err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected 3 pending messages, got %d", count)
	}

	// Read all rows and verify fields.
	rows, err := th.PgPool.Query(ctx,
		"SELECT team_id, app_id, channel, data FROM pending_alert_messages WHERE team_id = $1", teamID)
	if err != nil {
		t.Fatalf("select query: %v", err)
	}
	defer rows.Close()

	seenRecipients := make(map[string]bool)
	for rows.Next() {
		var rowTeamID string
		var appID *string
		var channel string
		var data []byte

		if err := rows.Scan(&rowTeamID, &appID, &channel, &data); err != nil {
			t.Fatalf("scan: %v", err)
		}

		if rowTeamID != teamID {
			t.Errorf("team_id = %q, want %q", rowTeamID, teamID)
		}
		if appID != nil {
			t.Errorf("app_id should be NULL, got %v", *appID)
		}
		if channel != "email" {
			t.Errorf("channel = %q, want %q", channel, "email")
		}

		var email email.EmailInfo
		if err := json.Unmarshal(data, &email); err != nil {
			t.Fatalf("unmarshal data: %v", err)
		}

		if email.From != deps.TxEmailAddress {
			t.Errorf("from = %q, want %q", email.From, deps.TxEmailAddress)
		}
		if email.Subject != subject {
			t.Errorf("subject = %q, want %q", email.Subject, subject)
		}
		if email.ContentType != "text/html" {
			t.Errorf("content_type = %q, want %q", email.ContentType, "text/html")
		}
		if email.Body != body {
			t.Errorf("body = %q, want %q", email.Body, body)
		}

		seenRecipients[email.To] = true
	}

	expectedRecipients := []string{testOwnerEmail, testAdminEmail, testDeveloperEmail}
	for _, addr := range expectedRecipients {
		if !seenRecipients[addr] {
			t.Errorf("missing email for recipient %q", addr)
		}
	}
}

// ==========================================================================
// Utilities
// ==========================================================================

func TestStringPtrEqual(t *testing.T) {
	s1 := "hello"
	s2 := "world"

	tests := []struct {
		name string
		a, b *string
		want bool
	}{
		{"nil/nil", nil, nil, true},
		{"nil/val", nil, &s1, false},
		{"val/nil", &s1, nil, false},
		{"equal", &s1, &s1, true},
		{"different", &s1, &s2, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := stringPtrEqual(tt.a, tt.b); got != tt.want {
				t.Errorf("stringPtrEqual = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFormatNumber(t *testing.T) {
	tests := []struct {
		input uint64
		want  string
	}{
		{0, "0"},
		{999, "999"},
		{1000, "1K"},
		{1500, "1.5K"},
		{1000000, "1M"},
		{1500000, "1.5M"},
		{1000000000, "1B"},
		{1500000000, "1.5B"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := email.FormatNumber(tt.input); got != tt.want {
				t.Errorf("FormatNumber(%d) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

// ==========================================================================
// Upgrade notifications
// ==========================================================================

func TestFormatUpgradeEmail(t *testing.T) {
	subject, body := email.UpgradeEmail("TestTeam", "test-team-id", "https://test.measure.sh", MaxRetentionDays)

	if subject != "TestTeam - Upgraded to Measure Pro" {
		t.Errorf("subject = %q, want %q", subject, "TestTeam - Upgraded to Measure Pro")
	}
	if !strings.Contains(body, "Upgraded to Measure Pro") {
		t.Error("body should contain 'Upgraded to Measure Pro'")
	}
	if !strings.Contains(body, "TestTeam") {
		t.Error("body should contain team name")
	}
	if !strings.Contains(body, "unlimited usage") {
		t.Error("body should mention unlimited usage")
	}
	if !strings.Contains(body, fmt.Sprintf("%d days", MaxRetentionDays)) {
		t.Errorf("body should mention %d days retention", MaxRetentionDays)
	}
	if !strings.Contains(body, "Go to Dashboard") {
		t.Error("body should contain 'Go to Dashboard' CTA")
	}
}

func TestNotifyUpgrade(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	user1ID := uuid.New().String()
	user2ID := uuid.New().String()

	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "pro", true)
	seedUser(ctx, t, user1ID, testOwnerEmail)
	seedUser(ctx, t, user2ID, testAdminEmail)
	seedTeamMembership(ctx, t, teamID, user1ID, "owner")
	seedTeamMembership(ctx, t, teamID, user2ID, "admin")

	deps := testDeps()
	notifyUpgrade(ctx, deps, teamID)
	wantSubject, wantBody := email.UpgradeEmail("TestTeam", teamID, deps.SiteOrigin, MaxRetentionDays)

	var count int
	err := th.PgPool.QueryRow(ctx,
		"SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1", teamID).
		Scan(&count)
	if err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 pending messages, got %d", count)
	}

	rows, err := th.PgPool.Query(ctx,
		"SELECT team_id, app_id, channel, data FROM pending_alert_messages WHERE team_id = $1", teamID)
	if err != nil {
		t.Fatalf("select query: %v", err)
	}
	defer rows.Close()

	wantByRecipient := map[string]email.EmailInfo{
		testOwnerEmail: {
			From:        deps.TxEmailAddress,
			To:          testOwnerEmail,
			Subject:     wantSubject,
			ContentType: "text/html",
			Body:        wantBody,
		},
		testAdminEmail: {
			From:        deps.TxEmailAddress,
			To:          testAdminEmail,
			Subject:     wantSubject,
			ContentType: "text/html",
			Body:        wantBody,
		},
	}

	seenRecipients := make(map[string]bool)
	for rows.Next() {
		var rowTeamID string
		var appID *string
		var channel string
		var data []byte
		if err := rows.Scan(&rowTeamID, &appID, &channel, &data); err != nil {
			t.Fatalf("scan: %v", err)
		}

		if rowTeamID != teamID {
			t.Errorf("team_id = %q, want %q", rowTeamID, teamID)
		}
		if appID != nil {
			t.Errorf("app_id should be NULL, got %v", *appID)
		}
		if channel != "email" {
			t.Errorf("channel = %q, want %q", channel, "email")
		}

		var email email.EmailInfo
		if err := json.Unmarshal(data, &email); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		want, ok := wantByRecipient[email.To]
		if !ok {
			t.Errorf("unexpected recipient %q", email.To)
			continue
		}
		if email != want {
			t.Errorf("payload for %q = %+v, want %+v", email.To, email, want)
		}
		seenRecipients[email.To] = true
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("rows err: %v", err)
	}
	for recipient := range wantByRecipient {
		if !seenRecipients[recipient] {
			t.Errorf("missing payload for recipient %q", recipient)
		}
	}
}

// ==========================================================================
// Manual downgrade notifications
// ==========================================================================

func TestFormatManualDowngradeEmail(t *testing.T) {
	subject, body := email.ManualDowngradeEmail("TestTeam", "test-team-id", "https://test.measure.sh", FreePlanMaxUnits, FreePlanMaxRetentionDays)

	if subject != "TestTeam - Downgraded to Free Plan" {
		t.Errorf("subject = %q, want %q", subject, "TestTeam - Downgraded to Free Plan")
	}
	if !strings.Contains(body, "Downgraded to Free Plan") {
		t.Error("body should contain 'Downgraded to Free Plan'")
	}
	if !strings.Contains(body, "TestTeam") {
		t.Error("body should contain team name")
	}
	if !strings.Contains(body, email.FormatNumber(FreePlanMaxUnits)) {
		t.Errorf("body should contain formatted free plan max units (%s)", email.FormatNumber(FreePlanMaxUnits))
	}
	if !strings.Contains(body, fmt.Sprintf("%d", FreePlanMaxRetentionDays)) {
		t.Errorf("body should contain free plan max retention days (%d)", FreePlanMaxRetentionDays)
	}
	if !strings.Contains(body, "Go to Dashboard") {
		t.Error("body should contain 'Go to Dashboard' CTA")
	}
}

func TestNotifyManualDowngrade(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	user1ID := uuid.New().String()
	user2ID := uuid.New().String()

	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)
	seedUser(ctx, t, user1ID, testOwnerEmail)
	seedUser(ctx, t, user2ID, testAdminEmail)
	seedTeamMembership(ctx, t, teamID, user1ID, "owner")
	seedTeamMembership(ctx, t, teamID, user2ID, "admin")

	deps := testDeps()
	notifyManualDowngrade(ctx, deps, teamID)
	wantSubject, wantBody := email.ManualDowngradeEmail("TestTeam", teamID, deps.SiteOrigin, FreePlanMaxUnits, FreePlanMaxRetentionDays)

	var count int
	err := th.PgPool.QueryRow(ctx,
		"SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1", teamID).
		Scan(&count)
	if err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 pending messages, got %d", count)
	}

	rows, err := th.PgPool.Query(ctx,
		"SELECT team_id, app_id, channel, data FROM pending_alert_messages WHERE team_id = $1", teamID)
	if err != nil {
		t.Fatalf("select query: %v", err)
	}
	defer rows.Close()

	wantByRecipient := map[string]email.EmailInfo{
		testOwnerEmail: {
			From:        deps.TxEmailAddress,
			To:          testOwnerEmail,
			Subject:     wantSubject,
			ContentType: "text/html",
			Body:        wantBody,
		},
		testAdminEmail: {
			From:        deps.TxEmailAddress,
			To:          testAdminEmail,
			Subject:     wantSubject,
			ContentType: "text/html",
			Body:        wantBody,
		},
	}

	seenRecipients := make(map[string]bool)
	for rows.Next() {
		var rowTeamID string
		var appID *string
		var channel string
		var data []byte
		if err := rows.Scan(&rowTeamID, &appID, &channel, &data); err != nil {
			t.Fatalf("scan: %v", err)
		}

		if rowTeamID != teamID {
			t.Errorf("team_id = %q, want %q", rowTeamID, teamID)
		}
		if appID != nil {
			t.Errorf("app_id should be NULL, got %v", *appID)
		}
		if channel != "email" {
			t.Errorf("channel = %q, want %q", channel, "email")
		}

		var email email.EmailInfo
		if err := json.Unmarshal(data, &email); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		want, ok := wantByRecipient[email.To]
		if !ok {
			t.Errorf("unexpected recipient %q", email.To)
			continue
		}
		if email != want {
			t.Errorf("payload for %q = %+v, want %+v", email.To, email, want)
		}
		seenRecipients[email.To] = true
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("rows err: %v", err)
	}
	for recipient := range wantByRecipient {
		if !seenRecipients[recipient] {
			t.Errorf("missing payload for recipient %q", recipient)
		}
	}
}
