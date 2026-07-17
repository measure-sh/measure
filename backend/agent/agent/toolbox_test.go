package agent

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

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
