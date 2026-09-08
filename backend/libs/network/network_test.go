//go:build integration

package network

import (
	"backend/libs/exprfilter"
	"backend/testinfra"
	"context"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
)

func networkExprFilter(t *testing.T, appID, teamID uuid.UUID, from, to time.Time, filterExpr string) *exprfilter.ExprFilter {
	t.Helper()
	ef := &exprfilter.ExprFilter{
		AppID:      appID,
		TeamID:     teamID,
		Entity:     exprfilter.NetworkEntity,
		From:       from,
		To:         to,
		Timezone:   "UTC",
		Limit:      exprfilter.DefaultPaginationLimit,
		FilterExpr: filterExpr,
	}
	if err := ef.BuildExprTree(); err != nil {
		t.Fatalf("parse %q: %v", filterExpr, err)
	}
	if err := ef.Validate(); err != nil {
		t.Fatalf("validate %q: %v", filterExpr, err)
	}
	return ef
}

// --------------------------------------------------------------------------
// http_events queries
// --------------------------------------------------------------------------

func TestFetchEndpoints(t *testing.T) {
	ctx := context.Background()

	t.Run("browses only generated patterns when the search is empty", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/pattern")
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/raw-only", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := []Endpoint{{Domain: "api.example.com", PathPattern: "/v1/pattern"}}
		if !slices.Equal(endpoints, want) {
			t.Fatalf("endpoints = %v, want %v", endpoints, want)
		}
	})

	t.Run("returns a raw endpoint when the app has no patterns", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		appFilter := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/fallback", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "fallback", appFilter)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if want := (Endpoint{Domain: "api.example.com", PathPattern: "/v1/fallback"}); len(endpoints) != 1 || endpoints[0] != want {
			t.Fatalf("endpoints = %v, want [%v]", endpoints, want)
		}
	})

	t.Run("returns a raw endpoint when no generated pattern matches", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		appFilter := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/known")
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/raw-only", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "raw-only", appFilter)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if want := (Endpoint{Domain: "api.example.com", PathPattern: "/v1/raw-only"}); len(endpoints) != 1 || endpoints[0] != want {
			t.Fatalf("endpoints = %v, want [%v]", endpoints, want)
		}
	})

	t.Run("applies the dashboard time range and event filters", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "http_method:in:get")

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/visible", "GET", 200, 1, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/post", "POST", 200, 1, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/old", "GET", 200, 1, now.Add(-24*time.Hour))

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "v1", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if want := (Endpoint{Domain: "api.example.com", PathPattern: "/v1/visible"}); len(endpoints) != 1 || endpoints[0] != want {
			t.Fatalf("endpoints = %v, want [%v]", endpoints, want)
		}
	})

	t.Run("finds patterns and raw endpoints from a host and path prefix", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/products/*")
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/products/123", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "api.example.com/v1/product", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := []Endpoint{
			{Domain: "api.example.com", PathPattern: "/v1/products/*"},
			{Domain: "api.example.com", PathPattern: "/v1/products/123"},
		}
		if !slices.Equal(endpoints, want) {
			t.Fatalf("endpoints = %v, want %v", endpoints, want)
		}
	})

	t.Run("returns matching patterns before raw wildcard results", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users/*")
		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/orders/*")
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users/123", "GET", 200, 1, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/orders/456", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "api.example.com/v1/users/**", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := []Endpoint{
			{Domain: "api.example.com", PathPattern: "/v1/users/*"},
			{Domain: "api.example.com", PathPattern: "/v1/users/123"},
		}
		if !slices.Equal(endpoints, want) {
			t.Fatalf("endpoints = %v, want %v", endpoints, want)
		}
	})

	t.Run("returns generated patterns outside the active time range", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/stale/*")
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/stale/123", "GET", 200, 1, now.Add(-24*time.Hour))

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "stale", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := []Endpoint{{Domain: "api.example.com", PathPattern: "/v1/stale/*"}}
		if !slices.Equal(endpoints, want) {
			t.Fatalf("endpoints = %v, want %v", endpoints, want)
		}
	})

	t.Run("matches path wildcards across slashes", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users/123/profile", "GET", 200, 1, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users/123/settings/profile", "GET", 200, 1, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://other.example.com/v1/users/456/profile", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "api.example.com/v1/users/*/profile", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := []Endpoint{
			{Domain: "api.example.com", PathPattern: "/v1/users/123/profile"},
			{Domain: "api.example.com", PathPattern: "/v1/users/123/settings/profile"},
		}
		if !slices.Equal(endpoints, want) {
			t.Fatalf("endpoints = %v, want %v", endpoints, want)
		}
	})

	t.Run("matches descendants beneath a double wildcard", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 1, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users/123", "GET", 200, 1, now)
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users/123/orders", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "/v1/users/**", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := []Endpoint{
			{Domain: "api.example.com", PathPattern: "/v1/users/123"},
			{Domain: "api.example.com", PathPattern: "/v1/users/123/orders"},
		}
		if len(endpoints) != len(want) {
			t.Fatalf("endpoints = %v, want %v", endpoints, want)
		}
		for i := range want {
			if endpoints[i] != want[i] {
				t.Errorf("endpoint[%d] = %v, want %v", i, endpoints[i], want[i])
			}
		}
	})

	t.Run("returns raw endpoints from domains without matching patterns", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()
		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "patterns.example.com", "/v1/known")
		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://raw.example.com/v1/raw", "GET", 200, 1, now)

		endpoints, err := FetchEndpoints(ctx, deps.ChPool, appID, teamID, "raw.example.com/**", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if want := (Endpoint{Domain: "raw.example.com", PathPattern: "/v1/raw"}); len(endpoints) != 1 || endpoints[0] != want {
			t.Fatalf("endpoints = %v, want [%v]", endpoints, want)
		}
	})
}

func TestGetStatusCodesPlot(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)

	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 200, 10, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 301, 3, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 404, 5, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 500, 2, now)

	af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

	bucketExpr := "toStartOfHour(timestamp, ?)"
	datetimeFormat := "%Y-%m-%d %H:00:00"

	result, err := GetStatusCodesPlot(ctx, deps.ChPool, appID, teamID, "", "", af, bucketExpr, datetimeFormat)
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

func TestGetEndpointStatusCodesPlot(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)

	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 200, 10, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 201, 3, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/path", "GET", 404, 2, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/other", "GET", 500, 7, now)

	af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

	result, err := GetEndpointStatusCodesPlot(
		ctx,
		deps.ChPool,
		appID,
		teamID,
		"api.example.com",
		"/path",
		af,
		"toStartOfHour(timestamp, ?)",
		"%Y-%m-%d %H:00:00",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got, want := result.StatusCodes, []int{200, 201, 404}; !slices.Equal(got, want) {
		t.Fatalf("status codes = %v, want %v", got, want)
	}
	if len(result.DataPoints) != 1 {
		t.Fatalf("data points = %d, want 1", len(result.DataPoints))
	}

	dataPoint := result.DataPoints[0]
	if dataPoint["count_200"] != uint64(10) {
		t.Errorf("count_200 = %v, want 10", dataPoint["count_200"])
	}
	if dataPoint["count_201"] != uint64(3) {
		t.Errorf("count_201 = %v, want 3", dataPoint["count_201"])
	}
	if dataPoint["count_404"] != uint64(2) {
		t.Errorf("count_404 = %v, want 2", dataPoint["count_404"])
	}
	if dataPoint["total_count"] != uint64(15) {
		t.Errorf("total_count = %v, want 15", dataPoint["total_count"])
	}
}

func TestGetLatencyPlot(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)

	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

	af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

	bucketExpr := "toStartOfHour(timestamp, ?)"
	datetimeFormat := "%Y-%m-%d %H:00:00"

	result, err := GetLatencyPlot(ctx, deps.ChPool, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
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

func TestGetLatencyPlot_WildcardMatchesOnePathSegment(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/users/123/orders", "GET", 200, 11, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/users/a/b/orders", "GET", 200, 17, now)

	af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")
	result, err := GetLatencyPlot(
		ctx, deps.ChPool, appID, teamID, "api.example.com", "/users/*/orders", af,
		"toStartOfHour(timestamp, ?)", "%Y-%m-%d %H:00:00",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 data point, got %d", len(result))
	}
	if got := result[0]["count"]; got != uint64(11) {
		t.Errorf("count = %v, want 11", got)
	}
}

func TestGetLatencyPlot_HttpMethodFilter(t *testing.T) {
	ctx := context.Background()

	t.Run("matching method returns results", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(time.Hour)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "http_method:in:get")

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetLatencyPlot(ctx, deps.ChPool, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
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

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "http_method:in:post")

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetLatencyPlot(ctx, deps.ChPool, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 0 {
			t.Fatalf("expected 0 data points, got %d", len(result))
		}
	})
}

func TestGetLatencyPlot_AppVersionFilter(t *testing.T) {
	ctx := context.Background()

	t.Run("matching version returns results", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(time.Hour)

		seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://api.example.com/v1/users", "GET", 200, 20, now)

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "version_name:in:v1 AND version_code:in:1")

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetLatencyPlot(ctx, deps.ChPool, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
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

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "version_name:in:v2 AND version_code:in:2")

		bucketExpr := "toStartOfHour(timestamp, ?)"
		datetimeFormat := "%Y-%m-%d %H:00:00"

		result, err := GetLatencyPlot(ctx, deps.ChPool, appID, teamID, "api.example.com", "/v1/users", af, bucketExpr, datetimeFormat)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 0 {
			t.Fatalf("expected 0 data points, got %d", len(result))
		}
	})
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
		seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users", "", uuid.Nil, 100, 95, 3, 2, now)
		// Endpoint B: low request count, high errors
		seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/orders", "", uuid.Nil, 10, 2, 5, 3, now)

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		resp, err := FetchTrends(ctx, deps.ChPool, appID, teamID, af, 10)
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

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		resp, err := FetchTrends(ctx, deps.ChPool, appID, teamID, af, 10)
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

func TestFetchTimelinePlot_Unscoped(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(15 * time.Minute)

	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users", "", uuid.Nil, 50, 50, 0, 0, now)

	af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

	resp, err := FetchTimelinePlot(ctx, deps.ChPool, appID, teamID, "", "", af)
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

func TestFetchTimelinePlot(t *testing.T) {
	ctx := context.Background()

	t.Run("returns timeline for existing pattern", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC().Truncate(15 * time.Minute)

		seedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users")
		seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users", "", uuid.Nil, 50, 50, 0, 0, now)

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		resp, err := FetchTimelinePlot(ctx, deps.ChPool, appID, teamID, "api.example.com", "/v1/users", af)
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

	t.Run("non-existent pattern returns no points", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		now := time.Now().UTC()

		af := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), "")

		resp, err := FetchTimelinePlot(ctx, deps.ChPool, appID, teamID, "nonexistent.com", "/v1/nope", af)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp == nil {
			t.Fatal("expected an empty response, got nil")
		}
		if len(resp.Points) != 0 {
			t.Errorf("expected no points, got %+v", resp.Points)
		}
	})
}

func TestGetLatencyPlot_PatchFilter(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(time.Hour)
	patchID := uuid.New()

	// http_events collapses rows sharing a domain and timestamp.
	seedRequest := func(offset int, patch uuid.UUID, patchVersion string) {
		th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
			Type:           "http",
			Timestamp:      now.Add(time.Duration(offset) * time.Second),
			HttpURL:        "https://api.example.com/v1/users",
			HttpMethod:     "GET",
			HttpStatusCode: 200,
			HttpStartTime:  1000,
			HttpEndTime:    1100,
			PatchID:        patch,
			PatchVersion:   patchVersion,
		})
	}
	seedRequest(0, patchID, "1.0-patch.2")
	seedRequest(1, patchID, "1.0-patch.2")
	seedRequest(2, uuid.Nil, "")

	count := func(t *testing.T, filterExpr string) uint64 {
		t.Helper()
		ef := networkExprFilter(t, appID, teamID, now.Add(-time.Hour), now.Add(time.Hour), filterExpr)
		result, err := GetLatencyPlot(
			ctx, deps.ChPool, appID, teamID, "api.example.com", "/v1/users", ef,
			"toStartOfHour(timestamp, ?)", "%Y-%m-%d %H:00:00",
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 1 {
			t.Fatalf("expected 1 data point for %q, got %d", filterExpr, len(result))
		}
		return result[0]["count"].(uint64)
	}

	if got := count(t, ""); got != 3 {
		t.Errorf("unfiltered count = %d, want 3", got)
	}
	if got := count(t, "patch_id:in:"+patchID.String()); got != 2 {
		t.Errorf("patch_id count = %d, want 2", got)
	}
	if got := count(t, "patch_version:in:1.0-patch.2"); got != 2 {
		t.Errorf("patch_version count = %d, want 2", got)
	}
	if got := count(t, "patch_id:is_not_set"); got != 1 {
		t.Errorf("is_not_set count = %d, want 1", got)
	}
}

func TestHttpMetricsPatchFilter(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	now := time.Now().UTC().Truncate(15 * time.Minute)
	patchID := uuid.New()

	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/users", "1.0-patch.2", patchID, 50, 50, 0, 0, now)
	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "api.example.com", "/v1/orders", "", uuid.Nil, 20, 20, 0, 0, now)

	from, to := now.Add(-time.Hour), now.Add(time.Hour)

	timelinePaths := func(t *testing.T, filterExpr string) []string {
		t.Helper()
		ef := networkExprFilter(t, appID, teamID, from, to, filterExpr)
		resp, err := FetchTimelinePlot(ctx, deps.ChPool, appID, teamID, "", "", ef)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		paths := []string{}
		for _, point := range resp.Points {
			if !slices.Contains(paths, point.PathPattern) {
				paths = append(paths, point.PathPattern)
			}
		}
		return paths
	}

	if got := timelinePaths(t, ""); len(got) != 2 {
		t.Errorf("unfiltered timeline paths = %v, want both endpoints", got)
	}
	if got := timelinePaths(t, "patch_id:in:"+patchID.String()); len(got) != 1 || got[0] != "/v1/users" {
		t.Errorf("patch_id timeline paths = %v, want [/v1/users]", got)
	}
	if got := timelinePaths(t, "patch_version:in:1.0-patch.2"); len(got) != 1 || got[0] != "/v1/users" {
		t.Errorf("patch_version timeline paths = %v, want [/v1/users]", got)
	}
	if got := timelinePaths(t, "patch_id:is_not_set"); len(got) != 1 || got[0] != "/v1/orders" {
		t.Errorf("is_not_set timeline paths = %v, want [/v1/orders]", got)
	}

	trends, err := FetchTrends(ctx, deps.ChPool, appID, teamID, networkExprFilter(t, appID, teamID, from, to, "patch_id:in:"+patchID.String()), 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(trends.TrendsFrequency) != 1 || trends.TrendsFrequency[0].PathPattern != "/v1/users" {
		t.Errorf("patch_id trends = %v, want only the patched endpoint", trends.TrendsFrequency)
	}
}
