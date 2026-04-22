//go:build integration

package email

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

const (
	testFromEmail  = "test@example.com"
	testToEmail    = "user@example.com"
	testOwnerEmail = "owner@example.com"
	testAdminEmail = "admin@example.com"
	testDevEmail   = "dev@example.com"
)

func TestRenderEmailBody(t *testing.T) {
	body := RenderEmailBody("Test Title", "<p>Hello</p>", "Click Me", "https://example.com")

	checks := []struct {
		name    string
		contain string
	}{
		{"title tag", "<title>Test Title</title>"},
		{"header title", "Test Title</h1>"},
		{"content", "<p>Hello</p>"},
		{"cta text", "Click Me"},
		{"cta url", `href="https://example.com"`},
		{"footer", "measure.sh"},
		{"logo", "https://measure.sh/images/measure_logo.png"},
		{"doctype", "<!DOCTYPE html>"},
	}

	for _, c := range checks {
		t.Run(c.name, func(t *testing.T) {
			if !strings.Contains(body, c.contain) {
				t.Errorf("body should contain %q", c.contain)
			}
		})
	}
}

func TestMessageContent(t *testing.T) {
	content := MessageContent("Hello <b>world</b>")

	if !strings.Contains(content, "Hello <b>world</b>") {
		t.Error("content should contain the message")
	}
	if !strings.Contains(content, `font-size: 16px`) {
		t.Error("content should contain standard styling")
	}
	if !strings.Contains(content, `color: #4a5568`) {
		t.Error("content should contain standard text color")
	}
}

func TestUsageLimitContent(t *testing.T) {
	tests := []struct {
		threshold int
		wantColor string
	}{
		{75, "#facc15"},
		{90, "#f43f5e"},
		{100, "#e11d48"},
		{50, "#000000"},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%d%%", tt.threshold), func(t *testing.T) {
			content := UsageLimitContent("Test message", tt.threshold)

			if !strings.Contains(content, tt.wantColor) {
				t.Errorf("content should contain color %q for threshold %d", tt.wantColor, tt.threshold)
			}
			if !strings.Contains(content, fmt.Sprintf("%d%% of plan limit used", tt.threshold)) {
				t.Errorf("content should contain percent label for threshold %d", tt.threshold)
			}
			if !strings.Contains(content, "Test message") {
				t.Error("content should contain the message")
			}
			if !strings.Contains(content, fmt.Sprintf("width: %d%%", tt.threshold)) {
				t.Errorf("content should contain width: %d%%", tt.threshold)
			}
		})
	}
}

func TestDailySummaryContent(t *testing.T) {
	date := time.Date(2026, 2, 15, 0, 0, 0, 0, time.UTC)
	metrics := []MetricData{
		{Value: "1,234", Label: "Sessions", Subtitle: "Last 24h", HasWarning: false, HasError: false},
		{Value: "99.5%", Label: "Crash Free", Subtitle: "Target: 99%", HasWarning: true, HasError: false},
		{Value: "98.0%", Label: "ANR Free", Subtitle: "Target: 99%", HasWarning: false, HasError: true},
	}

	content := DailySummaryContent("MyApp", date, metrics)

	checks := []struct {
		name    string
		contain string
	}{
		{"date", "February 15, 2026"},
		{"summary label", "Summary for February 15, 2026"},
		{"comparison label", "Comparisons are between Feb 15, 2026 (12:00 AM UTC to 11:59 PM UTC) and Feb 14, 2026 (12:00 AM UTC to 11:59 PM UTC)."},
		{"sessions value", "1,234"},
		{"sessions label", "Sessions"},
		{"crash free value", "99.5%"},
		{"anr free value", "98.0%"},
		{"warning color", "#d08700"},
		{"error color", "#e7000b"},
	}

	for _, c := range checks {
		t.Run(c.name, func(t *testing.T) {
			if !strings.Contains(content, c.contain) {
				t.Errorf("content should contain %q", c.contain)
			}
		})
	}
}

func TestDailySummaryContentNoWarnings(t *testing.T) {
	date := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	metrics := []MetricData{
		{Value: "500", Label: "Sessions", Subtitle: "All good"},
	}

	content := DailySummaryContent("App", date, metrics)

	if strings.Contains(content, "#e7000b") {
		t.Error("should not contain error color when no errors")
	}
	if strings.Contains(content, "#d08700") {
		t.Error("should not contain warning color when no warnings")
	}
}

func TestQueueEmailNilPool(t *testing.T) {
	err := QueueEmail(context.Background(), nil, nil, "team-1", nil, EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Test",
		ContentType: "text/html",
		Body:        "<p>Hello</p>",
	})

	if err == nil {
		t.Fatal("expected error for nil pool")
	}
	if !strings.Contains(err.Error(), "not initialized") {
		t.Errorf("error should mention not initialized, got: %v", err)
	}
}

func TestQueueEmailInsertsPendingMessageWithNilAppID(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "Email Test Team")

	input := EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Queued Subject",
		ContentType: "text/html",
		Body:        "<p>Hello queue</p>",
	}
	if err := QueueEmail(ctx, th.PgPool, nil, teamID, nil, input); err != nil {
		t.Fatalf("QueueEmail: %v", err)
	}

	var rowTeamID uuid.UUID
	var rowAppID *uuid.UUID
	var channel string
	var data []byte
	err := th.PgPool.QueryRow(ctx,
		"SELECT team_id, app_id, channel, data FROM pending_alert_messages WHERE team_id = $1",
		teamID).
		Scan(&rowTeamID, &rowAppID, &channel, &data)
	if err != nil {
		t.Fatalf("read queued email: %v", err)
	}

	if rowTeamID != teamID {
		t.Errorf("team_id = %v, want %v", rowTeamID, teamID)
	}
	if rowAppID != nil {
		t.Errorf("app_id should be NULL, got %v", *rowAppID)
	}
	if channel != "email" {
		t.Errorf("channel = %q, want email", channel)
	}

	var got EmailInfo
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal email payload: %v", err)
	}
	if got != input {
		t.Errorf("payload = %+v, want %+v", got, input)
	}
}

func TestQueueEmailInsertsPendingMessageWithAppID(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "Email Test Team")
	seedApp(ctx, t, appID, teamID, 30)

	input := EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Queued Subject App",
		ContentType: "text/html",
		Body:        "<p>Hello app queue</p>",
	}
	if err := QueueEmail(ctx, th.PgPool, nil, teamID, appID, input); err != nil {
		t.Fatalf("QueueEmail: %v", err)
	}

	var rowTeamID uuid.UUID
	var rowAppID *uuid.UUID
	var channel string
	var data []byte
	err := th.PgPool.QueryRow(ctx,
		"SELECT team_id, app_id, channel, data FROM pending_alert_messages WHERE team_id = $1 AND app_id = $2",
		teamID, appID).
		Scan(&rowTeamID, &rowAppID, &channel, &data)
	if err != nil {
		t.Fatalf("read queued email: %v", err)
	}

	if rowTeamID != teamID {
		t.Errorf("team_id = %v, want %v", rowTeamID, teamID)
	}
	if rowAppID == nil {
		t.Fatal("app_id should not be NULL")
	}
	if *rowAppID != appID {
		t.Errorf("app_id = %v, want %v", *rowAppID, appID)
	}
	if channel != "email" {
		t.Errorf("channel = %q, want email", channel)
	}

	var got EmailInfo
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal email payload: %v", err)
	}
	if got != input {
		t.Errorf("payload = %+v, want %+v", got, input)
	}
}

func TestQueueEmailForTeamNilPool(t *testing.T) {
	err := QueueEmailForTeam(context.Background(), nil, nil, "team-1", nil, EmailInfo{
		From:        testFromEmail,
		Subject:     "Test",
		ContentType: "text/html",
		Body:        "<p>Hello</p>",
	})

	if err == nil {
		t.Fatal("expected error for nil pool")
	}
	if !strings.Contains(err.Error(), "not initialized") {
		t.Errorf("error should mention not initialized, got: %v", err)
	}
}

func TestQueueEmailForTeamQueuesOnePerMember(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	user1ID := uuid.New()
	user2ID := uuid.New()
	user3ID := uuid.New()

	seedTeam(ctx, t, teamID, "Email Team")
	seedUser(ctx, t, user1ID, testOwnerEmail)
	seedUser(ctx, t, user2ID, testAdminEmail)
	seedUser(ctx, t, user3ID, testDevEmail)
	seedTeamMembership(ctx, t, teamID, user1ID, "owner")
	seedTeamMembership(ctx, t, teamID, user2ID, "admin")
	seedTeamMembership(ctx, t, teamID, user3ID, "developer")

	input := EmailInfo{
		From:        testFromEmail,
		Subject:     "Team Subject",
		ContentType: "text/html",
		Body:        "<p>Team body</p>",
	}
	if err := QueueEmailForTeam(ctx, th.PgPool, nil, teamID, nil, input); err != nil {
		t.Fatalf("QueueEmailForTeam: %v", err)
	}

	rows, err := th.PgPool.Query(ctx,
		"SELECT team_id, app_id, channel, data FROM pending_alert_messages WHERE team_id = $1",
		teamID)
	if err != nil {
		t.Fatalf("select queued emails: %v", err)
	}
	defer rows.Close()

	wantByRecipient := map[string]EmailInfo{
		testOwnerEmail: {From: input.From, To: testOwnerEmail, Subject: input.Subject, ContentType: input.ContentType, Body: input.Body},
		testAdminEmail: {From: input.From, To: testAdminEmail, Subject: input.Subject, ContentType: input.ContentType, Body: input.Body},
		testDevEmail:   {From: input.From, To: testDevEmail, Subject: input.Subject, ContentType: input.ContentType, Body: input.Body},
	}
	seen := make(map[string]bool)
	for rows.Next() {
		var rowTeamID uuid.UUID
		var rowAppID *uuid.UUID
		var channel string
		var data []byte
		if err := rows.Scan(&rowTeamID, &rowAppID, &channel, &data); err != nil {
			t.Fatalf("scan queued email: %v", err)
		}

		if rowTeamID != teamID {
			t.Errorf("team_id = %v, want %v", rowTeamID, teamID)
		}
		if rowAppID != nil {
			t.Errorf("app_id should be NULL, got %v", *rowAppID)
		}
		if channel != "email" {
			t.Errorf("channel = %q, want email", channel)
		}

		var got EmailInfo
		if err := json.Unmarshal(data, &got); err != nil {
			t.Fatalf("unmarshal email payload: %v", err)
		}
		want, ok := wantByRecipient[got.To]
		if !ok {
			t.Errorf("unexpected recipient in payload: %q", got.To)
			continue
		}
		if got != want {
			t.Errorf("payload for %q = %+v, want %+v", got.To, got, want)
		}
		seen[got.To] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows err: %v", err)
	}
	if len(seen) != len(wantByRecipient) {
		t.Fatalf("queued recipient count = %d, want %d", len(seen), len(wantByRecipient))
	}
}

func TestQueueEmailForTeamQueuesWithAppID(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	appID := uuid.New()
	userID := uuid.New()

	seedTeam(ctx, t, teamID, "Email Team App")
	seedApp(ctx, t, appID, teamID, 30)
	seedUser(ctx, t, userID, testOwnerEmail)
	seedTeamMembership(ctx, t, teamID, userID, "owner")

	input := EmailInfo{
		From:        testFromEmail,
		Subject:     "App Subject",
		ContentType: "text/html",
		Body:        "<p>App body</p>",
	}
	if err := QueueEmailForTeam(ctx, th.PgPool, nil, teamID, appID, input); err != nil {
		t.Fatalf("QueueEmailForTeam: %v", err)
	}

	var rowAppID *uuid.UUID
	var data []byte
	err := th.PgPool.QueryRow(ctx,
		"SELECT app_id, data FROM pending_alert_messages WHERE team_id = $1",
		teamID).
		Scan(&rowAppID, &data)
	if err != nil {
		t.Fatalf("read queued email: %v", err)
	}
	if rowAppID == nil || *rowAppID != appID {
		t.Fatalf("app_id = %v, want %v", rowAppID, appID)
	}

	var got EmailInfo
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal email payload: %v", err)
	}
	if got.To != testOwnerEmail {
		t.Errorf("to = %q, want %q", got.To, testOwnerEmail)
	}
}

func TestQueueEmailForTeamWithNoMembersQueuesNothing(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "No Members Team")

	input := EmailInfo{
		From:        testFromEmail,
		Subject:     "No members",
		ContentType: "text/html",
		Body:        "<p>No members body</p>",
	}
	if err := QueueEmailForTeam(ctx, th.PgPool, nil, teamID, nil, input); err != nil {
		t.Fatalf("QueueEmailForTeam: %v", err)
	}

	var count int
	if err := th.PgPool.QueryRow(ctx,
		"SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1",
		teamID).
		Scan(&count); err != nil {
		t.Fatalf("count queued emails: %v", err)
	}
	if count != 0 {
		t.Fatalf("queued emails count = %d, want 0", count)
	}
}

func TestQueueEmailPersistsAlertType(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "AlertType Team")

	input := EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Crash Spike Alert",
		ContentType: "text/html",
		Body:        "<p>Crash alert</p>",
		AlertType:   "crash_spike",
	}
	if err := QueueEmail(ctx, th.PgPool, nil, teamID, nil, input); err != nil {
		t.Fatalf("QueueEmail: %v", err)
	}

	var data []byte
	err := th.PgPool.QueryRow(ctx,
		"SELECT data FROM pending_alert_messages WHERE team_id = $1",
		teamID).Scan(&data)
	if err != nil {
		t.Fatalf("read queued email: %v", err)
	}

	var got EmailInfo
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal email payload: %v", err)
	}
	if got.AlertType != "crash_spike" {
		t.Errorf("AlertType = %q, want %q", got.AlertType, "crash_spike")
	}
}

func TestQueueEmailOmitsEmptyAlertType(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "No AlertType Team")

	input := EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Usage Limit",
		ContentType: "text/html",
		Body:        "<p>Usage</p>",
	}
	if err := QueueEmail(ctx, th.PgPool, nil, teamID, nil, input); err != nil {
		t.Fatalf("QueueEmail: %v", err)
	}

	var data []byte
	err := th.PgPool.QueryRow(ctx,
		"SELECT data FROM pending_alert_messages WHERE team_id = $1",
		teamID).Scan(&data)
	if err != nil {
		t.Fatalf("read queued email: %v", err)
	}

	// With omitempty, alert_type key should be absent from JSON
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal email payload: %v", err)
	}
	if _, exists := raw["alert_type"]; exists {
		t.Errorf("alert_type should be omitted when empty, got %v", raw["alert_type"])
	}
}

func TestSendEmailNilClient(t *testing.T) {
	err := SendEmail(nil, EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Test",
		ContentType: "text/html",
		Body:        "<p>Hello</p>",
	})

	if err == nil {
		t.Fatal("expected error for nil client")
	}
	if !strings.Contains(err.Error(), "not initialized") {
		t.Errorf("error should mention not initialized, got: %v", err)
	}
}

// --------------------------------------------------------------------------
// Billing email builders — plan-agnostic copy (no byte counts, no retention
// numbers, except for the threshold percentage in UsageLimitEmail).
// --------------------------------------------------------------------------

// mustNotContainByteNumbers guards against regressions where email copy
// starts leaking specific byte/GB counts or hard-coded retention days. The
// design goal is that only percentages (thresholds) are plan-agnostic.
func mustNotContainByteNumbers(t *testing.T, label, s string) {
	t.Helper()
	forbidden := []string{"GB", "MB", " bytes", "days of retention", "days of data retention"}
	for _, needle := range forbidden {
		if strings.Contains(s, needle) {
			t.Errorf("%s: contains plan-coupled string %q (breaks plan-agnostic copy)", label, needle)
		}
	}
}

func TestUpgradeEmail(t *testing.T) {
	subject, body := UpgradeEmail("Acme Corp", "team-abc", "https://measure.sh")

	if !strings.Contains(subject, "Upgraded to Measure Pro") {
		t.Errorf("subject = %q, want it to contain 'Upgraded to Measure Pro'", subject)
	}
	if !strings.Contains(subject, "Acme Corp") {
		t.Errorf("subject = %q, want it to contain team name", subject)
	}
	if !strings.Contains(body, "Acme Corp") {
		t.Errorf("body missing team name")
	}
	if !strings.Contains(body, "upgraded to Measure Pro") {
		t.Errorf("body missing upgrade copy")
	}
	if !strings.Contains(body, "team-abc/usage") {
		t.Errorf("body missing dashboard link")
	}

	mustNotContainByteNumbers(t, "UpgradeEmail body", body)
}

func TestManualDowngradeEmail(t *testing.T) {
	subject, body := ManualDowngradeEmail("Acme Corp", "team-abc", "https://measure.sh")

	if !strings.Contains(subject, "Downgraded to Free Plan") {
		t.Errorf("subject = %q, want it to contain 'Downgraded to Free Plan'", subject)
	}
	if !strings.Contains(body, "Acme Corp") {
		t.Errorf("body missing team name")
	}
	if !strings.Contains(body, "downgraded to the free plan") {
		t.Errorf("body missing downgrade copy")
	}
	if !strings.Contains(body, "Check your dashboard") {
		t.Errorf("body should direct users to the dashboard for new limits")
	}

	mustNotContainByteNumbers(t, "ManualDowngradeEmail body", body)
}

func TestUsageLimitEmail_Thresholds(t *testing.T) {
	tests := []struct {
		threshold       int
		wantSubject     string
		wantBodySubstr  string
		wantExtraCopy   string
		wantCTA         string
		wantProgressPct string
	}{
		{75, "75% of Usage Limit Reached", "has used <strong>75%</strong>", "Consider upgrading to Measure Pro for unlimited usage!", "Upgrade to Measure Pro", "width: 75%"},
		{90, "90% of Usage Limit Reached", "has used <strong>90%</strong>", "Consider upgrading to Measure Pro for unlimited usage!", "Upgrade to Measure Pro", "width: 90%"},
		{100, "Usage Limit Reached", "has reached its plan's data limit", "Data ingestion has been paused", "Upgrade to Measure Pro", "width: 100%"},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%d%%", tt.threshold), func(t *testing.T) {
			subject, body := UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", tt.threshold)

			if !strings.Contains(subject, tt.wantSubject) {
				t.Errorf("subject = %q, want substring %q", subject, tt.wantSubject)
			}
			if !strings.Contains(subject, "Acme Corp") {
				t.Errorf("subject missing team name")
			}
			if !strings.Contains(body, tt.wantBodySubstr) {
				t.Errorf("body missing %q", tt.wantBodySubstr)
			}
			if !strings.Contains(body, tt.wantExtraCopy) {
				t.Errorf("body missing locked copy %q", tt.wantExtraCopy)
			}
			if !strings.Contains(body, tt.wantCTA) {
				t.Errorf("body missing CTA %q", tt.wantCTA)
			}
			if !strings.Contains(body, tt.wantProgressPct) {
				t.Errorf("body missing progress bar width %q", tt.wantProgressPct)
			}
			if !strings.Contains(body, "team-abc/usage") {
				t.Errorf("body missing dashboard link")
			}

			mustNotContainByteNumbers(t, fmt.Sprintf("UsageLimitEmail(%d)", tt.threshold), body)
		})
	}
}

func TestUsageLimitEmail_NonStandardThreshold(t *testing.T) {
	// Autumn dashboard can send any numeric threshold — handler should not
	// panic and should fall into the non-100 branch with an upgrade CTA.
	subject, body := UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", 50)

	if !strings.Contains(subject, "50% of Usage Limit Reached") {
		t.Errorf("subject = %q, want '50%%' mention", subject)
	}
	if !strings.Contains(body, "has used <strong>50%</strong>") {
		t.Errorf("body missing 50%% usage copy")
	}
	mustNotContainByteNumbers(t, "UsageLimitEmail(50)", body)
}
