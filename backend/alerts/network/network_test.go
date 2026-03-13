//go:build integration

package network

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func patternDomainPath(p UrlPattern) (string, string) {
	if len(p.Parts) == 0 {
		return "", ""
	}
	return p.Parts[0], "/" + strings.Join(p.Parts[1:], "/")
}

// --------------------------------------------------------------------------
// GeneratePatterns tests
// --------------------------------------------------------------------------

func TestGeneratePatterns_NoEventsCreatesNoPatterns(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	GeneratePatterns(ctx)

	if got := countUrlPatterns(ctx, t, teamID, appID); got != 0 {
		t.Errorf("want 0 url_patterns, got %d", got)
	}
}

func TestGeneratePatterns_EventsBelowThresholdCreatesNoPatterns(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	now := time.Now().UTC()

	th.SeedHttpEvent(ctx, t, teamID, appID, "https://api.example.com/api/v1/users", "GET", 200, 50, now.Add(-30*time.Minute))

	GeneratePatterns(ctx)

	if got := countUrlPatterns(ctx, t, teamID, appID); got != 0 {
		t.Errorf("want 0 url_patterns (below threshold), got %d", got)
	}
}

func TestGeneratePatterns_EventsAboveThresholdCreatesPatterns(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	now := time.Now().UTC()
	th.SeedHttpEvent(ctx, t, teamID, appID, "https://api.example.com/api/v1/users", "GET", 200, 150, now.Add(-30*time.Minute))

	GeneratePatterns(ctx)

	patterns := getUrlPatterns(ctx, t, teamID, appID)
	if len(patterns) == 0 {
		t.Fatal("expected at least 1 url_pattern, got 0")
	}

	found := false
	for _, p := range patterns {
		domain, path := patternDomainPath(p)
		if domain == "api.example.com" && path == "/api/v1/users" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected pattern with domain=api.example.com path=/api/v1/users, got %+v", patterns)
	}
}

func TestGeneratePatterns_ExistingPatternWithTrafficIsRetained(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	th.SeedUrlPattern(ctx, t, teamID, appID, "api.example.com", "/api/v1/users")

	now := time.Now().UTC()
	th.SeedHttpEvent(ctx, t, teamID, appID, "https://api.example.com/api/v1/users", "GET", 200, 10, now.Add(-30*time.Minute))

	GeneratePatterns(ctx)

	patterns := getUrlPatterns(ctx, t, teamID, appID)
	found := false
	for _, p := range patterns {
		domain, path := patternDomainPath(p)
		if domain == "api.example.com" && path == "/api/v1/users" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("existing pattern with traffic should be retained, got %+v", patterns)
	}
}

func TestGeneratePatterns_ExistingPatternSeedsTrie(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	th.SeedUrlPattern(ctx, t, teamID, appID, "api.example.com", "/api/*/orders")

	now := time.Now().UTC()
	th.SeedHttpEvent(ctx, t, teamID, appID, "https://api.example.com/api/5/orders", "GET", 200, 10, now.Add(-30*time.Minute))

	GeneratePatterns(ctx)

	patterns := getUrlPatterns(ctx, t, teamID, appID)
	foundWildcard := false
	foundLiteral := false
	for _, p := range patterns {
		domain, path := patternDomainPath(p)
		if domain == "api.example.com" && path == "/api/*/orders" {
			foundWildcard = true
		}
		if domain == "api.example.com" && path == "/api/5/orders" {
			foundLiteral = true
		}
	}
	if !foundWildcard {
		t.Errorf("existing wildcard pattern should be retained, got %+v", patterns)
	}
	if foundLiteral {
		t.Error("literal path should collapse into existing wildcard pattern")
	}
}

// --------------------------------------------------------------------------
// GenerateMetrics tests
// --------------------------------------------------------------------------

func TestGenerateMetrics_NoEventsSucceeds(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	// Should not panic or error
	GenerateMetrics(ctx)

	ts := getMetricsReportedAt(ctx, t, teamID, appID)
	if ts == nil {
		t.Error("metrics_reported_at should be set even with no events")
	}
}

func TestGenerateMetrics_InsertsAggregatedMetrics(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	now := time.Now().UTC()

	th.SeedUrlPattern(ctx, t, teamID, appID, "api.example.com", "/api/v1/users")
	th.SeedHttpEvent(ctx, t, teamID, appID, "https://api.example.com/api/v1/users", "GET", 200, 10, now.Add(-30*time.Minute))

	GenerateMetrics(ctx)

	if got := countHttpMetrics(ctx, t, teamID, appID); got == 0 {
		t.Error("expected http_metrics rows after GenerateMetrics, got 0")
	}
}

func TestGenerateMetrics_UpdatesMetricsReportedAtTimestamp(t *testing.T) {
	ctx := context.Background()
	setupTest(ctx, t)
	defer th.CleanupAll(ctx, t)

	teamID := uuid.New().String()
	appID := uuid.New().String()

	th.SeedTeam(ctx, t, teamID, "Test Team", true)
	th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

	GenerateMetrics(ctx)

	first := getMetricsReportedAt(ctx, t, teamID, appID)
	if first == nil {
		t.Fatal("first metrics_reported_at should be set")
	}

	GenerateMetrics(ctx)

	second := getMetricsReportedAt(ctx, t, teamID, appID)
	if second == nil {
		t.Fatal("second metrics_reported_at should be set")
	}
	if !second.After(*first) {
		t.Errorf("second metrics_reported_at (%v) should be after first (%v)", second, first)
	}
}
