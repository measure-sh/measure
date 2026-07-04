//go:build integration

package slackwebhook

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"backend/api/server"
	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// testSigningSecret is the Slack signing secret the harness configures and signs
// requests with. It is Slack's documented example secret.
const testSigningSecret = "8f742231b10e8888abcd99yyyzzz85a5"

// TestMain spins up a Postgres container for this package's integration tests.
// The webhook's DB-backed logic (team resolution, alert channels) only needs
// Postgres, so we skip the ClickHouse and Valkey containers the other harnesses
// start, and use a targeted cleanup instead of testinfra's CleanupAll. With no
// Valkey, the event-seen dedup is a no-op, which single-shot tests don't need.
var (
	th   *testinfra.TestHelper
	deps *server.Deps
)

func TestMain(m *testing.M) {
	ctx := context.Background()
	gin.SetMode(gin.TestMode)

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	th = testinfra.NewTestHelper(pgPool, nil, nil)
	deps = &server.Deps{
		PgPool: pgPool,
		Config: &server.Config{SlackSigningSecret: testSigningSecret},
	}

	code := m.Run()

	pgCleanup()
	os.Exit(code)
}

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string) {
	th.SeedTeam(ctx, t, teamID.String(), name)
}

func seedTeamSlack(ctx context.Context, t *testing.T, teamID uuid.UUID, channelIDs []string) {
	th.SeedTeamSlack(ctx, t, teamID.String(), channelIDs)
}

// pauseTeamSlack flips a seeded integration to inactive.
func pauseTeamSlack(ctx context.Context, t *testing.T, teamID uuid.UUID) {
	t.Helper()
	if _, err := deps.PgPool.Exec(ctx,
		"UPDATE measure.team_slack SET is_active = false WHERE team_id = $1", teamID); err != nil {
		t.Fatalf("pause integration: %v", err)
	}
}

// cleanupSlack truncates the tables these tests touch. testinfra's CleanupAll
// also flushes ClickHouse and Valkey, which this package's harness doesn't run.
func cleanupSlack(ctx context.Context, t *testing.T) {
	t.Helper()
	if _, err := deps.PgPool.Exec(ctx,
		"TRUNCATE TABLE measure.team_slack, measure.teams CASCADE"); err != nil {
		t.Fatalf("cleanup: %v", err)
	}
}

// slackTeamIDFor returns the slack_team_id SeedTeamSlack derives from a team id
// (left(team_id, 8)), the value the webhook resolves a workspace by.
func slackTeamIDFor(teamID uuid.UUID) string {
	return teamID.String()[:8]
}

// fakeProducer captures the events the webhook publishes to the bus so a test
// can assert what would reach the agent.
type fakeProducer struct {
	published [][]byte
	// keys[i] is the ordering key published[i] was sent with, "" for a plain
	// publish.
	keys []string
	err  error
}

func (f *fakeProducer) Publish(_ context.Context, data []byte) error {
	if f.err != nil {
		return f.err
	}
	f.published = append(f.published, data)
	f.keys = append(f.keys, "")
	return nil
}

func (f *fakeProducer) PublishOrdered(_ context.Context, orderingKey string, data []byte) error {
	if f.err != nil {
		return f.err
	}
	f.published = append(f.published, data)
	f.keys = append(f.keys, orderingKey)
	return nil
}

func (f *fakeProducer) Close() error { return nil }

// slackSignHeader builds the headers Slack would send for the given body,
// timestamp and signing secret.
func slackSignHeader(secret string, ts time.Time, body []byte) http.Header {
	timestamp := strconv.FormatInt(ts.Unix(), 10)
	h := http.Header{}
	h.Set("X-Slack-Request-Timestamp", timestamp)
	h.Set("X-Slack-Signature", computeSlackSignature(secret, timestamp, body))
	return h
}

// eventCallback wraps an inner event object in an event_callback envelope.
func eventCallback(slackTeamID, eventID, inner string) []byte {
	return fmt.Appendf(nil,
		`{"type":"event_callback","team_id":%q,"event_id":%q,"event":%s}`,
		slackTeamID, eventID, inner)
}

// postSignedSlack runs a signed request through the webhook and returns the
// recorder. contentType is application/json for the Events API or
// application/x-www-form-urlencoded for slash commands.
func postSignedSlack(wh *Webhook, secret, contentType string, body []byte) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/slack/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", contentType)
	for k, vs := range slackSignHeader(secret, time.Now(), body) {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	c.Request = req
	wh.HandleSlackEvents(c)
	return w
}
