package agent

import (
	"strings"
	"testing"
	"time"

	chparser "github.com/AfterShip/clickhouse-sql-parser/parser"
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
		// A "from" inside a string value is not a clause, and neither is a ';'.
		`select count(*) from {{events}} where screen = 'sent from checkout'`,
		`select count(*) from {{events}} where screen = 'a;b'`,
		// Multibyte text before a placeholder must not shift where it is replaced.
		`select count(*) from {{events}} where screen = 'héllo日本'`,
		// ClickHouse features the agent relies on. Each one pins a parser
		// capability, so a parser upgrade that loses it fails here.
		`select quantile(0.9)(duration) from {{spans}}`,
		`select uniqExact(session_id), countIf(type = 'exception') from {{events}}`,
		`select toStartOfInterval(timestamp, INTERVAL 1 hour) as h, count() from {{events}} group by h order by h`,
		`select session_id, type from {{events}} order by timestamp desc limit 3 by session_id`,
		`select session_id, count() over (partition by session_id) from {{events}} limit 5`,
		`select count() from {{events}} prewhere type = 'exception'`,
		`select arrayFilter(x -> x != '', groupArray(screen)) from {{events}}`,
		`select type from {{events}} union all select span_name from {{spans}}`,
		// ARRAY JOIN operands are columns of the row set, not tables.
		`select c from {{spans}} array join checkpoints as c`,
		`select a, b from {{spans}} array join checkpoints as a, checkpoints as b`,
		// IN can take a table name in ClickHouse, so a placeholder is valid
		// there.
		`select count(*) from {{events}} where session_id in {{spans}}`,
		`select count(*) from {{events}} where session_id not in (select session_id from {{spans}})`,
		`with 'exception' as v select count(*) from {{events}} where type = v`,
		// The same placeholder twice: two refs, two positions, both claimed.
		`select a.type, count(*) from {{events}} a join {{events}} b on a.session_id = b.session_id group by a.type`,
		`select count(*) from {{events}}, {{spans}}`,
		// The CTE form that carries its name in the Alias field.
		`with (select 1) as v select count(*) from {{events}}`,
		// More parser capability pins.
		`select type, count() from {{events}} group by type with rollup`,
		`select count()::Float64 from {{events}}`,
		`select count(*) from {{events}} where type in ('a', 'b')`,
		`select map('a', 1)['a'] from {{events}} limit 1`,
	}
	for _, q := range allowed {
		if _, _, err := validateAgentSQL(q, sets); err != nil {
			t.Errorf("expected allowed, got error %q for query: %s", err, q)
		}
	}

	denied := []struct {
		query string
		want  string
	}{
		{`select * from events`, "placeholder"},
		{`select 1; select 2`, "single statement"},
		{`select count(*) from {{events}};`, "single statement"},
		{`insert into {{events}} values (1)`, "only SELECT"},
		{`select * from {{events}} where 1 = (select 1 from system.tables)`, "cross-database"},
		{`select * from {{unknown_table}}`, "unknown table placeholder"},
		{`select * from numbers(10), {{events}}`, "table functions"},
		{`select * from url('http://example.com', CSV), {{events}}`, "table functions"},
		{`select * from remote('127.0.0.1', system.one), {{events}}`, "table functions"},
		{`with t as (select 1) select * from t, schema_migrations where 0 = (select count(*) from {{events}})`, "not queryable"},
		{`with t as (select 1) select * from t as x, schema_migrations where 0 = (select count(*) from {{events}})`, "not queryable"},
		{`select * from app_metrics, {{events}}`, "not queryable"},
		{`select * from {{app_metrics}}`, "unknown table placeholder"},
		{`select * from {{events}} e, system.processes`, "cross-database"},
		{`select * from {{events}}, numbers(10)`, "table functions"},
		{`select 1`, "placeholder"},
		{`select count(*) from {{events}} where type = 'x' and 1=1 union all select count(*) from system.processes`, "cross-database"},
		{`select count(*) from {{events}} union all select count(*) from events`, "via the {{events}} placeholder"},
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
		// A FROM target the parser cannot read is rejected, never passed.
		{`select * from 123, {{events}}`, "invalid SQL"},
		// Oversized input is rejected before any scanning or parsing.
		{"select count(*) from {{events}} where screen = '" + strings.Repeat("a", maxQueryBytes) + "'", "too long"},
		// A FORMAT clause would change how the driver reads result rows.
		{`select * from {{events}} format JSONEachRow`, "FORMAT"},
		// A CTE named after a table would shadow it inside the scoped
		// subqueries, in either field the parser stores the name in.
		{`with events as (select 1) select * from {{spans}}`, "shadows"},
		{`with (select 1) as events select * from {{spans}}`, "shadows"},
		// An empty query has no placeholders.
		{``, "placeholder"},
		// IN can take a table name, so raw and dotted names there are table
		// reads, in every operator spelling. GLOBAL NOT IN does not parse in
		// this parser version; pin that so an upgrade that starts accepting
		// it gets noticed.
		{`select count(*) from {{events}} where session_id in spans`, "via the {{spans}} placeholder"},
		{`select count(*) from {{events}} where session_id not in spans`, "via the {{spans}} placeholder"},
		{`select count(*) from {{events}} where session_id global in spans`, "via the {{spans}} placeholder"},
		{`select count(*) from {{events}} where session_id global not in spans`, "invalid SQL"},
		{`select count(*) from {{events}} where session_id in system.one`, "cross-database"},
		// A placeholder that is not used as a table never reaches expansion.
		{`select count(*) from {{events}} where screen = 'see {{spans}} here'`, "must be a table"},
		{`select * from {{events}} as {{spans}}`, "must be a table"},
		// Subqueries inside an ARRAY JOIN operand still read tables.
		{`select x from {{spans}} array join (select id from app_metrics) as x`, "not queryable"},
		// A real join chained after ARRAY JOIN operands is still a table join.
		{`select c from {{spans}} array join checkpoints as c join events on 1=1`, "via the {{events}} placeholder"},
	}
	for _, tc := range denied {
		_, _, err := validateAgentSQL(tc.query, sets)
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
	sets := testSets()
	teamID := uuid.MustParse("0196792a-0000-7000-8000-000000000000")
	from := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)

	expand := func(t *testing.T, query string, appIDs []uuid.UUID) string {
		t.Helper()
		subst, refs, err := validateAgentSQL(query, sets)
		if err != nil {
			t.Fatalf("validateAgentSQL: %v", err)
		}
		return expandPlaceholders(subst, refs, teamID, appIDs, from, to)
	}

	t.Run("one app across a join", func(t *testing.T) {
		appA := uuid.MustParse("0196792b-0000-7000-8000-000000000001")
		got := expand(t, `select count(*) from {{events}} e join {{ spans }} s on 1=1`, []uuid.UUID{appA})
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
		got := expand(t, `select count(*) from {{events}}`, []uuid.UUID{appA, appB})
		want := `select count(*) from ` +
			`(select * from events where team_id = toUUID('0196792a-0000-7000-8000-000000000000')` +
			` and app_id in (toUUID('0196792b-0000-7000-8000-000000000001'), toUUID('0196792b-0000-7000-8000-000000000002'))` +
			` and timestamp >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and timestamp <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC'))`
		if got != want {
			t.Errorf("expandPlaceholders mismatch:\n got: %s\nwant: %s", got, want)
		}
	})

	t.Run("placeholder after IN", func(t *testing.T) {
		appA := uuid.MustParse("0196792b-0000-7000-8000-000000000001")
		got := expand(t, `select count(*) from {{events}} where session_id in {{spans}}`, []uuid.UUID{appA})
		want := `select count(*) from ` +
			`(select * from events where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id in (toUUID('0196792b-0000-7000-8000-000000000001')) and timestamp >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and timestamp <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC')) where session_id in ` +
			`(select * from spans where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id in (toUUID('0196792b-0000-7000-8000-000000000001')) and start_time >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and start_time <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC'))`
		if got != want {
			t.Errorf("expandPlaceholders mismatch:\n got: %s\nwant: %s", got, want)
		}
	})

	t.Run("multibyte text before a placeholder", func(t *testing.T) {
		appA := uuid.MustParse("0196792b-0000-7000-8000-000000000001")
		got := expand(t, `select 'héllo日本' as x, count(*) from {{events}}`, []uuid.UUID{appA})
		want := `select 'héllo日本' as x, count(*) from ` +
			`(select * from events where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id in (toUUID('0196792b-0000-7000-8000-000000000001')) and timestamp >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and timestamp <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC'))`
		if got != want {
			t.Errorf("expandPlaceholders mismatch:\n got: %s\nwant: %s", got, want)
		}
	})

	t.Run("same table twice", func(t *testing.T) {
		appA := uuid.MustParse("0196792b-0000-7000-8000-000000000001")
		got := expand(t, `select count(*) from {{events}} a join {{events}} b on a.session_id = b.session_id`, []uuid.UUID{appA})
		sub := `(select * from events where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id in (toUUID('0196792b-0000-7000-8000-000000000001')) and timestamp >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and timestamp <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC'))`
		want := `select count(*) from ` + sub + ` a join ` + sub + ` b on a.session_id = b.session_id`
		if got != want {
			t.Errorf("expandPlaceholders mismatch:\n got: %s\nwant: %s", got, want)
		}
	})
}

// FuzzValidateAgentSQL checks that the validator never panics on arbitrary
// input, and that every query it accepts expands into SQL the parser can
// read again with no placeholder left over.
func FuzzValidateAgentSQL(f *testing.F) {
	seeds := []string{
		`select count(*) from {{events}}`,
		`select e.type from {{events}} e join {{spans}} s on e.session_id = s.session_id`,
		"select `attribute.app_version`, count(*) from {{events}} group by `attribute.app_version`",
		`select count(*) from {{events}} where string_value = 'it\'s the settings page'`,
		`select count(*) from {{events}} where session_id in {{spans}}`,
		`select c from {{spans}} array join checkpoints as c`,
		`with t as (select type from {{events}}) select * from t`,
		`select * from events`,
		`select count(*) from {{events}} settings SQL_agent_team_ids='x'`,
		`select * from {{events}} -- comment`,
		`insert into {{events}} values (1)`,
		`select * from {{events}} where x = 'see {{spans}} here'`,
	}
	for _, s := range seeds {
		f.Add(s)
	}

	sets := testSets()
	teamID := uuid.MustParse("0196792a-0000-7000-8000-000000000000")
	appID := uuid.MustParse("0196792b-0000-7000-8000-000000000001")
	from := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)

	f.Fuzz(func(t *testing.T, query string) {
		subst, refs, err := validateAgentSQL(query, sets)
		if err != nil {
			return
		}
		expanded := expandPlaceholders(subst, refs, teamID, []uuid.UUID{appID}, from, to)
		if placeholderRe.MatchString(expanded) {
			t.Errorf("expansion left a placeholder in the query\nquery: %q\nexpanded: %q", query, expanded)
		}
		if _, perr := chparser.NewParser(expanded).ParseStmts(); perr != nil {
			t.Errorf("accepted query expands to SQL the parser rejects\nquery: %q\nexpanded: %q\nerr: %v", query, expanded, perr)
		}
	})
}
