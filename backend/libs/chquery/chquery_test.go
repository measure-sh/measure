package chquery

import (
	"context"
	"testing"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
)

// carried reads chquery's private settings map back out of ctx.
func carried(ctx context.Context) clickhouse.Settings {
	s, _ := ctx.Value(settingsKey{}).(clickhouse.Settings)
	return s
}

// TestWithSettingsMerges is the regression guard for the original bug: a later
// local setting must not clobber the team scope set earlier (& vice versa).
func TestWithSettingsMerges(t *testing.T) {
	team := uuid.New()

	// scope first, local settings second
	ctx := WithTeamScope(context.Background(), team)
	ctx = WithSettings(ctx, clickhouse.Settings{"log_comment": "x"})
	s := carried(ctx)
	if _, ok := s[ReaderScopeKey]; !ok {
		t.Fatalf("team scope dropped after merging local settings")
	}
	if s["log_comment"] != "x" {
		t.Fatalf("log_comment missing after merge: %v", s)
	}

	// local settings first, scope second
	ctx = WithSettings(context.Background(), clickhouse.Settings{"log_comment": "y"})
	ctx = WithTeamScope(ctx, team)
	s = carried(ctx)
	if _, ok := s[ReaderScopeKey]; !ok || s["log_comment"] != "y" {
		t.Fatalf("merge lost a key regardless of order: %v", s)
	}
}

// TestTeamScopeValue guards the comma joined value the row policies split on:
// one id stays bare, several join with a comma, none yields "" (fail-closed).
func TestTeamScopeValue(t *testing.T) {
	a, b := uuid.New(), uuid.New()

	cases := map[string]struct {
		ids  []uuid.UUID
		want string
	}{
		"single": {[]uuid.UUID{a}, a.String()},
		"multi":  {[]uuid.UUID{a, b}, a.String() + "," + b.String()},
		"none":   {nil, ""},
	}
	for name, tc := range cases {
		ctx := WithTeamScope(context.Background(), tc.ids...)
		got := carried(ctx)[ReaderScopeKey].(clickhouse.CustomSetting).Value
		if got != tc.want {
			t.Fatalf("%s: got %q want %q", name, got, tc.want)
		}
	}
}

func TestRequireScope(t *testing.T) {
	if err := RequireScope(context.Background(), ReaderScopeKey); err == nil {
		t.Fatalf("expected error on unscoped ctx")
	}
	ctx := WithTeamScope(context.Background(), uuid.New())
	if err := RequireScope(ctx, ReaderScopeKey); err != nil {
		t.Fatalf("expected no error on scoped ctx, got %v", err)
	}
	// wrong key still fails
	if err := RequireScope(ctx, AgentScopeKey); err == nil {
		t.Fatalf("expected error when the required key is absent")
	}
}

// stubConn records whether the underlying read was reached.
type stubConn struct {
	driver.Conn
	queried bool
}

func (s *stubConn) Query(ctx context.Context, q string, args ...any) (driver.Rows, error) {
	s.queried = true
	return nil, nil
}

func TestReaderConnGuard(t *testing.T) {
	stub := &stubConn{}
	rc := NewReaderConn(stub, ReaderScopeKey)

	// unscoped: guard fires, underlying pool untouched
	if _, err := rc.Query(context.Background(), "select 1"); err == nil {
		t.Fatalf("expected guard error on unscoped query")
	}
	if stub.queried {
		t.Fatalf("underlying pool was queried despite missing scope")
	}

	// scoped: delegates
	ctx := WithTeamScope(context.Background(), uuid.New())
	if _, err := rc.Query(ctx, "select 1"); err != nil {
		t.Fatalf("scoped query should delegate, got %v", err)
	}
	if !stub.queried {
		t.Fatalf("scoped query did not reach the underlying pool")
	}

	// QueryRow carries the guard error through driver.Row
	if err := rc.QueryRow(context.Background(), "select 1").Scan(); err == nil {
		t.Fatalf("expected guard error via QueryRow.Scan")
	}
}
