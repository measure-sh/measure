package exprfilter

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

type ExprFilter struct {
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

	// FilterExpr is the text form of the filter, as a link or an API request
	// carries it. ExprTree is the parsed form.
	FilterExpr string `form:"filter_expr"`

	ExprTree *ExprTree

	// customBinder writes the SQL for the custom-key conditions of one filter
	// group. ResolveCustomKeys sets it; nil when the filter mentions no
	// custom keys or the entity has none.
	customBinder GroupKeyBinding
}

func (ef *ExprFilter) HasFilterExpr() bool {
	return ef.ExprTree != nil
}

func (ef *ExprFilter) HasTimeRange() bool {
	return !ef.From.IsZero() && !ef.To.IsZero()
}

// SetDefaultTimeRangeIfUnset fills the time range when the request gave neither
// bound. A request giving only is left alone, so it can be rejected during validation.
func (ef *ExprFilter) SetDefaultTimeRangeIfUnset() {
	if !ef.From.IsZero() || !ef.To.IsZero() {
		return
	}
	to := time.Now().UTC()
	ef.From = to.Add(-DefaultDuration)
	ef.To = to
}

func (ef *ExprFilter) BuildExprTree() error {
	if ef.FilterExpr == "" {
		ef.ExprTree = nil
		return nil
	}

	exprTree, err := ParseFilterExpr(ef.FilterExpr)
	if err != nil {
		return err
	}

	ef.ExprTree = exprTree
	return nil
}

func (ef *ExprFilter) Validate() error {
	if ef.AppID == uuid.Nil {
		return errors.New("App id is invalid or empty")
	}

	if ef.From.IsZero() != ef.To.IsZero() {
		return errors.New("Both `from` and `to` time must be set")
	}
	if ef.To.Before(ef.From) {
		return errors.New("`to` must be later time than `from`")
	}
	if ef.From.After(time.Now().UTC()) {
		return errors.New("`from` cannot be later than now")
	}

	if ef.Limit < 1 {
		return errors.New("`limit` must be at least 1")
	}
	if ef.Limit > MaxPaginationLimit {
		return fmt.Errorf("`limit` cannot be more than %d", MaxPaginationLimit)
	}
	if ef.Offset < 0 {
		return errors.New("`offset` cannot be negative")
	}

	if ef.PlotTimeGroup != "" && !slices.Contains(plotTimeGroups, ef.PlotTimeGroup) {
		return fmt.Errorf("`plot_time_group` must be one of: %s", strings.Join(plotTimeGroups, ", "))
	}

	if !ef.HasFilterExpr() {
		return nil
	}

	if ef.Entity.Name == "" {
		return errors.New("Filter entity is not set")
	}

	return ValidateFilterExpr(ef.ExprTree, IndexKeysByName(ef.Entity.Keys))
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
