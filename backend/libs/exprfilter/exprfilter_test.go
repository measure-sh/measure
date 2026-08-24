package exprfilter

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestExprFilterValidate(t *testing.T) {
	now := time.Now().UTC()
	appID := uuid.New()

	base := func() *ExprFilter {
		return &ExprFilter{
			AppID:  appID,
			Entity: testEntity,
			From:   now.Add(-time.Hour),
			To:     now,
			Limit:  DefaultPaginationLimit,
		}
	}

	tests := []struct {
		name    string
		build   func() *ExprFilter
		wantErr string
	}{
		{
			name:  "a request with no filter",
			build: base,
		},
		{
			name: "a request with no time range",
			build: func() *ExprFilter {
				ef := base()
				ef.From, ef.To = time.Time{}, time.Time{}
				return ef
			},
		},
		{
			name: "a filter whose keys the entity has",
			build: func() *ExprFilter {
				ef := base()
				ef.ExprTree = leafExprTree("version_name", OperatorIn, "1.2.0")
				return ef
			},
		},
		{
			name: "no app id",
			build: func() *ExprFilter {
				ef := base()
				ef.AppID = uuid.Nil
				return ef
			},
			wantErr: "App id",
		},
		{
			name: "only one end of the time range",
			build: func() *ExprFilter {
				ef := base()
				ef.From = time.Time{}
				return ef
			},
			wantErr: "Both `from` and `to`",
		},
		{
			name: "a range running backwards",
			build: func() *ExprFilter {
				ef := base()
				ef.From, ef.To = now, now.Add(-time.Hour)
				return ef
			},
			wantErr: "later time than",
		},
		{
			name: "a range starting in the future",
			build: func() *ExprFilter {
				ef := base()
				ef.From, ef.To = now.Add(time.Hour), now.Add(2*time.Hour)
				return ef
			},
			wantErr: "later than now",
		},
		{
			name: "a negative limit",
			build: func() *ExprFilter {
				ef := base()
				ef.Limit = -1
				return ef
			},
			wantErr: "`limit` must be at least 1",
		},
		{
			name: "a limit of zero",
			build: func() *ExprFilter {
				ef := base()
				ef.Limit = 0
				return ef
			},
			wantErr: "`limit` must be at least 1",
		},
		{
			name: "a limit past the maximum",
			build: func() *ExprFilter {
				ef := base()
				ef.Limit = MaxPaginationLimit + 1
				return ef
			},
			wantErr: "cannot be more than",
		},
		{
			name: "a negative offset",
			build: func() *ExprFilter {
				ef := base()
				ef.Offset = -1
				return ef
			},
			wantErr: "`offset` cannot be negative",
		},
		{
			name: "a valid plot time group",
			build: func() *ExprFilter {
				ef := base()
				ef.PlotTimeGroup = PlotTimeGroupHours
				return ef
			},
		},
		{
			name: "an unknown plot time group",
			build: func() *ExprFilter {
				ef := base()
				ef.PlotTimeGroup = "weeks"
				return ef
			},
			wantErr: "`plot_time_group` must be one of",
		},
		{
			name: "a filter with no entity to check it against",
			build: func() *ExprFilter {
				ef := base()
				ef.Entity = Entity{}
				ef.ExprTree = leafExprTree("version_name", OperatorIn, "1.2.0")
				return ef
			},
			wantErr: "entity is not set",
		},
		{
			name: "a filter naming a key the entity does not have",
			build: func() *ExprFilter {
				ef := base()
				ef.ExprTree = leafExprTree("device_cohort", OperatorIn, "beta")
				return ef
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
		ef := &ExprFilter{}

		if err := ef.BuildExprTree(); err != nil {
			t.Fatalf("want a request with no filter accepted, got %v", err)
		}
		if ef.HasFilterExpr() {
			t.Error("want no tree built from no text")
		}
	})

	t.Run("the text is read into the tree", func(t *testing.T) {
		ef := &ExprFilter{FilterExpr: "version_name:in:1.2.0"}

		if err := ef.BuildExprTree(); err != nil {
			t.Fatalf("build: %v", err)
		}
		if !ef.HasFilterExpr() {
			t.Fatal("want a tree once the text is read")
		}
		if got := FormatFilterExpr(ef.ExprTree); got != "version_name:in:1.2.0" {
			t.Errorf("want the filter back as it was written, got %q", got)
		}
	})

	// Text that cannot be read is refused rather than ignored, which would
	// widen what comes back without saying so.
	t.Run("text that cannot be read", func(t *testing.T) {
		ef := &ExprFilter{FilterExpr: "version_name"}

		if err := ef.BuildExprTree(); err == nil {
			t.Fatal("want a filter that cannot be read refused")
		}
	})
}

func TestTimeRangeHelpers(t *testing.T) {
	ef := &ExprFilter{}

	if ef.HasTimeRange() {
		t.Error("want no range before one is set")
	}

	ef.SetDefaultTimeRangeIfUnset()

	if !ef.HasTimeRange() {
		t.Fatal("want a range after the default is set")
	}
	if got := ef.To.Sub(ef.From); got != DefaultDuration {
		t.Errorf("want the default duration %v, got %v", DefaultDuration, got)
	}
	if ef.To.After(time.Now().UTC().Add(time.Minute)) {
		t.Error("want the range to end around now")
	}

	oneSided := &ExprFilter{From: time.Now().UTC().Add(-time.Hour)}
	oneSided.SetDefaultTimeRangeIfUnset()
	if !oneSided.To.IsZero() {
		t.Error("want a one-sided range kept for Validate, got a default")
	}
}

func TestHasFilterExpr(t *testing.T) {
	ef := &ExprFilter{}
	if ef.HasFilterExpr() {
		t.Error("want no filter on a bare request")
	}

	ef.ExprTree = leafExprTree("version_name", OperatorIn, "1.2.0")
	if !ef.HasFilterExpr() {
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
