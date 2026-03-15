//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNewNotifPref(t *testing.T) {
	userId := uuid.New()
	now := time.Now()

	pref := newNotifPref(userId)

	if pref.UserId != userId {
		t.Errorf("userId mismatch: expected %v, got %v", userId, pref.UserId)
	}
	if !pref.ErrorSpike {
		t.Errorf("ErrorSpike should be true")
	}
	if !pref.AppHangSpike {
		t.Errorf("AppHangSpike should be true")
	}
	if !pref.BugReport {
		t.Errorf("BugReport should be true")
	}
	if !pref.DailySummary {
		t.Errorf("DailySummary should be true")
	}
	if pref.CreatedAt.Sub(now) > time.Second {
		t.Errorf("createdAt should be around current time")
	}
	if pref.UpdatedAt.Sub(now) > time.Second {
		t.Errorf("updatedAt should be around current time")
	}
}

func TestNotifPrefMarshalJSON(t *testing.T) {
	userId := uuid.New()
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := NotifPref{
		UserId:       userId,
		ErrorSpike:   true,
		AppHangSpike: false,
		BugReport:    true,
		DailySummary: false,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}

	expectedJSON := `{
		"error_spike": true,
		"app_hang_spike": false,
		"bug_report": true,
		"daily_summary": false,
		"created_at": "2023-04-04T12:00:00Z",
		"updated_at": "2023-04-05T12:00:00Z"
	}`

	jsonBytes, err := pref.MarshalJSON()
	if err != nil {
		t.Errorf("MarshalJSON failed: %v", err)
		return
	}

	var expectedMap, actualMap map[string]interface{}
	if err := json.Unmarshal([]byte(expectedJSON), &expectedMap); err != nil {
		t.Errorf("Failed to unmarshal expected JSON: %v", err)
		return
	}
	if err := json.Unmarshal(jsonBytes, &actualMap); err != nil {
		t.Errorf("Failed to unmarshal actual JSON: %v", err)
		return
	}

	if !reflect.DeepEqual(expectedMap, actualMap) {
		t.Errorf("JSON output mismatch:\nExpected: %s\nActual: %s", expectedJSON, string(jsonBytes))
	}
}

func TestNotifPrefString(t *testing.T) {
	userId := uuid.New()
	createdAt := time.Date(2023, 4, 4, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 4, 5, 12, 0, 0, 0, time.UTC)

	pref := NotifPref{
		UserId:       userId,
		ErrorSpike:   true,
		AppHangSpike: false,
		BugReport:    true,
		DailySummary: false,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}

	expectedString := fmt.Sprintf("NotifPref - userId: %s, error_spike: true, app_hang_spike: false, bug_report: true, daily_summary: false, created_at: %s, updated_at: %s", userId, createdAt, updatedAt)

	trimmedExpected := strings.TrimSpace(expectedString)
	trimmedActual := strings.TrimSpace(pref.String())

	if trimmedActual != trimmedExpected {
		t.Errorf("String() output mismatch:\nExpected: %s\nActual: %s", expectedString, pref.String())
	}
}

func TestCreateNotifPref(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId := uuid.New()
	seedUser(ctx, t, userId.String(), "test@example.com")

	if err := createNotifPref(userId); err != nil {
		t.Fatalf("createNotifPref failed: %v", err)
	}

	pref, err := getNotifPref(userId)
	if err != nil {
		t.Fatalf("getNotifPref failed: %v", err)
	}

	if !pref.ErrorSpike {
		t.Errorf("ErrorSpike should default to true")
	}
	if !pref.AppHangSpike {
		t.Errorf("AppHangSpike should default to true")
	}
	if !pref.BugReport {
		t.Errorf("BugReport should default to true")
	}
	if !pref.DailySummary {
		t.Errorf("DailySummary should default to true")
	}
}

func TestGetNotifPrefNotFound(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	_, err := getNotifPref(uuid.New())
	if err == nil {
		t.Error("expected error for non-existent notif pref, got nil")
	}
}

func TestUpdateNotifPref(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId := uuid.New()
	seedUser(ctx, t, userId.String(), "test@example.com")

	if err := createNotifPref(userId); err != nil {
		t.Fatalf("createNotifPref failed: %v", err)
	}

	pref, err := getNotifPref(userId)
	if err != nil {
		t.Fatalf("getNotifPref failed: %v", err)
	}

	pref.ErrorSpike = false
	pref.DailySummary = false
	pref.UpdatedAt = time.Now()

	if err := pref.update(); err != nil {
		t.Fatalf("update failed: %v", err)
	}

	updated, err := getNotifPref(userId)
	if err != nil {
		t.Fatalf("getNotifPref after update failed: %v", err)
	}

	if updated.ErrorSpike {
		t.Errorf("ErrorSpike should be false after update")
	}
	if !updated.AppHangSpike {
		t.Errorf("AppHangSpike should still be true")
	}
	if !updated.BugReport {
		t.Errorf("BugReport should still be true")
	}
	if updated.DailySummary {
		t.Errorf("DailySummary should be false after update")
	}
}

func TestUpdateNotifPrefIsolation(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId1 := uuid.New()
	userId2 := uuid.New()
	seedUser(ctx, t, userId1.String(), "user1@example.com")
	seedUser(ctx, t, userId2.String(), "user2@example.com")

	if err := createNotifPref(userId1); err != nil {
		t.Fatalf("createNotifPref user1 failed: %v", err)
	}
	if err := createNotifPref(userId2); err != nil {
		t.Fatalf("createNotifPref user2 failed: %v", err)
	}

	// Update user1's prefs
	pref1, _ := getNotifPref(userId1)
	pref1.ErrorSpike = false
	pref1.UpdatedAt = time.Now()
	if err := pref1.update(); err != nil {
		t.Fatalf("update user1 failed: %v", err)
	}

	// Verify user2's prefs are unchanged
	pref2, err := getNotifPref(userId2)
	if err != nil {
		t.Fatalf("getNotifPref user2 failed: %v", err)
	}

	if !pref2.ErrorSpike {
		t.Errorf("user2 ErrorSpike should still be true")
	}
	if !pref2.AppHangSpike {
		t.Errorf("user2 AppHangSpike should still be true")
	}
	if !pref2.BugReport {
		t.Errorf("user2 BugReport should still be true")
	}
	if !pref2.DailySummary {
		t.Errorf("user2 DailySummary should still be true")
	}
}

func TestGetNotifPrefsHandler(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId := uuid.New()
	seedUser(ctx, t, userId.String(), "test@example.com")

	if err := createNotifPref(userId); err != nil {
		t.Fatalf("createNotifPref failed: %v", err)
	}

	c, w := newTestGinContext("GET", "/notifPrefs", nil)
	c.Set("userId", userId.String())

	GetNotifPrefs(c)

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

	GetNotifPrefs(c)

	if w.Code != 400 {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestUpdateNotifPrefsHandler(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userId := uuid.New()
	seedUser(ctx, t, userId.String(), "test@example.com")

	if err := createNotifPref(userId); err != nil {
		t.Fatalf("createNotifPref failed: %v", err)
	}

	body := strings.NewReader(`{"error_spike": false, "app_hang_spike": true, "bug_report": false, "daily_summary": true}`)
	c, w := newTestGinContext("PATCH", "/notifPrefs", body)
	c.Set("userId", userId.String())

	UpdateNotifPrefs(c)

	if w.Code != 200 {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	// Verify persisted
	pref, err := getNotifPref(userId)
	if err != nil {
		t.Fatalf("getNotifPref failed: %v", err)
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
