package filter

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"backend/libs/chquery"
	"backend/libs/config"
	"backend/libs/logcomment"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
)

const DefaultDuration = time.Hour * 24 * 7

const DefaultPaginationLimit = 10

const MaxPaginationLimit = 1000

// The granularities a plot endpoint can bucket its time axis by.
const (
	PlotTimeGroupMinutes = "minutes"
	PlotTimeGroupHours   = "hours"
	PlotTimeGroupDays    = "days"
	PlotTimeGroupMonths  = "months"
)

var plotTimeGroups = []string{
	PlotTimeGroupMinutes,
	PlotTimeGroupHours,
	PlotTimeGroupDays,
	PlotTimeGroupMonths,
}

// Filter is one filter a query applies: the app and time window it covers,
// paging and plot bucketing, and the filter expression that narrows the rows,
// held both as the text a request carries and as the tree parsed from it.
type Filter struct {
	AppID  uuid.UUID
	TeamID uuid.UUID

	// Entity must be set before Validate.
	Entity Entity

	From     time.Time `form:"from" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	To       time.Time `form:"to" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	Timezone string    `form:"timezone"`

	Limit  int `form:"limit"`
	Offset int `form:"offset"`

	// PlotTimeGroup is the time bucketing a plot endpoint groups by. Endpoints
	// that do not plot leave it empty.
	PlotTimeGroup string `form:"plot_time_group"`

	// FilterExpr is the filter expression as a link or an API request carries
	// it. ExprTree is the same expression parsed.
	FilterExpr string `form:"filter_expr"`

	ExprTree *ExprTree

	// customBinder writes the SQL for the custom-key conditions of one filter
	// group. ResolveCustomKeys sets it; nil when the filter mentions no
	// custom keys or the entity has none.
	customBinder GroupKeyBinding
}

func (flt *Filter) HasFilterExpr() bool {
	return flt.ExprTree != nil
}

// RootVersionConditions returns the version names and codes of the in
// conditions at the root of the expression or directly under a root AND.
// Every matching row carries one of them, so a query on a table sorted by
// version can prune with them before the full predicate.
func (flt *Filter) RootVersionConditions() (versionNames, versionCodes [][]string) {
	return collectRootVersionConditions(flt.ExprTree)
}

// NeedsWholeGroup reports whether the filter carries a predicate that cannot be
// decided from a single row of a group: a negation, or a conjunction whose
// parts can be true on different rows.
func (flt *Filter) NeedsWholeGroup() bool {
	if flt.ExprTree == nil {
		return false
	}

	needsWholeGroup, err := WalkExprTree(flt.ExprTree,
		func(condition Condition) (bool, error) {
			switch condition.Operator {
			case OperatorNotIn, OperatorNotContains, OperatorIsNotSet:
				return true, nil
			}
			return false, nil
		},
		func(operator LogicalOperator, children []bool) (bool, error) {
			if operator == LogicalAnd && len(children) > 1 {
				return true, nil
			}
			return slices.Contains(children, true), nil
		})
	if err != nil {
		return true
	}
	return needsWholeGroup
}

func (flt *Filter) HasTimeRange() bool {
	return !flt.From.IsZero() && !flt.To.IsZero()
}

// SetDefaultTimeRangeIfUnset fills the time range when the request gave neither
// bound. A request giving only is left alone, so it can be rejected during validation.
func (flt *Filter) SetDefaultTimeRangeIfUnset() {
	if !flt.From.IsZero() || !flt.To.IsZero() {
		return
	}
	to := time.Now().UTC()
	flt.From = to.Add(-DefaultDuration)
	flt.To = to
}

func (flt *Filter) SetDefaultPlotTimeGroupIfUnset() {
	if flt.PlotTimeGroup == "" {
		flt.PlotTimeGroup = PlotTimeGroupDays
	}
}

func (flt *Filter) BuildExprTree() error {
	if flt.FilterExpr == "" {
		flt.ExprTree = nil
		return nil
	}

	exprTree, err := ParseFilterExpr(flt.FilterExpr)
	if err != nil {
		return err
	}

	flt.ExprTree = exprTree
	return nil
}

func (flt *Filter) Validate() error {
	if flt.AppID == uuid.Nil {
		return errors.New("App id is invalid or empty")
	}

	if flt.From.IsZero() != flt.To.IsZero() {
		return errors.New("Both `from` and `to` time must be set")
	}
	if flt.To.Before(flt.From) {
		return errors.New("`to` must be later time than `from`")
	}
	if flt.From.After(time.Now().UTC()) {
		return errors.New("`from` cannot be later than now")
	}

	if flt.Limit < 1 {
		return errors.New("`limit` must be at least 1")
	}
	if flt.Limit > MaxPaginationLimit {
		return fmt.Errorf("`limit` cannot be more than %d", MaxPaginationLimit)
	}
	if flt.Offset < 0 {
		return errors.New("`offset` cannot be negative")
	}

	if flt.PlotTimeGroup != "" && !slices.Contains(plotTimeGroups, flt.PlotTimeGroup) {
		return fmt.Errorf("`plot_time_group` must be one of: %s", strings.Join(plotTimeGroups, ", "))
	}

	if flt.Timezone != "" {
		if _, err := time.LoadLocation(flt.Timezone); err != nil {
			return fmt.Errorf("`timezone` must be a valid IANA time zone name, got %q", flt.Timezone)
		}
	}

	if !flt.HasFilterExpr() {
		return nil
	}

	if flt.Entity.Name == "" {
		return errors.New("Filter entity is not set")
	}

	return ValidateFilterExpr(flt.ExprTree, IndexKeysByName(flt.Entity.Keys))
}

// WithFilterQuerySettings carries the ClickHouse settings for filter key and
// value reads: a log comment specifying the query and, in release mode, a short
// query cache, since the same lists are asked for on every picker open.
func WithFilterQuerySettings(ctx context.Context, releaseMode, debugMode bool, queryName string) context.Context {
	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment":       lc.MustPut(logcomment.Root, logcomment.Filters).String(),
		"use_query_cache":   releaseMode,
		"query_cache_ttl":   int(config.DefaultQueryCacheTTL.Seconds()),
		"force_primary_key": debugMode,
	}
	return chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, queryName))
}
