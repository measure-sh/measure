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
		{name: "empty is not a state", want: false},
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

func TestAndroidMemoryTargetExpression(t *testing.T) {
	for _, tier := range filter.DeviceMemoryRanges {
		if _, ok := androidMemoryTargets[tier.Name]; !ok {
			t.Errorf("device memory tier %q has no Android target", tier.Name)
		}
	}
	foreground := androidMemoryTargetExpression("device_memory", "foreground")
	if !strings.Contains(foreground, "device_memory >= 5242880 AND device_memory < 7340032, 2359296") {
		t.Fatalf("foreground target does not include the 5-7 GB device range: %s", foreground)
	}
	if !strings.Contains(foreground, "device_memory > 0 AND device_memory < 5242880") {
		t.Fatalf("unknown-memory devices must not match a target: %s", foreground)
	}
	if !strings.Contains(foreground, "device_memory >= 34603008, 10485760") || strings.Contains(foreground, "device_memory < 0") {
		t.Fatalf("33 GB and larger devices need an open-ended target: %s", foreground)
	}
	if !strings.HasSuffix(foreground, ", 0))") {
		t.Fatalf("target needs a no-target fallback: %s", foreground)
	}

	userService := androidMemoryTargetExpression("device_memory", "user_service")
	if !strings.Contains(userService, "device_memory >= 5242880 AND device_memory < 7340032, 1310720") {
		t.Fatalf("user-service target does not include the expected range: %s", userService)
	}
	for _, tt := range []struct {
		ramGB  uint64
		wantKB uint64
	}{
		{16, 17 * memoryKBPerGB / 4},
		{17, 6 * memoryKBPerGB},
		{32, 6 * memoryKBPerGB},
		{33, 10 * memoryKBPerGB},
	} {
		var got uint64
		if err := deps.RchPool.QueryRow(t.Context(), "SELECT "+foreground+" FROM (SELECT toUInt64(?) AS device_memory)", tt.ramGB*memoryKBPerGB).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != tt.wantKB {
			t.Errorf("%d GB device target = %d KiB, want %d", tt.ramGB, got, tt.wantKB)
		}
	}
}

func TestResolveMemoryAppImportance(t *testing.T) {
	tests := []struct {
		name    string
		os      string
		value   string
		want    string
		wantErr bool
	}{
		{name: "Android defaults to foreground", os: opsys.Android, want: "foreground"},
		{name: "Android foreground", os: opsys.Android, value: "foreground", want: "foreground"},
		{name: "Android user service", os: opsys.Android, value: "user_service", want: "user_service"},
		{name: "Android background", os: opsys.Android, value: "background", want: "background"},
		{name: "Android rejects invalid state", os: opsys.Android, value: "cached", wantErr: true},
		{name: "iOS accepts omission", os: opsys.IOS},
		{name: "iOS ignores Android state", os: opsys.IOS, value: "background"},
		{name: "iOS ignores arbitrary input", os: opsys.IOS, value: "unused"},
		{name: "iPadOS ignores Android state", os: opsys.IPad, value: "foreground"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := App{OSNames: []string{tt.os}}
			got, err := app.resolveMemoryAppImportance(tt.value)
			if tt.wantErr {
				if !errors.Is(err, ErrInvalidMemoryAppImportance) {
					t.Fatalf("error = %v, want ErrInvalidMemoryAppImportance", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Errorf("resolved importance = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGetHighMemoryUsageSessionsUsesPeakAndProcessState(t *testing.T) {
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
			MemoryAnonRSS:       memoryKB(anonRSS),
			MemorySwap:          memoryKB(0),
			MemoryAppImportance: importance,
		})
	}

	for i, memory := range []uint64{2 * memoryKBPerGB, 3 * memoryKBPerGB, 3 * memoryKBPerGB} {
		seedMemory(highForeground, base.Add(time.Duration(i)*time.Minute), memory, "foreground")
		seedMemory(lowForeground, base.Add(time.Duration(i)*time.Minute), memoryKBPerGB, "foreground")
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
	if got := foreground[0].PeakMemoryKB; got != 3*memoryKBPerGB {
		t.Errorf("foreground peak = %d KiB, want %d", got, 3*memoryKBPerGB)
	}
	if foreground[0].TargetMemoryKB == nil {
		t.Fatal("missing foreground memory target")
	}
	if got := *foreground[0].TargetMemoryKB; got != 9*memoryKBPerGB/4 {
		t.Errorf("foreground target = %d KiB, want %d", got, 9*memoryKBPerGB/4)
	}

	service, _, _, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, "user_service")
	if err != nil {
		t.Fatalf("user-service sessions: %v", err)
	}
	if len(service) != 1 || service[0].SessionID != highService {
		t.Fatalf("user-service sessions = %#v, want only %s", service, highService)
	}
}

func TestGetHighMemoryUsageSessionsAndroidTargetCutoff(t *testing.T) {
	for _, state := range []struct {
		importance string
		targetKB   uint64
	}{
		{"foreground", 9 * memoryKBPerGB / 4},
		{"user_service", 5 * memoryKBPerGB / 4},
		{"background", 5 * memoryKBPerGB / 4},
	} {
		t.Run(state.importance, func(t *testing.T) {
			f := newPlotFixture(t)
			f.app.OSNames = []string{opsys.Android}
			base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
			cutoffKB := state.targetKB * 3 / 4
			atCutoff, atTarget := uuid.New(), uuid.New()
			for _, sample := range []struct {
				id       uuid.UUID
				usageKB  uint64
				deviceKB uint64
			}{
				{uuid.New(), cutoffKB - 1, 5 * memoryKBPerGB},
				{atCutoff, cutoffKB, 5 * memoryKBPerGB},
				{atTarget, state.targetKB, 5 * memoryKBPerGB},
				{uuid.New(), state.targetKB, 0},
			} {
				// A single spike must qualify even when the session's p90 is low.
				th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 100, testinfra.EventRow{
					Type: "memory_usage", SessionID: sample.id.String(), Timestamp: base.Add(-time.Second),
					DeviceTotalMemory: sample.deviceKB, MemoryAppImportance: state.importance,
					MemoryAnonRSS: memoryKB(cutoffKB / 2), MemorySwap: memoryKB(0),
				})
				th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
					Type: "memory_usage", SessionID: sample.id.String(), Timestamp: base,
					DeviceTotalMemory: sample.deviceKB, MemoryAppImportance: state.importance,
					MemoryAnonRSS: memoryKB(sample.usageKB / 2),
					MemorySwap:    memoryKB(sample.usageKB - sample.usageKB/2),
				})
				// Peaks outside the selected range must not affect classification or display.
				th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
					Type: "memory_usage", SessionID: sample.id.String(), Timestamp: base.Add(-time.Hour),
					DeviceTotalMemory: sample.deviceKB, MemoryAppImportance: state.importance,
					MemoryAnonRSS: memoryKB(2 * state.targetKB), MemorySwap: memoryKB(0),
				})
			}
			flt := f.sessionFilter(base.Add(-time.Minute), base.Add(time.Minute), "UTC", "")
			sessions, _, _, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, state.importance)
			if err != nil {
				t.Fatal(err)
			}
			if len(sessions) != 2 || sessions[0].SessionID != atTarget || sessions[1].SessionID != atCutoff {
				t.Fatalf("sessions = %#v, want target then exact 75%% cutoff; exclude below cutoff and unknown RAM", sessions)
			}
			for i, wantPercent := range []float64{100, 75} {
				if want := []uint64{state.targetKB, cutoffKB}[i]; sessions[i].PeakMemoryKB != want {
					t.Errorf("session %d peak = %d, want %d", i, sessions[i].PeakMemoryKB, want)
				}
				if sessions[i].PercentOfTarget == nil || *sessions[i].PercentOfTarget != wantPercent {
					t.Errorf("session %d percentage = %v, want %v", i, sessions[i].PercentOfTarget, wantPercent)
				}
				if sessions[i].TargetMemoryKB == nil || *sessions[i].TargetMemoryKB != state.targetKB {
					t.Errorf("session %d target = %v, want %d", i, sessions[i].TargetMemoryKB, state.targetKB)
				}
			}
		})
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
				MemoryMax: 5 * memoryKBPerGB, MemoryUsed: 3 * memoryKBPerGB, MemoryAvailable: memoryHeadroom(memoryKBPerGB),
			}
			if osName == opsys.Android {
				row.Type = "memory_usage"
				row.DeviceTotalMemory = 5 * memoryKBPerGB
				row.MemoryAnonRSS = memoryKB(2 * memoryKBPerGB)
				row.MemorySwap = memoryKB(memoryKBPerGB)
				row.MemoryAppImportance = "foreground"
			}
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 3, row)

			// Zero-usage samples, samples the device could not measure, and the other
			// platform's event may not count.
			zero := row
			zero.MemoryUsed, zero.MemoryAnonRSS, zero.MemorySwap = 0, memoryKB(0), memoryKB(0)
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, zero)
			if osName == opsys.Android {
				unavailable := row
				unavailable.MemoryAnonRSS, unavailable.MemorySwap = nil, nil
				th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, unavailable)
			}
			other := row
			other.Type = "memory_usage"
			if osName == opsys.Android {
				other.Type = "memory_usage_absolute"
			}
			other.MemoryAnonRSS = memoryKB(10 * memoryKBPerGB)
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
						if len(breakdown) != 0 || len(plot) != 0 || len(sessions) != 0 || next || previous {
							t.Fatalf("excluded session returned data: %v / %v / %v", plot, breakdown, sessions)
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
					if len(sessions) != 1 || sessions[0].SessionID != sessionID || next || previous {
						t.Fatalf("sessions = %#v, next/previous = %v/%v", sessions, next, previous)
					}
					s := sessions[0]
					if s.PeakMemoryKB != 3*memoryKBPerGB || s.Attribute.DeviceTotalMemory != 5*memoryKBPerGB {
						t.Fatalf("unexpected session memory: %#v, RAM = %d", s, s.Attribute.DeviceTotalMemory)
					}
					if osName == opsys.Android {
						if s.TargetMemoryKB == nil || s.PercentOfTarget == nil {
							t.Fatal("missing Android memory target or percentage")
						}
						if got := *s.TargetMemoryKB; got != 9*memoryKBPerGB/4 {
							t.Errorf("Android target = %d KiB, want %d", got, 9*memoryKBPerGB/4)
						}
						if got := *s.PercentOfTarget; math.Abs(got-400.0/3) > 0.001 {
							t.Errorf("Android percent of target = %v, want %v", got, 400.0/3)
						}
						if s.PeakMemoryLimitUtilization != nil {
							t.Errorf("Android process-limit utilization = %v, want omitted", *s.PeakMemoryLimitUtilization)
						}
					} else {
						assertIOSMemoryUtilization(t, s, 0.75)
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
			MemoryUsed: uint64(4-i) * memoryKBPerGB, MemoryAvailable: memoryHeadroom(memoryKBPerGB),
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
	flt.Limit, flt.Offset = 0, 0
	sessions, next, previous, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != len(ids) || next || previous {
		t.Fatalf("unlimited query returned %d sessions, next/previous = %v/%v", len(sessions), next, previous)
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
	sessions, next, previous, err := app.GetHighMemoryUsageSessions(t.Context(), nil, flt, "")
	if err != nil || len(sessions) != 0 || next || previous {
		t.Fatalf("sessions = %v, next/previous = %v/%v, err = %v", sessions, next, previous, err)
	}
}

func TestMemoryUsageIOSProcessLimit(t *testing.T) {
	type memorySample struct {
		usedKB      uint64
		availableKB *uint64
	}
	singleSpike := make([]memorySample, 100)
	for i := range singleSpike {
		singleSpike[i] = memorySample{usedKB: 1000, availableKB: memoryHeadroom(9000)}
	}
	singleSpike = append(singleSpike, memorySample{usedKB: 300, availableKB: memoryHeadroom(100)})
	tests := []struct {
		name            string
		samples         []memorySample
		deviceMemoryKB  uint64
		wantUtilization float64 // Zero means the session must not qualify.
		wantPeakKB      uint64
		wantAvailableKB uint64
	}{
		{
			name:    "single spike reaches 75 percent with lower memory usage",
			samples: singleSpike, deviceMemoryKB: 8 * memoryKBPerGB,
			wantUtilization: 0.75, wantPeakKB: 1000, wantAvailableKB: 100,
		},
		{
			name:           "exhausted headroom",
			samples:        []memorySample{{usedKB: 100, availableKB: memoryHeadroom(0)}},
			deviceMemoryKB: 8 * memoryKBPerGB, wantUtilization: 1,
		},
		{
			name:           "exactly 75 percent",
			samples:        []memorySample{{usedKB: 300, availableKB: memoryHeadroom(100)}},
			deviceMemoryKB: 8 * memoryKBPerGB, wantUtilization: 0.75,
			wantAvailableKB: 100,
		},
		{
			name:           "below 75 percent",
			samples:        []memorySample{{usedKB: 299, availableKB: memoryHeadroom(101)}},
			deviceMemoryKB: 8 * memoryKBPerGB,
		},
		{
			name:           "missing headroom is unknown",
			samples:        []memorySample{{usedKB: 10 * memoryKBPerGB}},
			deviceMemoryKB: 8 * memoryKBPerGB,
		},
		{
			name:           "zero footprint is excluded",
			samples:        []memorySample{{usedKB: 0, availableKB: memoryHeadroom(0)}},
			deviceMemoryKB: 8 * memoryKBPerGB,
		},
		{
			name:           "process limit addition does not overflow",
			samples:        []memorySample{{usedKB: 1 << 63, availableKB: memoryHeadroom(1 << 63)}},
			deviceMemoryKB: 8 * memoryKBPerGB,
		},
		{
			name:           "unknown RAM still qualifies",
			samples:        []memorySample{{usedKB: 300, availableKB: memoryHeadroom(100)}},
			deviceMemoryKB: 0, wantUtilization: 0.75,
			wantAvailableKB: 100,
		},
		{
			name: "headroom is paired with peak utilization rather than minimum headroom",
			samples: []memorySample{
				{usedKB: 100, availableKB: memoryHeadroom(100)},
				{usedKB: 900, availableKB: memoryHeadroom(300)},
			},
			deviceMemoryKB: 8 * memoryKBPerGB, wantUtilization: 0.75, wantAvailableKB: 300,
		},
		{
			name: "latest sample breaks ties in peak utilization",
			samples: []memorySample{
				{usedKB: 900, availableKB: memoryHeadroom(300)},
				{usedKB: 300, availableKB: memoryHeadroom(100)},
			},
			deviceMemoryKB: 8 * memoryKBPerGB, wantUtilization: 0.75, wantPeakKB: 900, wantAvailableKB: 100,
		},
		{
			name: "legacy samples do not affect classification",
			samples: []memorySample{
				{usedKB: 100, availableKB: memoryHeadroom(900)},
				{usedKB: 10 * memoryKBPerGB},
			},
			deviceMemoryKB: 8 * memoryKBPerGB,
		},
		{
			name: "utilization is calculated before the maximum",
			// Sample utilization is 100% then 10%. Dividing aggregated usage
			// by an aggregated limit would incorrectly exclude this session.
			samples: []memorySample{
				{usedKB: 100, availableKB: memoryHeadroom(0)},
				{usedKB: 1000, availableKB: memoryHeadroom(9000)},
			},
			deviceMemoryKB: 8 * memoryKBPerGB, wantUtilization: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newPlotFixture(t)
			f.app.OSNames = []string{opsys.IOS}
			base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
			sessionID := uuid.New()
			for i, sample := range tt.samples {
				th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
					Type: "memory_usage_absolute", SessionID: sessionID.String(),
					Timestamp: base.Add(time.Duration(i) * time.Second), OSName: opsys.IOS,
					MemoryMax: tt.deviceMemoryKB, MemoryUsed: sample.usedKB, MemoryAvailable: sample.availableKB,
				})
			}
			flt := f.sessionFilter(base.Add(-time.Minute), base.Add(5*time.Minute), "UTC", "")
			// Android process-state filters must not affect iOS classification.
			for _, importance := range []string{"", "foreground", "background", "user_service"} {
				t.Run("importance="+importance, func(t *testing.T) {
					sessions, _, _, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, importance)
					if err != nil {
						t.Fatalf("high-memory sessions: %v", err)
					}
					if tt.wantUtilization == 0 {
						if len(sessions) != 0 {
							t.Fatalf("got %d high-memory sessions, want none", len(sessions))
						}
						return
					}
					if len(sessions) != 1 || sessions[0].SessionID != sessionID {
						t.Fatalf("sessions = %#v, want only %s", sessions, sessionID)
					}
					assertIOSMemoryUtilization(t, sessions[0], tt.wantUtilization)
					available := sessions[0].AvailableMemoryAtPeakUtilizationKB
					if available == nil || *available != tt.wantAvailableKB {
						t.Errorf("available memory at peak utilization = %v, want %d", available, tt.wantAvailableKB)
					}
					if tt.wantPeakKB > 0 && sessions[0].PeakMemoryKB != tt.wantPeakKB {
						t.Errorf("peak memory = %d, want %d", sessions[0].PeakMemoryKB, tt.wantPeakKB)
					}
				})
			}
		})
	}
}

func TestMemoryUsageIOSLegacySamplesRemainInCharts(t *testing.T) {
	f := newPlotFixture(t)
	f.app.OSNames = []string{opsys.IOS}
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	for _, ram := range []uint64{32 * memoryKBPerGB, 5 * memoryKBPerGB, 0} {
		th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
			Type: "memory_usage_absolute", SessionID: uuid.NewString(), Timestamp: base,
			OSName: opsys.IOS, MemoryMax: ram, MemoryUsed: 3 * memoryKBPerGB,
			// Legacy events have no MemoryAvailable field.
		})
	}
	flt := f.sessionFilter(base.Add(-time.Minute), base.Add(time.Minute), "UTC", "")
	for _, importance := range []string{"", "foreground", "background", "user_service"} {
		t.Run("importance="+importance, func(t *testing.T) {
			plot, err := f.app.GetMemoryUsagePlot(f.ctx, deps.RchPool, flt, importance)
			if err != nil {
				t.Fatalf("memory plot: %v", err)
			}
			if len(plot) != 1 || plot[0].SampleCount != 3 {
				t.Fatalf("plot = %#v, want one point with three samples", plot)
			}

			breakdown, err := f.app.GetMemoryUsageBreakdown(f.ctx, deps.RchPool, flt, importance)
			if err != nil {
				t.Fatalf("memory breakdown: %v", err)
			}
			tiers := map[string]uint64{}
			for _, point := range breakdown {
				tiers[point.DeviceTotalMemoryTier] += point.SampleCount
			}
			if len(tiers) != 3 || tiers["17-32gb"] != 1 || tiers["5-6gb"] != 1 || tiers["unknown"] != 1 {
				t.Fatalf("memory tiers = %v, want one sample each in 17-32gb, 5-6gb and unknown", tiers)
			}
		})
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
					row.MemoryAnonRSS = memoryKB(usage)
					row.MemorySwap = memoryKB(0)
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

func memoryHeadroom(kb uint64) *uint64 {
	return &kb
}

func memoryKB(kb uint64) *uint64 {
	return &kb
}

func assertIOSMemoryUtilization(t *testing.T, session HighMemoryUsageSession, want float64) {
	t.Helper()
	if session.PeakMemoryLimitUtilization == nil {
		t.Fatal("missing iOS process-limit utilization")
	}
	if got := *session.PeakMemoryLimitUtilization; math.Abs(got-want) > 0.00001 {
		t.Errorf("process-limit utilization = %v, want %v", got, want)
	}
	if session.TargetMemoryKB != nil {
		t.Errorf("iOS target_memory_kb = %d, want omitted", *session.TargetMemoryKB)
	}
	if session.PercentOfTarget != nil {
		t.Errorf("iOS percent_of_target = %v, want omitted", *session.PercentOfTarget)
	}
}
