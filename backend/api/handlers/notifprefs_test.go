//go:build integration

package handlers

import (
	"context"
	"strings"
	"testing"

	"backend/libs/measure"

	"github.com/google/uuid"
)

func TestGetNotifPrefsHandler(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId := uuid.New()
	seedUser(ctx, t, userId.String(), "test@example.com")

	if err := measure.CreateNotifPref(deps.PgPool, userId); err != nil {
		t.Fatalf("CreateNotifPref failed: %v", err)
	}

	c, w := newTestGinContext("GET", "/notifPrefs", nil)
	c.Set("userId", userId.String())

	h.GetNotifPrefs(c)

	if w.Code != 200 {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	wantJSON(t, w, "error_spike", true)
	wantJSON(t, w, "app_hang_spike", true)
	wantJSON(t, w, "bug_report", true)
	wantJSON(t, w, "daily_summary", true)
}

func TestGetNotifPrefsHandlerNoPrefs(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId := uuid.New()
	seedUser(ctx, t, userId.String(), "test@example.com")

	c, w := newTestGinContext("GET", "/notifPrefs", nil)
	c.Set("userId", userId.String())

	h.GetNotifPrefs(c)

	if w.Code != 400 {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestUpdateNotifPrefsHandler(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId := uuid.New()
	seedUser(ctx, t, userId.String(), "test@example.com")

	if err := measure.CreateNotifPref(deps.PgPool, userId); err != nil {
		t.Fatalf("CreateNotifPref failed: %v", err)
	}

	body := strings.NewReader(`{"error_spike": false, "app_hang_spike": true, "bug_report": false, "daily_summary": true}`)
	c, w := newTestGinContext("PATCH", "/notifPrefs", body)
	c.Set("userId", userId.String())

	h.UpdateNotifPrefs(c)

	if w.Code != 200 {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	// Verify persisted
	pref, err := measure.GetNotifPref(deps.PgPool, userId)
	if err != nil {
		t.Fatalf("GetNotifPref failed: %v", err)
	}

	if pref.ErrorSpike {
		t.Errorf("ErrorSpike should be false")
	}
	if !pref.AppHangSpike {
		t.Errorf("AppHangSpike should be true")
	}
	if pref.BugReport {
		t.Errorf("BugReport should be false")
	}
	if !pref.DailySummary {
		t.Errorf("DailySummary should be true")
	}
}
