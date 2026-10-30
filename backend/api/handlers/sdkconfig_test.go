//go:build integration

package handlers

import (
	"backend/api/server"
	"backend/libs/sdkconfig"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func seedSdkConfig(ctx context.Context, t *testing.T) (appID uuid.UUID, userID string) {
	t.Helper()

	userID = uuid.NewString()
	teamID := uuid.New()
	seedUser(ctx, t, userID, "sdkconfig@test.com")
	seedTeam(ctx, t, teamID, testTeamName)
	seedTeamMembership(ctx, t, teamID, userID, "owner")

	appID = uuid.New()
	seedApp(ctx, t, appID, teamID, 30)

	tx, err := th.PgPool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	uid := uuid.MustParse(userID)
	if err := sdkconfig.CreateConfig(ctx, tx, teamID, appID, &uid); err != nil {
		t.Fatalf("create sdk config: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit sdk config: %v", err)
	}

	return appID, userID
}

func patchMaxEvents(t *testing.T, deps *server.Deps, appID uuid.UUID, userID string, value int) error {
	t.Helper()

	body := strings.NewReader(`{"max_events_in_batch":` + strconv.Itoa(value) + `}`)
	c, _ := newTestGinContext("PATCH", "/apps/"+appID.String()+"/config", body)
	return PatchConfigForApp(c, deps, appID, userID)
}

func maxEventsInDb(ctx context.Context, t *testing.T, appID uuid.UUID) int {
	t.Helper()

	var n int
	if err := th.PgPool.QueryRow(ctx,
		`SELECT max_events_in_batch FROM sdk_config WHERE app_id = $1`, appID).Scan(&n); err != nil {
		t.Fatalf("read max_events_in_batch: %v", err)
	}
	return n
}

func cachedMaxEvents(ctx context.Context, t *testing.T, appID uuid.UUID) int {
	t.Helper()

	data, err := sdkconfig.GetCache(ctx, th.VK, appID)
	if err != nil {
		t.Fatalf("get cache: %v", err)
	}
	if data == "" {
		t.Fatal("cache empty, want a value")
	}

	var config sdkconfig.SdkConfig
	if err := json.Unmarshal([]byte(data), &config); err != nil {
		t.Fatalf("unmarshal cached config: %v", err)
	}
	return config.MaxEventsInBatch
}

func TestPatchConfigForApp_SlowReaderCannotOverwrite(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)
	staleJSON := []byte(`{"max_events_in_batch":1111}`)

	if err := sdkconfig.SetCacheIfAbsent(ctx, th.VK, appID, staleJSON); err != nil {
		t.Fatalf("repopulate cache: %v", err)
	}

	if got := cachedMaxEvents(ctx, t, appID); got != 1111 {
		t.Fatalf("cached max_events_in_batch = %d, want 1111, absent key was not populated", got)
	}

	if err := patchMaxEvents(t, deps, appID, userID, 4242); err != nil {
		t.Fatalf("patch config: %v", err)
	}

	if err := sdkconfig.SetCacheIfAbsent(ctx, th.VK, appID, staleJSON); err != nil {
		t.Fatalf("repopulate cache: %v", err)
	}

	if got := cachedMaxEvents(ctx, t, appID); got != 4242 {
		t.Errorf("cached max_events_in_batch = %d, want 4242", got)
	}
}

func TestPatchConfigForApp_CacheFailureStillUpdates(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)

	noCache := *deps
	noCache.VK = nil

	if err := patchMaxEvents(t, &noCache, appID, userID, 4242); err != nil {
		t.Fatalf("patch config: %v", err)
	}

	if got := maxEventsInDb(ctx, t, appID); got != 4242 {
		t.Errorf("max_events_in_batch = %d, want 4242", got)
	}
}

func TestGetCache_ErrorIsNotMiss(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID := uuid.New()

	data, err := sdkconfig.GetCache(ctx, th.VK, appID)
	if err != nil || data != "" {
		t.Errorf("missing key: got (%q, %v), want (\"\", nil)", data, err)
	}

	deadCtx, cancel := context.WithCancel(ctx)
	cancel()

	if _, err := sdkconfig.GetCache(deadCtx, th.VK, appID); err == nil {
		t.Error("unusable client returned nil error, want an error")
	}
}

func patchConfig(t *testing.T, appID uuid.UUID, userID, body string) {
	t.Helper()

	c, _ := newTestGinContext("PATCH", "/apps/"+appID.String()+"/config", strings.NewReader(body))
	if err := PatchConfigForApp(c, deps, appID, userID); err != nil {
		t.Fatalf("patch config: %v", err)
	}
}

func insertConfigChange(ctx context.Context, t *testing.T, appID uuid.UUID, changedAt time.Time, changes string) {
	t.Helper()

	if _, err := th.PgPool.Exec(ctx,
		`INSERT INTO sdk_config_history (app_id, changed_at, changes) VALUES ($1, $2, $3)`,
		appID, changedAt, changes); err != nil {
		t.Fatalf("insert config change: %v", err)
	}
}

func TestPatchConfigForApp_RecordsChangedFields(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)

	patchConfig(t, appID, userID,
		`{"trace_sampling_rate":10,"journey_sampling_rate":100,"http_blocked_headers":["x-token"]}`)

	var changedBy uuid.UUID
	var changedAt, updatedAt time.Time
	var changes map[string]sdkconfig.SdkConfigFieldChange
	if err := th.PgPool.QueryRow(ctx,
		`SELECT c.changed_by, c.changed_at, c.changes, s.updated_at
		FROM sdk_config_history c JOIN sdk_config s ON s.app_id = c.app_id
		WHERE c.app_id = $1`, appID).Scan(&changedBy, &changedAt, &changes, &updatedAt); err != nil {
		t.Fatalf("read config change: %v", err)
	}

	if changedBy.String() != userID {
		t.Errorf("changed_by = %s, want %s", changedBy, userID)
	}
	if !changedAt.Equal(updatedAt) {
		t.Errorf("changed_at = %v, want sdk_config.updated_at %v", changedAt, updatedAt)
	}

	keys := make([]string, 0, len(changes))
	for key := range changes {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	if want := []string{"http_blocked_headers", "trace_sampling_rate"}; !slices.Equal(keys, want) {
		t.Fatalf("changed keys = %v, want %v", keys, want)
	}

	if got := changes["trace_sampling_rate"]; got.Old != float64(100) || got.New != float64(10) {
		t.Errorf("trace_sampling_rate change = %+v, want 100 to 10", got)
	}
	if got := changes["http_blocked_headers"]; len(got.Old.([]any)) != 0 || got.New.([]any)[0] != "x-token" {
		t.Errorf("http_blocked_headers change = %+v, want [] to [x-token]", got)
	}
}

func TestPatchConfigForApp_UnchangedPatchRecordsNothing(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)

	// max_events_in_batch changes, but the dashboard doesn't show it
	patchConfig(t, appID, userID, `{"trace_sampling_rate":100,"max_events_in_batch":500}`)

	var n int
	if err := th.PgPool.QueryRow(ctx,
		`SELECT count(*) FROM sdk_config_history WHERE app_id = $1`, appID).Scan(&n); err != nil {
		t.Fatalf("count config changes: %v", err)
	}
	if n != 0 {
		t.Errorf("config changes = %d, want 0", n)
	}
}

func TestGetConfigHistory(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)

	base := time.Now().Add(-time.Hour)
	insertConfigChange(ctx, t, appID, base, `{"crash_timeline_duration":{"old":300,"new":60}}`)
	insertConfigChange(ctx, t, appID, base.Add(time.Minute),
		`{"crash_take_screenshot":{"old":true,"new":false},"anr_take_screenshot":{"old":true,"new":false}}`)
	patchConfig(t, appID, userID, `{"trace_sampling_rate":10}`)

	c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/config/history", nil)
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	h.GetConfigHistory(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp struct {
		Results []sdkconfig.ConfigChange `json:"results"`
		Meta    struct {
			Next     bool `json:"next"`
			Previous bool `json:"previous"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if len(resp.Results) != 2 {
		t.Fatalf("results = %d, want 2, the change with only unknown keys left out", len(resp.Results))
	}

	newest := resp.Results[0]
	if _, ok := newest.Changes["trace_sampling_rate"]; !ok || len(newest.Changes) != 1 {
		t.Errorf("newest changes = %v, want only trace_sampling_rate", newest.Changes)
	}
	if newest.ChangedByEmail == nil || *newest.ChangedByEmail != "sdkconfig@test.com" {
		t.Errorf("newest changed_by_email = %v, want sdkconfig@test.com", newest.ChangedByEmail)
	}

	older := resp.Results[1]
	if _, ok := older.Changes["anr_take_screenshot"]; !ok || len(older.Changes) != 1 {
		t.Errorf("older changes = %v, want only anr_take_screenshot", older.Changes)
	}
	if older.ChangedByEmail != nil {
		t.Errorf("older changed_by_email = %v, want nil", *older.ChangedByEmail)
	}

	if resp.Meta.Next || resp.Meta.Previous {
		t.Errorf("meta = %+v, want no next or previous page", resp.Meta)
	}
}

func TestGetConfigHistory_SkipsChangesWithOnlyUnknownKeys(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)

	base := time.Now().Add(-time.Hour)
	insertConfigChange(ctx, t, appID, base, `{"anr_take_screenshot":{"old":true,"new":false}}`)
	insertConfigChange(ctx, t, appID, base.Add(time.Minute), `{"crash_timeline_duration":{"old":300,"new":60}}`)
	patchConfig(t, appID, userID, `{"trace_sampling_rate":10}`)

	c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/config/history?limit=1&offset=1", nil)
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	h.GetConfigHistory(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp struct {
		Results []sdkconfig.ConfigChange `json:"results"`
		Meta    struct {
			Next     bool `json:"next"`
			Previous bool `json:"previous"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if len(resp.Results) != 1 {
		t.Fatalf("results = %d, want 1", len(resp.Results))
	}
	if _, ok := resp.Results[0].Changes["anr_take_screenshot"]; !ok {
		t.Errorf("second page changes = %v, want anr_take_screenshot", resp.Results[0].Changes)
	}
	if resp.Meta.Next || !resp.Meta.Previous {
		t.Errorf("meta = %+v, want a previous page and no next page", resp.Meta)
	}
}

func patchConfigViaHandler(t *testing.T, appID uuid.UUID, userID, body string) (int, string) {
	t.Helper()
	c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/config", strings.NewReader(body))
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	h.PatchConfig(c)

	var resp struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	return w.Code, resp.Error
}

func configColumn(ctx context.Context, t *testing.T, appID uuid.UUID, column string) int {
	t.Helper()
	var v int
	if err := th.PgPool.QueryRow(ctx, "SELECT "+column+" FROM sdk_config WHERE app_id = $1", appID).Scan(&v); err != nil {
		t.Fatalf("read %s: %v", column, err)
	}
	return v
}

var configRanges = []struct {
	field    string
	min, max int
}{
	{"error_replay_duration", minTimelineDurationSeconds, maxTimelineDurationSeconds},
	{"anr_timeline_duration", minTimelineDurationSeconds, maxTimelineDurationSeconds},
	{"bug_report_timeline_duration", minTimelineDurationSeconds, maxTimelineDurationSeconds},
	{"app_hang_timeline_duration", minTimelineDurationSeconds, maxTimelineDurationSeconds},
	{"memory_usage_interval", minIntervalSeconds, maxIntervalSeconds},
	{"memory_usage_background_interval", minIntervalSeconds, maxIntervalSeconds},
	{"app_hang_threshold_millis", minAppHangThresholdMillis, maxAppHangThresholdMillis},
}

func TestPatchConfigForApp_RejectsOutOfRangeValues(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)

	for _, r := range configRanges {
		for _, value := range []int{r.min - 1, r.max + 1} {
			t.Run(r.field+"="+strconv.Itoa(value), func(t *testing.T) {
				before := configColumn(ctx, t, appID, r.field)

				code, _ := patchConfigViaHandler(t, appID, userID, `{"`+r.field+`":`+strconv.Itoa(value)+`}`)

				if code != http.StatusInternalServerError {
					t.Errorf("status = %d, want %d", code, http.StatusInternalServerError)
				}
				if got := configColumn(ctx, t, appID, r.field); got != before {
					t.Errorf("%s = %d, want unchanged %d", r.field, got, before)
				}
			})
		}
	}
}

func TestPatchConfigForApp_AcceptsRangeBoundaries(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)

	for _, r := range configRanges {
		for _, value := range []int{r.min, r.max} {
			t.Run(r.field+"="+strconv.Itoa(value), func(t *testing.T) {
				code, msg := patchConfigViaHandler(t, appID, userID, `{"`+r.field+`":`+strconv.Itoa(value)+`}`)

				if code != http.StatusOK {
					t.Fatalf("status = %d, want %d, error %q", code, http.StatusOK, msg)
				}
				if got := configColumn(ctx, t, appID, r.field); got != value {
					t.Errorf("%s = %d, want %d", r.field, got, value)
				}
			})
		}
	}
}
