package exprfilter

import (
	"context"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// BuildsEntity is an app's uploaded builds. Both its filtering and its
// value lists read the build_mappings rows in Postgres.
var BuildsEntity = Entity{
	Name:             "builds",
	Keys:             buildsKeys,
	BindKey:          bindBuildsKey,
	SuggestKeyValues: fetchBuildsKeySuggestions,
}

var buildsKeys = []Key{
	versionName,
	versionCode,
	mappingType,
	patchVersion,
	patchID,
}

// bindBuildsKey compares one key against the build_mappings column of the
// same name. Every key must answer each operator it offers, so a missing case
// means a filter passed validation that cannot be written, and the request
// fails.
func bindBuildsKey(condition Condition) (*sqlf.Stmt, error) {
	switch condition.KeyName {
	case versionName.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("version_name = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("version_name <> all(?)", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New("version_name ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorStartsWith:
			return sqlf.New("version_name ilike ?", EscapeLikeWildcards(condition.TextValue())+"%"), nil
		}

	case versionCode.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("version_code = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("version_code <> all(?)", condition.TextValues()), nil
		}

	case mappingType.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("mapping_type = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("mapping_type <> all(?)", condition.TextValues()), nil
		}

	case patchVersion.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("patch_version = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("patch_version <> all(?)", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New("patch_version ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		}

	case patchID.Name:
		// A regular build carries the nil uuid rather than null, so that value
		// is what "not set" compares against.
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("patch_id::text = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("patch_id::text <> all(?)", condition.TextValues()), nil
		case OperatorIsSet:
			return sqlf.New("patch_id::text <> '" + uuid.Nil.String() + "'"), nil
		case OperatorIsNotSet:
			return sqlf.New("patch_id::text = '" + uuid.Nil.String() + "'"), nil
		}

	default:
		return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// fetchBuildsKeySuggestions lists what one key can be set to, narrowed by what has been
// typed. It asks for one row past the limit so it can report that more matched
// without counting them. Builds are read from Postgres only, so the ClickHouse
// connection and the team id are unused here.
func fetchBuildsKeySuggestions(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	if len(key.EnumValues) > 0 {
		return narrowEnumValues(key, valueRequest), nil
	}

	if key.ValueSuggestionMode == ValueSuggestionModeNone {
		return ValueList{}, fmt.Errorf("Key %q is typed in rather than picked from a list", key.Name)
	}

	limit := valueRequest.Limit
	if limit <= 0 {
		limit = DefaultValueLimit
	}

	// A row the key does not apply to holds the unset value in that column, so
	// those rows are left out: a regular build has no patch columns and a patch
	// upload has no version columns.
	column := key.Name
	unset := "''"
	if key.ValueType == ValueTypeUUID {
		column += "::text"
		unset = "'" + uuid.Nil.String() + "'"
	}

	stmt := sqlf.PostgreSQL.From("build_mappings").
		Select(column).
		Select("max(last_updated) as recency").
		Where("app_id = ?", appID).
		Where(column + " <> " + unset).
		GroupBy(column).
		OrderBy("recency desc").
		Limit(limit + 1)

	defer stmt.Close()

	if valueRequest.Search != "" {
		stmt.Where(column+" ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
	}

	rows, err := pgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}
	defer rows.Close()

	values := []Value{}
	for rows.Next() {
		var text string
		var recency any
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
