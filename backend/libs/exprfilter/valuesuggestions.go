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
// most-recently-seen-first ordering.
type fixedKeyValueSource struct {
	table       string
	columns     map[string]string
	recencyExpr string
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
// suggester over a ClickHouse value source: each key reads its column, most
// recently seen first, and a key that takes typed-in values only is refused.
func suggestFixedKeyValuesFromClickHouse(fixedValues fixedKeyValueSource) func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	return func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
		if key.ValueSuggestionMode == ValueSuggestionModeNone {
			return ValueList{}, fmt.Errorf("Key %q takes typed-in values only", key.Name)
		}

		column, ok := fixedValues.columns[key.Name]
		if !ok {
			return ValueList{}, fmt.Errorf("%w: %q", ErrKeyNotSupported, key.Name)
		}

		limit := valueRequest.effectiveLimit()

		ctx = chquery.WithTeamScope(ctx, teamID)

		// A row that did not carry an attribute holds an empty string in that
		// column, so those rows are left out. Values tied on recency order
		// alphabetically.
		stmt := sqlf.
			From(fixedValues.table).
			Select(column+" as suggested_value").
			Select(fixedValues.recencyExpr+" as recency").
			Where("team_id = toUUID(?)", teamID).
			Where("app_id = toUUID(?)", appID).
			Where(column + " <> ''").
			GroupBy("suggested_value").
			OrderBy("recency desc, suggested_value").
			Limit(limit + 1)

		defer stmt.Close()

		if valueRequest.Search != "" {
			stmt.Where(column+" ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
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
