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
			content := UsageLimitContent("Test message", tt.threshold, "750K", "1M")

			if !strings.Contains(content, tt.wantColor) {
				t.Errorf("content should contain color %q for threshold %d", tt.wantColor, tt.threshold)
			}
			if !strings.Contains(content, "750K / 1M units used") {
				t.Error("content should contain usage text")
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
		{"last 24h", "Last 24 hours"},
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
	err := QueueEmail(context.Background(), nil, "team-1", nil, EmailInfo{
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
	seedTeam(ctx, t, teamID, "Email Test Team", true)

	input := EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Queued Subject",
		ContentType: "text/html",
		Body:        "<p>Hello queue</p>",
	}
	if err := QueueEmail(ctx, th.PgPool, teamID, nil, input); err != nil {
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
	seedTeam(ctx, t, teamID, "Email Test Team", true)
	seedApp(ctx, t, appID, teamID, 30)

	input := EmailInfo{
		From:        testFromEmail,
		To:          testToEmail,
		Subject:     "Queued Subject App",
		ContentType: "text/html",
		Body:        "<p>Hello app queue</p>",
	}
	if err := QueueEmail(ctx, th.PgPool, teamID, appID, input); err != nil {
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
	err := QueueEmailForTeam(context.Background(), nil, "team-1", nil, EmailInfo{
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

	seedTeam(ctx, t, teamID, "Email Team", true)
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
	if err := QueueEmailForTeam(ctx, th.PgPool, teamID, nil, input); err != nil {
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

	seedTeam(ctx, t, teamID, "Email Team App", true)
	seedApp(ctx, t, appID, teamID, 30)
	seedUser(ctx, t, userID, testOwnerEmail)
	seedTeamMembership(ctx, t, teamID, userID, "owner")

	input := EmailInfo{
		From:        testFromEmail,
		Subject:     "App Subject",
		ContentType: "text/html",
		Body:        "<p>App body</p>",
	}
	if err := QueueEmailForTeam(ctx, th.PgPool, teamID, appID, input); err != nil {
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
	seedTeam(ctx, t, teamID, "No Members Team", true)

	input := EmailInfo{
		From:        testFromEmail,
		Subject:     "No members",
		ContentType: "text/html",
		Body:        "<p>No members body</p>",
	}
	if err := QueueEmailForTeam(ctx, th.PgPool, teamID, nil, input); err != nil {
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
