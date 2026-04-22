//go:build integration

package measure

import (
	"backend/api/group"
	"backend/api/server"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// Pure function tests
// --------------------------------------------------------------------------

func TestFormatExceptionMessage(t *testing.T) {
	cases := []struct {
		name       string
		exType     string
		message    string
		fileName   string
		methodName string
		want       string
	}{
		{"type and message", "NullPointerException", "null ref", "", "", "NullPointerException - null ref"},
		{"type only", "NullPointerException", "", "", "", "NullPointerException"},
		{"message only", "", "null ref", "", "", "null ref"},
		{"file and method", "", "", "Foo.java", "bar", "Foo.java:bar()"},
		{"file only", "", "", "Foo.java", "", "Foo.java"},
		{"method only", "", "", "", "bar", "bar()"},
		{"all empty", "", "", "", "", "Unknown error"},
		{"type+message wins over file+method", "NPE", "msg", "F.java", "m", "NPE - msg"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := formatExceptionMessage(tc.exType, tc.message, tc.fileName, tc.methodName)
			if got != tc.want {
				t.Errorf("formatExceptionMessage(%q, %q, %q, %q) = %q, want %q",
					tc.exType, tc.message, tc.fileName, tc.methodName, got, tc.want)
			}
		})
	}
}

func TestCleanNullBytes(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"trailing null bytes", "hello\x00\x00", "hello"},
		{"embedded unicode null", "he\u0000llo", "hello"},
		{"both trailing and embedded", "he\u0000llo\x00", "hello"},
		{"clean string", "clean", "clean"},
		{"empty string", "", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := cleanNullBytes(tc.input)
			if got != tc.want {
				t.Errorf("cleanNullBytes(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

// --------------------------------------------------------------------------
// Gin handler tests
// --------------------------------------------------------------------------

func TestGetCrashGroupCommonPathHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("GET", "/apps/not-a-uuid/crashGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}, {Key: "crashGroupId", Value: "fp1"}}

		GetCrashGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("missing crashGroupId", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups//path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetCrashGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("app with no team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		// Use a valid UUID that doesn't exist in the DB
		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: "fp1"}}

		GetCrashGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("user not authorized", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-handler-team")
		ownerID := uuid.New().String()
		seedUser(ctx, t, ownerID, "cp-owner@test.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		// Different user who is not a team member — PerformAuthz returns
		// an error for unknown roles, so the handler responds with 500.
		otherID := uuid.New().String()
		seedUser(ctx, t, otherID, "cp-other@test.com")

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/fp1/path", nil)
		c.Set("userId", otherID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: "fp1"}}

		GetCrashGroupCommonPath(c)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("nonexistent crash group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-handler-team2")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-user2@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/fp-nonexistent/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: "fp-nonexistent"}}

		GetCrashGroupCommonPath(c)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("valid call with seeded crash group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-handler-team3")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-user3@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-cp-handler-crash-12345678"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/"+fingerprint+"/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: fingerprint}}

		GetCrashGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if _, ok := result["sessions_analyzed"]; !ok {
			t.Error("response missing sessions_analyzed field")
		}
		if _, ok := result["steps"]; !ok {
			t.Error("response missing steps field")
		}
	})
}

func TestGetANRGroupCommonPathHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("GET", "/apps/not-a-uuid/anrGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}, {Key: "anrGroupId", Value: "fp1"}}

		GetANRGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("missing anrGroupId", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/anrGroups//path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetANRGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("valid call with seeded ANR group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-anr-handler-team")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-anr-user@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-cp-handler-anr-123456789"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/anrGroups/"+fingerprint+"/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "anrGroupId", Value: fingerprint}}

		GetANRGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if _, ok := result["sessions_analyzed"]; !ok {
			t.Error("response missing sessions_analyzed field")
		}
		if _, ok := result["steps"]; !ok {
			t.Error("response missing steps field")
		}
	})
}

// --------------------------------------------------------------------------
// Core function tests
// --------------------------------------------------------------------------

func TestGetIssueGroupCommonPath(t *testing.T) {
	ctx := context.Background()
	server.Server.ChPool = th.ChConn

	t.Run("nonexistent crash group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()

		_, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, "fp-does-not-exist")
		if err == nil {
			t.Fatal("expected error for nonexistent crash group")
		}
		if !strings.Contains(err.Error(), "no crash group found") {
			t.Errorf("error = %q, want substring %q", err.Error(), "no crash group found")
		}
	})

	t.Run("nonexistent ANR group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()

		_, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeANR, "fp-does-not-exist")
		if err == nil {
			t.Fatal("expected error for nonexistent ANR group")
		}
		if !strings.Contains(err.Error(), "no anr group found") {
			t.Errorf("error = %q, want substring %q", err.Error(), "no anr group found")
		}
	})

	t.Run("crash group exists but no session events", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-empty-crash-sessions-12345"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed != 0 {
			t.Errorf("sessions_analyzed = %d, want 0", result.SessionsAnalyzed)
		}
		if len(result.Steps) != 0 {
			t.Errorf("steps length = %d, want 0", len(result.Steps))
		}
	})

	t.Run("ANR group exists but no session events", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-empty-anr-sessions-123456"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeANR, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed != 0 {
			t.Errorf("sessions_analyzed = %d, want 0", result.SessionsAnalyzed)
		}
		if len(result.Steps) != 0 {
			t.Errorf("steps length = %d, want 0", len(result.Steps))
		}
	})

	t.Run("crash path with seeded session data", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-crash-with-sessions-12345"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		// Seed a session with multiple events (minEventsInSession=2):
		// 1. A navigation event
		// 2. A crash event with matching fingerprint
		// Both share the same session_id.
		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedEventWithSession(ctx, t, teamID.String(), appID.String(), sessionID, now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed < 1 {
			t.Errorf("sessions_analyzed = %d, want >= 1", result.SessionsAnalyzed)
		}
	})

	t.Run("ANR path with seeded session data", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-anr-with-sessions-1234567"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedEventWithSession(ctx, t, teamID.String(), appID.String(), sessionID, now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "anr", fingerprint, false, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeANR, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed < 1 {
			t.Errorf("sessions_analyzed = %d, want >= 1", result.SessionsAnalyzed)
		}
	})

	t.Run("duplicate descriptions are deduplicated", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-dedup-crash-sessions-1234"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		now := time.Now().UTC()

		// Seed 2 sessions with identical navigation events (same type and
		// timestamp offset so they land at the same position_from_end), then crash.
		for i := 0; i < 2; i++ {
			sessionID := uuid.New().String()
			seedEventWithSession(ctx, t, teamID.String(), appID.String(), sessionID, now.Add(-2*time.Second))
			seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, now)
		}

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []struct {
				Description string `json:"description"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		// Check no duplicate descriptions
		seen := make(map[string]bool)
		for _, step := range result.Steps {
			if seen[step.Description] {
				t.Errorf("duplicate description found: %q", step.Description)
			}
			seen[step.Description] = true
		}
	})

	// ------------------------------------------------------------------
	// Row scanning: handled exception with data
	// ------------------------------------------------------------------

	t.Run("handled exception shows Handled exception prefix", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-handled-ex-data-12345678"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		sessionID := uuid.New().String()
		now := time.Now().UTC()
		// Navigation event to satisfy minEventsInSession=2
		seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "HomeScreen", now.Add(-2*time.Second))
		// Handled exception with JSON data
		excJSON := `[{"type":"NullPointerException","message":"null ref","frames":[]}]`
		seedIssueEventWithDataInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, true, excJSON, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			Steps []struct {
				Description string `json:"description"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		found := false
		for _, s := range result.Steps {
			if strings.Contains(s.Description, "Handled exception: NullPointerException - null ref") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected step with 'Handled exception: NullPointerException - null ref', got steps: %+v", result.Steps)
		}
	})

	// ------------------------------------------------------------------
	// Row scanning: handled ANR with data
	// ------------------------------------------------------------------

	t.Run("handled ANR shows Handled ANR prefix", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-handled-anr-data-1234567"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "SettingsScreen", now.Add(-2*time.Second))
		anrJSON := `[{"type":"ANR","message":"Input dispatching timed out","frames":[]}]`
		seedIssueEventWithDataInSession(ctx, t, teamID.String(), appID.String(), sessionID, "anr", fingerprint, true, anrJSON, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeANR, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			Steps []struct {
				Description string `json:"description"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		found := false
		for _, s := range result.Steps {
			if strings.Contains(s.Description, "Handled ANR: ANR - Input dispatching timed out") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected step with 'Handled ANR: ANR - Input dispatching timed out', got steps: %+v", result.Steps)
		}
	})

	// ------------------------------------------------------------------
	// Row scanning: empty exception_data fallback
	// ------------------------------------------------------------------

	t.Run("empty exception data falls back to Crash occurred", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-empty-excdata-123456789"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "LoginScreen", now.Add(-2*time.Second))
		// No exceptions JSON — SeedIssueEventInSession leaves it empty
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			Steps []struct {
				Description string `json:"description"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		found := false
		for _, s := range result.Steps {
			if s.Description == "Crash occurred" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected step with description 'Crash occurred', got steps: %+v", result.Steps)
		}
	})

	// ------------------------------------------------------------------
	// Row scanning: empty anr_data fallback
	// ------------------------------------------------------------------

	t.Run("empty ANR data falls back to ANR occurred", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-empty-anrdata-123456789"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "ProfileScreen", now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "anr", fingerprint, false, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeANR, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			Steps []struct {
				Description string `json:"description"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		found := false
		for _, s := range result.Steps {
			if s.Description == "ANR (Application Not Responding) occurred" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected step with description 'ANR (Application Not Responding) occurred', got steps: %+v", result.Steps)
		}
	})

	// ------------------------------------------------------------------
	// Row scanning: default event type uses rawDescription
	// ------------------------------------------------------------------

	t.Run("navigation event uses rawDescription from ClickHouse multiIf", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-nav-description-12345678"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "CheckoutScreen", now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			Steps []struct {
				Description string `json:"description"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		found := false
		for _, s := range result.Steps {
			if strings.Contains(s.Description, "Navigated to screen: CheckoutScreen") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected step containing 'Navigated to screen: CheckoutScreen', got steps: %+v", result.Steps)
		}
	})

	// ------------------------------------------------------------------
	// Boundary: session with only 1 event excluded by minEventsInSession
	// ------------------------------------------------------------------

	t.Run("session with only 1 event excluded by minEventsInSession", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-min-events-boundary-12345"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		now := time.Now().UTC()
		// Session with only 1 event (the crash itself) — should be excluded
		sessionID := uuid.New().String()
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed != 0 {
			t.Errorf("sessions_analyzed = %d, want 0 (1-event session should be excluded)", result.SessionsAnalyzed)
		}
	})

	// ------------------------------------------------------------------
	// Boundary: minConfidencePct filtering
	// ------------------------------------------------------------------

	t.Run("steps below minConfidencePct threshold are filtered out", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-confidence-threshold-12345"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		now := time.Now().UTC()
		// Seed 4 sessions. 3 navigate to "CommonScreen" before crash,
		// 1 navigates to "RareScreen" before crash (25% confidence < 30%).
		for i := 0; i < 3; i++ {
			sessionID := uuid.New().String()
			seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "CommonScreen", now.Add(-2*time.Second))
			seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, now)
		}
		rareSessionID := uuid.New().String()
		seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), rareSessionID, "RareScreen", now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), rareSessionID, "exception", fingerprint, false, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []struct {
				Description   string  `json:"description"`
				ConfidencePct float64 `json:"confidence_pct"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		for _, s := range result.Steps {
			if s.ConfidencePct < float64(minConfidencePct) {
				t.Errorf("step %q has confidence_pct=%.1f, want >= %d", s.Description, s.ConfidencePct, minConfidencePct)
			}
		}

		// "RareScreen" appears in only 1/4 sessions = 25% < 30%, should be filtered
		for _, s := range result.Steps {
			if strings.Contains(s.Description, "RareScreen") {
				t.Errorf("step containing 'RareScreen' should be filtered (25%% < %d%% threshold), got: %+v", minConfidencePct, s)
			}
		}
	})

	// ------------------------------------------------------------------
	// Content validation: step descriptions, confidence_pct, thread_name
	// ------------------------------------------------------------------

	t.Run("step content has correct description and confidence_pct", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		fingerprint := "fp-content-validation-1234567"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		now := time.Now().UTC()
		excJSON := `[{"type":"IllegalStateException","message":"bad state","frames":[]}]`
		// Seed 1 session: navigation → crash with data
		sessionID := uuid.New().String()
		seedNavigationEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "DetailScreen", now.Add(-2*time.Second))
		seedIssueEventWithDataInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, excJSON, now)

		data, err := GetIssueGroupCommonPath(ctx, teamID, appID, group.GroupTypeCrash, fingerprint)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []struct {
				Description   string  `json:"description"`
				ThreadName    string  `json:"thread_name"`
				ConfidencePct float64 `json:"confidence_pct"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		if result.SessionsAnalyzed != 1 {
			t.Errorf("sessions_analyzed = %d, want 1", result.SessionsAnalyzed)
		}

		// With 1 session, every step should have 100% confidence
		for _, s := range result.Steps {
			if s.ConfidencePct != 100.0 {
				t.Errorf("step %q has confidence_pct=%.1f, want 100.0 (single session)", s.Description, s.ConfidencePct)
			}
		}

		// Check crash description includes exception data
		foundCrash := false
		foundNav := false
		for _, s := range result.Steps {
			if strings.Contains(s.Description, "Crash: IllegalStateException - bad state") {
				foundCrash = true
			}
			if strings.Contains(s.Description, "Navigated to screen: DetailScreen") {
				foundNav = true
			}
		}
		if !foundCrash {
			t.Errorf("expected step with 'Crash: IllegalStateException - bad state', got steps: %+v", result.Steps)
		}
		if !foundNav {
			t.Errorf("expected step with 'Navigated to screen: DetailScreen', got steps: %+v", result.Steps)
		}
	})
}
