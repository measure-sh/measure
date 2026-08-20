//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"backend/libs/artdump"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/testinfra"

	"github.com/google/uuid"
)

// artDumpFixture is the parser package's API 36 capture, trimmed to the
// thread section exactly as the SDK trims it.
const artDumpFixture = "../artdump/testdata/api36_deadlock.txt"

const anrSubject = "user request after error: Broadcast of Intent { cmp=sh.frankenstein.android/.AnrBroadcastReceiver }"

func seedDumpANR(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, fingerprint string, ts time.Time) *artdump.Dump {
	t.Helper()

	raw, err := os.ReadFile(artDumpFixture)
	if err != nil {
		t.Fatalf("read art dump fixture: %v", err)
	}

	dump := artdump.Parse(string(raw))
	dump.MarkInApp()

	marshalled, err := json.Marshal(dump)
	if err != nil {
		t.Fatalf("marshal thread dump: %v", err)
	}

	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type:            event.TypeANR,
		Timestamp:       ts,
		Fingerprint:     fingerprint,
		ExceptionsJSON:  "[]",
		ThreadsJSON:     "[]",
		AttachmentsJSON: "[]",
		Subject:         anrSubject,
		ThreadDumpJSON:  string(marshalled),
	})

	return dump
}

func dumpANRFilter(appID uuid.UUID, ts time.Time) *filter.AppFilter {
	return &filter.AppFilter{
		AppID:        appID,
		From:         ts.Add(-time.Hour),
		To:           ts.Add(time.Hour),
		Versions:     []string{"v1"},
		VersionCodes: []string{"1"},
		Limit:        10,
	}
}

func TestGetErrorsWithFilterServesTheThreadDump(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "dump-team")
	seedApp(ctx, t, appID, teamID, 30)

	ts := time.Now().UTC().Add(-time.Minute)
	fingerprint := "artdumpfingerprint00000000000000"
	seedDumpANR(ctx, t, teamID, appID, fingerprint, ts)

	a := App{ID: &appID, TeamId: teamID}
	events, _, _, err := a.GetErrorsWithFilter(ctx, th.ChConn, fingerprint, dumpANRFilter(appID, ts))
	if err != nil {
		t.Fatalf("GetErrorsWithFilter failed: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("Expected 1 error, but got %d", len(events))
	}
	got, ok := events[0].(*event.EventANR)
	if !ok {
		t.Fatalf("Expected an ANR event, but got %T", events[0])
	}

	t.Run("Serves the subject", func(t *testing.T) {
		if got.ANRView.Subject != anrSubject {
			t.Errorf("Expected subject %q, but got %q", anrSubject, got.ANRView.Subject)
		}
	})

	t.Run("Serves the stalled thread's stack", func(t *testing.T) {
		for _, want := range []string{
			`"main" prio=5 tid=1 Blocked`,
			"sh.frankenstein.android.AnrBroadcastReceiver.onReceive",
		} {
			if !strings.Contains(got.ANRView.Stacktrace, want) {
				t.Errorf("Expected the stacktrace to contain %q, got:\n%s", want, got.ANRView.Stacktrace)
			}
		}
	})

	t.Run("Serves every thread", func(t *testing.T) {
		if len(got.Threads) < 2 {
			t.Fatalf("Expected the dump's threads, but got %d", len(got.Threads))
		}

		var locker []string
		for _, thread := range got.Threads {
			if strings.HasPrefix(thread.Name, `"APP: Locker"`) {
				locker = thread.Frames
			}
		}
		if locker == nil {
			t.Fatal("the lock holder thread is missing from the response")
		}

		var sleeping bool
		for _, frame := range locker {
			if strings.HasPrefix(frame, "  - sleeping on ") {
				sleeping = true
			}
		}
		if !sleeping {
			t.Errorf("Expected a lock line among the holder's frames, got:\n%s", strings.Join(locker, "\n"))
		}
	})

	t.Run("Names the thread holding a contended lock", func(t *testing.T) {
		for _, thread := range got.Threads {
			for _, frame := range thread.Frames {
				if strings.Contains(frame, "waiting to lock") {
					if !strings.Contains(frame, "held by APP: Locker") {
						t.Errorf("Expected the holder named, got %q", frame)
					}
					return
				}
			}
		}
		t.Fatal("the fixture carries no contended lock, this test asserts nothing")
	})
}
