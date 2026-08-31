package exprfilter

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"testing"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
)

var errQueryRecorded = errors.New("query recorded")

// sqlRecorder satisfies driver.Conn through the embedded interface and
// records the one query a fetch function issues before failing it, so a test
// can assert the SQL an entity sends to ClickHouse without a database.
type sqlRecorder struct {
	driver.Conn
	query string
	args  []any
}

func (r *sqlRecorder) Query(ctx context.Context, query string, args ...any) (driver.Rows, error) {
	r.query = query
	// The fetch functions close their statement on return, which recycles the
	// argument slice, so the recorder copies it while the values are intact.
	r.args = slices.Clone(args)
	return nil, errQueryRecorded
}

// The suggestion and key-listing statements below are pinned verbatim: the
// key listing carries `settings use_skip_indexes = 0` and no final, value
// reads carry neither, values order by recency desc then value, and listings
// order by key. The bug reports statements keep the bug_report flag between
// the app scope and the key conditions.
func TestSuggestionSQL(t *testing.T) {
	teamID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	appID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	ctx := context.Background()

	tests := []struct {
		name     string
		run      func(recorder *sqlRecorder)
		wantSQL  string
		wantArgs []any
	}{
		{
			name: "spans fixed key values read the span_filters rollup by month",
			run: func(recorder *sqlRecorder) {
				byName := IndexKeysByName(SpansEntity.Keys)
				_, _ = SpansEntity.SuggestKeyValues(ctx, nil, recorder, teamID, appID, byName["device_name"], ValueRequest{Search: "Ph%one_x"})
			},
			wantSQL: "SELECT device_name as suggested_value, max(end_of_month) as recency" +
				" FROM span_filters" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND device_name <> '' AND device_name ilike ?" +
				" GROUP BY suggested_value ORDER BY recency desc, suggested_value LIMIT ?",
			wantArgs: []any{teamID, appID, `%Ph\%one\_x%`, DefaultValueLimit + 1},
		},
		{
			name: "spans patch id values read the column as text and leave out the nil uuid",
			run: func(recorder *sqlRecorder) {
				byName := IndexKeysByName(SpansEntity.Keys)
				_, _ = SpansEntity.SuggestKeyValues(ctx, nil, recorder, teamID, appID, byName["patch_id"], ValueRequest{})
			},
			wantSQL: "SELECT toString(patch_id) as suggested_value, max(end_of_month) as recency" +
				" FROM span_filters" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND toString(patch_id) <> ?" +
				" GROUP BY suggested_value ORDER BY recency desc, suggested_value LIMIT ?",
			wantArgs: []any{teamID, appID, uuid.Nil.String(), DefaultValueLimit + 1},
		},
		{
			name: "bug report fixed key values read the bug_reports table by timestamp",
			run: func(recorder *sqlRecorder) {
				byName := IndexKeysByName(BugReportsEntity.Keys)
				_, _ = BugReportsEntity.SuggestKeyValues(ctx, nil, recorder, teamID, appID, byName["device_name"], ValueRequest{})
			},
			wantSQL: "SELECT device_name as suggested_value, max(timestamp) as recency" +
				" FROM bug_reports" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND device_name <> ''" +
				" GROUP BY suggested_value ORDER BY recency desc, suggested_value LIMIT ?",
			wantArgs: []any{teamID, appID, DefaultValueLimit + 1},
		},
		{
			name: "bug report patch id values read the column as text and leave out the nil uuid",
			run: func(recorder *sqlRecorder) {
				byName := IndexKeysByName(BugReportsEntity.Keys)
				_, _ = BugReportsEntity.SuggestKeyValues(ctx, nil, recorder, teamID, appID, byName["patch_id"], ValueRequest{})
			},
			wantSQL: "SELECT toString(patch_id) as suggested_value, max(timestamp) as recency" +
				" FROM bug_reports" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND toString(patch_id) <> ?" +
				" GROUP BY suggested_value ORDER BY recency desc, suggested_value LIMIT ?",
			wantArgs: []any{teamID, appID, uuid.Nil.String(), DefaultValueLimit + 1},
		},
		{
			name: "span custom key values read span_user_def_attrs by key and type",
			run: func(recorder *sqlRecorder) {
				_, _ = SpansEntity.SuggestKeyValues(ctx, nil, recorder, teamID, appID, CustomKey("plan", ValueTypeString), ValueRequest{})
			},
			wantSQL: "SELECT value, max(timestamp) as recency" +
				" FROM span_user_def_attrs" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND key = ? AND type = ? AND value <> ''" +
				" GROUP BY value ORDER BY recency desc, value LIMIT ?",
			wantArgs: []any{teamID, appID, "plan", "string", DefaultValueLimit + 1},
		},
		{
			name: "bug report custom key values keep to the rows flagged bug_report",
			run: func(recorder *sqlRecorder) {
				_, _ = BugReportsEntity.SuggestKeyValues(ctx, nil, recorder, teamID, appID, CustomKey("plan", ValueTypeString), ValueRequest{Search: "fr", Limit: 3})
			},
			wantSQL: "SELECT value, max(timestamp) as recency" +
				" FROM user_def_attrs" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND bug_report = true AND key = ? AND type = ? AND value <> '' AND value ilike ?" +
				" GROUP BY value ORDER BY recency desc, value LIMIT ?",
			wantArgs: []any{teamID, appID, "plan", "string", "%fr%", 4},
		},
		{
			name: "the span custom key listing skips the skip indexes",
			run: func(recorder *sqlRecorder) {
				_, _, _ = SpansEntity.FetchCustomKeys(ctx, nil, recorder, teamID, appID, CustomKeyLimit)
			},
			wantSQL: "SELECT key, argMax(type, timestamp) as type" +
				" FROM span_user_def_attrs" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?)" +
				" GROUP BY key ORDER BY key LIMIT ? settings use_skip_indexes = 0",
			wantArgs: []any{teamID, appID, CustomKeyLimit + 1},
		},
		{
			name: "the bug report custom key listing keeps to the rows flagged bug_report",
			run: func(recorder *sqlRecorder) {
				_, _, _ = BugReportsEntity.FetchCustomKeys(ctx, nil, recorder, teamID, appID, CustomKeyLimit)
			},
			wantSQL: "SELECT key, argMax(type, timestamp) as type" +
				" FROM user_def_attrs" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND bug_report = true" +
				" GROUP BY key ORDER BY key LIMIT ? settings use_skip_indexes = 0",
			wantArgs: []any{teamID, appID, CustomKeyLimit + 1},
		},
		{
			name: "span custom keys resolve by name without a limit or settings",
			run: func(recorder *sqlRecorder) {
				_, _ = SpansEntity.FetchCustomKeysByName(ctx, nil, recorder, teamID, appID, []string{"plan", "retries"})
			},
			wantSQL: "SELECT key, argMax(type, timestamp) as type" +
				" FROM span_user_def_attrs" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND key in ?" +
				" GROUP BY key ORDER BY key",
			wantArgs: []any{teamID, appID, []string{"plan", "retries"}},
		},
		{
			name: "bug report custom keys resolve by name behind the bug_report flag",
			run: func(recorder *sqlRecorder) {
				_, _ = BugReportsEntity.FetchCustomKeysByName(ctx, nil, recorder, teamID, appID, []string{"plan"})
			},
			wantSQL: "SELECT key, argMax(type, timestamp) as type" +
				" FROM user_def_attrs" +
				" WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND bug_report = true AND key in ?" +
				" GROUP BY key ORDER BY key",
			wantArgs: []any{teamID, appID, []string{"plan"}},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := &sqlRecorder{}
			test.run(recorder)

			if recorder.query != test.wantSQL {
				t.Errorf("\n got %s\nwant %s", recorder.query, test.wantSQL)
			}
			if !reflect.DeepEqual(recorder.args, test.wantArgs) {
				t.Errorf("\n got args %#v\nwant args %#v", recorder.args, test.wantArgs)
			}
		})
	}
}
