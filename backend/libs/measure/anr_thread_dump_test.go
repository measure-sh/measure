//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"os"
	"slices"
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

	// The same call ingest makes, so a step added there cannot be
	// missed here.
	dump := artdump.Parse(string(raw))
	dump.Annotate()

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
	seeded := seedDumpANR(ctx, t, teamID, appID, fingerprint, ts)

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

	t.Run("Serves the blocking thread's stack", func(t *testing.T) {
		// The stacktrace is the thread the ANR is blamed on, which the
		// session timeline carries too, so both name one thread.
		for _, want := range []string{
			`"APP: Locker" daemon prio=5 tid=46 Sleeping`,
			"sh.frankenstein.android.AnrBroadcastReceiver$Companion.trigger$lambda$0",
		} {
			if !strings.Contains(got.ANRView.Stacktrace, want) {
				t.Errorf("Expected the stacktrace to contain %q, got:\n%s", want, got.ANRView.Stacktrace)
			}
		}
	})

	t.Run("Serves every thread but the blamed one", func(t *testing.T) {
		// The blamed thread is served as the stacktrace instead, so the
		// list is every other thread in the dump.
		want := len(seeded.Threads) - 1
		if got := len(got.Threads); got != want {
			t.Errorf("Expected %d threads, but got %d", want, got)
		}
	})

	t.Run("Names the thread holding a contended lock", func(t *testing.T) {
		if len(got.Threads) == 0 {
			t.Fatal("Expected the dump's threads")
		}
		stalled := strings.Join(got.Threads[0].Frames, "\n")
		if !strings.Contains(stalled, "waiting to lock") {
			t.Fatal("the fixture's main thread waits on no lock, this test asserts nothing")
		}
		if !strings.Contains(stalled, "held by APP: Locker") {
			t.Errorf("Expected the holder named, got:\n%s", stalled)
		}
	})

	t.Run("Puts the stalled thread first and the blamed one only in the stacktrace", func(t *testing.T) {
		if len(got.Threads) == 0 {
			t.Fatal("Expected the dump's threads")
		}
		if !strings.HasPrefix(got.Threads[0].Name, `"main"`) {
			t.Errorf("Expected the stalled thread first, but got %q", got.Threads[0].Name)
		}
		for _, thread := range got.Threads {
			if thread.Name == got.ANRView.BlamedThread {
				t.Error("the blamed thread is rendered twice, once from the stacktrace and once here")
			}
		}
	})

	t.Run("Blames the thread holding the lock, not the one waiting", func(t *testing.T) {
		// Main waits at AnrBroadcastReceiver.kt:11. The code that
		// causes the stall is on the thread holding the lock, which
		// sleeps forever at line 24.
		if got, want := got.ANR.GetMethodName(), "trigger$lambda$0"; got != want {
			t.Errorf("Expected method name %q, but got %q", want, got)
		}
		if got, want := got.ANR.GetFileName(), "AnrBroadcastReceiver.kt"; got != want {
			t.Errorf("Expected file name %q, but got %q", want, got)
		}
		if got, want := got.ANR.GetLineNumber(), int32(24); got != want {
			t.Errorf("Expected line number %d, but got %d", want, got)
		}
	})

	t.Run("Names the blamed thread", func(t *testing.T) {
		if !strings.HasPrefix(got.ANRView.BlamedThread, `"APP: Locker"`) {
			t.Errorf("Expected the lock holder named, but got %q", got.ANRView.BlamedThread)
		}
		if len(got.Threads) == 0 {
			t.Fatal("Expected the dump's threads")
		}
	})
}

func TestSessionSearchFindsADumpOnlyANR(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "dump-search-team")
	seedApp(ctx, t, appID, teamID, 30)

	ts := time.Now().UTC().Add(-time.Minute)
	sessionID := uuid.New()

	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type:           event.TypeANR,
		SessionID:      sessionID.String(),
		Timestamp:      ts,
		Fingerprint:    "artdumpsearch00000000000000000000",
		ExceptionsJSON: "[]",
		ThreadsJSON:    "[]",
		Subject:        anrSubject,
	})

	legacySessionID := uuid.New()
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type:           event.TypeANR,
		SessionID:      legacySessionID.String(),
		Timestamp:      ts,
		Fingerprint:    "legacyanr000000000000000000000000",
		ExceptionsJSON: `[{"type":"AppNotResponding","message":"main thread stalled"}]`,
		ThreadsJSON:    "[]",
	})

	search := func(t *testing.T, keyword string) []uuid.UUID {
		t.Helper()
		af := dumpANRFilter(appID, ts)
		af.FreeText = keyword

		sessions, _, _, err := App{ID: &appID, TeamId: teamID}.GetSessionsWithFilter(ctx, th.ChConn, af)
		if err != nil {
			t.Fatalf("GetSessionsWithFilter failed: %v", err)
		}

		ids := make([]uuid.UUID, 0, len(sessions))
		for _, s := range sessions {
			ids = append(ids, s.SessionID)
		}
		return ids
	}

	t.Run("Finds a dump-only anr by a word from its subject", func(t *testing.T) {
		if got := search(t, "AnrBroadcastReceiver"); !slices.Contains(got, sessionID) {
			t.Errorf("Expected session %s among %v", sessionID, got)
		}
	})

	t.Run("Still finds a legacy anr by its exception type", func(t *testing.T) {
		if got := search(t, "AppNotResponding"); !slices.Contains(got, legacySessionID) {
			t.Errorf("Expected session %s among %v", legacySessionID, got)
		}
	})

	t.Run("Does not match an unrelated keyword", func(t *testing.T) {
		if got := search(t, "NoSuchThingAnywhere"); len(got) != 0 {
			t.Errorf("Expected no sessions, but got %v", got)
		}
	})
}
