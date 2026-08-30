package exprfilter

import (
	"context"
	"fmt"
	"strings"

	"backend/libs/chquery"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// customKeyStore says where an entity's user-defined attributes are stored: a
// ClickHouse table holding one row per entity row, attribute and value, with
// the value of every type stored in one String column. The store answers the
// entity's custom-key listing, by-name resolution and value suggestions, and
// bindConditions turns conditions on its keys into membership subqueries. The
// attributes are read from ClickHouse, so the Postgres pool the entity fields
// carry is unused here.
type customKeyStore struct {
	table string

	// idColumn identifies the entity row an attribute row belongs to, and is
	// what membership subqueries select.
	idColumn string

	// extraScope is an extra boolean SQL clause for tables shared by more than
	// one entity, such as the bug_report flag of user_def_attrs; empty when
	// the table holds one entity's rows only.
	extraScope string
}

// keyQuery reads an app's user-defined attribute keys with their types. An
// attribute rewritten under a new type keeps one row per type, so the type
// written last is the one its key offers.
//
// The scan is on the full table without a time bound. If needed in future:
// time bound it so only keys in time range show up or add a rollup of
// distinct keys and values like the span_filters rollup that fixed keys read.
func (s customKeyStore) keyQuery(teamID, appID uuid.UUID) *sqlf.Stmt {
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

// fetchKeys lists the filter keys for every user-defined attribute of an
// app's entity rows, ordered by name. It asks for one key past the limit so
// it can report that more exist without counting them.
func (s customKeyStore) fetchKeys(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, limit int) ([]Key, bool, error) {
	stmt := s.keyQuery(teamID, appID).
		Limit(limit + 1).
		// Most granules hold rows of this team and app anyway, so skip
		// indexes cost analysis without pruning reads.
		Clause("settings use_skip_indexes = 0")

	defer stmt.Close()

	keys, err := readCustomKeys(ctx, chPool, teamID, stmt)
	if err != nil {
		return nil, false, err
	}

	if len(keys) > limit {
		return keys[:limit], true, nil
	}
	return keys, false, nil
}

// fetchKeysByName reads the filter keys for the named user-defined attributes
// of one app.
func (s customKeyStore) fetchKeysByName(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, rawNames []string) ([]Key, error) {
	if len(rawNames) == 0 {
		return nil, nil
	}

	stmt := s.keyQuery(teamID, appID).
		Where("key in ?", rawNames)

	defer stmt.Close()

	return readCustomKeys(ctx, chPool, teamID, stmt)
}

// suggestValues lists what one user-defined attribute has been set to, most
// recently written first, asking for one row past the limit so it can report
// that more matched without counting them. Empty ones are left out.
//
// The scan is on the full table without a time bound. If needed in future:
// time bound it so only suggestions in time range show up or add a rollup of
// distinct keys and values like the span_filters rollup that fixed keys read.
func (s customKeyStore) suggestValues(ctx context.Context, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	limit := valueRequest.effectiveLimit()

	ctx = chquery.WithTeamScope(ctx, teamID)

	stmt := sqlf.
		From(s.table).
		Select("value").
		Select("max(timestamp) as recency").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID)

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

	return readSuggestedValues(ctx, chPool, key, stmt, limit)
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
