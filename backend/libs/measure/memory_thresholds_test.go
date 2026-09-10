package measure

import (
	"testing"

	"backend/libs/exprfilter"
)

func exprFilterWith(t *testing.T, filterExpr string) *exprfilter.ExprFilter {
	t.Helper()
	ef := &exprfilter.ExprFilter{
		Entity:     exprfilter.SessionsEntity,
		FilterExpr: filterExpr,
	}
	if err := ef.BuildExprTree(); err != nil {
		t.Fatalf("build filter expression %q: %v", filterExpr, err)
	}
	return ef
}

func TestMemoryThresholdSingleTierAndScope(t *testing.T) {
	ef := exprFilterWith(t, "session_ram_tier:in:4gb")

	mb, label, ok := MemoryThreshold(ef, false, MemoryScopeForeground)
	if !ok {
		t.Fatalf("expected ok=true for a single-tier foreground filter")
	}
	if mb != 2048 {
		t.Errorf("mb = %v, want 2048", mb)
	}
	if label != "Play threshold (4 GB, Foreground)" {
		t.Errorf("label = %q", label)
	}
}

func TestMemoryThresholdEveryPublishedTierAndScope(t *testing.T) {
	tests := []struct {
		tier  string
		scope MemoryScope
		want  float64
	}{
		{"4gb", MemoryScopeForeground, 2048},
		{"4gb", MemoryScopeUserPerceivedService, 1024},
		{"4gb", MemoryScopeBackground, 1024},
		{"6gb", MemoryScopeForeground, 2304},
		{"6gb", MemoryScopeUserPerceivedService, 1280},
		{"6gb", MemoryScopeBackground, 1280},
		{"8gb", MemoryScopeForeground, 2304},
		{"8gb", MemoryScopeUserPerceivedService, 1536},
		{"8gb", MemoryScopeBackground, 1536},
		{"12gb", MemoryScopeForeground, 3328},
		{"12gb", MemoryScopeUserPerceivedService, 1792},
		{"12gb", MemoryScopeBackground, 1792},
		{"16gb", MemoryScopeForeground, 4352},
		{"16gb", MemoryScopeUserPerceivedService, 2048},
		{"16gb", MemoryScopeBackground, 2048},
	}
	for _, tt := range tests {
		ef := exprFilterWith(t, "session_ram_tier:in:"+tt.tier)
		mb, _, ok := MemoryThreshold(ef, false, tt.scope)
		if !ok {
			t.Errorf("%s/%s: expected ok=true", tt.tier, tt.scope)
			continue
		}
		if mb != tt.want {
			t.Errorf("%s/%s: mb = %v, want %v", tt.tier, tt.scope, mb, tt.want)
		}
	}
}

func TestMemoryThresholdNotApplicable(t *testing.T) {
	tests := []struct {
		name       string
		filterExpr string
		ios        bool
		scope      MemoryScope
	}{
		{"no filter at all", "", false, MemoryScopeForeground},
		{"ios has no Play-vitals equivalent", "session_ram_tier:in:8gb", true, MemoryScopeForeground},
		{"scope All is ambiguous across states", "session_ram_tier:in:8gb", false, MemoryScopeAny},
		{"Play publishes no Cached ceiling", "session_ram_tier:in:8gb", false, MemoryScopeCached},
		{"not_in doesn't positively select a tier", "session_ram_tier:not_in:8gb", false, MemoryScopeForeground},
		{"more than one value is ambiguous", "session_ram_tier:in:[8gb,12gb]", false, MemoryScopeForeground},
		{"tier below Play's published range", "session_ram_tier:in:0-4gb", false, MemoryScopeForeground},
		{"tier above Play's published range", "session_ram_tier:in:16gb+", false, MemoryScopeForeground},
		{"unrelated filter key, no ram tier clause", "device_manufacturer:in:Google", false, MemoryScopeForeground},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ef := exprFilterWith(t, tt.filterExpr)
			if _, _, ok := MemoryThreshold(ef, tt.ios, tt.scope); ok {
				t.Errorf("expected ok=false")
			}
		})
	}
}

func TestMemoryThresholdMoreThanOneRAMTierClauseIsAmbiguous(t *testing.T) {
	// Two independent session_ram_tier clauses (e.g. inside an OR) — even
	// though each alone names exactly one tier, which one applies to the
	// chart as a whole is not well-defined, so this must not resolve either.
	ef := exprFilterWith(t, "session_ram_tier:in:8gb OR session_ram_tier:in:12gb")
	if _, _, ok := MemoryThreshold(ef, false, MemoryScopeForeground); ok {
		t.Errorf("expected ok=false for two independent ram tier clauses")
	}
}
