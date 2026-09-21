package filter

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend/libs/chquery"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel/attribute"
)

// valueSource says where an entity's fixed keys read their value
// suggestions from.
type valueSource struct {
	table   string
	columns *Columns

	// The aggregate that dates a value, for most-recently-seen-first order.
	recencyExpr string

	// The row timestamp a raw table is windowed on. A rollup small enough to
	// read whole leaves it empty.
	timeColumn string

	// extraScope is an extra boolean SQL clause for tables holding more than
	// the entity's rows. The events table holds every event type of event, so the
	// errors entity reads user ids from it with type in ('exception', 'anr').
	// Empty when every row belongs to the entity.
	extraScope string
}

// A suggestion is only a shortcut for typing a value, so a raw table is read
// for the last 30 days only; older values can still be typed in. The start of
// the window is computed here and bound as a parameter because ClickHouse
// refuses to cache a query that calls its own now() function. The driver
// writes the bound time into the query text, so the start is rounded down to
// the hour; otherwise the text would change every second and no read would
// ever find a cached result.
func suggestionWindowStart() time.Time {
	return time.Now().Add(-30 * 24 * time.Hour).Truncate(time.Hour)
}

// SuggestKeyValues lists what one key can be set to, narrowed by what has
// been typed.
func (e Entity) SuggestKeyValues(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	if len(key.EnumValues) > 0 {
		return narrowEnumValues(key, valueRequest), nil
	}

	if key.ValueSuggestionMode == ValueSuggestionModeNone {
		return ValueList{}, fmt.Errorf("Key %q takes typed-in values only", key.Name)
	}

	if e.CustomKeySource != nil && strings.HasPrefix(key.Name, CustomKeyPrefix) {
		return e.CustomKeySource.suggestValues(ctx, chPool, teamID, appID, key, valueRequest)
	}

	return suggestFixedKeyValues(ctx, pgPool, chPool, teamID, appID, e.ValueSources, key, valueRequest)
}

// An entity has several sources when a rollup answers most of its keys and
// a few exist only on its own table; the first source that has the key
// answers it.
func suggestFixedKeyValues(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, sources []valueSource, key Key, valueRequest ValueRequest) (valueList ValueList, err error) {
	var source valueSource
	var col column
	var ok bool
	for _, candidate := range sources {
		if col, ok = candidate.columns.byKey[key.Name]; ok {
			source = candidate
			break
		}
	}
	if !ok {
		return ValueList{}, fmt.Errorf("%w: %q", ErrKeyNotSupported, key.Name)
	}

	limit := valueRequest.effectiveLimit()

	ctx, span := startReadSpan(ctx, "filter.values", source.table, teamID, appID,
		attribute.String("filter.key", key.Name),
		attribute.Int("filter.limit", limit),
		attribute.Bool("filter.search", valueRequest.Search != ""))
	defer func() {
		endReadSpan(span, err,
			attribute.Int("filter.values", len(valueList.Values)),
			attribute.Bool("filter.truncated", valueList.Truncated))
	}()

	// Each element of an array column is suggested on its own. The elements
	// are expanded with ARRAY JOIN because ClickHouse refuses to cache a
	// query that calls arrayJoin.
	from := source.table
	valueExpr := col.expr
	if col.kind == columnTextArray || col.kind == columnUUIDArray {
		from += " ARRAY JOIN " + col.expr + " AS array_value"
		valueExpr = "array_value"
	}

	// A row the key does not apply to holds the unset value, an empty string
	// or the nil uuid, and is left out. A uuid column is read as text so the
	// search and the returned values are strings.
	unsetTest := valueExpr + " <> ''"
	var unsetArgs []any
	if col.kind == columnUUID || col.kind == columnUUIDArray {
		valueExpr = fmt.Sprintf(uuidAsText[source.columns.dialect], valueExpr)
		unsetTest = valueExpr + " <> ?"
		unsetArgs = []any{uuid.Nil.String()}
	}

	var stmt *sqlf.Stmt
	switch source.columns.dialect {
	case dialectClickHouse:
		ctx = chquery.WithTeamScope(ctx, teamID)
		stmt = sqlf.From(from).
			Where("team_id = toUUID(?)", teamID).
			Where("app_id = toUUID(?)", appID)
	case dialectPostgres:
		stmt = sqlf.PostgreSQL.From(from).
			Where("app_id = ?", appID)
	}
	stmt.
		Select(valueExpr + " as suggested_value").
		Select(source.recencyExpr + " as recency")

	if source.timeColumn != "" {
		stmt.Where(source.timeColumn+" >= ?", suggestionWindowStart())
	}

	if source.extraScope != "" {
		stmt.Where(source.extraScope)
	}

	// Ties are ordered alphabetically.
	stmt.
		Where(unsetTest, unsetArgs...).
		GroupBy("suggested_value").
		OrderBy("recency desc, suggested_value").
		Limit(limit + 1)

	defer stmt.Close()

	if valueRequest.Search != "" {
		stmt.Where(valueExpr+" ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
	}

	var rows suggestedValueRows
	switch source.columns.dialect {
	case dialectClickHouse:
		chRows, err := chPool.Query(ctx, stmt.String(), stmt.Args()...)
		if err != nil {
			return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
		}
		defer chRows.Close()
		rows = chRows
	case dialectPostgres:
		pgRows, err := pgPool.Query(ctx, stmt.String(), stmt.Args()...)
		if err != nil {
			return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
		}
		defer pgRows.Close()
		rows = pgRows
	}

	return readSuggestedValues(rows, key, limit)
}

// suggestedValueRows is the part of the ClickHouse and pgx row cursors that
// reading suggested values needs, so one reader serves either dialect.
type suggestedValueRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

// The statement asked for one row past the limit, so an extra row means
// the list is truncated without counting the rest.
func readSuggestedValues(rows suggestedValueRows, key Key, limit int) (ValueList, error) {
	values := []Value{}
	for rows.Next() {
		var text string
		var recency time.Time
		if err := rows.Scan(&text, &recency); err != nil {
			return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
		}
		values = append(values, Value{Text: text})
	}
	if err := rows.Err(); err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}

	truncated := len(values) > limit
	if truncated {
		values = values[:limit]
	}

	// Version keys list the latest release first. The page is cut to the
	// limit before it is reordered so the row past the limit is dropped by
	// recency, as for every other key, and not by version.
	if isVersionKey(key.Name) {
		sortVersionValues(values)
	}

	return ValueList{Values: values, Truncated: truncated}, nil
}
