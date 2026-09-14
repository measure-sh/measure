package filter

import (
	"context"
	"fmt"
	"strings"

	"backend/libs/chquery"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel/attribute"
)

// customKeySource says where an entity's user-defined attributes are read
// from: a ClickHouse table holding one row per entity row, attribute and
// value, with the value of every type stored in one String column.
type customKeySource struct {
	table string

	// idColumn identifies the entity row an attribute row belongs to, and is
	// what membership subqueries select.
	idColumn string

	// entityColumn is the entity table's column a membership subquery
	// compares idColumn against, when the two are named differently: the
	// events table calls event_id id. Empty means the same name as idColumn.
	entityColumn string

	// extraScope is an extra boolean SQL clause for tables shared by more than
	// one entity, such as the bug_report flag of user_def_attrs; empty when
	// the table holds one entity's rows only.
	extraScope string
}

func (s customKeySource) matchColumn() string {
	if s.entityColumn != "" {
		return s.entityColumn
	}
	return s.idColumn
}

// keyQuery reads an app's user-defined attribute keys with their types. An
// attribute rewritten under a new type keeps one row per type, so the type
// written last is the one its key offers.
//
// The scan is on the full table without a time bound. If needed in future:
// time bound it so only keys in time range show up or add a rollup of
// distinct keys and values like the span_filters rollup that fixed keys read.
func (s customKeySource) keyQuery(teamID, appID uuid.UUID) *sqlf.Stmt {
	stmt := sqlf.
		From(s.table).
		Select("key").
		Select("argMax(type, timestamp) as type").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID)

	if s.extraScope != "" {
		stmt.Where(s.extraScope)
	}

	return stmt.
		GroupBy("key").
		OrderBy("key")
}

func (s customKeySource) fetchKeys(ctx context.Context, chPool driver.Conn, teamID, appID uuid.UUID, limit int) (keys []Key, truncated bool, err error) {
	ctx, span := startReadSpan(ctx, "filter.custom_keys", s.table, teamID, appID,
		attribute.Int("filter.limit", limit))
	defer func() {
		endReadSpan(span, err,
			attribute.Int("filter.keys", len(keys)),
			attribute.Bool("filter.truncated", truncated))
	}()

	stmt := s.keyQuery(teamID, appID).
		Limit(limit + 1).
		// Most granules hold rows of this team and app anyway, so skip
		// indexes cost analysis without pruning reads.
		Clause("settings use_skip_indexes = 0")

	defer stmt.Close()

	keys, err = readCustomKeys(ctx, chPool, teamID, stmt)
	if err != nil {
		return nil, false, err
	}

	if len(keys) > limit {
		return keys[:limit], true, nil
	}
	return keys, false, nil
}

func (s customKeySource) fetchKeysByName(ctx context.Context, chPool driver.Conn, teamID, appID uuid.UUID, rawNames []string) (keys []Key, err error) {
	if len(rawNames) == 0 {
		return nil, nil
	}

	ctx, span := startReadSpan(ctx, "filter.custom_keys_by_name", s.table, teamID, appID,
		attribute.Int("filter.names", len(rawNames)))
	defer func() {
		endReadSpan(span, err, attribute.Int("filter.keys", len(keys)))
	}()

	stmt := s.keyQuery(teamID, appID).
		Where("key in ?", rawNames)

	defer stmt.Close()

	return readCustomKeys(ctx, chPool, teamID, stmt)
}

// suggestValues lists what one user-defined attribute has been set to, most
// recently written first, leaving empty values out.
//
// The scan reads the raw attribute table within the suggestion window. If
// it gets slow, add a rollup of distinct keys and values like the
// span_filters rollup that fixed keys read.
func (s customKeySource) suggestValues(ctx context.Context, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (valueList ValueList, err error) {
	limit := valueRequest.effectiveLimit()

	ctx, span := startReadSpan(ctx, "filter.custom_values", s.table, teamID, appID,
		attribute.String("filter.key", key.Name),
		attribute.Int("filter.limit", limit),
		attribute.Bool("filter.search", valueRequest.Search != ""))
	defer func() {
		endReadSpan(span, err,
			attribute.Int("filter.values", len(valueList.Values)),
			attribute.Bool("filter.truncated", valueList.Truncated))
	}()

	ctx = chquery.WithTeamScope(ctx, teamID)

	stmt := sqlf.
		From(s.table).
		Select("value").
		Select("max(timestamp) as recency").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID).
		Where("timestamp >= ?", suggestionWindowStart())

	if s.extraScope != "" {
		stmt.Where(s.extraScope)
	}

	stmt.
		Where("key = ?", strings.TrimPrefix(key.Name, CustomKeyPrefix)).
		Where("type = ?", string(key.ValueType)).
		Where("value <> ''").
		GroupBy("value").
		OrderBy("recency desc, value").
		Limit(limit + 1)

	defer stmt.Close()

	if valueRequest.Search != "" {
		stmt.Where("value ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
	}

	rows, err := chPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}
	defer rows.Close()
	return readSuggestedValues(rows, key, limit)
}

func readCustomKeys(ctx context.Context, ch driver.Conn, teamID uuid.UUID, stmt *sqlf.Stmt) ([]Key, error) {
	ctx = chquery.WithTeamScope(ctx, teamID)

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("Failed to read the user-defined attribute keys: %w", err)
	}
	defer rows.Close()

	keys := []Key{}
	for rows.Next() {
		var rawName, storedType string
		if err := rows.Scan(&rawName, &storedType); err != nil {
			return nil, fmt.Errorf("Failed to read the user-defined attribute keys: %w", err)
		}
		valueType, ok := customValueTypes[storedType]
		if !ok {
			return nil, fmt.Errorf("Attribute %q stores values of unknown type %q", rawName, storedType)
		}
		keys = append(keys, CustomKey(rawName, valueType))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("Failed to read the user-defined attribute keys: %w", err)
	}

	return keys, nil
}
