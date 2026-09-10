package exprfilter

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
)

// fixedKeyValueSource says where an entity's fixed-key value suggestions are
// read from: a ClickHouse table, the column expression each key's values are
// read from, and the aggregate expression that dates a value for
// most-recently-seen-first ordering. timeColumn names the row timestamp of a
// raw table so the read stays within the suggestion window; a rollup that is
// small enough to read whole leaves it empty. arrayColumns marks a source
// whose column expressions are arrays, so each element is suggested as its own
// value; the elements are expanded with an ARRAY JOIN clause because ClickHouse
// refuses to cache a query that calls its arrayJoin function.
type fixedKeyValueSource struct {
	table        string
	columns      map[string]string
	recencyExpr  string
	timeColumn   string
	arrayColumns bool

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
// been typed. An enum key answers from its own value list without a read, a
// custom key reads the entity's custom key store, and every other key is
// answered by the entity's fixed-key suggester.
func (e Entity) SuggestKeyValues(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	if len(key.EnumValues) > 0 {
		return narrowEnumValues(key, valueRequest), nil
	}

	if e.CustomKeys != nil && strings.HasPrefix(key.Name, CustomKeyPrefix) {
		if key.ValueSuggestionMode == ValueSuggestionModeNone {
			return ValueList{}, fmt.Errorf("Key %q takes typed-in values only", key.Name)
		}
		return e.CustomKeys.suggestValues(ctx, chPool, teamID, appID, key, valueRequest)
	}

	return e.SuggestFixedKeyValues(ctx, pgPool, chPool, teamID, appID, key, valueRequest)
}

// suggestFixedKeyValuesFromClickHouse builds an entity's fixed-key value
// suggester. An entity may pass several sources because a rollup table
// answers most of its keys while a few keys only exist on the entity's own
// table; the first source that has a key answers it.
func suggestFixedKeyValuesFromClickHouse(sources ...fixedKeyValueSource) func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	return func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
		if key.ValueSuggestionMode == ValueSuggestionModeNone {
			return ValueList{}, fmt.Errorf("Key %q takes typed-in values only", key.Name)
		}

		var fixedValues fixedKeyValueSource
		var column string
		var ok bool
		for _, source := range sources {
			if column, ok = source.columns[key.Name]; ok {
				fixedValues = source
				break
			}
		}
		if !ok {
			return ValueList{}, fmt.Errorf("%w: %q", ErrKeyNotSupported, key.Name)
		}

		limit := valueRequest.effectiveLimit()

		ctx = chquery.WithTeamScope(ctx, teamID)

		// Unset attributes use an empty string, except UUID columns,
		// which use the nil UUID. Unset values are excluded.
		// UUID columns are read as text so searches and returned
		// values use strings. Ties are ordered alphabetically.
		from := fixedValues.table
		valueExpr := column
		if fixedValues.arrayColumns {
			from += " ARRAY JOIN " + column + " AS array_value"
			valueExpr = "array_value"
		}
		unsetTest := valueExpr + " <> ''"
		var unsetArgs []any
		if key.ValueType == ValueTypeUUID {
			valueExpr = "toString(" + valueExpr + ")"
			unsetTest = valueExpr + " <> ?"
			unsetArgs = []any{uuid.Nil.String()}
		}

		stmt := sqlf.
			From(from).
			Select(valueExpr+" as suggested_value").
			Select(fixedValues.recencyExpr+" as recency").
			Where("team_id = toUUID(?)", teamID).
			Where("app_id = toUUID(?)", appID)

		if fixedValues.timeColumn != "" {
			stmt.Where(fixedValues.timeColumn+" >= ?", suggestionWindowStart())
		}

		if fixedValues.extraScope != "" {
			stmt.Where(fixedValues.extraScope)
		}

		stmt.
			Where(unsetTest, unsetArgs...).
			GroupBy("suggested_value").
			OrderBy("recency desc, suggested_value").
			Limit(limit + 1)

		defer stmt.Close()

		if valueRequest.Search != "" {
			stmt.Where(valueExpr+" ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
		}

		return readSuggestedValues(ctx, chPool, key, stmt, limit)
	}
}

// readSuggestedValues runs a suggestion statement that selects a value and
// its recency per row, and reports the list truncated when more than limit
// rows come back, which the statement arranged by asking for one extra row.
func readSuggestedValues(ctx context.Context, chPool driver.Conn, key Key, stmt *sqlf.Stmt, limit int) (ValueList, error) {
	rows, err := chPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}
	defer rows.Close()

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

	if len(values) > limit {
		return ValueList{Values: values[:limit], Truncated: true}, nil
	}

	return ValueList{Values: values}, nil
}
