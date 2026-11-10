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

func TestRedactJWTSignatures(t *testing.T) {
	jwt := "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl"
	cases := []struct {
		name, in, want string
	}{
		{"jwt", jwt, "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.[redacted]"},
		{"bearer in message", "401 Bearer " + jwt + " rejected", "401 Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.[redacted] rejected"},
		{"two jwts", jwt + " " + jwt, "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.[redacted] eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.[redacted]"},
		{"no signature", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ"},
		{"plain text", "select http.url from events", "select http.url from events"},
		{"empty", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := redactJWTSignatures(tc.in); got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}
