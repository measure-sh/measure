package measure

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"backend/libs/chquery"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/network"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	valkey "github.com/valkey-io/valkey-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const (
	minFunnelSteps             = 2
	maxFunnelSteps             = 30
	maxFunnelNameLength        = 256
	minConversionWindowSeconds = 60
	maxConversionWindowSeconds = 30 * 24 * 60 * 60
)

var ErrFunnelNotFound = errors.New("funnel not found")

type FunnelStep struct {
	EventName string `json:"event_name"`
}

type Funnel struct {
	ID                      uuid.UUID    `json:"id"`
	AppID                   uuid.UUID    `json:"app_id"`
	Name                    string       `json:"name"`
	Steps                   []FunnelStep `json:"steps"`
	ConversionWindowSeconds int          `json:"conversion_window_seconds"`
	Pinned                  bool         `json:"pinned"`
	PinOrder                *int         `json:"pin_order"`
	CreatedBy               *uuid.UUID   `json:"created_by"`
	CreatedByEmail          *string      `json:"created_by_email"`
	CreatedAt               time.Time    `json:"created_at"`
	UpdatedAt               time.Time    `json:"updated_at"`
}

// FunnelDraft is the part of a funnel a user creates or edits.
type FunnelDraft struct {
	Name                    string       `json:"name"`
	Steps                   []FunnelStep `json:"steps"`
	ConversionWindowSeconds int          `json:"conversion_window_seconds"`
}

// Validate returns the first problem that keeps the draft from being saved,
// with a message the dashboard can show to the user.
func (d FunnelDraft) Validate() error {
	name := strings.TrimSpace(d.Name)
	if name == "" {
		return errors.New("funnel name is required")
	}
	if utf8.RuneCountInString(name) > maxFunnelNameLength {
		return fmt.Errorf("funnel name must be at most %d characters", maxFunnelNameLength)
	}
	if len(d.Steps) < minFunnelSteps || len(d.Steps) > maxFunnelSteps {
		return fmt.Errorf("a funnel must have between %d and %d steps", minFunnelSteps, maxFunnelSteps)
	}
	for i, step := range d.Steps {
		if step.EventName == "" {
			return errors.New("every step must have an event")
		}
		if !event.IsValidCustomName(step.EventName) {
			return fmt.Errorf("step %d must be the name of a custom event", i+1)
		}
	}
	if d.ConversionWindowSeconds < minConversionWindowSeconds || d.ConversionWindowSeconds > maxConversionWindowSeconds {
		return errors.New("the conversion window must be between 1 minute and 30 days")
	}
	if d.ConversionWindowSeconds%60 != 0 {
		return errors.New("the conversion window must be a whole number of minutes")
	}
	return nil
}

func eventNames(steps []FunnelStep) []string {
	names := make([]string, len(steps))
	for i, step := range steps {
		names[i] = step.EventName
	}
	return names
}

func selectFunnels() *sqlf.Stmt {
	return sqlf.PostgreSQL.
		From("measure.funnels").
		LeftJoin("measure.users", "users.id = funnels.created_by").
		Select("funnels.id").
		Select("funnels.app_id").
		Select("funnels.name").
		Select("funnels.steps").
		Select("funnels.conversion_window_seconds").
		Select("funnels.pin_order").
		Select("funnels.created_by").
		Select("users.email").
		Select("funnels.created_at").
		Select("funnels.updated_at")
}

func scanFunnel(row pgx.Row) (Funnel, error) {
	funnel := Funnel{}
	var eventNames []string
	if err := row.Scan(
		&funnel.ID,
		&funnel.AppID,
		&funnel.Name,
		&eventNames,
		&funnel.ConversionWindowSeconds,
		&funnel.PinOrder,
		&funnel.CreatedBy,
		&funnel.CreatedByEmail,
		&funnel.CreatedAt,
		&funnel.UpdatedAt,
	); err != nil {
		return Funnel{}, err
	}
	funnel.Steps = make([]FunnelStep, len(eventNames))
	for i, name := range eventNames {
		funnel.Steps[i] = FunnelStep{EventName: name}
	}
	funnel.Pinned = funnel.PinOrder != nil
	return funnel, nil
}

func startFunnelSpan(ctx context.Context, name string, appID uuid.UUID, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	ctx, span := tracer.Start(ctx, name)
	span.SetAttributes(attribute.String("funnel.app_id", appID.String()))
	span.SetAttributes(attrs...)
	return ctx, span
}

func startFunnelQuerySpan(ctx context.Context, name string, funnel Funnel, flt *filter.Filter, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return startFunnelSpan(ctx, name, flt.AppID, append([]attribute.KeyValue{
		attribute.String("funnel.team_id", flt.TeamID.String()),
		attribute.String("funnel.id", funnel.ID.String()),
		attribute.Int("funnel.steps", len(funnel.Steps)),
		attribute.Int("funnel.conversion_window_seconds", funnel.ConversionWindowSeconds),
		attribute.Bool("funnel.filter_expr", flt.HasFilterExpr()),
	}, attrs...)...)
}

func startFunnelStepSpan(ctx context.Context, name string, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return startFunnelQuerySpan(ctx, name, funnel, flt, append([]attribute.KeyValue{
		attribute.String("funnel.from", flt.From.Format(time.RFC3339)),
		attribute.String("funnel.to", flt.To.Format(time.RFC3339)),
		attribute.Int("funnel.step_from", stepRange.From),
		attribute.Int("funnel.step_to", stepRange.To),
		attribute.Int("funnel.limit", flt.Limit),
		attribute.Int("funnel.offset", flt.Offset),
	}, attrs...)...)
}

func endFunnelSpan(span trace.Span, err error, results ...attribute.KeyValue) {
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
	} else {
		span.SetAttributes(results...)
	}
	span.End()
}

// GetFunnels returns a page of an app's funnels whose name contains search,
// most recently updated first.
func GetFunnels(ctx context.Context, pg *pgxpool.Pool, appID uuid.UUID, search string, limit, offset int) (funnels []Funnel, next, previous bool, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.list", appID,
		attribute.Bool("funnel.search", search != ""),
		attribute.Int("funnel.limit", limit),
		attribute.Int("funnel.offset", offset))
	defer func() {
		endFunnelSpan(span, err,
			attribute.Int("funnel.funnels", len(funnels)),
			attribute.Bool("funnel.next", next))
	}()

	stmt := selectFunnels().Where("funnels.app_id = ?", appID)
	defer stmt.Close()
	if search != "" {
		stmt.Where("funnels.name ilike ?", "%"+filter.EscapeLikeWildcards(search)+"%")
	}
	stmt.OrderBy("funnels.updated_at desc", "funnels.id").
		// one extra row tells whether another page exists
		Limit(uint64(limit) + 1).
		Offset(uint64(offset))

	rows, err := pg.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to query funnels: %w", err)
	}
	defer rows.Close()

	funnels = []Funnel{}
	for rows.Next() {
		funnel, err := scanFunnel(rows)
		if err != nil {
			return nil, false, false, fmt.Errorf("failed to scan funnel: %w", err)
		}
		funnels = append(funnels, funnel)
	}
	if err := rows.Err(); err != nil {
		return nil, false, false, fmt.Errorf("failed to read funnels: %w", err)
	}

	if len(funnels) > limit {
		funnels = funnels[:limit]
		next = true
	}

	return funnels, next, offset > 0, nil
}

func GetFunnel(ctx context.Context, pg *pgxpool.Pool, appID, funnelID uuid.UUID) (funnel Funnel, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.get", appID, attribute.String("funnel.id", funnelID.String()))
	defer func() {
		endFunnelSpan(span, err)
	}()

	stmt := selectFunnels().
		Where("funnels.app_id = ?", appID).
		Where("funnels.id = ?", funnelID)
	defer stmt.Close()

	funnel, err = scanFunnel(pg.QueryRow(ctx, stmt.String(), stmt.Args()...))
	if errors.Is(err, pgx.ErrNoRows) {
		return Funnel{}, ErrFunnelNotFound
	}
	if err != nil {
		return Funnel{}, fmt.Errorf("failed to get funnel: %w", err)
	}
	return funnel, nil
}

func CreateFunnel(ctx context.Context, pg *pgxpool.Pool, appID uuid.UUID, userID string, draft FunnelDraft) (funnel Funnel, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.create", appID,
		attribute.Int("funnel.steps", len(draft.Steps)),
		attribute.Int("funnel.conversion_window_seconds", draft.ConversionWindowSeconds))
	defer func() {
		endFunnelSpan(span, err, attribute.String("funnel.id", funnel.ID.String()))
	}()

	stmt := sqlf.PostgreSQL.
		InsertInto("measure.funnels").
		Set("app_id", appID).
		Set("name", strings.TrimSpace(draft.Name)).
		Set("steps", eventNames(draft.Steps)).
		Set("conversion_window_seconds", draft.ConversionWindowSeconds).
		Set("created_by", userID).
		Returning("id")
	defer stmt.Close()

	var funnelID uuid.UUID
	if err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&funnelID); err != nil {
		return Funnel{}, fmt.Errorf("failed to create funnel: %w", err)
	}
	return GetFunnel(ctx, pg, appID, funnelID)
}

func UpdateFunnel(ctx context.Context, pg *pgxpool.Pool, appID, funnelID uuid.UUID, draft FunnelDraft) (funnel Funnel, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.update", appID,
		attribute.String("funnel.id", funnelID.String()),
		attribute.Int("funnel.steps", len(draft.Steps)),
		attribute.Int("funnel.conversion_window_seconds", draft.ConversionWindowSeconds))
	defer func() {
		endFunnelSpan(span, err)
	}()

	stmt := sqlf.PostgreSQL.
		Update("measure.funnels").
		Set("name", strings.TrimSpace(draft.Name)).
		Set("steps", eventNames(draft.Steps)).
		Set("conversion_window_seconds", draft.ConversionWindowSeconds).
		SetExpr("updated_at", "now()").
		Where("app_id = ?", appID).
		Where("id = ?", funnelID)
	defer stmt.Close()

	tag, err := pg.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return Funnel{}, fmt.Errorf("failed to update funnel: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return Funnel{}, ErrFunnelNotFound
	}
	return GetFunnel(ctx, pg, appID, funnelID)
}

func DeleteFunnel(ctx context.Context, pg *pgxpool.Pool, appID, funnelID uuid.UUID) (err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.delete", appID, attribute.String("funnel.id", funnelID.String()))
	defer func() {
		endFunnelSpan(span, err)
	}()

	stmt := sqlf.PostgreSQL.
		DeleteFrom("measure.funnels").
		Where("app_id = ?", appID).
		Where("id = ?", funnelID)
	defer stmt.Close()

	tag, err := pg.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to delete funnel: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrFunnelNotFound
	}
	return nil
}

var ErrPinnedFunnelsChanged = errors.New("pinned funnels have changed")

// MaxPinnedFunnels keeps an app's pinned funnels few enough to show them all.
const MaxPinnedFunnels = 10

var ErrPinnedFunnelsFull = fmt.Errorf("an app can have at most %d pinned funnels", MaxPinnedFunnels)

// funnelPinsLockClass is the first key of the two-key advisory lock around
// changes to an app's pinned funnels; the second key is a hash of the app id.
// The fixed first key keeps these locks apart from advisory locks other
// features take. It encodes the ASCII letters "msfp" (measure funnel pins).
const funnelPinsLockClass int32 = 0x6d736670

// withPinsLock runs fn in a transaction that holds the app's pins lock. A pin
// computes its position from the positions taken so far, and a reorder checks
// the pinned set before rewriting it, so two changes running at once would
// each act on a set the other is changing.
func withPinsLock(ctx context.Context, pg *pgxpool.Pool, appID uuid.UUID, fn func(tx pgx.Tx) error) error {
	tx, err := pg.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	stmt := sqlf.PostgreSQL.
		Select("pg_advisory_xact_lock(?::int4, hashtext(?))", funnelPinsLockClass, appID.String())
	defer stmt.Close()

	lockCtx, lockSpan := startFunnelSpan(ctx, "funnel.pins_lock", appID)
	_, err = tx.Exec(lockCtx, stmt.String(), stmt.Args()...)
	endFunnelSpan(lockSpan, err)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetPinnedFunnels returns an app's pinned funnels in their pinned order.
func GetPinnedFunnels(ctx context.Context, pg *pgxpool.Pool, appID uuid.UUID) (funnels []Funnel, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.pinned", appID)
	defer func() {
		endFunnelSpan(span, err, attribute.Int("funnel.funnels", len(funnels)))
	}()

	stmt := selectFunnels().
		Where("funnels.app_id = ?", appID).
		Where("funnels.pin_order is not null").
		OrderBy("funnels.pin_order")
	defer stmt.Close()

	rows, err := pg.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query pinned funnels: %w", err)
	}
	defer rows.Close()

	funnels = []Funnel{}
	for rows.Next() {
		funnel, err := scanFunnel(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan pinned funnel: %w", err)
		}
		funnels = append(funnels, funnel)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read pinned funnels: %w", err)
	}
	return funnels, nil
}

// SetFunnelPinned pins a funnel after the app's other pinned funnels, or
// unpins it. Pinning and unpinning are idempotent. Pinning returns
// ErrPinnedFunnelsFull when MaxPinnedFunnels other funnels are pinned.
func SetFunnelPinned(ctx context.Context, pg *pgxpool.Pool, appID, funnelID uuid.UUID, pinned bool) (funnel Funnel, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.set_pinned", appID,
		attribute.String("funnel.id", funnelID.String()),
		attribute.Bool("funnel.pinned", pinned))
	defer func() {
		endFunnelSpan(span, err)
	}()

	pinOrderStmt := sqlf.PostgreSQL.
		From("measure.funnels").
		Select("pin_order").
		Where("app_id = ?", appID).
		Where("id = ?", funnelID)
	defer pinOrderStmt.Close()

	countStmt := sqlf.PostgreSQL.
		From("measure.funnels").
		Select("count(*)").
		Where("app_id = ?", appID).
		Where("pin_order is not null")
	defer countStmt.Close()

	stmt := sqlf.PostgreSQL.
		Update("measure.funnels").
		Where("app_id = ?", appID).
		Where("id = ?", funnelID)
	if pinned {
		stmt.SetExpr("pin_order", "(select coalesce(max(pin_order) + 1, 0) from measure.funnels where app_id = ?)", appID)
	} else {
		stmt.SetExpr("pin_order", "null")
	}
	defer stmt.Close()

	err = withPinsLock(ctx, pg, appID, func(tx pgx.Tx) error {
		var pinOrder *int
		err := tx.QueryRow(ctx, pinOrderStmt.String(), pinOrderStmt.Args()...).Scan(&pinOrder)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrFunnelNotFound
		}
		if err != nil {
			return err
		}
		if pinned == (pinOrder != nil) {
			return nil
		}
		if pinned {
			var pins int
			if err := tx.QueryRow(ctx, countStmt.String(), countStmt.Args()...).Scan(&pins); err != nil {
				return err
			}
			if pins >= MaxPinnedFunnels {
				return ErrPinnedFunnelsFull
			}
		}
		_, err = tx.Exec(ctx, stmt.String(), stmt.Args()...)
		return err
	})
	if errors.Is(err, ErrPinnedFunnelsFull) || errors.Is(err, ErrFunnelNotFound) {
		return Funnel{}, err
	}
	if err != nil {
		return Funnel{}, fmt.Errorf("failed to set funnel pinned: %w", err)
	}
	return GetFunnel(ctx, pg, appID, funnelID)
}

// ReorderPinnedFunnels puts the app's pinned funnels in the order of
// funnelIDs. It returns ErrPinnedFunnelsChanged when funnelIDs is not the app's
// current pinned set, so an order arranged before a teammate pinned or unpinned
// a funnel does not undo that change.
func ReorderPinnedFunnels(ctx context.Context, pg *pgxpool.Pool, appID uuid.UUID, funnelIDs []uuid.UUID) (funnels []Funnel, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.reorder_pinned", appID, attribute.Int("funnel.funnels", len(funnelIDs)))
	defer func() {
		endFunnelSpan(span, err)
	}()

	pinnedStmt := sqlf.PostgreSQL.
		From("measure.funnels").
		Select("id").
		Where("app_id = ?", appID).
		Where("pin_order is not null")
	defer pinnedStmt.Close()

	// pgx has no encode plan for []uuid.UUID, so the ids go as strings and the
	// query casts them.
	reorderStmt := sqlf.PostgreSQL.
		Update("measure.funnels").
		SetExpr("pin_order", "array_position(?::uuid[], id) - 1", uuid.UUIDs(funnelIDs).Strings()).
		Where("app_id = ?", appID).
		Where("pin_order is not null")
	defer reorderStmt.Close()

	if err := withPinsLock(ctx, pg, appID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, pinnedStmt.String(), pinnedStmt.Args()...)
		if err != nil {
			return err
		}
		pinnedIDs, err := pgx.CollectRows(rows, pgx.RowTo[uuid.UUID])
		if err != nil {
			return err
		}
		if !sameIDs(pinnedIDs, funnelIDs) {
			return ErrPinnedFunnelsChanged
		}
		_, err = tx.Exec(ctx, reorderStmt.String(), reorderStmt.Args()...)
		return err
	}); err != nil {
		if errors.Is(err, ErrPinnedFunnelsChanged) {
			return nil, err
		}
		return nil, fmt.Errorf("failed to reorder pinned funnels: %w", err)
	}
	return GetPinnedFunnels(ctx, pg, appID)
}

// sameIDs reports whether b is a reordering of a, holding each of its ids once
// with no others.
func sameIDs(a, b []uuid.UUID) bool {
	if len(a) != len(b) {
		return false
	}
	seen := make(map[uuid.UUID]bool, len(b))
	for _, id := range b {
		if seen[id] {
			return false
		}
		seen[id] = true
	}
	for _, id := range a {
		if !seen[id] {
			return false
		}
	}
	return true
}

// MaxSuggestFunnelEventNames is how many names are returned at once.
const MaxSuggestFunnelEventNames = 50

// SuggestFunnelEventNames returns the custom event names containing search
// that the app's sessions sent in the last 30 days, most recently seen first.
//
// Funnel event suggestions logic is the same as custom event name fetching in
// filters but deliberately kept separate, since we might want to change what
// events we show for funnels and how in the future.
func SuggestFunnelEventNames(ctx context.Context, rch driver.Conn, teamID, appID uuid.UUID, search string) (names []string, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.event_names", appID,
		attribute.String("funnel.team_id", teamID.String()),
		attribute.Bool("funnel.search", search != ""))
	defer func() {
		endFunnelSpan(span, err, attribute.Int("funnel.event_names", len(names)))
	}()

	ctx = chquery.WithTeamScope(ctx, teamID)

	// The start is rounded down to the hour, so the query text stays the same
	// for an hour and ClickHouse can answer repeats from its query cache.
	from := time.Now().Add(-30 * 24 * time.Hour).Truncate(time.Hour)

	stmt := sqlf.
		From("sessions array join unique_custom_type_names as event_name").
		Select("event_name").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID).
		Where("first_event_timestamp >= ?", from).
		Where("event_name != ''")
	defer stmt.Close()
	if search != "" {
		stmt.Where("event_name ilike ?", "%"+filter.EscapeLikeWildcards(search)+"%")
	}
	stmt.GroupBy("event_name").
		OrderBy("max(first_event_timestamp) desc", "event_name").
		Limit(MaxSuggestFunnelEventNames)

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query funnel event names: %w", err)
	}
	defer rows.Close()

	names = []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan funnel event name: %w", err)
		}
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read funnel event names: %w", err)
	}
	return names, nil
}

type FunnelStepUsers struct {
	Users                     uint64   `json:"users"`
	MedianSecondsFromPrevious *float64 `json:"median_seconds_from_previous"`
}

type FunnelStepConversion struct {
	EventName string `json:"event_name"`
	FunnelStepUsers
}

// GetFunnelConversion counts how many installations reached each funnel step
// in the filter's time range and the median time between consecutive steps.
func GetFunnelConversion(ctx context.Context, rch driver.Conn, funnel Funnel, flt *filter.Filter) (conversions []FunnelStepConversion, err error) {
	ctx, span := startFunnelQuerySpan(ctx, "funnel.conversion", funnel, flt)
	defer func() {
		endFunnelSpan(span, err)
	}()

	periods, err := queryFunnelPeriods(ctx, rch, funnel, flt, []time.Time{flt.From, flt.To})
	if err != nil {
		return nil, err
	}
	conversions = make([]FunnelStepConversion, len(funnel.Steps))
	for i, step := range funnel.Steps {
		conversions[i] = FunnelStepConversion{EventName: step.EventName, FunnelStepUsers: periods[0].steps[i]}
	}
	return conversions, nil
}

type FunnelTrendPeriod string

const (
	FunnelTrendDay   FunnelTrendPeriod = "day"
	FunnelTrendWeek  FunnelTrendPeriod = "week"
	FunnelTrendMonth FunnelTrendPeriod = "month"
)

// funnelTrendLengths is how many periods a trend shows, ending with the
// current one.
var funnelTrendLengths = map[FunnelTrendPeriod]int{
	FunnelTrendDay:   30,
	FunnelTrendWeek:  12,
	FunnelTrendMonth: 12,
}

func (p FunnelTrendPeriod) Valid() bool {
	_, ok := funnelTrendLengths[p]
	return ok
}

// start returns the start of the period that contains t. Weeks start on
// Monday.
func (p FunnelTrendPeriod) start(t time.Time) time.Time {
	year, month, day := t.Date()
	switch p {
	case FunnelTrendWeek:
		day -= (int(t.Weekday()) + 6) % 7
	case FunnelTrendMonth:
		day = 1
	}
	return startOfDate(year, month, day, t.Location())
}

// add moves t, the start of a period, n periods forward.
func (p FunnelTrendPeriod) add(t time.Time, n int) time.Time {
	year, month, day := t.Date()
	switch p {
	case FunnelTrendWeek:
		day += 7 * n
	case FunnelTrendMonth:
		month += time.Month(n)
	default:
		day += n
	}
	return startOfDate(year, month, day, t.Location())
}

// startOfDate returns the first instant of a date in loc. In a time zone
// whose clocks skip midnight on that date, such as America/Santiago when
// daylight saving time starts, time.Date returns a time on the day before, and
// the date starts when that time's zone period ends.
func startOfDate(year int, month time.Month, day int, loc *time.Location) time.Time {
	t := time.Date(year, month, day, 0, 0, 0, 0, loc)
	if _, _, wantDay := time.Date(year, month, day, 12, 0, 0, 0, loc).Date(); t.Day() != wantDay {
		_, end := t.ZoneBounds()
		return end
	}
	return t
}

type FunnelTrendPoint struct {
	Datetime               string            `json:"datetime"`
	Steps                  []FunnelStepUsers `json:"steps"`
	MedianSecondsToConvert *float64          `json:"median_seconds_to_convert"`
	Complete               bool              `json:"complete"`
}

type FunnelBuild struct {
	VersionName  string    `json:"version_name"`
	VersionCode  string    `json:"version_code"`
	PatchID      *string   `json:"patch_id"`
	PatchVersion *string   `json:"patch_version"`
	UploadedAt   time.Time `json:"uploaded_at"`
}

type FunnelTrend struct {
	EventNames []string           `json:"event_names"`
	Points     []FunnelTrendPoint `json:"points"`
	Builds     []FunnelBuild      `json:"builds"`
}

// funnelTrendBoundaries returns the start of each trend period, and then the
// end of the last period. The last period contains now.
func funnelTrendBoundaries(period FunnelTrendPeriod, now time.Time) []time.Time {
	length := funnelTrendLengths[period]
	first := period.add(period.start(now), 1-length)
	boundaries := make([]time.Time, length+1)
	for i := range boundaries {
		boundaries[i] = period.add(first, i)
	}
	return boundaries
}

// getFunnelTrend counts the funnel's conversion in each period of the trend,
// the last period being the one that contains now in the filter's time zone.
// Installations that entered the funnel near the end of a period can still
// convert after it ends, so a period is complete once a conversion window
// has passed since its end. Builds are left empty unless withBuilds is set.
// now must be in the filter's time zone.
func getFunnelTrend(ctx context.Context, pg *pgxpool.Pool, rch driver.Conn, funnel Funnel, flt *filter.Filter, period FunnelTrendPeriod, withBuilds bool, now time.Time) (trend FunnelTrend, err error) {
	ctx, span := startFunnelQuerySpan(ctx, "funnel.trend", funnel, flt,
		attribute.String("funnel.period", string(period)),
		attribute.Bool("funnel.with_builds", withBuilds))
	defer func() {
		endFunnelSpan(span, err)
	}()

	boundaries := funnelTrendBoundaries(period, now)
	length := len(boundaries) - 1

	periods, err := queryFunnelPeriods(ctx, rch, funnel, flt, boundaries)
	if err != nil {
		return FunnelTrend{}, err
	}
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second
	points := make([]FunnelTrendPoint, length)
	for i, funnelPeriod := range periods {
		points[i] = FunnelTrendPoint{
			Datetime:               boundaries[i].Format(time.DateOnly),
			Steps:                  funnelPeriod.steps,
			MedianSecondsToConvert: funnelPeriod.medianSecondsToConvert,
			Complete:               !boundaries[i+1].Add(window).After(now),
		}
	}

	trend = FunnelTrend{EventNames: eventNames(funnel.Steps), Points: points, Builds: []FunnelBuild{}}
	if withBuilds {
		trend.Builds, err = getFunnelBuilds(ctx, pg, flt.AppID, boundaries[0], boundaries[length])
		if err != nil {
			return FunnelTrend{}, err
		}
	}
	return trend, nil
}

const FunnelCadenceMaxWeeks = 12

type FunnelCadenceHour struct {
	// From 1 for Monday to 7 for Sunday.
	Weekday   uint8  `json:"weekday"`
	Hour      uint8  `json:"hour"`
	Users     uint64 `json:"users"`
	Converted uint64 `json:"converted"`
}

type FunnelCadence struct {
	From  time.Time           `json:"from"`
	To    time.Time           `json:"to"`
	Hours []FunnelCadenceHour `json:"hours"`
}

// FunnelCadenceWeeks returns the start and end of the weeks a cadence counts.
// It counts whole weeks, so every hour of the week is counted equally often.
// The last week is the latest one whose installations have all had a full
// conversion window by now, so none of them can still convert.
func FunnelCadenceWeeks(now time.Time, window time.Duration, weeks int) (from, to time.Time) {
	to = FunnelTrendWeek.start(now.Add(-window))
	return FunnelTrendWeek.add(to, -weeks), to
}

// getFunnelCadence counts the installations that entered the funnel in each
// hour of the week, and how many of them converted. now must be in the
// filter's time zone.
func getFunnelCadence(ctx context.Context, rch driver.Conn, funnel Funnel, flt *filter.Filter, weeks int, now time.Time) (cadence FunnelCadence, err error) {
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second
	from, to := FunnelCadenceWeeks(now, window, weeks)

	ctx, span := startFunnelQuerySpan(ctx, "funnel.cadence", funnel, flt,
		attribute.Int("funnel.weeks", weeks),
		attribute.String("funnel.from", from.Format(time.RFC3339)),
		attribute.String("funnel.to", to.Format(time.RFC3339)))
	defer func() {
		endFunnelSpan(span, err, attribute.Int("funnel.hours", len(cadence.Hours)))
	}()

	ctx = chquery.WithTeamScope(ctx, flt.TeamID)
	pathsStmt, err := funnelPathsStmt(funnel, flt, []time.Time{from, to})
	if err != nil {
		return FunnelCadence{}, err
	}
	// reached[1] is when the installation did the first step.
	stmt := sqlf.
		Select("toDayOfWeek(toTimeZone(fromUnixTimestamp64Milli(reached[1]), ?)) as weekday", flt.Timezone).
		Select("toHour(toTimeZone(fromUnixTimestamp64Milli(reached[1]), ?)) as hour", flt.Timezone).
		Select("count()").
		Select("countIf(length(reached) = step_count)").
		From("").
		SubQuery("(", ")", pathsStmt).
		GroupBy("weekday, hour").
		OrderBy("weekday, hour")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return FunnelCadence{}, fmt.Errorf("failed to query funnel cadence: %w", err)
	}
	defer rows.Close()

	cadence = FunnelCadence{From: from, To: to, Hours: []FunnelCadenceHour{}}
	for rows.Next() {
		var hour FunnelCadenceHour
		if err := rows.Scan(&hour.Weekday, &hour.Hour, &hour.Users, &hour.Converted); err != nil {
			return FunnelCadence{}, fmt.Errorf("failed to scan funnel cadence: %w", err)
		}
		cadence.Hours = append(cadence.Hours, hour)
	}
	if err := rows.Err(); err != nil {
		return FunnelCadence{}, fmt.Errorf("failed to read funnel cadence: %w", err)
	}
	return cadence, nil
}

// getFunnelBuilds returns the app's builds and patches first uploaded between
// from and to, oldest first. A build counts as uploaded once one of its
// mapping files has finished uploading.
func getFunnelBuilds(ctx context.Context, pg *pgxpool.Pool, appID uuid.UUID, from, to time.Time) (builds []FunnelBuild, err error) {
	ctx, span := startFunnelSpan(ctx, "funnel.builds", appID,
		attribute.String("funnel.from", from.Format(time.RFC3339)),
		attribute.String("funnel.to", to.Format(time.RFC3339)))
	defer func() {
		endFunnelSpan(span, err, attribute.Int("funnel.builds", len(builds)))
	}()

	stmt := sqlf.PostgreSQL.From("build_mappings").
		Select("version_name").
		Select("version_code").
		Select("patch_id").
		Select("(array_agg(patch_version order by last_updated desc))[1]").
		Select("min(last_updated) as uploaded_at").
		Where("app_id = ?", appID).
		Where("key != ''").
		GroupBy("version_name, version_code, patch_id").
		Having("min(last_updated) >= ?", from).
		Having("min(last_updated) < ?", to).
		OrderBy("uploaded_at, version_name, version_code, patch_id")
	defer stmt.Close()

	rows, err := pg.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	builds = []FunnelBuild{}
	for rows.Next() {
		var build FunnelBuild
		var patchID uuid.UUID
		var patchVersion string
		if err := rows.Scan(&build.VersionName, &build.VersionCode, &patchID, &patchVersion, &build.UploadedAt); err != nil {
			return nil, err
		}
		if patchID != uuid.Nil {
			id := patchID.String()
			build.PatchID = &id
		}
		if patchVersion != "" {
			build.PatchVersion = &patchVersion
		}
		builds = append(builds, build)
	}
	return builds, rows.Err()
}

type funnelPeriod struct {
	steps                  []FunnelStepUsers
	medianSecondsToConvert *float64
}

// funnelPathsStmt walks each installation's funnel events and selects, as
// reached, the time it reached each step, from the first step to the furthest
// one it got to, along with the period of the walk.
//
// Events are processed in timestamp order. A path starts at the first step,
// and every later step must occur within the conversion window measured from
// that start. When a new first-step event occurs, it starts a new path. For
// each step, the query keeps the latest path that reached it, giving
// subsequent steps as much time as possible to occur within the window. A path
// that reaches a step again keeps the time it first reached it.
//
// An installation's times all come from one path: the first path that reached
// the furthest step the installation got to or, for an installation that did
// not get past the first step, its newest path, which has the most time left
// in the conversion window.
//
// For a funnel of app_open -> add_to_cart -> purchase with a 100-minute window:
//
//	minute 0    app_open     starts a path
//	minute 90   add_to_cart  reaches step 2 on that path
//	minute 95   app_open     starts a newer path
//	minute 120  purchase     does not complete the old path: it is 120 minutes
//	                         after its app_open, outside the conversion window
//	minute 150  add_to_cart  reaches step 2 on the newer path
//	minute 160  purchase     reaches step 3 on the newer path
//
// The installation reaches all three steps on the newer path. The recorded
// times between steps are 55 minutes (95 -> 150) and 10 minutes (150 -> 160).
//
// The walk's state is a tuple of (the path at each step, the path the times
// come from), and a path is an array of its step times. An empty path means no
// valid path has reached the step. Events with the same timestamp are
// processed in the order of the first step their event name is in.
//
// An installation is walked once for each period it has a first-step event
// in, and that walk starts paths only at the period's first-step events. Its
// later steps can come after the period ends, within the conversion window,
// so an installation that enters near the end of a period can still convert.
func funnelPathsStmt(funnel Funnel, flt *filter.Filter, boundaries []time.Time) (*sqlf.Stmt, error) {
	stepNames := eventNames(funnel.Steps)
	end := boundaries[len(boundaries)-1]
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second

	// An event name may appear in multiple funnel steps. Keep every matching
	// step for each name, ordered from highest to lowest, and remember the
	// lowest step number for sorting events.
	var names []string
	var nameSteps [][]int
	var nameFirstSteps []int
	nameIndexes := map[string]int{}
	for i, name := range stepNames {
		step := i + 1
		index, ok := nameIndexes[name]
		if !ok {
			index = len(names)
			nameIndexes[name] = index
			names = append(names, name)
			nameSteps = append(nameSteps, nil)
			nameFirstSteps = append(nameFirstSteps, step)
		}
		nameSteps[index] = append([]int{step}, nameSteps[index]...)
	}

	// Pack each event into an Int64 so ClickHouse can sort integers instead
	// of tuples. The packed value contains:
	//
	//	timestamp in milliseconds << 10 | first step << 5 | (31 - step)
	//
	// Sorting by this value orders events by timestamp, then by the first step
	// associated with their name, then by step number in descending order.
	// Processing higher steps first ensures that one event cannot complete
	// multiple steps in the same funnel path.
	//
	// A path can only start at step 1. Discard events before the first step-1
	// event, and skip installations that do not reach step 1.
	//
	// In a run of events for the same step, only one event affects the
	// result, so the others are dropped.
	//
	// For step 1, the last event matters. Each step-1 event starts a new path,
	// and the newest path has the most time left in the conversion window.
	//
	// For later steps, the first event matters. A path keeps the time it first
	// reached a step and ignores later events for that step.
	//
	// For example:
	//
	//	app_open, app_open, add_to_cart, add_to_cart, add_to_cart, purchase
	//
	// becomes:
	//
	//	app_open, add_to_cart, purchase
	//
	// Events after the last boundary are read so that paths can still be
	// completed by later steps within the conversion window, but first-step
	// events there start no path.
	//
	// With one period, every event belongs to it. With more, a first-step
	// event goes to the period it is in, and a later-step event also goes to
	// the periods that ended less than a conversion window before it, since
	// paths started in those periods can still reach it. Assigning periods
	// costs time, so it is skipped when there is only one.
	from := "events array join ?[transform(toString(`custom.name`), ?, arrayEnumerate(?), 0)] as funnel_step"
	periodColumn := "toUInt32(1) as period"
	groupBy := "`attribute.installation_id`"
	if len(boundaries) > 2 {
		from += ` array join arrayFilter(index -> boundaries[index] <= toUnixTimestamp64Milli(timestamp)
				and toUnixTimestamp64Milli(timestamp) < boundaries[index + 1] + if(funnel_step = 1, 0, window_ms),
			arrayEnumerate(arrayPopBack(boundaries))) as period`
		periodColumn = "period"
		groupBy += ", period"
	}
	boundariesMs := make([]int64, len(boundaries))
	for i, boundary := range boundaries {
		boundariesMs[i] = boundary.UnixMilli()
	}
	pathsStmt := sqlf.
		From(from, nameSteps, names, names).
		Select(periodColumn).
		Select("? as boundaries", boundariesMs).
		Select("? as step_count", len(stepNames)).
		Select("? as window_ms", funnel.ConversionWindowSeconds*1000).
		Select(`arraySort(groupArrayIf(bitOr(
			bitShiftLeft(toUnixTimestamp64Milli(timestamp), 10),
			bitOr(bitShiftLeft(toInt64(transform(toString(`+"`custom.name`"+`), ?, ?, 0)), 5), 31 - funnel_step)
		), funnel_step != 1 or timestamp < ?)) as packed_events`, names, nameFirstSteps, end).
		Select("arraySlice(packed_events, arrayFirstIndex(event -> bitAnd(event, 31) = 30, packed_events)) as sorted_events").
		Select(`arrayFilter((event, previous, next, i) -> if(bitAnd(event, 31) = 30,
				i = length(sorted_events) or bitAnd(next, 31) != 30,
				bitAnd(event, 31) != bitAnd(previous, 31)),
			sorted_events, arrayRotateRight(sorted_events, 1), arrayRotateLeft(sorted_events, 1), arrayEnumerate(sorted_events)
		) as kept_events`).
		Select("arrayMap(event -> bitShiftRight(event, 10), kept_events) as event_times").
		Select("arrayMap(event -> toUInt8(31 - bitAnd(event, 31)), kept_events) as event_steps").
		// Walk through events in timestamp order, updating funnel paths as each
		// event arrives. A path advances when the event is its next step and
		// occurs within the conversion window, and the advanced path replaces
		// the one kept for that step. The first path to reach a new furthest
		// step becomes the path the times come from. While the furthest step is
		// the first, each first-step event replaces it, so keeping only the
		// last event of a run of first-step events does not change the result.
		//
		// Use arrayConcat and arraySlice to replace only that step's path
		// instead of mapping over every step for every event, which is
		// significantly slower.
		Select(`arrayFold(
			(state, time, step) -> (
				if(step = 1 or (notEmpty(state.1[step - 1])
						and time - state.1[step - 1][1] <= window_ms
						and (empty(state.1[step]) or state.1[step][1] != state.1[step - 1][1])),
					arrayConcat(
						arraySlice(state.1, 1, step - 1),
						[arrayPushBack(if(step = 1, [], state.1[step - 1]), time)],
						arraySlice(state.1, step + 1)),
					state.1),
				if(step = 1 and length(state.2) <= 1,
					[time],
					if(step = length(state.2) + 1 and time - state.1[length(state.2)][1] <= window_ms,
						arrayPushBack(state.1[length(state.2)], time),
						state.2))
			),
			event_times, event_steps,
			(arrayWithConstant(step_count, []::Array(Int64)), []::Array(Int64))
		).2 as reached`).
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID).
		Where("type = 'custom'").
		Where("`custom.name` in ?", stepNames).
		Where("timestamp >= ?", boundaries[0]).
		Where("timestamp < ?", end.Add(window)).
		GroupBy(groupBy).
		Having("countIf(funnel_step = 1 and timestamp < ?) > 0", end)

	if flt.HasFilterExpr() {
		predicate, err := funnelPredicate(flt, nil, boundaries[0], end.Add(window))
		if err != nil {
			pathsStmt.Close()
			return nil, err
		}
		pathsStmt.Where(predicate.String(), predicate.Args()...)
		predicate.Close()
	}
	return pathsStmt, nil
}

// funnelPredicate builds a predicate for a funnel query over [from, to].
// Custom key conditions only consider attributes set within the filter's
// time range, so override the filter's range to match the range queried by
// the funnel.
func funnelPredicate(flt *filter.Filter, columns *filter.Columns, from, to time.Time) (*sqlf.Stmt, error) {
	scoped := *flt
	scoped.From = from
	scoped.To = to
	return scoped.Predicate(columns)
}

// queryFunnelPeriods counts, for each period between consecutive boundaries,
// how many installations reached each funnel step, the median time between
// consecutive steps, and the median time from the first step to the last.
func queryFunnelPeriods(ctx context.Context, rch driver.Conn, funnel Funnel, flt *filter.Filter, boundaries []time.Time) (periods []funnelPeriod, err error) {
	ctx, span := startFunnelQuerySpan(ctx, "funnel.periods", funnel, flt,
		attribute.String("funnel.from", boundaries[0].Format(time.RFC3339)),
		attribute.String("funnel.to", boundaries[len(boundaries)-1].Format(time.RFC3339)),
		attribute.Int("funnel.periods", len(boundaries)-1))
	defer func() {
		endFunnelSpan(span, err)
	}()

	ctx = chquery.WithTeamScope(ctx, flt.TeamID)
	stepCount := len(funnel.Steps)
	pathsStmt, err := funnelPathsStmt(funnel, flt, boundaries)
	if err != nil {
		return nil, err
	}

	// reached holds one installation's step times in milliseconds, so a time's
	// position is its step number and arrayDifference gives the gap from the
	// step before:
	//
	//	reached [0, 600000, 1200000]
	//	step 1 gap 0, step 2 gap 600000, step 3 gap 600000
	//
	// A gap of zero means both steps were sent in the same millisecond, usually
	// by one action in the app, so those gaps are left out of the median to
	// keep them from pulling it down to zero.
	stmt := sqlf.
		Select("period").
		Select("step").
		Select("count()").
		Select("medianIf(gap, gap > 0) / 1000").
		Select("medianIf(reached[step] - reached[1], step = step_count) / 1000").
		From("").
		SubQuery("(", ") array join arrayEnumerate(reached) as step, arrayDifference(reached) as gap", pathsStmt).
		GroupBy("period, step")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query funnel conversion: %w", err)
	}
	defer rows.Close()

	periods = make([]funnelPeriod, len(boundaries)-1)
	for i := range periods {
		periods[i].steps = make([]FunnelStepUsers, stepCount)
	}
	for rows.Next() {
		var period, step uint32
		var users uint64
		var medianSeconds, medianSecondsToConvert float64
		if err := rows.Scan(&period, &step, &users, &medianSeconds, &medianSecondsToConvert); err != nil {
			return nil, fmt.Errorf("failed to scan funnel conversion: %w", err)
		}
		funnelPeriod := &periods[period-1]
		funnelPeriod.steps[step-1].Users = users
		// medianIf is nan when every gap at the step was zero.
		if step > 1 && !math.IsNaN(medianSeconds) {
			funnelPeriod.steps[step-1].MedianSecondsFromPrevious = &medianSeconds
		}
		if int(step) == stepCount {
			funnelPeriod.medianSecondsToConvert = &medianSecondsToConvert
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read funnel conversion: %w", err)
	}
	return periods, nil
}

// FunnelStepRange is the part of a funnel that installations try to get
// through, from the step at index From to the step at index To.
type FunnelStepRange struct {
	From int
	To   int
}

// funnelStepAttemptsStmt selects one row for each installation that reached
// the From step of stepRange, with the time it spent trying to get to the To
// step.
//
// The attempt starts when the installation reaches the From step. It ends
// when the installation reaches the To step, or, if it does not, when its
// conversion window runs out. converted says which of the two happened, and
// both times are in milliseconds.
//
// For a funnel of app_open -> add_to_cart with a 60-minute window:
//
//	app_open at 10:00, add_to_cart at 10:05   attempt from 10:00 to 10:05, converted
//	app_open at 10:00, no add_to_cart         attempt from 10:00 to 11:00, dropped off
//
// Steps are counted from 0, while reached counts from 1, so reached[From + 1]
// is the time of the From step.
func funnelStepAttemptsStmt(funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange) (*sqlf.Stmt, error) {
	pathsStmt, err := funnelPathsStmt(funnel, flt, []time.Time{flt.From, flt.To})
	if err != nil {
		return nil, err
	}
	pathsStmt.Select("`attribute.installation_id` as installation_id")
	return sqlf.
		From("").
		SubQuery("(", ")", pathsStmt).
		Select("installation_id").
		Select("length(reached) > ? as converted", stepRange.To).
		Select("reached[? + 1] as attempt_start", stepRange.From).
		Select("if(converted, reached[? + 1], reached[1] + window_ms) as attempt_end", stepRange.To).
		Where("length(reached) > ?", stepRange.From), nil
}

type FunnelStepError struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	ErrorType  string         `json:"error_type"`
	Severity   event.Severity `json:"severity"`
	Message    string         `json:"message"`
	MethodName string         `json:"method_name"`
	FileName   string         `json:"file_name"`
	Count      uint64         `json:"count"`
	Users      uint64         `json:"users"`
	Dropped    uint64         `json:"dropped"`
	Converted  uint64         `json:"converted"`
}

// GetFunnelStepErrors lists the error groups that installations hit while
// trying to get through stepRange. For each group it counts the errors, the
// installations that hit them, and how many of those installations converted
// and how many dropped off. The groups with the most drop-offs come first.
//
// The same exception can be stored both as a crash group and as a handled
// error group, so a group is identified by its fingerprint, source type and
// severity class together. Errors whose group has no group table row are
// left out, since there are no details to show for them. The filter applies
// to the errors as it does to the step events, so an installation that
// updated the app between two steps only has its errors from the filtered
// version listed.
func GetFunnelStepErrors(ctx context.Context, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange) (stepErrors []FunnelStepError, next, previous bool, err error) {
	ctx, span := startFunnelStepSpan(ctx, "funnel.step_errors", funnel, flt, stepRange)
	defer func() {
		endFunnelSpan(span, err,
			attribute.Int("funnel.results", len(stepErrors)),
			attribute.Bool("funnel.next", next))
	}()

	ctx = chquery.WithTeamScope(ctx, flt.TeamID)
	attemptsStmt, err := funnelStepAttemptsStmt(funnel, flt, stepRange)
	if err != nil {
		return nil, false, false, err
	}
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second

	countsStmt := sqlf.
		With("attempts", attemptsStmt).
		From("events").
		Join("attempts", "attempts.installation_id = events.`attribute.installation_id`").
		Select(errorFingerprintExpr+" as fingerprint").
		Select(errorSourceTypeExpr+" as source_type").
		Select(errorSeverityClassExpr+" as severity_class").
		Select("count() as instances").
		Select("uniqExact(attempts.installation_id) as users").
		Select("uniqExactIf(attempts.installation_id, attempts.converted) as converted_users").
		Select("uniqExactIf(attempts.installation_id, not attempts.converted) as dropped_users").
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID).
		Where("type in ?", errorEventTypes).
		Where("timestamp >= ?", flt.From).
		Where("timestamp < ?", flt.To.Add(window)).
		Where("toUnixTimestamp64Milli(timestamp) between attempts.attempt_start and attempts.attempt_end").
		Where(errorFingerprintExpr + " != ''").
		GroupBy("fingerprint, source_type, severity_class")
	if flt.HasFilterExpr() {
		predicate, err := funnelPredicate(flt, nil, flt.From, flt.To.Add(window))
		if err != nil {
			countsStmt.Close()
			return nil, false, false, err
		}
		defer predicate.Close()
		countsStmt.Where(predicate.String(), predicate.Args()...)
	}

	// A group row's timestamp is the newest event in its version and month, so
	// every group with a counted event has a row at or after From, and that
	// row holds the newest details. Older rows are skipped to keep the read
	// from growing with the app's history. There is no upper bound, since a
	// group whose newest row is after To would be dropped.
	groupStmts := errorGroupStmts(flt.TeamID, flt.AppID)
	for _, groupStmt := range groupStmts {
		groupStmt.Where("timestamp >= toDateTime64(?, 3, 'UTC')", flt.From)
	}

	stmt := sqlf.
		With("counts", countsStmt).
		With("groups", unionStmts(groupStmts)).
		From("counts").
		Join("groups", "groups.id = counts.fingerprint and groups.source_type = counts.source_type and groups.severity_class = counts.severity_class").
		Select("counts.fingerprint").
		Select("counts.source_type").
		Select("groups.type").
		Select("groups.severity").
		Select("groups.message").
		Select("groups.method_name").
		Select("groups.file_name").
		Select("counts.instances").
		Select("counts.users").
		Select("counts.converted_users").
		Select("counts.dropped_users").
		OrderBy("counts.dropped_users desc, counts.users desc, counts.instances desc, counts.fingerprint, counts.source_type, counts.severity_class").
		Limit(uint64(flt.Limit) + 1).
		Offset(uint64(flt.Offset))
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to query funnel step errors: %w", err)
	}
	defer rows.Close()

	stepErrors = []FunnelStepError{}
	for rows.Next() {
		var stepError FunnelStepError
		var severity string
		if err := rows.Scan(&stepError.ID, &stepError.ErrorType, &stepError.Type, &severity, &stepError.Message, &stepError.MethodName, &stepError.FileName, &stepError.Count, &stepError.Users, &stepError.Converted, &stepError.Dropped); err != nil {
			return nil, false, false, fmt.Errorf("failed to scan funnel step errors: %w", err)
		}
		stepError.Severity = event.Severity(severity)
		stepErrors = append(stepErrors, stepError)
	}
	if err := rows.Err(); err != nil {
		return nil, false, false, fmt.Errorf("failed to read funnel step errors: %w", err)
	}
	if len(stepErrors) > flt.Limit {
		stepErrors = stepErrors[:flt.Limit]
		next = true
	}
	return stepErrors, next, flt.Offset > 0, nil
}

var FunnelQuantiles = map[string]float64{
	"p50": 0.5,
	"p90": 0.9,
	"p95": 0.95,
	"p99": 0.99,
}

type FunnelStepTrace struct {
	SpanName            string   `json:"span_name"`
	Count               uint64   `json:"count"`
	Dropped             uint64   `json:"dropped"`
	Converted           uint64   `json:"converted"`
	DroppedDurationMs   *float64 `json:"dropped_duration_ms"`
	ConvertedDurationMs *float64 `json:"converted_duration_ms"`
}

// GetFunnelStepTraces lists the root spans that started while installations
// were trying to get through stepRange. For each span name it counts the
// spans and how many of the installations that recorded them converted and
// how many dropped off, and takes the quantile of the span durations for each
// of the two groups.
//
// The span names recorded by the most installations that dropped off come
// first. A duration is null when no installation of its group recorded the
// span.
func GetFunnelStepTraces(ctx context.Context, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange, quantile float64) (stepTraces []FunnelStepTrace, next, previous bool, err error) {
	ctx, span := startFunnelStepSpan(ctx, "funnel.step_traces", funnel, flt, stepRange,
		attribute.Float64("funnel.quantile", quantile))
	defer func() {
		endFunnelSpan(span, err,
			attribute.Int("funnel.results", len(stepTraces)),
			attribute.Bool("funnel.next", next))
	}()

	ctx = chquery.WithTeamScope(ctx, flt.TeamID)
	attemptsStmt, err := funnelStepAttemptsStmt(funnel, flt, stepRange)
	if err != nil {
		return nil, false, false, err
	}
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second

	stmt := sqlf.
		With("attempts", attemptsStmt).
		From("spans").
		Join("attempts", "attempts.installation_id = spans.`attribute.installation_id`").
		Select("toString(span_name) as name").
		Select("count() as instances").
		Select("uniqExactIf(attempts.installation_id, not attempts.converted) as dropped_users").
		Select("uniqExactIf(attempts.installation_id, attempts.converted) as converted_users").
		Select("round(quantileIfOrNull(?)(dateDiff('ms', start_time, end_time), not attempts.converted), 2) as dropped_duration_ms", quantile).
		Select("round(quantileIfOrNull(?)(dateDiff('ms', start_time, end_time), attempts.converted), 2) as converted_duration_ms", quantile).
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID).
		Where("parent_id = ''").
		Where("start_time >= ?", flt.From).
		Where("start_time < ?", flt.To.Add(window)).
		Where("toUnixTimestamp64Milli(start_time) between attempts.attempt_start and attempts.attempt_end")
	if flt.HasFilterExpr() {
		predicate, err := funnelPredicate(flt, filter.FunnelSpansColumns, flt.From, flt.To.Add(window))
		if err != nil {
			stmt.Close()
			return nil, false, false, err
		}
		defer predicate.Close()
		stmt.Where(predicate.String(), predicate.Args()...)
	}
	stmt.
		GroupBy("name").
		OrderBy("dropped_users desc, instances desc, name").
		Limit(uint64(flt.Limit) + 1).
		Offset(uint64(flt.Offset))
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to query funnel step traces: %w", err)
	}
	defer rows.Close()

	stepTraces = []FunnelStepTrace{}
	for rows.Next() {
		var stepTrace FunnelStepTrace
		if err := rows.Scan(&stepTrace.SpanName, &stepTrace.Count, &stepTrace.Dropped, &stepTrace.Converted, &stepTrace.DroppedDurationMs, &stepTrace.ConvertedDurationMs); err != nil {
			return nil, false, false, fmt.Errorf("failed to scan funnel step traces: %w", err)
		}
		stepTraces = append(stepTraces, stepTrace)
	}
	if err := rows.Err(); err != nil {
		return nil, false, false, fmt.Errorf("failed to read funnel step traces: %w", err)
	}
	if len(stepTraces) > flt.Limit {
		stepTraces = stepTraces[:flt.Limit]
		next = true
	}
	return stepTraces, next, flt.Offset > 0, nil
}

type FunnelStepEndpoint struct {
	Domain             string   `json:"domain"`
	PathPattern        string   `json:"path_pattern"`
	Count              uint64   `json:"count"`
	Dropped            uint64   `json:"dropped"`
	Converted          uint64   `json:"converted"`
	DroppedLatencyMs   *float64 `json:"dropped_latency_ms"`
	ConvertedLatencyMs *float64 `json:"converted_latency_ms"`
}

// GetFunnelStepNetwork lists the URL patterns of the network requests that
// installations made while trying to get through stepRange. For each
// pattern it counts the requests and how many of the installations that made
// them converted and how many dropped off, and takes the quantile of the
// request latencies for each of the two groups. The patterns requested by the
// most installations that dropped off come first. A latency is null when no
// installation of its group made the request.
//
// A request counts once for each pattern its path matches, so a request to
// /products/42 counts under both /products/* and /products/**. Requests that
// got no response have no status code and are left out. Requests that took
// over a minute are left out too, because they are long-lived connections,
// such as a stream a screen keeps open, whose latency is how long the
// connection stayed open, and they would make the installations that stayed
// longer look slower.
func GetFunnelStepNetwork(ctx context.Context, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange, quantile float64) (stepEndpoints []FunnelStepEndpoint, next, previous bool, err error) {
	ctx, span := startFunnelStepSpan(ctx, "funnel.step_network", funnel, flt, stepRange,
		attribute.Float64("funnel.quantile", quantile))
	defer func() {
		endFunnelSpan(span, err,
			attribute.Int("funnel.results", len(stepEndpoints)),
			attribute.Bool("funnel.next", next))
	}()

	ctx = chquery.WithTeamScope(ctx, flt.TeamID)
	attemptsStmt, err := funnelStepAttemptsStmt(funnel, flt, stepRange)
	if err != nil {
		return nil, false, false, err
	}
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second

	requestsStmt := sqlf.
		With("attempts", attemptsStmt).
		From("events").
		Join("attempts", "attempts.installation_id = events.`attribute.installation_id`").
		Select("attempts.installation_id as installation_id").
		Select("attempts.converted as converted").
		Select("domain(`http.url`) as domain").
		Select("path(`http.url`) as path").
		Select("`http.end_time` - `http.start_time` as latency_ms").
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID).
		Where("type = 'http'").
		Where("timestamp >= ?", flt.From).
		Where("timestamp < ?", flt.To.Add(window)).
		Where("toUnixTimestamp64Milli(timestamp) between attempts.attempt_start and attempts.attempt_end").
		Where("`http.status_code` != 0").
		Where("latency_ms <= 60000")
	if flt.HasFilterExpr() {
		predicate, err := funnelPredicate(flt, nil, flt.From, flt.To.Add(window))
		if err != nil {
			requestsStmt.Close()
			return nil, false, false, err
		}
		defer predicate.Close()
		requestsStmt.Where(predicate.String(), predicate.Args()...)
	}

	patternsStmt := sqlf.
		From("url_patterns final").
		Select("domain").
		Select("path").
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID)

	stmt := sqlf.
		With("requests", requestsStmt).
		With("patterns", patternsStmt).
		From("requests").
		Join("patterns", "requests.domain = patterns.domain and "+network.PathPatternMatchExpression("requests.path", "patterns.path")).
		Select("requests.domain as endpoint_domain").
		Select("patterns.path as endpoint_path").
		Select("count() as requests").
		Select("uniqExactIf(requests.installation_id, not requests.converted) as dropped_users").
		Select("uniqExactIf(requests.installation_id, requests.converted) as converted_users").
		Select("round(quantileIfOrNull(?)(requests.latency_ms, not requests.converted), 2) as dropped_latency_ms", quantile).
		Select("round(quantileIfOrNull(?)(requests.latency_ms, requests.converted), 2) as converted_latency_ms", quantile).
		GroupBy("endpoint_domain, endpoint_path").
		OrderBy("dropped_users desc, requests desc, endpoint_domain, endpoint_path").
		Limit(uint64(flt.Limit) + 1).
		Offset(uint64(flt.Offset))
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to query funnel step network: %w", err)
	}
	defer rows.Close()

	stepEndpoints = []FunnelStepEndpoint{}
	for rows.Next() {
		var stepEndpoint FunnelStepEndpoint
		if err := rows.Scan(&stepEndpoint.Domain, &stepEndpoint.PathPattern, &stepEndpoint.Count, &stepEndpoint.Dropped, &stepEndpoint.Converted, &stepEndpoint.DroppedLatencyMs, &stepEndpoint.ConvertedLatencyMs); err != nil {
			return nil, false, false, fmt.Errorf("failed to scan funnel step network: %w", err)
		}
		stepEndpoints = append(stepEndpoints, stepEndpoint)
	}
	if err := rows.Err(); err != nil {
		return nil, false, false, fmt.Errorf("failed to read funnel step network: %w", err)
	}
	if len(stepEndpoints) > flt.Limit {
		stepEndpoints = stepEndpoints[:flt.Limit]
		next = true
	}
	return stepEndpoints, next, flt.Offset > 0, nil
}

type FunnelStepSession struct {
	SessionID      uuid.UUID `json:"session_id"`
	InstallationID uuid.UUID `json:"installation_id"`
	UserID         string    `json:"user_id"`
	FirstEventTime time.Time `json:"first_event_time"`
	DurationMs     int64     `json:"duration"`
}

// GetFunnelStepSessions lists the sessions of the installations that
// converted, or of those that dropped off, while trying to get through
// stepRange. A session is listed when it has an event between the start and
// end of its installation's attempt, so an installation that got from one
// step to the next across sessions has each of them listed. The installations
// that started their attempt most recently come first, each with its sessions
// from oldest to newest.
//
// The user id is the latest one set on the session's events in the attempt.
// Sessions whose only events are session starts are left out, since their
// replays would be empty.
func GetFunnelStepSessions(ctx context.Context, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange, converted bool) (stepSessions []FunnelStepSession, next, previous bool, err error) {
	ctx, span := startFunnelStepSpan(ctx, "funnel.step_sessions", funnel, flt, stepRange,
		attribute.Bool("funnel.converted", converted))
	defer func() {
		endFunnelSpan(span, err,
			attribute.Int("funnel.results", len(stepSessions)),
			attribute.Bool("funnel.next", next))
	}()

	ctx = chquery.WithTeamScope(ctx, flt.TeamID)
	attemptsStmt, err := funnelStepAttemptsStmt(funnel, flt, stepRange)
	if err != nil {
		return nil, false, false, err
	}
	attemptsStmt.Where("converted = ?", converted)
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second

	attemptSessionsStmt := sqlf.
		From("events").
		Join("attempts", "attempts.installation_id = events.`attribute.installation_id`").
		Select("session_id").
		Select("attempts.installation_id as installation_id").
		Select("attempts.attempt_start as attempt_start").
		Select("argMaxIf(`attribute.user_id`, timestamp, `attribute.user_id` != '') as user_id").
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID).
		Where("timestamp >= ?", flt.From).
		Where("timestamp < ?", flt.To.Add(window)).
		Where("toUnixTimestamp64Milli(timestamp) between attempts.attempt_start and attempts.attempt_end").
		GroupBy("session_id, installation_id, attempt_start")
	if flt.HasFilterExpr() {
		predicate, err := funnelPredicate(flt, nil, flt.From, flt.To.Add(window))
		if err != nil {
			attemptsStmt.Close()
			attemptSessionsStmt.Close()
			return nil, false, false, err
		}
		defer predicate.Close()
		attemptSessionsStmt.Where(predicate.String(), predicate.Args()...)
	}

	// A session's rows are read with no time bound, so a session that began
	// before the range keeps its real start.
	sessionTimesStmt := sqlf.
		From("sessions").
		Select("session_id").
		Select("min(first_event_timestamp) as first_event_time").
		Select("max(last_event_timestamp) as last_event_time").
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID).
		Where("session_id in (select session_id from attempt_sessions)").
		GroupBy("session_id").
		Having("sum(event_count) > sumMap(event_type_counts)['session_start']")

	stmt := sqlf.
		With("attempts", attemptsStmt).
		With("attempt_sessions", attemptSessionsStmt).
		With("session_times", sessionTimesStmt).
		From("attempt_sessions").
		Join("session_times", "session_times.session_id = attempt_sessions.session_id").
		Select("attempt_sessions.session_id").
		Select("attempt_sessions.installation_id").
		Select("attempt_sessions.user_id").
		Select("session_times.first_event_time").
		Select("toUnixTimestamp64Milli(session_times.last_event_time) - toUnixTimestamp64Milli(session_times.first_event_time)").
		OrderBy("attempt_sessions.attempt_start desc, attempt_sessions.installation_id, session_times.first_event_time, attempt_sessions.session_id").
		Limit(uint64(flt.Limit) + 1).
		Offset(uint64(flt.Offset))
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, fmt.Errorf("failed to query funnel step sessions: %w", err)
	}
	defer rows.Close()

	stepSessions = []FunnelStepSession{}
	for rows.Next() {
		var stepSession FunnelStepSession
		if err := rows.Scan(&stepSession.SessionID, &stepSession.InstallationID, &stepSession.UserID, &stepSession.FirstEventTime, &stepSession.DurationMs); err != nil {
			return nil, false, false, fmt.Errorf("failed to scan funnel step sessions: %w", err)
		}
		stepSessions = append(stepSessions, stepSession)
	}
	if err := rows.Err(); err != nil {
		return nil, false, false, fmt.Errorf("failed to read funnel step sessions: %w", err)
	}
	if len(stepSessions) > flt.Limit {
		stepSessions = stepSessions[:flt.Limit]
		next = true
	}
	return stepSessions, next, flt.Offset > 0, nil
}

// Funnel results are cached for as long as new events are unlikely to change
// them noticeably. A date range usually ends at the current time, so results
// over one expire soonest, while cadence only counts finished weeks.
const (
	funnelRangeCacheTTL   = 10 * time.Minute
	funnelCadenceCacheTTL = 6 * time.Hour
)

// The daily trend's last point is today, while an hour of new events barely
// moves a week's or a month's conversion.
var funnelTrendCacheTTLs = map[FunnelTrendPeriod]time.Duration{
	FunnelTrendDay:   10 * time.Minute,
	FunnelTrendWeek:  time.Hour,
	FunnelTrendMonth: time.Hour,
}

// Change funnelCacheVersion whenever a cached result type or the query behind
// it changes, so that entries written by the older code are no longer read.
const funnelCacheVersion = 1

// funnelCacheKey identifies a funnel by its steps and conversion window, so
// results cached before an edit to either are no longer read.
type funnelCacheKey struct {
	Query                   string
	TeamID                  uuid.UUID
	AppID                   uuid.UUID
	Steps                   []FunnelStep
	ConversionWindowSeconds int
	FilterExpr              string
	Params                  []any
}

// Each query passes the rest of what its result depends on as params.
func newFunnelCacheKey(query string, funnel Funnel, flt *filter.Filter, params ...any) funnelCacheKey {
	return funnelCacheKey{
		Query:                   query,
		TeamID:                  flt.TeamID,
		AppID:                   flt.AppID,
		Steps:                   funnel.Steps,
		ConversionWindowSeconds: funnel.ConversionWindowSeconds,
		FilterExpr:              flt.FilterExpr,
		Params:                  params,
	}
}

// flt must already be rounded by alignFunnelRange, so that the key holds the
// range the query runs on.
func newFunnelRangeCacheKey(query string, funnel Funnel, flt *filter.Filter, params ...any) funnelCacheKey {
	return newFunnelCacheKey(query, funnel, flt, append([]any{flt.From, flt.To}, params...)...)
}

func newFunnelPageCacheKey(query string, funnel Funnel, flt *filter.Filter, params ...any) funnelCacheKey {
	return newFunnelRangeCacheKey(query, funnel, flt, append([]any{flt.Limit, flt.Offset}, params...)...)
}

// A range that ends at the current time has new bounds on every request, so
// rounding them down lets repeated requests share a cached result. The newest
// events it leaves out are ones a cached result would be missing anyway. Only
// bounds taken from the clock carry seconds; a bound a person chose, such as
// the end of a custom range or the start of a trend period, arrives on a whole
// minute and is kept as sent, since rounding it would drop or add events the
// person asked about.
func alignFunnelRange(flt *filter.Filter) *filter.Filter {
	step := time.Minute
	if flt.To.Sub(flt.From) >= 24*time.Hour {
		step = 10 * time.Minute
	}
	from, to := alignFunnelBound(flt.From, step), alignFunnelBound(flt.To, step)
	if !to.After(from) {
		return flt
	}
	alignedFlt := *flt
	alignedFlt.From, alignedFlt.To = from, to
	return &alignedFlt
}

func alignFunnelBound(bound time.Time, step time.Duration) time.Time {
	if bound.Truncate(time.Minute).Equal(bound) {
		return bound
	}
	return bound.Truncate(step)
}

// Valkey errors are logged and the query runs uncached, so a Valkey outage
// slows funnel requests without failing them.
func cachedFunnelResult[T any](ctx context.Context, vk valkey.Client, funnelCacheKey funnelCacheKey, ttl time.Duration, query func() (T, error)) (T, error) {
	if vk == nil {
		return query()
	}
	keyJSON, err := json.Marshal(funnelCacheKey)
	if err != nil {
		var zero T
		return zero, err
	}
	sum := sha256.Sum256(keyJSON)
	valkeyKey := fmt.Sprintf("funnel:v%d:%s", funnelCacheVersion, hex.EncodeToString(sum[:]))

	if result, hit := readCachedFunnelResult[T](ctx, vk, funnelCacheKey, valkeyKey); hit {
		return result, nil
	}

	result, err := query()
	if err != nil {
		return result, err
	}
	body, err := json.Marshal(result)
	if err != nil {
		return result, err
	}
	writeCachedFunnelResult(ctx, vk, funnelCacheKey, valkeyKey, body, ttl)
	return result, nil
}

func readCachedFunnelResult[T any](ctx context.Context, vk valkey.Client, funnelCacheKey funnelCacheKey, valkeyKey string) (result T, hit bool) {
	ctx, span := startFunnelSpan(ctx, "funnel.cache_read", funnelCacheKey.AppID,
		attribute.String("funnel.query", funnelCacheKey.Query))
	var err error
	defer func() {
		span.SetAttributes(attribute.Bool("funnel.cache_hit", hit))
		endFunnelSpan(span, err)
	}()

	body, err := vk.Do(ctx, vk.B().Get().Key(valkeyKey).Build()).AsBytes()
	if valkey.IsValkeyNil(err) {
		err = nil
		return result, false
	}
	if err != nil {
		log.Printf("funnel cache: valkey get failed: %v", err)
		return result, false
	}
	if err = json.Unmarshal(body, &result); err != nil {
		log.Printf("funnel cache: decode failed: %v", err)
		var zero T
		return zero, false
	}
	return result, true
}

func writeCachedFunnelResult(ctx context.Context, vk valkey.Client, funnelCacheKey funnelCacheKey, valkeyKey string, body []byte, ttl time.Duration) {
	ctx, span := startFunnelSpan(ctx, "funnel.cache_write", funnelCacheKey.AppID,
		attribute.String("funnel.query", funnelCacheKey.Query),
		attribute.Int("funnel.cache_bytes", len(body)),
		attribute.Int64("funnel.cache_ttl_seconds", int64(ttl.Seconds())))
	cmd := vk.B().Set().Key(valkeyKey).Value(valkey.BinaryString(body)).ExSeconds(int64(ttl.Seconds())).Build()
	err := vk.Do(ctx, cmd).Error()
	if err != nil {
		log.Printf("funnel cache: valkey set failed: %v", err)
	}
	endFunnelSpan(span, err)
}

// funnelPage holds one page of a paginated funnel query, so it can be cached
// as one value.
type funnelPage[T any] struct {
	Results  []T  `json:"results"`
	Next     bool `json:"next"`
	Previous bool `json:"previous"`
}

func cachedFunnelPage[T any](ctx context.Context, vk valkey.Client, funnelCacheKey funnelCacheKey, query func() ([]T, bool, bool, error)) ([]T, bool, bool, error) {
	funnelPage, err := cachedFunnelResult(ctx, vk, funnelCacheKey, funnelRangeCacheTTL, func() (funnelPage[T], error) {
		results, next, previous, err := query()
		return funnelPage[T]{Results: results, Next: next, Previous: previous}, err
	})
	return funnelPage.Results, funnelPage.Next, funnelPage.Previous, err
}

// Without these dates in the key, a user could see an out of date trend until
// the cached entry expires. For example, with a daily trend and a one hour
// conversion window, a chart cached at 23:58 on Oct 19 with key dates (Oct 19,
// Oct 19) would be reused at 00:05 on Oct 20, leaving out today's point. A
// chart cached at 00:58 with key dates (Oct 20, Oct 19) would be reused at
// 01:05, still showing yesterday as incomplete.
func newFunnelTrendCacheKey(funnel Funnel, flt *filter.Filter, period FunnelTrendPeriod, withBuilds bool, now time.Time, location *time.Location) funnelCacheKey {
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second
	now = now.In(location)
	return newFunnelCacheKey("trend", funnel, flt, location.String(), period, withBuilds, period.start(now), period.start(now.Add(-window)))
}

// Without this date in the key, a user could see an out of date cadence until
// the cached entry expires. For example, with a one hour conversion window, a
// cadence cached on Monday at 00:58 with key date Oct 12 would be reused at
// 01:05, leaving out the previous week. The new key date, Oct 19, allows that
// week to be counted.
func newFunnelCadenceCacheKey(funnel Funnel, flt *filter.Filter, weeks int, now time.Time, location *time.Location) funnelCacheKey {
	window := time.Duration(funnel.ConversionWindowSeconds) * time.Second
	_, to := FunnelCadenceWeeks(now.In(location), window, weeks)
	return newFunnelCacheKey("cadence", funnel, flt, location.String(), weeks, to)
}

func GetFunnelConversionCached(ctx context.Context, vk valkey.Client, rch driver.Conn, funnel Funnel, flt *filter.Filter) ([]FunnelStepConversion, error) {
	flt = alignFunnelRange(flt)
	funnelCacheKey := newFunnelRangeCacheKey("conversion", funnel, flt)
	return cachedFunnelResult(ctx, vk, funnelCacheKey, funnelRangeCacheTTL, func() ([]FunnelStepConversion, error) {
		return GetFunnelConversion(ctx, rch, funnel, flt)
	})
}

func GetFunnelTrendCached(ctx context.Context, vk valkey.Client, pg *pgxpool.Pool, rch driver.Conn, funnel Funnel, flt *filter.Filter, period FunnelTrendPeriod, withBuilds bool) (FunnelTrend, error) {
	location, err := time.LoadLocation(flt.Timezone)
	if err != nil {
		return FunnelTrend{}, err
	}
	now := time.Now().In(location)
	funnelCacheKey := newFunnelTrendCacheKey(funnel, flt, period, withBuilds, now, location)
	return cachedFunnelResult(ctx, vk, funnelCacheKey, funnelTrendCacheTTLs[period], func() (FunnelTrend, error) {
		return getFunnelTrend(ctx, pg, rch, funnel, flt, period, withBuilds, now)
	})
}

func GetFunnelCadenceCached(ctx context.Context, vk valkey.Client, rch driver.Conn, funnel Funnel, flt *filter.Filter, weeks int) (FunnelCadence, error) {
	location, err := time.LoadLocation(flt.Timezone)
	if err != nil {
		return FunnelCadence{}, err
	}
	now := time.Now().In(location)
	funnelCacheKey := newFunnelCadenceCacheKey(funnel, flt, weeks, now, location)
	return cachedFunnelResult(ctx, vk, funnelCacheKey, funnelCadenceCacheTTL, func() (FunnelCadence, error) {
		return getFunnelCadence(ctx, rch, funnel, flt, weeks, now)
	})
}

func GetFunnelStepErrorsCached(ctx context.Context, vk valkey.Client, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange) ([]FunnelStepError, bool, bool, error) {
	flt = alignFunnelRange(flt)
	funnelCacheKey := newFunnelPageCacheKey("errors", funnel, flt, stepRange)
	return cachedFunnelPage(ctx, vk, funnelCacheKey, func() ([]FunnelStepError, bool, bool, error) {
		return GetFunnelStepErrors(ctx, rch, funnel, flt, stepRange)
	})
}

func GetFunnelStepTracesCached(ctx context.Context, vk valkey.Client, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange, quantile float64) ([]FunnelStepTrace, bool, bool, error) {
	flt = alignFunnelRange(flt)
	funnelCacheKey := newFunnelPageCacheKey("traces", funnel, flt, stepRange, quantile)
	return cachedFunnelPage(ctx, vk, funnelCacheKey, func() ([]FunnelStepTrace, bool, bool, error) {
		return GetFunnelStepTraces(ctx, rch, funnel, flt, stepRange, quantile)
	})
}

func GetFunnelStepNetworkCached(ctx context.Context, vk valkey.Client, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange, quantile float64) ([]FunnelStepEndpoint, bool, bool, error) {
	flt = alignFunnelRange(flt)
	funnelCacheKey := newFunnelPageCacheKey("network", funnel, flt, stepRange, quantile)
	return cachedFunnelPage(ctx, vk, funnelCacheKey, func() ([]FunnelStepEndpoint, bool, bool, error) {
		return GetFunnelStepNetwork(ctx, rch, funnel, flt, stepRange, quantile)
	})
}

func GetFunnelStepSessionsCached(ctx context.Context, vk valkey.Client, rch driver.Conn, funnel Funnel, flt *filter.Filter, stepRange FunnelStepRange, converted bool) ([]FunnelStepSession, bool, bool, error) {
	flt = alignFunnelRange(flt)
	funnelCacheKey := newFunnelPageCacheKey("sessions", funnel, flt, stepRange, converted)
	return cachedFunnelPage(ctx, vk, funnelCacheKey, func() ([]FunnelStepSession, bool, bool, error) {
		return GetFunnelStepSessions(ctx, rch, funnel, flt, stepRange, converted)
	})
}
