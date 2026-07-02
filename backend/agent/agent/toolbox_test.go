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
	appID := uuid.MustParse("0196792b-0000-7000-8000-000000000000")
	from := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)

	got := expandPlaceholders(`select count(*) from {{events}} e join {{ spans }} s on 1=1`, teamID, appID, from, to)
	want := `select count(*) from ` +
		`(select * from events where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id = toUUID('0196792b-0000-7000-8000-000000000000') and timestamp >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and timestamp <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC')) e join ` +
		`(select * from spans where team_id = toUUID('0196792a-0000-7000-8000-000000000000') and app_id = toUUID('0196792b-0000-7000-8000-000000000000') and start_time >= toDateTime64('2025-03-01 00:00:00.000', 3, 'UTC') and start_time <= toDateTime64('2025-04-01 00:00:00.000', 3, 'UTC')) s on 1=1`
	if got != want {
		t.Errorf("expandPlaceholders mismatch:\n got: %s\nwant: %s", got, want)
	}
}

// A nil team or app id must be refused before the query reaches ClickHouse,
// so an incomplete scope can never run as an unscoped or wrong-team query.
func TestRunSQLRejectsIncompleteScope(t *testing.T) {
	teamID := uuid.MustParse("0196792a-0000-7000-8000-000000000000")
	appID := uuid.MustParse("0196792b-0000-7000-8000-000000000000")
	from := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		name   string
		teamID uuid.UUID
		appID  uuid.UUID
	}{
		{"nil team", uuid.Nil, appID},
		{"nil app", teamID, uuid.Nil},
		{"both nil", uuid.Nil, uuid.Nil},
	}

	c := &Config{}
	for _, tc := range cases {
		_, err := c.runSQL(context.Background(), `select count(*) from {{events}}`, tc.teamID, tc.appID, from, to)
		if err == nil {
			t.Errorf("%s: expected refusal, got nil", tc.name)
			continue
		}
		if !strings.Contains(err.Error(), "scope is incomplete") {
			t.Errorf("%s: expected scope error, got %q", tc.name, err)
		}
	}
}
