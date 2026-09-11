package filter

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestFilterValidate(t *testing.T) {
	now := time.Now().UTC()
	appID := uuid.New()

	base := func() *Filter {
		return &Filter{
			AppID:  appID,
			Entity: testEntity,
			From:   now.Add(-time.Hour),
			To:     now,
			Limit:  DefaultPaginationLimit,
		}
	}

	tests := []struct {
		name    string
		build   func() *Filter
		wantErr string
	}{
		{
			name:  "a request with no filter",
			build: base,
		},
		{
			name: "a request with no time range",
			build: func() *Filter {
				flt := base()
				flt.From, flt.To = time.Time{}, time.Time{}
				return flt
			},
		},
		{
			name: "a filter whose keys the entity has",
			build: func() *Filter {
				flt := base()
				flt.ExprTree = leafExprTree("version_name", OperatorIn, "1.2.0")
				return flt
			},
		},
		{
			name: "no app id",
			build: func() *Filter {
				flt := base()
				flt.AppID = uuid.Nil
				return flt
			},
			wantErr: "App id",
		},
		{
			name: "a valid timezone",
			build: func() *Filter {
				flt := base()
				flt.Timezone = "Asia/Kolkata"
				return flt
			},
		},
		{
			name: "a timezone ClickHouse would reject",
			build: func() *Filter {
				flt := base()
				flt.Timezone = "EST5"
				return flt
			},
			wantErr: "`timezone`",
		},
		{
			name: "only one end of the time range",
			build: func() *Filter {
				flt := base()
				flt.From = time.Time{}
				return flt
			},
			wantErr: "Both `from` and `to`",
		},
		{
			name: "a range running backwards",
			build: func() *Filter {
				flt := base()
				flt.From, flt.To = now, now.Add(-time.Hour)
				return flt
			},
			wantErr: "later time than",
		},
		{
			name: "a range starting in the future",
			build: func() *Filter {
				flt := base()
				flt.From, flt.To = now.Add(time.Hour), now.Add(2*time.Hour)
				return flt
			},
			wantErr: "later than now",
		},
		{
			name: "a negative limit",
			build: func() *Filter {
				flt := base()
				flt.Limit = -1
				return flt
			},
			wantErr: "`limit` must be at least 1",
		},
		{
			name: "a limit of zero",
			build: func() *Filter {
				flt := base()
				flt.Limit = 0
				return flt
			},
			wantErr: "`limit` must be at least 1",
		},
		{
			name: "a limit past the maximum",
			build: func() *Filter {
				flt := base()
				flt.Limit = MaxPaginationLimit + 1
				return flt
			},
			wantErr: "cannot be more than",
		},
		{
			name: "a negative offset",
			build: func() *Filter {
				flt := base()
				flt.Offset = -1
				return flt
			},
			wantErr: "`offset` cannot be negative",
		},
		{
			name: "a valid plot time group",
			build: func() *Filter {
				flt := base()
				flt.PlotTimeGroup = PlotTimeGroupHours
				return flt
			},
		},
		{
			name: "an unknown plot time group",
			build: func() *Filter {
				flt := base()
				flt.PlotTimeGroup = "weeks"
				return flt
			},
			wantErr: "`plot_time_group` must be one of",
		},
		{
			name: "a filter with no entity to check it against",
			build: func() *Filter {
				flt := base()
				flt.Entity = Entity{}
				flt.ExprTree = leafExprTree("version_name", OperatorIn, "1.2.0")
				return flt
			},
			wantErr: "entity is not set",
		},
		{
			name: "a filter naming a key the entity does not have",
			build: func() *Filter {
				flt := base()
				flt.ExprTree = leafExprTree("device_cohort", OperatorIn, "beta")
				return flt
			},
			wantErr: "device_cohort",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := test.build().Validate()

			if test.wantErr == "" {
				if err != nil {
					t.Fatalf("want no error, got %v", err)
				}
				return
			}

			if err == nil {
				t.Fatalf("want an error holding %q, got none", test.wantErr)
			}
			if !strings.Contains(err.Error(), test.wantErr) {
				t.Errorf("want an error holding %q, got %q", test.wantErr, err)
			}
		})
	}
}

func TestBuildExprTree(t *testing.T) {
	t.Run("no filter is not an error", func(t *testing.T) {
		flt := &Filter{}

		if err := flt.BuildExprTree(); err != nil {
			t.Fatalf("want a request with no filter accepted, got %v", err)
		}
		if flt.HasFilterExpr() {
			t.Error("want no tree built from no text")
		}
	})

	t.Run("the text is read into the tree", func(t *testing.T) {
		flt := &Filter{FilterExpr: "version_name:in:1.2.0"}

		if err := flt.BuildExprTree(); err != nil {
			t.Fatalf("build: %v", err)
		}
		if !flt.HasFilterExpr() {
			t.Fatal("want a tree once the text is read")
		}
		if got := FormatFilterExpr(flt.ExprTree); got != "version_name:in:1.2.0" {
			t.Errorf("want the filter back as it was written, got %q", got)
		}
	})

	// Text that cannot be read is refused rather than ignored, which would
	// widen what comes back without saying so.
	t.Run("text that cannot be read", func(t *testing.T) {
		flt := &Filter{FilterExpr: "version_name"}

		if err := flt.BuildExprTree(); err == nil {
			t.Fatal("want a filter that cannot be read refused")
		}
	})
}

func TestTimeRangeHelpers(t *testing.T) {
	flt := &Filter{}

	if flt.HasTimeRange() {
		t.Error("want no range before one is set")
	}

	flt.SetDefaultTimeRangeIfUnset()

	if !flt.HasTimeRange() {
		t.Fatal("want a range after the default is set")
	}
	if got := flt.To.Sub(flt.From); got != DefaultDuration {
		t.Errorf("want the default duration %v, got %v", DefaultDuration, got)
	}
	if flt.To.After(time.Now().UTC().Add(time.Minute)) {
		t.Error("want the range to end around now")
	}

	oneSided := &Filter{From: time.Now().UTC().Add(-time.Hour)}
	oneSided.SetDefaultTimeRangeIfUnset()
	if !oneSided.To.IsZero() {
		t.Error("want a one-sided range kept for Validate, got a default")
	}
}

func TestHasFilterExpr(t *testing.T) {
	flt := &Filter{}
	if flt.HasFilterExpr() {
		t.Error("want no filter on a bare request")
	}

	flt.ExprTree = leafExprTree("version_name", OperatorIn, "1.2.0")
	if !flt.HasFilterExpr() {
		t.Error("want a filter once a tree is loaded")
	}
}

func TestIndexKeysByName(t *testing.T) {
	byName := IndexKeysByName([]Key{{Name: "a"}, {Name: "b"}})

	if len(byName) != 2 {
		t.Fatalf("want 2 keys, got %d", len(byName))
	}
	if _, ok := byName["a"]; !ok {
		t.Error("want to find a key by its name")
	}
}

func TestNeedsWholeGroup(t *testing.T) {
	tests := []struct {
		filterExpr string
		want       bool
	}{
		{filterExpr: ""},
		{filterExpr: "session_events:in:fatal_error"},
		{filterExpr: "session_log:contains:boom"},
		{filterExpr: "session_events:in:[fatal_error,anr]"},
		{filterExpr: "session_events:in:fatal_error OR session_log:contains:boom"},
		{filterExpr: "session_events:not_in:fatal_error", want: true},
		{filterExpr: "session_log:not_contains:boom", want: true},
		{filterExpr: "patch_id:is_not_set", want: true},
		{filterExpr: "session_log:contains:boom AND session_events:in:fatal_error", want: true},
		{filterExpr: "session_log:contains:boom OR (user_id:in:alice AND country:in:US)", want: true},
		{filterExpr: "session_events:in:fatal_error OR session_events:not_in:anr", want: true},
	}

	for _, test := range tests {
		t.Run(test.filterExpr, func(t *testing.T) {
			flt := &Filter{Entity: SessionsEntity, FilterExpr: test.filterExpr}
			if err := flt.BuildExprTree(); err != nil {
				t.Fatalf("build: %v", err)
			}
			if got := flt.NeedsWholeGroup(); got != test.want {
				t.Errorf("want %v, got %v", test.want, got)
			}
		})
	}
}
