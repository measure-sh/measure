//go:build integration

package handlers

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"backend/libs/event"
	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// configureAttachmentsStore uploads the given objects into a fresh bucket on
// the MinIO test container and points the process config at it, restoring
// the config when the test finishes.
func configureAttachmentsStore(t *testing.T, objects map[string]testinfra.S3Object) {
	t.Helper()
	bucket := "attachments-" + uuid.NewString()
	testinfra.SeedS3Bucket(context.Background(), t, minioEndpoint, bucket, objects)

	orig := *deps.Config
	deps.Config.AWSEndpoint = minioEndpoint
	deps.Config.AttachmentsBucket = bucket
	deps.Config.AttachmentsBucketRegion = "us-east-1"
	deps.Config.AttachmentsAccessKey = testinfra.MinioUser
	deps.Config.AttachmentsSecretAccessKey = testinfra.MinioPassword

	t.Cleanup(func() { *deps.Config = orig })
}

func gzipped(t *testing.T, data []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(data); err != nil {
		t.Fatalf("gzip: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("gzip: %v", err)
	}
	return buf.Bytes()
}

// seedJourneyMapEvent inserts an event of the given type with its payload
// columns, keyed by column name.
func seedJourneyMapEvent(ctx context.Context, t *testing.T, teamID, appID, sessionID, eventType string, ts time.Time, payload map[string]string) {
	t.Helper()
	cols := "id, type, session_id, app_id, team_id, timestamp, user_triggered, " +
		"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, " +
		"`attribute.app_unique_id`, `attribute.measure_sdk_version`"
	values := fmt.Sprintf("'%s', '%s', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1'",
		uuid.NewString(), eventType, sessionID, appID, teamID, ts.UTC().Format("2006-01-02 15:04:05.000"), uuid.NewString())
	for col, value := range payload {
		cols += ", `" + col + "`"
		values += ", '" + value + "'"
	}
	if err := th.ChConn.Exec(ctx, "INSERT INTO measure.events ("+cols+") VALUES ("+values+")"); err != nil {
		t.Fatalf("seed %s event: %v", eventType, err)
	}
}

// journeyMapTestResponse mirrors the parts of the GetAppJourneyMap JSON the test
// asserts on.
type journeyMapTestResponse struct {
	Screens []struct {
		Key      string `json:"key"`
		Variants []struct {
			Wireframe struct {
				Width  int      `json:"width"`
				Height int      `json:"height"`
				Boxes  [][5]int `json:"boxes"`
			} `json:"wireframe"`
		} `json:"variants"`
	} `json:"screens"`
	Transitions []struct {
		From     string `json:"from"`
		To       string `json:"to"`
		Triggers []struct {
			Label string `json:"label"`
			Count int    `json:"count"`
		} `json:"triggers"`
	} `json:"transitions"`
}

// TestGetAppJourneyMapHandler drives the endpoint end to end: events are read
// from ClickHouse, the layout snapshot from object storage, and the response
// carries the screens, the tap that moved between them and the wireframe.
func TestGetAppJourneyMapHandler(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	snapshot, err := json.Marshal(map[string]any{
		"label": "DecorView", "type": "container", "x": 0, "y": 0, "width": 400, "height": 800,
		"children": []map[string]any{
			{"label": "Title", "type": "text", "x": 20, "y": 40, "width": 200, "height": 30},
		},
	})
	if err != nil {
		t.Fatalf("marshal snapshot: %v", err)
	}
	snapshotKey := uuid.NewString() + ".gz"
	configureAttachmentsStore(t, map[string]testinfra.S3Object{
		snapshotKey: {Data: gzipped(t, snapshot)},
	})

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "journey-map-team")
	userID := uuid.NewString()
	seedUser(ctx, t, userID, "journey-map@test.com")
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 30)

	team, app, sessionID := teamID.String(), appID.String(), uuid.NewString()
	base := time.Now().UTC().Add(-time.Hour)
	at := func(ms int) time.Time { return base.Add(time.Duration(ms) * time.Millisecond) }

	attachments := fmt.Sprintf(`[{"id":"%s","name":"snapshot.json","type":"layout_snapshot_json","key":"%s"}]`, uuid.NewString(), snapshotKey)
	seedJourneyMapEvent(ctx, t, team, app, sessionID, event.TypeLifecycleActivity, at(0), map[string]string{
		"lifecycle_activity.type":       event.LifecycleActivityTypeCreated,
		"lifecycle_activity.class_name": "com.test.HomeActivity",
	})
	seedJourneyMapEvent(ctx, t, team, app, sessionID, event.TypeLifecycleActivity, at(100), map[string]string{
		"lifecycle_activity.type":       event.LifecycleActivityTypeResumed,
		"lifecycle_activity.class_name": "com.test.HomeActivity",
		"attachments":                   attachments,
	})
	seedJourneyMapEvent(ctx, t, team, app, sessionID, event.TypeGestureClick, at(2000), map[string]string{
		"gesture_click.label": "Checkout",
	})
	seedJourneyMapEvent(ctx, t, team, app, sessionID, event.TypeLifecycleActivity, at(2200), map[string]string{
		"lifecycle_activity.type":       event.LifecycleActivityTypeCreated,
		"lifecycle_activity.class_name": "com.test.CartActivity",
	})
	seedJourneyMapEvent(ctx, t, team, app, sessionID, event.TypeLifecycleActivity, at(2300), map[string]string{
		"lifecycle_activity.type":       event.LifecycleActivityTypeResumed,
		"lifecycle_activity.class_name": "com.test.CartActivity",
	})

	c, w := newTestGinContext("GET", "/apps/"+app+"/journeyMap", nil)
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: app}}

	h.GetAppJourneyMap(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var result journeyMapTestResponse
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	screens := map[string]int{}
	for i, s := range result.Screens {
		screens[s.Key] = i
	}
	home, ok := screens["HomeActivity"]
	if !ok {
		t.Fatalf("HomeActivity missing from %+v", result.Screens)
	}
	if _, ok := screens["CartActivity"]; !ok {
		t.Fatalf("CartActivity missing from %+v", result.Screens)
	}

	variants := result.Screens[home].Variants
	if len(variants) != 1 {
		t.Fatalf("HomeActivity variants = %+v, want one", variants)
	}
	wireframe := variants[0].Wireframe
	if wireframe.Width != 400 || wireframe.Height != 800 {
		t.Errorf("wireframe size = %dx%d, want 400x800", wireframe.Width, wireframe.Height)
	}
	if want := [][5]int{{0, 0, 400, 800, 0}, {20, 40, 200, 30, 1}}; fmt.Sprint(wireframe.Boxes) != fmt.Sprint(want) {
		t.Errorf("wireframe boxes = %v, want %v", wireframe.Boxes, want)
	}

	if len(result.Transitions) != 1 {
		t.Fatalf("transitions = %+v, want one", result.Transitions)
	}
	transition := result.Transitions[0]
	if transition.From != "HomeActivity" || transition.To != "CartActivity" {
		t.Errorf("transition = %s -> %s, want HomeActivity -> CartActivity", transition.From, transition.To)
	}
	if len(transition.Triggers) != 1 || transition.Triggers[0].Label != "Checkout" {
		t.Errorf("triggers = %+v, want Checkout", transition.Triggers)
	}
}

// TestGetAppJourneyMapForbidden rejects a user outside the app's team.
func TestGetAppJourneyMapForbidden(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "journey-map-team")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 30)
	outsider := uuid.NewString()
	seedUser(ctx, t, outsider, "journey-map-outsider@test.com")

	c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/journeyMap", nil)
	c.Set("userId", outsider)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}

	h.GetAppJourneyMap(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusForbidden, w.Body.String())
	}
}
