//go:build integration

package network

import (
	"backend/api/filter"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// http_events queries
// --------------------------------------------------------------------------

func TestFetchDomains(t *testing.T) {
	ctx := context.Background()

	t.Run("returns domains ordered by count DESC", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		// Seed more events for domain-b so it should appear first
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://domain-a.com/path", "GET", 200, 5, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://domain-b.com/path", "GET", 200, 10, now)

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		domains, err := FetchDomains(ctx, appID, teamID, from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(domains) != 2 {
			t.Fatalf("expected 2 domains, got %d", len(domains))
		}
		if domains[0] != "domain-b.com" {
			t.Errorf("expected first domain domain-b.com, got %s", domains[0])
		}
		if domains[1] != "domain-a.com" {
			t.Errorf("expected second domain domain-a.com, got %s", domains[1])
		}
	})

	t.Run("no events returns empty slice", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		domains, err := FetchDomains(ctx, appID, teamID, from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if domains != nil {
			t.Errorf("expected nil, got %v", domains)
		}
	})

	t.Run("events outside time range are excluded", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		old := now.AddDate(0, 0, -31)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://old-domain.com/path", "GET", 200, 5, old)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://new-domain.com/path", "GET", 200, 5, now)

		// Query a range that only includes recent events
		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		domains, err := FetchDomains(ctx, appID, teamID, from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(domains) != 1 {
			t.Errorf("expected 1 domain, got %d: %v", len(domains), domains)
		}
	})

	t.Run("time range is clamped to minimum of 1 week", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		threeDaysAgo := now.AddDate(0, 0, -3)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://recent-domain.com/path", "GET", 200, 5, threeDaysAgo)

		// Pass a 1-hour range that would normally miss the 3-day-old event,
		// but the 1-week minimum clamp should include it.
		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		domains, err := FetchDomains(ctx, appID, teamID, from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(domains) != 1 {
			t.Errorf("expected 1 domain due to 1-week clamp, got %d: %v", len(domains), domains)
		}
	})
}

func TestFetchPaths(t *testing.T) {
	ctx := context.Background()

	t.Run("returns paths from url_patterns ordered by path", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users")
		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/orders")
		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/items")

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		paths, err := FetchPaths(ctx, appID, teamID, "api.example.com", "", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(paths) != 3 {
			t.Fatalf("expected 3 paths, got %d", len(paths))
		}
		// Should be alphabetical: items, orders, users
		if paths[0] != "/v1/items" {
			t.Errorf("expected /v1/items, got %s", paths[0])
		}
		if paths[1] != "/v1/orders" {
			t.Errorf("expected /v1/orders, got %s", paths[1])
		}
		if paths[2] != "/v1/users" {
			t.Errorf("expected /v1/users, got %s", paths[2])
		}
	})

	t.Run("search filter on patterns", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users")
		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/orders")

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		paths, err := FetchPaths(ctx, appID, teamID, "api.example.com", "user", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(paths) != 1 {
			t.Fatalf("expected 1 path, got %d: %v", len(paths), paths)
		}
		if paths[0] != "/v1/users" {
			t.Errorf("expected /v1/users, got %s", paths[0])
		}
	})

	t.Run("fallback to http_events when no patterns match search", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		// No url_patterns, but seed http_events
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/fallback", "GET", 200, 5, now)

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		paths, err := FetchPaths(ctx, appID, teamID, "api.example.com", "fallback", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(paths) != 1 {
			t.Fatalf("expected 1 path, got %d: %v", len(paths), paths)
		}
		if paths[0] != "/v1/fallback" {
			t.Errorf("expected /v1/fallback, got %s", paths[0])
		}
	})

	t.Run("fallback to http_events when no patterns exist and no search query", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		// No url_patterns, but seed http_events
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/all-paths", "GET", 200, 5, now)

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		paths, err := FetchPaths(ctx, appID, teamID, "api.example.com", "", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(paths) != 1 {
			t.Fatalf("expected 1 path, got %d: %v", len(paths), paths)
		}
		if paths[0] != "/v1/all-paths" {
			t.Errorf("expected /v1/all-paths, got %s", paths[0])
		}
	})

	t.Run("fallback time range is clamped to minimum of 1 week", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		threeDaysAgo := now.AddDate(0, 0, -3)

		// Seed http_event 3 days ago, no url_patterns
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/old-path", "GET", 200, 5, threeDaysAgo)

		// Pass a 1-hour range that would normally miss the 3-day-old event,
		// but the 1-week minimum clamp should include it.
		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		paths, err := FetchPaths(ctx, appID, teamID, "api.example.com", "old-path", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(paths) != 1 {
			t.Errorf("expected 1 path due to 1-week clamp, got %d: %v", len(paths), paths)
		}
	})

	t.Run("fallback excludes events outside clamped time range", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		old := now.AddDate(0, 0, -31)

		// Seed http_event 31 days ago (outside 1-week clamp), no url_patterns
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/ancient", "GET", 200, 5, old)

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		paths, err := FetchPaths(ctx, appID, teamID, "api.example.com", "ancient", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if paths != nil {
			t.Errorf("expected nil for events outside clamped range, got %v", paths)
		}
	})

	t.Run("no results returns empty", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		from := now.Add(-1 * time.Hour)
		to := now.Add(1 * time.Hour)
		paths, err := FetchPaths(ctx, appID, teamID, "nonexistent.com", "", from, to)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if paths != nil {
			t.Errorf("expected nil, got %v", paths)
		}
	})
}

func TestGetNetworkOverviewStatusCodesPlot(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)

	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 200, 10, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 301, 3, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 404, 5, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 500, 2, now)

	af := &filter.AppFilter{
		AppID:    appID,
		From:     now.Add(-1 * time.Hour),
		To:       now.Add(1 * time.Hour),
		Timezone: "UTC",
	}

	bucketExpr := "toStartOfHour(timestamp, ?)"
	datetimeFormat := "%Y-%m-%d %H:00:00"

	result, err := GetNetworkOverviewStatusCodesPlot(ctx, appID, teamID, af, bucketExpr, datetimeFormat)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 data point, got %d", len(result))
	}

	dp := result[0]
	if dp["count_2xx"] != uint64(10) {
		t.Errorf("count_2xx = %v, want 10", dp["count_2xx"])
	}
	if dp["count_3xx"] != uint64(3) {
		t.Errorf("count_3xx = %v, want 3", dp["count_3xx"])
	}
	if dp["count_4xx"] != uint64(5) {
		t.Errorf("count_4xx = %v, want 5", dp["count_4xx"])
	}
	if dp["count_5xx"] != uint64(2) {
		t.Errorf("count_5xx = %v, want 2", dp["count_5xx"])
	}
	if dp["total_count"] != uint64(20) {
		t.Errorf("total_count = %v, want 20", dp["total_count"])
	}
}

func TestGetEndpointLatencyPlot(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)

	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

	af := &filter.AppFilter{
		AppID:    appID,
		From:     now.Add(-1 * time.Hour),
		To:       now.Add(1 * time.Hour),
		Timezone: "UTC",
	}

	bucketExpr := "toStartOfHour(timestamp, ?)"
	datetimeFormat := "%Y-%m-%d %H:00:00"

	result, err := GetEndpointLatencyPlot(ctx, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 data point, got %d", len(result))
	}

	dp := result[0]
	// SeedHttpEvent uses fixed 100ms latency (start=1000, end=1100)
	if dp["p50"] != 100.0 {
		t.Errorf("p50 = %v, want 100", dp["p50"])
	}
	if dp["p90"] != 100.0 {
		t.Errorf("p90 = %v, want 100", dp["p90"])
	}
	if dp["p95"] != 100.0 {
		t.Errorf("p95 = %v, want 100", dp["p95"])
	}
	if dp["p99"] != 100.0 {
		t.Errorf("p99 = %v, want 100", dp["p99"])
	}
	if dp["count"] != uint64(20) {
		t.Errorf("count = %v, want 20", dp["count"])
	}
}

func TestGetEndpointLatencyPlot_HttpMethodFilter(t *testing.T) {
	ctx := context.Background()

	t.Run("matching method returns results", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(time.Hour)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

		af := &filter.AppFilter{
			AppID:       appID,
			From:        now.Add(-1 * time.Hour),
			To:          now.Add(1 * time.Hour),
			Timezone:    "UTC",
			HttpMethods: []string{"GET"},
		}

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetEndpointLatencyPlot(ctx, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 1 {
			t.Fatalf("expected 1 data point, got %d", len(result))
		}
	})

	t.Run("non-matching method returns empty", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(time.Hour)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

		af := &filter.AppFilter{
			AppID:       appID,
			From:        now.Add(-1 * time.Hour),
			To:          now.Add(1 * time.Hour),
			Timezone:    "UTC",
			HttpMethods: []string{"POST"},
		}

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetEndpointLatencyPlot(ctx, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 0 {
			t.Fatalf("expected 0 data points, got %d", len(result))
		}
	})
}

func TestGetEndpointLatencyPlot_AppVersionFilter(t *testing.T) {
	ctx := context.Background()

	t.Run("matching version returns results", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(time.Hour)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

		af := &filter.AppFilter{
			AppID:        appID,
			From:         now.Add(-1 * time.Hour),
			To:           now.Add(1 * time.Hour),
			Timezone:     "UTC",
			Versions:     []string{"v1"},
			VersionCodes: []string{"1"},
		}

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetEndpointLatencyPlot(ctx, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 1 {
			t.Fatalf("expected 1 data point, got %d", len(result))
		}
	})

	t.Run("non-matching version returns empty", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(time.Hour)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

		af := &filter.AppFilter{
			AppID:        appID,
			From:         now.Add(-1 * time.Hour),
			To:           now.Add(1 * time.Hour),
			Timezone:     "UTC",
			Versions:     []string{"v2"},
			VersionCodes: []string{"2"},
		}

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetEndpointLatencyPlot(ctx, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 0 {
			t.Fatalf("expected 0 data points, got %d", len(result))
		}
	})
}

func TestGetEndpointStatusCodesPlot(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)

	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 8, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 404, 3, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 500, 1, now)

	af := &filter.AppFilter{
		AppID:    appID,
		From:     now.Add(-1 * time.Hour),
		To:       now.Add(1 * time.Hour),
		Timezone: "UTC",
	}

	bucketExpr := "toStartOfHour(timestamp, ?)"
	datetimeFormat := "%Y-%m-%d %H:00:00"

	resp, err := GetEndpointStatusCodesPlot(ctx, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify status codes
	expectedCodes := []int{200, 404, 500}
	if len(resp.StatusCodes) != len(expectedCodes) {
		t.Fatalf("expected status codes %v, got %v", expectedCodes, resp.StatusCodes)
	}
	for i, code := range expectedCodes {
		if resp.StatusCodes[i] != code {
			t.Errorf("status_codes[%d] = %d, want %d", i, resp.StatusCodes[i], code)
		}
	}

	// Verify data points
	if len(resp.DataPoints) != 1 {
		t.Fatalf("expected 1 data point, got %d", len(resp.DataPoints))
	}

	dp := resp.DataPoints[0]
	if dp["count_200"] != uint64(8) {
		t.Errorf("count_200 = %v, want 8", dp["count_200"])
	}
	if dp["count_404"] != uint64(3) {
		t.Errorf("count_404 = %v, want 3", dp["count_404"])
	}
	if dp["count_500"] != uint64(1) {
		t.Errorf("count_500 = %v, want 1", dp["count_500"])
	}
	if dp["total_count"] != uint64(12) {
		t.Errorf("total_count = %v, want 12", dp["total_count"])
	}
}

// --------------------------------------------------------------------------
// http_metrics queries
// --------------------------------------------------------------------------

func TestFetchTrends(t *testing.T) {
	ctx := context.Background()

	t.Run("returns trends sorted correctly", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(15 * time.Minute)

		// Endpoint A: high request count, low errors
		seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users", 100, 95, 3, 2, now)
		// Endpoint B: low request count, high errors
		seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/orders", 10, 2, 5, 3, now)

		af := &filter.AppFilter{
			AppID: appID,
			From:  now.Add(-1 * time.Hour),
			To:    now.Add(1 * time.Hour),
		}

		resp, err := FetchTrends(ctx, appID, teamID, af, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Frequency: /v1/users (100) should be first
		if len(resp.TrendsFrequency) != 2 {
			t.Fatalf("expected 2 frequency trends, got %d", len(resp.TrendsFrequency))
		}
		if resp.TrendsFrequency[0].PathPattern != "/v1/users" {
			t.Errorf("expected /v1/users first by frequency, got %s", resp.TrendsFrequency[0].PathPattern)
		}

		// Error rate: /v1/orders (80%) should be first
		if len(resp.TrendsErrorRate) != 2 {
			t.Fatalf("expected 2 error rate trends, got %d", len(resp.TrendsErrorRate))
		}
		if resp.TrendsErrorRate[0].PathPattern != "/v1/orders" {
			t.Errorf("expected /v1/orders first by error rate, got %s", resp.TrendsErrorRate[0].PathPattern)
		}
	})

	t.Run("no data returns empty lists", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		af := &filter.AppFilter{
			AppID: appID,
			From:  now.Add(-1 * time.Hour),
			To:    now.Add(1 * time.Hour),
		}

		resp, err := FetchTrends(ctx, appID, teamID, af, 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(resp.TrendsLatency) != 0 {
			t.Errorf("expected 0 latency trends, got %d", len(resp.TrendsLatency))
		}
		if len(resp.TrendsErrorRate) != 0 {
			t.Errorf("expected 0 error rate trends, got %d", len(resp.TrendsErrorRate))
		}
		if len(resp.TrendsFrequency) != 0 {
			t.Errorf("expected 0 frequency trends, got %d", len(resp.TrendsFrequency))
		}
	})
}

func TestFetchOverviewTimelinePlot(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(15 * time.Minute)

	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users", 50, 50, 0, 0, now)

	af := &filter.AppFilter{
		AppID: appID,
		From:  now.Add(-1 * time.Hour),
		To:    now.Add(1 * time.Hour),
	}

	resp, err := FetchOverviewTimelinePlot(ctx, appID, teamID, af, defaultOverviewTimelineMax)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Interval != 5 {
		t.Errorf("expected interval 5, got %d", resp.Interval)
	}

	if len(resp.Points) == 0 {
		t.Fatal("expected non-empty points")
	}

	// Points should be sorted by Elapsed
	for i := 1; i < len(resp.Points); i++ {
		if resp.Points[i].Elapsed < resp.Points[i-1].Elapsed {
			t.Errorf("points not sorted by elapsed: %d < %d at index %d", resp.Points[i].Elapsed, resp.Points[i-1].Elapsed, i)
		}
	}
}

func TestFetchEndpointTimelinePlot(t *testing.T) {
	ctx := context.Background()

	t.Run("returns timeline for existing pattern", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(15 * time.Minute)

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users")
		seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users", 50, 50, 0, 0, now)

		af := &filter.AppFilter{
			AppID: appID,
			From:  now.Add(-1 * time.Hour),
			To:    now.Add(1 * time.Hour),
		}

		resp, err := FetchEndpointTimelinePlot(ctx, appID, teamID, "api.example.com", "/v1/users", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp == nil {
			t.Fatal("expected non-nil response")
		}
		if resp.Interval != 5 {
			t.Errorf("expected interval 5, got %d", resp.Interval)
		}

		// Verify the points contain the correct domain/path
		for _, p := range resp.Points {
			if p.Domain != "api.example.com" {
				t.Errorf("expected domain api.example.com, got %s", p.Domain)
			}
			if p.PathPattern != "/v1/users" {
				t.Errorf("expected path /v1/users, got %s", p.PathPattern)
			}
		}
	})

	t.Run("non-existent pattern returns nil", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		af := &filter.AppFilter{
			AppID: appID,
			From:  now.Add(-1 * time.Hour),
			To:    now.Add(1 * time.Hour),
		}

		resp, err := FetchEndpointTimelinePlot(ctx, appID, teamID, "nonexistent.com", "/v1/nope", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp != nil {
			t.Errorf("expected nil response, got %+v", resp)
		}
	})
}
