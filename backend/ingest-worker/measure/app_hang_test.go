//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"backend/ingest-worker/server"
	"backend/libs/ambient"
	"backend/libs/event"

	"github.com/google/uuid"
)

func makeBucketAppHangEvent(t *testing.T, appID uuid.UUID, state, method string) event.EventField {
	t.Helper()

	hang := &event.AppHang{
		Exceptions: event.AppHangDetails{
			{
				ThreadName: "main",
				Frames: event.Frames{
					{
						MethodName: method,
						FileName:   "ViewController.swift",
						LineNum:    319,
						InApp:      true,
						FrameiOS: &event.FrameiOS{
							BinaryName:    "DemoApp",
							BinaryAddress: "0000000104a10000",
							SymbolAddress: "0000000104a3f5c0",
						},
					},
				},
			},
		},
		Duration:   2500,
		State:      state,
		Framework:  event.FrameworkApple,
		Foreground: true,
	}

	if err := hang.ComputeFingerprint(); err != nil {
		t.Fatalf("compute fingerprint: %v", err)
	}

	return event.EventField{
		ID:        uuid.New(),
		AppID:     appID,
		SessionID: uuid.New(),
		Timestamp: time.Now(),
		Type:      event.TypeAppHang,
		Attribute: event.Attribute{
			AppVersion: "1.0.3",
			AppBuild:   "7",
			OSName:     "ios",
			OSVersion:  "18.0",
		},
		AppHang: hang,
	}
}

// makeBucketAppHangRequest wraps app hang events in an ingest
// request, indexed the way processIngestBatchSync indexes them.
func makeBucketAppHangRequest(appID, teamID uuid.UUID, events ...event.EventField) eventreq {
	e := eventreq{
		id:     uuid.New(),
		appId:  appID,
		teamId: teamID,
		osName: "ios",
		events: events,
	}
	for i := range events {
		e.appHangIds = append(e.appHangIds, i)
	}
	return e
}

type appHangGroupRow struct {
	id         string
	count      uint64
	methodName string
	fileName   string
	lineNumber int32
	appVersion string
	appBuild   string
}

func readAppHangGroups(ctx context.Context, t *testing.T, appID uuid.UUID) (rows []appHangGroupRow) {
	t.Helper()

	stmt := "select id, sumMerge(count), any(method_name), any(file_name), any(line_number), any(app_version.1), any(app_version.2) from app_hang_groups where app_id = ? group by id order by id"
	result, err := server.Server.ChPool.Query(ctx, stmt, appID)
	if err != nil {
		t.Fatalf("read app hang groups: %v", err)
	}
	defer result.Close()

	for result.Next() {
		var row appHangGroupRow
		if err := result.Scan(&row.id, &row.count, &row.methodName, &row.fileName, &row.lineNumber, &row.appVersion, &row.appBuild); err != nil {
			t.Fatalf("scan app hang group: %v", err)
		}
		rows = append(rows, row)
	}
	if err := result.Err(); err != nil {
		t.Fatalf("iterate app hang groups: %v", err)
	}
	return
}

func TestBucketAppHangs(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "app-hang-team")
	ctx = ambient.WithTeamId(ctx, teamID)

	t.Run("Creates one group for killed and recovered app hangs with the same fingerprint", func(t *testing.T) {
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		e := makeBucketAppHangRequest(appID, teamID,
			makeBucketAppHangEvent(t, appID, event.AppHangStateRecovered, "blockMainThread()"),
			makeBucketAppHangEvent(t, appID, event.AppHangStateRecovered, "blockMainThread()"),
			makeBucketAppHangEvent(t, appID, event.AppHangStateKilled, "blockMainThread()"),
		)
		if err := e.bucketAppHangs(ctx); err != nil {
			t.Fatalf("bucketAppHangs failed: %v", err)
		}

		rows := readAppHangGroups(ctx, t, appID)
		if len(rows) != 1 {
			t.Fatalf("Expected 1 group, but got %d", len(rows))
		}
		if rows[0].id != e.events[0].AppHang.Fingerprint {
			t.Errorf("Expected group id %q, but got %q", e.events[0].AppHang.Fingerprint, rows[0].id)
		}
		if rows[0].count != 3 {
			t.Errorf("Expected 3 app hangs, but got %d", rows[0].count)
		}
	})

	t.Run("Creates separate groups for app hangs with different method names", func(t *testing.T) {
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		e := makeBucketAppHangRequest(appID, teamID,
			makeBucketAppHangEvent(t, appID, event.AppHangStateRecovered, "blockMainThread()"),
			makeBucketAppHangEvent(t, appID, event.AppHangStateRecovered, "holdAllocatorLock()"),
		)
		if err := e.bucketAppHangs(ctx); err != nil {
			t.Fatalf("bucketAppHangs failed: %v", err)
		}

		rows := readAppHangGroups(ctx, t, appID)
		if len(rows) != 2 {
			t.Fatalf("Expected 2 groups, but got %d", len(rows))
		}
		if rows[0].id == rows[1].id {
			t.Errorf("Expected different fingerprints, but both are %q", rows[0].id)
		}
	})

	t.Run("Stores the hung frame and app version in the group", func(t *testing.T) {
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		e := makeBucketAppHangRequest(appID, teamID,
			makeBucketAppHangEvent(t, appID, event.AppHangStateKilled, "blockMainThread()"),
		)
		if err := e.bucketAppHangs(ctx); err != nil {
			t.Fatalf("bucketAppHangs failed: %v", err)
		}

		rows := readAppHangGroups(ctx, t, appID)
		if len(rows) != 1 {
			t.Fatalf("Expected 1 group, but got %d", len(rows))
		}
		row := rows[0]
		if row.methodName != "blockMainThread()" {
			t.Errorf("Expected method name %q, but got %q", "blockMainThread()", row.methodName)
		}
		if row.fileName != "ViewController.swift" {
			t.Errorf("Expected file name %q, but got %q", "ViewController.swift", row.fileName)
		}
		if row.lineNumber != 319 {
			t.Errorf("Expected line number %d, but got %d", 319, row.lineNumber)
		}
		if row.appVersion != "1.0.3" || row.appBuild != "7" {
			t.Errorf("Expected app version %q (%q), but got %q (%q)", "1.0.3", "7", row.appVersion, row.appBuild)
		}
	})

	t.Run("Skips group creation for a batch without app hangs", func(t *testing.T) {
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		e := makeBucketAppHangRequest(appID, teamID)
		if err := e.bucketAppHangs(ctx); err != nil {
			t.Fatalf("Expected no error, but got %v", err)
		}

		if rows := readAppHangGroups(ctx, t, appID); len(rows) != 0 {
			t.Errorf("Expected no groups, but got %d", len(rows))
		}
	})
}
