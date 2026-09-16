//go:build integration

package measure

import (
	"errors"
	"math"
	"strings"
	"testing"
	"time"

	"backend/libs/filter"
	"backend/libs/opsys"
	"backend/testinfra"

	"github.com/google/uuid"
)

func TestValidMemoryAppImportance(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "all states", want: true},
		{name: "foreground", value: "foreground", want: true},
		{name: "user service", value: "user_service", want: true},
		{name: "background", value: "background", want: true},
		{name: "cached", value: "cached", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validMemoryAppImportance(tt.value); got != tt.want {
				t.Fatalf("validMemoryAppImportance(%q) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

func TestMemoryDistributionBucketLabel(t *testing.T) {
	tests := []struct {
		bucket uint64
		want   string
	}{
		{bucket: 0, want: "0-100"},
		{bucket: 8, want: "800-900"},
		{bucket: 9, want: "900+"},
		{bucket: 20, want: "900+"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := memoryDistributionBucketLabel(tt.bucket); got != tt.want {
				t.Fatalf("memoryDistributionBucketLabel(%d) = %q, want %q", tt.bucket, got, tt.want)
			}
		})
	}
}

func TestMemoryThresholdExpression(t *testing.T) {
	foreground := memoryThresholdExpression("device_memory", "foreground")
	if !strings.Contains(foreground, "device_memory >= 5242880 AND device_memory < 7340032, 2359296") {
		t.Fatalf("foreground threshold does not include the 5-7 GB device range: %s", foreground)
	}
	if !strings.Contains(foreground, "device_memory > 0 AND device_memory < 5242880") {
		t.Fatalf("unknown-memory devices must not match a threshold: %s", foreground)
	}
	if !strings.Contains(foreground, "device_memory >= 33554432, 10485760") || strings.Contains(foreground, "device_memory < 0") {
		t.Fatalf("32 GB and larger devices need an open-ended threshold: %s", foreground)
	}
	if !strings.HasSuffix(foreground, ", 0))") {
		t.Fatalf("threshold needs a no-threshold fallback: %s", foreground)
	}

	userService := memoryThresholdExpression("device_memory", "user_service")
	if !strings.Contains(userService, "device_memory >= 5242880 AND device_memory < 7340032, 1310720") {
		t.Fatalf("user-service threshold does not include the expected range: %s", userService)
	}
}

func TestValidateMemoryAppImportance(t *testing.T) {
	if err := validateMemoryAppImportance("foreground"); err != nil {
		t.Fatalf("foreground: %v", err)
	}
	if err := validateMemoryAppImportance("cached"); !errors.Is(err, ErrInvalidMemoryAppImportance) {
		t.Fatalf("cached importance error = %v, want ErrInvalidMemoryAppImportance", err)
	}
}

func TestGetHighMemoryUsageSessionsUsesP90AndProcessState(t *testing.T) {
	f := newPlotFixture(t)
	f.app.OSNames = []string{opsys.Android}
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	highForeground := uuid.New()
	lowForeground := uuid.New()
	highService := uuid.New()
	deviceMemory := uint64(5 * memoryKBPerGB)

	seedMemory := func(sessionID uuid.UUID, timestamp time.Time, anonRSS uint64, importance string) {
		t.Helper()
		th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
			Type:                "memory_usage",
			SessionID:           sessionID.String(),
			Timestamp:           timestamp,
			DeviceTotalMemory:   deviceMemory,
			MemoryAnonRSS:       anonRSS,
			MemoryAppImportance: importance,
		})
	}

	for i, memory := range []uint64{2 * memoryKBPerGB, 3 * memoryKBPerGB, 3 * memoryKBPerGB} {
		seedMemory(highForeground, base.Add(time.Duration(i)*time.Minute), memory, "foreground")
		seedMemory(lowForeground, base.Add(time.Duration(i)*time.Minute), 2*memoryKBPerGB, "foreground")
		seedMemory(highService, base.Add(time.Duration(i)*time.Minute), 3*memoryKBPerGB/2, "user_service")
	}

	flt := f.sessionFilter(base.Add(-time.Minute), base.Add(5*time.Minute), "UTC", "")
	foreground, _, _, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, "foreground")
	if err != nil {
		t.Fatalf("foreground sessions: %v", err)
	}
	if len(foreground) != 1 || foreground[0].SessionID != highForeground {
		t.Fatalf("foreground sessions = %#v, want only %s", foreground, highForeground)
	}
	if foreground[0].P90MemoryKB != 3*memoryKBPerGB || foreground[0].TargetMemoryKB != 9*memoryKBPerGB/4 {
		t.Fatalf("foreground P90/target = %d/%d", foreground[0].P90MemoryKB, foreground[0].TargetMemoryKB)
	}

	service, _, _, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, "user_service")
	if err != nil {
		t.Fatalf("user-service sessions: %v", err)
	}
	if len(service) != 1 || service[0].SessionID != highService {
		t.Fatalf("user-service sessions = %#v, want only %s", service, highService)
	}
}

func TestMemoryUsageQueries(t *testing.T) {
	for _, osName := range []string{opsys.Android, "iOS", opsys.IPad} {
		t.Run(osName, func(t *testing.T) {
			f := newPlotFixture(t)
			f.app.OSNames = []string{osName}
			base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
			sessionID := uuid.New()
			row := testinfra.EventRow{
				Type: "memory_usage_absolute", SessionID: sessionID.String(), Timestamp: base,
				OSName: osName, OSVersion: "18", DeviceName: "device",
				MemoryMax: 5 * memoryKBPerGB, MemoryUsed: 3 * memoryKBPerGB,
			}
			if osName == opsys.Android {
				row.Type = "memory_usage"
				row.DeviceTotalMemory = 5 * memoryKBPerGB
				row.MemoryAnonRSS = 2 * memoryKBPerGB
				row.MemorySwap = memoryKBPerGB
				row.MemoryAppImportance = "foreground"
			}
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 3, row)

			// Neither zero-usage samples nor the other platform's event may count.
			zero := row
			zero.MemoryUsed, zero.MemoryAnonRSS, zero.MemorySwap = 0, 0, 0
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, zero)
			other := row
			other.Type = "memory_usage"
			if osName == opsys.Android {
				other.Type = "memory_usage_absolute"
			}
			other.MemoryAnonRSS = 10 * memoryKBPerGB
			other.MemoryUsed = 10 * memoryKBPerGB
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, other)

			for _, filterName := range []string{"unfiltered", "where", "having", "excluded", "device-memory-known", "device-memory-unknown"} {
				t.Run(filterName, func(t *testing.T) {
					flt := f.sessionFilter(base.Add(-time.Minute), base.Add(time.Minute), "UTC", "")
					switch filterName {
					case "where":
						flt.ExprTree = &filter.ExprTree{Condition: &filter.Condition{KeyName: "version_name", Operator: filter.OperatorIn, Values: []filter.Value{{Text: "v1"}}}}
					case "having":
						flt.ExprTree = &filter.ExprTree{Children: []filter.ExprTree{
							{Condition: &filter.Condition{KeyName: "version_name", Operator: filter.OperatorNotIn, Values: []filter.Value{{Text: "v2"}}}},
							{Condition: &filter.Condition{KeyName: "device_name", Operator: filter.OperatorIn, Values: []filter.Value{{Text: "device"}}}},
						}, LogicalOperator: filter.LogicalAnd}
					case "excluded":
						flt.ExprTree = &filter.ExprTree{Condition: &filter.Condition{KeyName: "version_name", Operator: filter.OperatorNotIn, Values: []filter.Value{{Text: "v1"}}}}
					case "device-memory-known", "device-memory-unknown":
						tier := "5-6gb"
						if filterName == "device-memory-unknown" {
							tier = "unknown"
						}
						flt.ExprTree = &filter.ExprTree{Condition: &filter.Condition{KeyName: "device_total_memory", Operator: filter.OperatorIn, Values: []filter.Value{{Text: tier}}}}
					}
					importance := "foreground"
					if osName != opsys.Android {
						importance = ""
					}
					plot, err := f.app.GetMemoryUsagePlot(f.ctx, deps.RchPool, flt, importance)
					if err != nil {
						t.Fatalf("memory plot: %v", err)
					}
					breakdown, err := f.app.GetMemoryUsageBreakdown(f.ctx, deps.RchPool, flt, importance)
					if err != nil {
						t.Fatalf("memory breakdown: %v", err)
					}
					distribution, err := f.app.GetMemoryUsageDistribution(f.ctx, deps.RchPool, flt, importance)
					if err != nil {
						t.Fatalf("memory distribution: %v", err)
					}
					sessions, next, previous, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, importance)
					if err != nil {
						t.Fatalf("high-memory sessions: %v", err)
					}
					// This fixture models older iOS SDKs without the device-memory
					// session attribute, whose sessions match unknown in filters.
					excluded := filterName == "excluded" ||
						(filterName == "device-memory-known" && osName != opsys.Android) ||
						(filterName == "device-memory-unknown" && osName == opsys.Android)
					if excluded {
						if len(breakdown) != 0 || len(plot) != 0 || len(distribution) != 0 || len(sessions) != 0 || next || previous {
							t.Fatalf("excluded session returned data: %v / %v / %v", plot, distribution, sessions)
						}
						return
					}
					if len(plot) != 1 || plot[0].Version != "v1 (1)" || plot[0].SampleCount != 3 {
						t.Fatalf("plot = %#v, want one v1 (1) point with three samples", plot)
					}
					for _, quantile := range []*float64{plot[0].P50, plot[0].P90, plot[0].P95, plot[0].P99} {
						if quantile == nil || *quantile != float64(3*memoryKBPerGB) {
							t.Fatalf("quantile = %v, want 3 GiB in KiB", quantile)
						}
					}
					if len(breakdown) != 1 || breakdown[0].DeviceTotalMemoryTier != "5-6gb" || breakdown[0].SampleCount != 3 || breakdown[0].SessionCount != 1 {
						t.Fatalf("breakdown = %#v", breakdown)
					}
					for _, quantile := range []*float64{breakdown[0].P50, breakdown[0].P90, breakdown[0].P95} {
						if quantile == nil || *quantile != float64(3*memoryKBPerGB) {
							t.Fatalf("breakdown quantile = %v, want 3 GiB in KiB", quantile)
						}
					}
					if len(distribution) != 1 || distribution[0].Bucket != "900+" || distribution[0].SampleCount != 3 || distribution[0].Percentage != 100 {
						t.Fatalf("distribution = %#v", distribution)
					}
					if len(sessions) != 1 || sessions[0].SessionID != sessionID || next || previous {
						t.Fatalf("sessions = %#v, next/previous = %v/%v", sessions, next, previous)
					}
					s := sessions[0]
					if s.P90MemoryKB != 3*memoryKBPerGB || s.TargetMemoryKB != 9*memoryKBPerGB/4 || s.Attribute.DeviceTotalMemory != 5*memoryKBPerGB || math.Abs(s.PercentOfTarget-400.0/3) > 0.001 {
						t.Fatalf("unexpected session memory: %#v, RAM = %d", s, s.Attribute.DeviceTotalMemory)
					}
				})
			}
		})
	}
}

func TestMemoryUsageIOSSessionPagination(t *testing.T) {
	f := newPlotFixture(t)
	f.app.OSNames = []string{opsys.IOS}
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	ids := []uuid.UUID{uuid.New(), uuid.New()}
	for i, id := range ids {
		th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
			Type: "memory_usage_absolute", SessionID: id.String(), Timestamp: base,
			OSName: opsys.IOS, MemoryMax: 5 * memoryKBPerGB,
			MemoryUsed: uint64(4-i) * memoryKBPerGB,
		})
	}
	flt := f.sessionFilter(base.Add(-time.Minute), base.Add(time.Minute), "UTC", "")
	flt.Limit = 1
	for offset, id := range ids {
		flt.Offset = offset
		sessions, next, previous, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, "")
		if err != nil {
			t.Fatal(err)
		}
		if len(sessions) != 1 || sessions[0].SessionID != id || next != (offset == 0) || previous != (offset > 0) {
			t.Fatalf("offset %d: sessions = %#v, next/previous = %v/%v", offset, sessions, next, previous)
		}
	}
}

func TestMemoryUsageUnknownPlatform(t *testing.T) {
	app := App{}
	flt := &filter.Filter{Timezone: "UTC"}
	// A nil connection also verifies unsupported apps never reach ClickHouse.
	plot, err := app.GetMemoryUsagePlot(t.Context(), nil, flt, "")
	if err != nil || len(plot) != 0 {
		t.Fatalf("plot = %v, err = %v", plot, err)
	}
	breakdown, err := app.GetMemoryUsageBreakdown(t.Context(), nil, flt, "")
	if err != nil || len(breakdown) != 0 {
		t.Fatalf("breakdown = %v, err = %v", breakdown, err)
	}
	distribution, err := app.GetMemoryUsageDistribution(t.Context(), nil, flt, "")
	if err != nil || len(distribution) != 0 {
		t.Fatalf("distribution = %v, err = %v", distribution, err)
	}
	sessions, next, previous, err := app.GetHighMemoryUsageSessions(t.Context(), nil, flt, "")
	if err != nil || len(sessions) != 0 || next || previous {
		t.Fatalf("sessions = %v, next/previous = %v/%v, err = %v", sessions, next, previous, err)
	}
}

func TestMemoryUsageIOSForegroundThresholds(t *testing.T) {
	f := newPlotFixture(t)
	f.app.OSNames = []string{opsys.IOS}
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	highID := uuid.New()
	for _, sample := range []struct {
		sessionID uuid.UUID
		memory    uint64
		used      uint64
	}{
		{highID, 32 * memoryKBPerGB, 11 * memoryKBPerGB},
		{uuid.New(), 32 * memoryKBPerGB, 10 * memoryKBPerGB}, // exactly at target
		{uuid.New(), 5 * memoryKBPerGB, 2 * memoryKBPerGB},   // above background, below foreground
		{uuid.New(), 0, 11 * memoryKBPerGB},                  // unknown RAM has no target
	} {
		th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
			Type: "memory_usage_absolute", SessionID: sample.sessionID.String(), Timestamp: base,
			OSName: opsys.IOS, MemoryMax: sample.memory, MemoryUsed: sample.used,
		})
	}
	flt := f.sessionFilter(base.Add(-time.Minute), base.Add(time.Minute), "UTC", "")
	// Even an explicitly supplied Android state must not change iOS thresholds
	// or filter its events on an app_importance field they do not have.
	for _, importance := range []string{"", "foreground", "background", "user_service"} {
		sessions, _, _, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, importance)
		if err != nil {
			t.Fatal(err)
		}
		if len(sessions) != 1 || sessions[0].SessionID != highID || sessions[0].TargetMemoryKB != 10*memoryKBPerGB {
			t.Fatalf("importance %q: sessions = %#v", importance, sessions)
		}
		plot, err := f.app.GetMemoryUsagePlot(f.ctx, deps.RchPool, flt, importance)
		if err != nil {
			t.Fatal(err)
		}
		if len(plot) != 1 || plot[0].Version != "v1 (1)" || plot[0].SampleCount != 4 {
			t.Fatalf("importance %q: plot = %#v", importance, plot)
		}
		breakdown, err := f.app.GetMemoryUsageBreakdown(f.ctx, deps.RchPool, flt, importance)
		if err != nil {
			t.Fatal(err)
		}
		tiers := map[string]uint64{}
		for _, point := range breakdown {
			tiers[point.DeviceTotalMemoryTier] += point.SampleCount
		}
		if len(tiers) != 3 || tiers["32gb+"] != 2 || tiers["5-6gb"] != 1 || tiers["unknown"] != 1 {
			t.Fatalf("importance %q: tiers = %v", importance, tiers)
		}
		distribution, err := f.app.GetMemoryUsageDistribution(f.ctx, deps.RchPool, flt, importance)
		if err != nil || len(distribution) != 1 || distribution[0].SampleCount != 4 {
			t.Fatalf("importance %q: distribution = %v, err = %v", importance, distribution, err)
		}
	}
}

// The trend pools tiers within a version/time bucket, while the table pools
// versions and time buckets within a tier. Uneven sample counts ensure neither
// view is computed by averaging already-aggregated percentiles.
func TestMemoryUsageVersionTrendAndTierBreakdown(t *testing.T) {
	for _, osName := range []string{opsys.Android, opsys.IOS} {
		t.Run(osName, func(t *testing.T) {
			f := newPlotFixture(t)
			f.app.OSNames = []string{osName}
			base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
			firstSession := uuid.New()
			seed := func(id uuid.UUID, at time.Time, version, build string, ram, usage uint64, count int, importance string) {
				t.Helper()
				row := testinfra.EventRow{
					Type: "memory_usage_absolute", SessionID: id.String(), Timestamp: at,
					OSName: osName, AppVersion: version, AppBuild: build,
					MemoryMax: ram, MemoryUsed: usage,
				}
				if osName == opsys.Android {
					row.Type = "memory_usage"
					row.DeviceTotalMemory = ram
					row.MemoryAnonRSS = usage
					row.MemoryAppImportance = importance
				}
				th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), count, row)
			}
			seed(firstSession, base, "1.2.3", "1", 4*memoryKBPerGB, 100*1024, 9, "foreground")
			seed(firstSession, base.Add(time.Hour), "1.2.3", "1", 4*memoryKBPerGB, 1000*1024, 1, "foreground")
			seed(uuid.New(), base, "1.2.3", "1", 6*memoryKBPerGB, 200*1024, 1, "foreground")
			seed(uuid.New(), base, "1.2.3", "2", 6*memoryKBPerGB, 300*1024, 1, "foreground")
			seed(uuid.New(), base, "2.0.0", "3", 6*memoryKBPerGB, 400*1024, 1, "foreground")
			seed(uuid.New(), base.Add(-24*time.Hour), "old", "0", 4*memoryKBPerGB, 900*1024, 20, "foreground")
			if osName == opsys.Android {
				seed(uuid.New(), base, "background", "0", 4*memoryKBPerGB, 900*1024, 20, "background")
			}
			flt := f.sessionFilter(base.Add(-time.Minute), base.Add(2*time.Hour), "UTC", "")
			flt.PlotTimeGroup = filter.PlotTimeGroupHours
			plot, err := f.app.GetMemoryUsagePlot(f.ctx, deps.RchPool, flt, "foreground")
			if err != nil {
				t.Fatal(err)
			}
			if len(plot) != 4 {
				t.Fatalf("plot = %#v, want four version/time buckets", plot)
			}
			counts := map[string]uint64{}
			for _, point := range plot {
				counts[point.Version] += point.SampleCount
				if point.SampleCount == 10 && (point.P50 == nil || *point.P50 != 100*1024) {
					t.Fatalf("pooled median = %v, want 100 MB", point.P50)
				}
			}
			if counts["1.2.3 (1)"] != 11 || counts["1.2.3 (2)"] != 1 || counts["2.0.0 (3)"] != 1 {
				t.Fatalf("version sample counts = %v", counts)
			}
			breakdown, err := f.app.GetMemoryUsageBreakdown(f.ctx, deps.RchPool, flt, "foreground")
			if err != nil {
				t.Fatal(err)
			}
			if len(breakdown) != 2 {
				t.Fatalf("breakdown = %#v, want two tiers", breakdown)
			}
			low, high := breakdown[0], breakdown[1]
			if low.DeviceTotalMemoryTier != "0-4gb" || low.SampleCount != 10 || low.SessionCount != 1 || low.P50 == nil || *low.P50 != 100*1024 {
				t.Fatalf("low-memory tier = %#v, want 10 samples from one session with a 100 MB median", low)
			}
			if high.DeviceTotalMemoryTier != "5-6gb" || high.SampleCount != 3 || high.SessionCount != 3 || high.P50 == nil || *high.P50 != 300*1024 {
				t.Fatalf("high-memory tier = %#v, want samples across all three versions with a 300 MB median", high)
			}
		})
	}
}
