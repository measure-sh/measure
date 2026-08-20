//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"backend/ingest-worker/server"
	"backend/libs/artdump"
	"backend/libs/event"
	"backend/libs/span"

	"github.com/google/uuid"
)

func TestEventReqOnboardable(t *testing.T) {
	// Not onboardable when no events or spans
	{
		eventReq := &eventreq{}

		if eventReq.onboardable() {
			t.Errorf("Expected eventReq to be not onboardable")
		}
	}

	// Onboardable when at least 1 event
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
				},
			},
		}

		if !eventReq.onboardable() {
			t.Errorf("Expected eventReq to be onboardable")
		}
	}

	// Onboardable when at least 1 span
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					SpanName: "some-span",
				},
			},
		}

		if !eventReq.onboardable() {
			t.Errorf("Expected eventReq to be onboardable")
		}
	}
}

func TestEventReqGetOSName(t *testing.T) {
	// Can extract os name from ingest batch containing
	// only events.
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
					Attribute: event.Attribute{
						OSName: "Android",
					},
				},
			},
		}

		osName := eventReq.getOSName()
		if osName != "android" {
			t.Errorf("Expected OS name to be 'android', got '%s'", osName)
		}
	}

	// Can extract os version from ingest batch containing
	// only events.
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
					Attribute: event.Attribute{
						OSVersion: "33",
					},
				},
			},
		}

		osVersion := eventReq.getOSVersion()
		if osVersion != "33" {
			t.Errorf("Expected OS version to be '33', got '%s'", osVersion)
		}
	}

	// Can extract app unique id from ingest batch
	// containing only events.
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
					Attribute: event.Attribute{
						AppUniqueID: "sh.measure.test",
					},
				},
			},
		}

		appUniqueID := eventReq.getAppUniqueID()
		if appUniqueID != "sh.measure.test" {
			t.Errorf("Expected app unique id to be 'sh.measure.test', got '%s'", appUniqueID)
		}
	}

	// Can extract os name from ingest batch containing
	// only spans.
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					Attributes: span.SpanAttributes{
						OSName: "Android",
					},
				},
			},
		}

		osName := eventReq.getOSName()
		if osName != "android" {
			t.Errorf("Expected OS Name to be 'android', got '%s'", osName)
		}
	}

	// Can extract os version from ingest batch containing
	// only spans.
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					Attributes: span.SpanAttributes{
						OSVersion: "33",
					},
				},
			},
		}

		osVersion := eventReq.getOSVersion()
		if osVersion != "33" {
			t.Errorf("Expected OS version to be '33', got '%s'", osVersion)
		}
	}

	// Can extract app unique id from ingest batch
	// containing only spans.
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					Attributes: span.SpanAttributes{
						AppUniqueID: "sh.measure.test",
					},
				},
			},
		}

		appUniqueID := eventReq.getAppUniqueID()
		if appUniqueID != "sh.measure.test" {
			t.Errorf("Expected app unique id to be 'sh.measure.test', got '%s'", appUniqueID)
		}
	}
}

// artDumpFixture is the parser package's real API 33 capture, read
// directly so the stored row is built from the same bytes the parser
// and the symbolicator are tested against.
const artDumpFixture = "../../libs/artdump/testdata/api33_idle_main.txt"

func makeANRThreadDumpRequest(t *testing.T, appID, teamID uuid.UUID) (eventreq, uuid.UUID, string) {
	t.Helper()

	raw, err := os.ReadFile(artDumpFixture)
	if err != nil {
		t.Fatalf("read art dump fixture: %v", err)
	}
	dump := string(raw)

	eventID := uuid.New()
	ev := event.EventField{
		ID:        eventID,
		AppID:     appID,
		SessionID: uuid.New(),
		Timestamp: time.Now(),
		Type:      event.TypeANR,
		Attribute: event.Attribute{
			InstallationID:    uuid.New(),
			AppVersion:        "0.0.1",
			AppBuild:          "1",
			AppUniqueID:       "sh.measure.android.flutter",
			MeasureSDKVersion: "0.1.0",
			OSName:            "android",
			ThreadName:        "main",
		},
		ANR: &event.ANR{
			Subject:       "user request after error: Input dispatching timed out",
			ArtThreadDump: dump,
			Foreground:    true,
		},
	}

	return eventreq{
		id:     uuid.New(),
		appId:  appID,
		teamId: teamID,
		osName: "android",
		events: []event.EventField{ev},
		anrIds: []int{0},
	}, eventID, dump
}

func readANRColumns(ctx context.Context, t *testing.T, eventID uuid.UUID) (subject, threadDump, exceptions, fingerprint string) {
	t.Helper()

	stmt := "select `anr.subject`, `anr.thread_dump`, `anr.exceptions`, `anr.fingerprint` from events where id = ?"
	if err := server.Server.ChPool.QueryRow(ctx, stmt, eventID).Scan(&subject, &threadDump, &exceptions, &fingerprint); err != nil {
		t.Fatalf("read back the anr row: %v", err)
	}
	return
}

func TestIngestANRThreadDump(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "art-dump-team")
	seedApp(ctx, t, appID, teamID, 30)

	eventReq, eventID, dump := makeANRThreadDumpRequest(t, appID, teamID)
	eventReq.parseThreadDumps()

	if err := eventReq.ingestEvents(ctx); err != nil {
		t.Fatalf("ingestEvents failed: %v", err)
	}

	subject, threadDump, exceptions, fingerprint := readANRColumns(ctx, t, eventID)

	t.Run("Stores the subject", func(t *testing.T) {
		if want := "user request after error: Input dispatching timed out"; subject != want {
			t.Errorf("Expected subject %q, but got %q", want, subject)
		}
	})

	t.Run("Leaves the exception columns as an empty array", func(t *testing.T) {
		if exceptions != "[]" {
			t.Errorf("Expected empty exceptions, but got %q", exceptions)
		}

		var threads string
		stmt := "select `anr.threads` from events where id = ?"
		if err := server.Server.ChPool.QueryRow(ctx, stmt, eventID).Scan(&threads); err != nil {
			t.Fatalf("read back anr.threads: %v", err)
		}
		if threads != "[]" {
			t.Errorf("Expected empty threads, but got %q", threads)
		}
	})

	t.Run("Stores a dump that round-trips to the original bytes", func(t *testing.T) {
		var stored artdump.Dump
		if err := json.Unmarshal([]byte(threadDump), &stored); err != nil {
			t.Fatalf("stored thread dump is not valid json: %v", err)
		}
		if got := stored.Render(); got != dump {
			t.Error("the stored dump does not render back to the captured bytes")
		}
	})

	t.Run("Marks in-app frames", func(t *testing.T) {
		var stored artdump.Dump
		if err := json.Unmarshal([]byte(threadDump), &stored); err != nil {
			t.Fatalf("stored thread dump is not valid json: %v", err)
		}

		marked := map[string]bool{}
		for _, thread := range stored.Threads {
			for _, frame := range thread.Frames {
				if frame.InApp {
					marked[frame.ClassName] = true
				}
			}
		}
		if len(marked) == 0 {
			t.Fatal("no frame was marked in-app, the fixture contains application code")
		}
		for className := range marked {
			if strings.HasPrefix(className, "android.") || strings.HasPrefix(className, "java.") {
				t.Errorf("framework class %q was marked in-app", className)
			}
		}
	})

	t.Run("Fingerprints on the grouping frame", func(t *testing.T) {
		if fingerprint == "" {
			t.Fatal("Expected a fingerprint, but got none")
		}

		var stored artdump.Dump
		if err := json.Unmarshal([]byte(threadDump), &stored); err != nil {
			t.Fatalf("stored thread dump is not valid json: %v", err)
		}
		expected := event.ANR{
			Subject:    "user request after error: Input dispatching timed out",
			ThreadDump: &stored,
		}
		if err := expected.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if fingerprint != expected.Fingerprint {
			t.Errorf("Expected fingerprint %q, but got %q", expected.Fingerprint, fingerprint)
		}
	})
}

func TestIngestStacktraceANRLeavesTheNewColumnsEmpty(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "stacktrace-anr-team")
	seedApp(ctx, t, appID, teamID, 30)

	eventReq, eventID, _ := makeANRThreadDumpRequest(t, appID, teamID)
	eventReq.events[0].ANR = &event.ANR{
		Exceptions: event.ExceptionUnits{
			{
				Type:    "AppNotResponding",
				Message: "ANR detected",
				Frames:  event.Frames{{MethodName: "blockerMethod", FileName: "MainActivity.java", LineNum: 42}},
			},
		},
		Threads:    event.Threads{{Name: "main", Frames: event.Frames{{MethodName: "blockerMethod", FileName: "MainActivity.java"}}}},
		Foreground: true,
	}
	eventReq.parseThreadDumps()

	if err := eventReq.ingestEvents(ctx); err != nil {
		t.Fatalf("ingestEvents failed: %v", err)
	}

	subject, threadDump, exceptions, fingerprint := readANRColumns(ctx, t, eventID)

	if subject != "" {
		t.Errorf("Expected no subject, but got %q", subject)
	}
	if threadDump != "" {
		t.Errorf("Expected no thread dump, but got %q", threadDump)
	}
	if exceptions == "[]" {
		t.Error("Expected the exceptions to be stored")
	}
	if fingerprint == "" {
		t.Error("Expected a fingerprint")
	}
}
