//go:build integration

package measure

import (
	"errors"
	"strings"
	"testing"
	"time"

	"backend/libs/filter"
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

func TestMemoryUsageQueriesWithHavingFilter(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	sessionID := uuid.New()
	th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "memory_usage", SessionID: sessionID.String(), Timestamp: base,
		DeviceTotalMemory: 5 * memoryKBPerGB, MemoryAnonRSS: memoryKBPerGB,
	})
	flt := f.sessionFilter(base.Add(-time.Minute), base.Add(time.Minute), "UTC", "")
	flt.ExprTree = &filter.ExprTree{Children: []filter.ExprTree{
		{Condition: &filter.Condition{KeyName: "version_name", Operator: filter.OperatorNotIn, Values: []filter.Value{{Text: "v2"}}}},
		{Condition: &filter.Condition{KeyName: "device_name", Operator: filter.OperatorIn, Values: []filter.Value{{Text: "device"}}}},
	}, LogicalOperator: filter.LogicalAnd}
	if _, err := f.app.GetMemoryUsagePlot(f.ctx, deps.RchPool, flt, "foreground"); err != nil {
		t.Fatalf("filtered memory plot: %v", err)
	}
	if _, err := f.app.GetMemoryUsageDistribution(f.ctx, deps.RchPool, flt, "foreground"); err != nil {
		t.Fatalf("filtered memory distribution: %v", err)
	}
	if _, _, _, err := f.app.GetHighMemoryUsageSessions(f.ctx, deps.RchPool, flt, "foreground"); err != nil {
		t.Fatalf("filtered high-memory sessions: %v", err)
	}
}
