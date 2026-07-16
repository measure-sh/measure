package agent

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func testSets() *tableSets {
	return &tableSets{
		scoped: map[string]bool{"events": true, "spans": true},
		all:    map[string]bool{"events": true, "spans": true, "app_metrics": true, "schema_migrations": true},
	}
}

func TestValidateAgentSQL(t *testing.T) {
	sets := testSets()

	allowed := []string{
		`select count(*) from {{events}}`,
		`SELECT type, count(*) FROM {{events}} GROUP BY type ORDER BY count(*) DESC`,
		`select * from {{ events }} limit 10`,
		`select e.type from {{events}} e join {{spans}} s on e.session_id = s.session_id`,
		`with t as (select type from {{events}}) select * from t`,
		`select count(*) from (select * from {{events}} where type = 'exception')`,
		`select count(*) from {{events}} where string_value = 'Settings'`,
		`select count(*) from {{events}} where string_value = 'it\'s the settings page'`,
		// Backtick-quoted columns are pervasive in the schema and must pass,
		// including one whose name embeds the word "from".
		"select `attribute.app_version`, count(*) from {{events}} group by `attribute.app_version`",
		"select `navigation.from`, count(*) from {{events}} where `navigation.from` != '' group by `navigation.from`",
		// A "from" inside a string value is not a clause.
		`select count(*) from {{events}} where screen = 'sent from checkout'`,
	}
	for _, q := range allowed {
		if err := validateAgentSQL(q, sets); err != nil {
			t.Errorf("expected allowed, got error %q for query: %s", err, q)
		}
	}

	denied := []struct {
		query string
		want  string
	}{
		{`select * from events`, "placeholder"},
		{`select 1; select 2`, "single statement"},
		{`insert into {{events}} values (1)`, "only SELECT"},
		{`select * from {{events}} where 1 = (select 1 from system.tables)`, "cross-database"},
		{`select * from {{unknown_table}}`, "unknown table placeholder"},
		{`select * from numbers(10), {{events}}`, "table functions"},
		{`select * from url('http://example.com', CSV), {{events}}`, "table functions"},
		{`with t as (select 1) select * from t, schema_migrations where 0 = (select count(*) from {{events}})`, "not queryable"},
		{`with t as (select 1) select * from t as x, schema_migrations where 0 = (select count(*) from {{events}})`, "not queryable"},
		{`select * from app_metrics, {{events}}`, "not queryable"},
		{`select * from {{app_metrics}}`, "unknown table placeholder"},
		{`select * from {{events}} e, system.processes`, "cross-database"},
		{`select * from {{events}}, numbers(10)`, "table functions"},
		{`select 1`, "placeholder"},
		{`select count(*) from {{events}} where type = 'x' and 1=1 union all select count(*) from system.processes`, "cross-database"},
		{`alter table {{events}} delete where 1`, "only SELECT"},
		{`select count(*) from {{events}} settings SQL_agent_team_ids='0196792a-0000-7000-8000-000000000000'`, "SETTINGS"},
		{`select * from (select * from {{events}} SeTtInGs max_result_rows=0)`, "SETTINGS"},
		{`select count(*) from {{events}} where type = 'x'
			settings max_execution_time=600`, "SETTINGS"},
		// Quoted-identifier raw tables that dodge placeholder scoping.
		{"select count(*) from `events`, {{spans}}", "placeholder"},
		{`select count(*) from "events", {{spans}}`, "placeholder"},
		{"select count(*) from {{spans}} union all select count(*) from `events`", "placeholder"},
		{"select count(*) from `app_metrics`, {{spans}}", "not queryable"},
		{"select count(*) from `system`.`processes`, {{spans}}", "cross-database"},
		// Comments can hide a raw table, a table function, or split a keyword.
		{"select count(*) from/**/events, {{spans}}", "comments"},
		{"select * from url/**/('http://x','CSV','a String'), {{events}}", "comments"},
		{"select * from {{events}} -- and events\nunion all select 1", "comments"},
		{"select * from {{events}} # note", "comments"},
		// An unmodeled FROM target is rejected rather than passed.
		{`select * from 123, {{events}}`, "unrecognized"},
	}
	for _, tc := range denied {
		err := validateAgentSQL(tc.query, sets)
		if err == nil {
			t.Errorf("expected error containing %q, got nil for query: %s", tc.want, tc.query)
			continue
		}
		if !strings.Contains(err.Error(), tc.want) {
			t.Errorf("expected error containing %q, got %q for query: %s", tc.want, err, tc.query)
		}
	}
}

func TestExpandPlaceholders(t *testing.T) {
	teamID := uuid.MustParse("0196792a-0000-7000-8000-000000000000")
	from := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)

	t.Run("one app across a join", func(t *testing.T) {
		appA := uuid.MustParse("0196792b-0000-7000-8000-000000000001")
		got := expandPlaceholders(`select count(*) from {{events}} e join {{ spans }} s on 1=1`, teamID, []uuid.UUID{appA}, from, to)
		want := `select count(*) from ` +
			`(select * from events where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id in (toUUID('0196792b-0000-7000-8000-000000000001')) and timestamp >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and timestamp <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC')) e join ` +
			`(select * from spans where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id in (toUUID('0196792b-0000-7000-8000-000000000001')) and start_time >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and start_time <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC')) s on 1=1`
		if got != want {
			t.Errorf("expandPlaceholders mismatch:\n got: %s\nwant: %s", got, want)
		}
	})

	t.Run("scoped to apps", func(t *testing.T) {
		appA := uuid.MustParse("0196792b-0000-7000-8000-000000000001")
		appB := uuid.MustParse("0196792b-0000-7000-8000-000000000002")
		got := expandPlaceholders(`select count(*) from {{events}}`, teamID, []uuid.UUID{appA, appB}, from, to)
		want := `select count(*) from ` +
			`(select * from events where team_id = toUUID('0196792a-0000-7000-8000-000000000000')` +
			` and app_id in (toUUID('0196792b-0000-7000-8000-000000000001'), toUUID('0196792b-0000-7000-8000-000000000002'))` +
			` and timestamp >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and timestamp <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC'))`
		if got != want {
			t.Errorf("expandPlaceholders mismatch:\n got: %s\nwant: %s", got, want)
		}
	})
}

// An incomplete scope (nil team, empty app set) is refused before the query
// reaches ClickHouse or any dependency.
func TestRunSQLRejectsIncompleteScope(t *testing.T) {
	teamID := uuid.MustParse("0196792a-0000-7000-8000-000000000000")
	appID := uuid.MustParse("0196792b-0000-7000-8000-000000000000")
	from := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		name   string
		teamID uuid.UUID
		appIDs []uuid.UUID
	}{
		{"nil team", uuid.Nil, []uuid.UUID{appID}},
		{"no apps", teamID, nil},
		{"both missing", uuid.Nil, nil},
	}

	c := &Config{}
	for _, tc := range cases {
		_, err := c.runSQL(context.Background(), `select count(*) from {{events}}`, tc.teamID, tc.appIDs, from, to)
		if err == nil {
			t.Errorf("%s: expected refusal, got nil", tc.name)
			continue
		}
		if !strings.Contains(err.Error(), "scope is incomplete") {
			t.Errorf("%s: expected scope error, got %q", tc.name, err)
		}
	}
}

// One-sided or length-mismatched paired filters are refused before the
// filter reaches any dependency.
func TestMCPBuildAppFilterRejectsUnpairedFilters(t *testing.T) {
	appID := uuid.MustParse("0196792b-0000-7000-8000-000000000000")

	rejected := []struct {
		name string
		cf   mcpCommonFilters
		want string
	}{
		{"versions only", mcpCommonFilters{Versions: []string{"1.0"}}, "versions and version_codes"},
		{"version_codes only", mcpCommonFilters{VersionCodes: []string{"1"}}, "versions and version_codes"},
		{"version length mismatch", mcpCommonFilters{Versions: []string{"1.0", "1.1"}, VersionCodes: []string{"1"}}, "versions and version_codes"},
		{"os_versions only", mcpCommonFilters{OsVersions: []string{"26.1"}}, "os_versions must be paired with os_names"},
		{"os length mismatch", mcpCommonFilters{OsNames: []string{"ios"}, OsVersions: []string{"26.0", "26.1"}}, "os_versions must be paired with os_names"},
	}

	c := &Config{}
	for _, tc := range rejected {
		_, err := c.mcpBuildAppFilter(context.Background(), appID, tc.cf)
		if err == nil {
			t.Errorf("%s: expected refusal, got nil", tc.name)
			continue
		}
		if !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: expected error containing %q, got %q", tc.name, tc.want, err)
		}
	}

	accepted := []struct {
		name string
		cf   mcpCommonFilters
	}{
		{"paired versions", mcpCommonFilters{Versions: []string{"1.0"}, VersionCodes: []string{"1"}}},
		{"os_names alone", mcpCommonFilters{Versions: []string{"1.0"}, VersionCodes: []string{"1"}, OsNames: []string{"android", "ios"}}},
		{"paired os_versions", mcpCommonFilters{Versions: []string{"1.0"}, VersionCodes: []string{"1"}, OsNames: []string{"ios", "ios"}, OsVersions: []string{"26.0", "26.1"}}},
	}

	for _, tc := range accepted {
		af, err := c.mcpBuildAppFilter(context.Background(), appID, tc.cf)
		if err != nil {
			t.Errorf("%s: expected success, got %q", tc.name, err)
			continue
		}
		if len(af.Versions) != len(af.VersionCodes) {
			t.Errorf("%s: filter has unpaired versions", tc.name)
		}
	}
}
