//go:build integration

package measure

import (
	"context"
	"slices"
	"testing"
	"time"

	"backend/libs/filter"
	"backend/testinfra"

	"github.com/google/uuid"
)

type sessionFixture struct {
	ctx    context.Context
	teamID uuid.UUID
	appID  uuid.UUID
	app    App

	fatal       uuid.UUID
	anr         uuid.UUID
	bugReport   uuid.UUID
	gesture     uuid.UUID
	screenView  uuid.UUID
	alice       uuid.UUID
	bob         uuid.UUID
	background  uuid.UUID
	custom      uuid.UUID
	log         uuid.UUID
	logString   uuid.UUID
	activity    uuid.UUID
	patched     uuid.UUID
	patchID     uuid.UUID
	fatalEvent  uuid.UUID
	otherAppSid uuid.UUID
}

// newSessionFixture seeds one session per session type for one app, each a
// minute apart: a fatal exception, an ANR, a bug report, a gesture, a screen
// view, two plain sessions attributed to alice in the US and bob in India,
// one that only went to the background, and one running an OTA patch. A
// session of another app is seeded too, which every query must leave out.
func newSessionFixture(t *testing.T) (sessionFixture, time.Time) {
	t.Helper()

	ctx := context.Background()
	cleanupAll(ctx, t)

	f := sessionFixture{
		ctx:         ctx,
		teamID:      uuid.New(),
		appID:       uuid.New(),
		fatal:       uuid.New(),
		anr:         uuid.New(),
		bugReport:   uuid.New(),
		gesture:     uuid.New(),
		screenView:  uuid.New(),
		alice:       uuid.New(),
		bob:         uuid.New(),
		background:  uuid.New(),
		patched:     uuid.New(),
		patchID:     uuid.New(),
		fatalEvent:  uuid.New(),
		otherAppSid: uuid.New(),
	}
	f.app = App{ID: &f.appID, TeamId: f.teamID}
	otherAppID := uuid.New()
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "exception", EventID: f.fatalEvent.String(), SessionID: f.fatal.String(),
		Fingerprint: "fatal-fp", Severity: "fatal", Timestamp: base,
	})
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "anr", SessionID: f.anr.String(),
		Fingerprint: "anr-fp", Timestamp: base.Add(time.Minute),
	})
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "bug_report", SessionID: f.bugReport.String(),
		Description: "checkout button does nothing", Timestamp: base.Add(2 * time.Minute),
	})
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "gesture_click", SessionID: f.gesture.String(), Timestamp: base.Add(3 * time.Minute),
	})
	th.SeedScreenViewInSession(ctx, t, f.teamID.String(), f.appID.String(), f.screenView.String(), "Checkout", base.Add(4*time.Minute))

	attributed := func(row testinfra.EventRow) testinfra.EventRow {
		row.Type = "test"
		row.OSName = "Android"
		row.OSVersion = "14"
		row.NetworkProvider = "carrier"
		row.NetworkType = "wifi"
		row.NetworkGeneration = "4g"
		row.DeviceLocale = "en-US"
		row.DeviceManufacturer = "TestCo"
		row.DeviceName = "pixel"
		return row
	}
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, attributed(testinfra.EventRow{
		SessionID: f.alice.String(), UserID: "alice", CountryCode: "US", Timestamp: base.Add(5 * time.Minute),
	}))
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, attributed(testinfra.EventRow{
		SessionID: f.bob.String(), UserID: "bob", CountryCode: "IN", Timestamp: base.Add(6 * time.Minute),
	}))
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "lifecycle_app", SessionID: f.background.String(),
		LifecycleAppType: "background", Timestamp: base.Add(7 * time.Minute),
	})
	// An app running an OTA patch reports it on both its events and its
	// spans, so this session reaches the sessions table through both views.
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, attributed(testinfra.EventRow{
		SessionID: f.patched.String(), Timestamp: base.Add(8 * time.Minute),
		PatchID: f.patchID, PatchVersion: "1.2.0-patch.3",
	}))
	th.SeedSpanRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.SpanRow{
		SpanName: "http_request", SessionID: f.patched.String(), StartTime: base.Add(8 * time.Minute),
		PatchID: f.patchID, PatchVersion: "1.2.0-patch.3",
	})
	th.SeedEventRows(ctx, t, f.teamID.String(), otherAppID.String(), 1, testinfra.EventRow{
		SessionID: f.otherAppSid.String(), Timestamp: base,
	})

	return f, base
}

func (f sessionFixture) newFilter(from, to time.Time, exprTree *filter.ExprTree) *filter.Filter {
	return &filter.Filter{
		AppID:    f.appID,
		TeamID:   f.teamID,
		Entity:   filter.SessionsEntity,
		From:     from,
		To:       to,
		Timezone: "UTC",
		Limit:    10,
		ExprTree: exprTree,
	}
}

func sessionIDs(t *testing.T, flt *filter.Filter, f sessionFixture) []uuid.UUID {
	t.Helper()
	sessions, _, _, err := f.app.GetSessionsWithFilter(f.ctx, deps.RchPool, flt)
	if err != nil {
		t.Fatalf("GetSessionsWithFilter: %v", err)
	}
	ids := make([]uuid.UUID, len(sessions))
	for i, sess := range sessions {
		ids[i] = sess.SessionID
	}
	return ids
}

func TestGetSessionsWithFilter(t *testing.T) {
	f, base := newSessionFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	list := func(t *testing.T, exprTree *filter.ExprTree) []uuid.UUID {
		t.Helper()
		return sessionIDs(t, f.newFilter(from, to, exprTree), f)
	}

	t.Run("no filter returns the app's sessions newest first", func(t *testing.T) {
		got := list(t, nil)
		want := []uuid.UUID{f.patched, f.background, f.bob, f.alice, f.screenView, f.gesture, f.bugReport, f.anr, f.fatal}
		if !slices.Equal(got, want) {
			t.Fatalf("want %v, got %v", want, got)
		}
	})

	t.Run("one event kind", func(t *testing.T) {
		exprTree := leaf("session_events", filter.OperatorIn, "fatal_error")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.fatal}) {
			t.Fatalf("want the fatal session, got %v", got)
		}
	})

	t.Run("many event kinds match either", func(t *testing.T) {
		exprTree := leaf("session_events", filter.OperatorIn, "fatal_error", "anr")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.anr, f.fatal}) {
			t.Fatalf("want the anr and fatal sessions, got %v", got)
		}
	})

	t.Run("bug report and user interaction sessions", func(t *testing.T) {
		exprTree := leaf("session_events", filter.OperatorIn, "bug_report")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.bugReport}) {
			t.Fatalf("want the bug report session, got %v", got)
		}

		exprTree = leaf("session_events", filter.OperatorIn, "user_interaction")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.gesture}) {
			t.Fatalf("want the gesture session, got %v", got)
		}
	})

	t.Run("not in an event kind leaves the sessions without it", func(t *testing.T) {
		exprTree := leaf("session_events", filter.OperatorNotIn, "bug_report")
		if got := list(t, &exprTree); slices.Contains(got, f.bugReport) {
			t.Fatalf("want the bug report session left out, got %v", got)
		}
	})

	t.Run("lifecycle splits the sessions by where the app ran", func(t *testing.T) {
		exprTree := leaf("session_foreground_background", filter.OperatorIn, "foreground")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.screenView, f.gesture}) {
			t.Fatalf("want the screen view and gesture sessions, got %v", got)
		}

		exprTree = leaf("session_foreground_background", filter.OperatorIn, "background")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.background}) {
			t.Fatalf("want the background session, got %v", got)
		}

		exprTree = leaf("session_foreground_background", filter.OperatorNotIn, "foreground")
		got := list(t, &exprTree)
		if slices.Contains(got, f.screenView) || slices.Contains(got, f.gesture) {
			t.Fatalf("want the foreground sessions left out, got %v", got)
		}
		if !slices.Contains(got, f.fatal) {
			t.Fatalf("want the fatal session, got %v", got)
		}
	})

	t.Run("an event kind and a lifecycle together", func(t *testing.T) {
		exprTree := filter.ExprTree{LogicalOperator: filter.LogicalAnd, Children: []filter.ExprTree{
			leaf("session_events", filter.OperatorIn, "fatal_error"),
			leaf("session_foreground_background", filter.OperatorNotIn, "foreground"),
		}}
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.fatal}) {
			t.Fatalf("want the fatal session, got %v", got)
		}
	})

	t.Run("user id reads the session's id list", func(t *testing.T) {
		exprTree := leaf("user_id", filter.OperatorIn, "alice")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.alice}) {
			t.Fatalf("want alice's session, got %v", got)
		}
	})

	t.Run("country reads the session's country list", func(t *testing.T) {
		exprTree := leaf("country", filter.OperatorIn, "IN")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.bob}) {
			t.Fatalf("want bob's session, got %v", got)
		}

		exprTree = leaf("country", filter.OperatorIn, "US", "IN")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.bob, f.alice}) {
			t.Fatalf("want both attributed sessions, got %v", got)
		}
	})

	t.Run("patch keys read the patch columns", func(t *testing.T) {
		exprTree := leaf("patch_id", filter.OperatorIn, f.patchID.String())
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.patched}) {
			t.Fatalf("want the patched session, got %v", got)
		}

		exprTree = leaf("patch_version", filter.OperatorIn, "1.2.0-patch.3")
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.patched}) {
			t.Fatalf("want the patched session, got %v", got)
		}

		exprTree = leaf("patch_id", filter.OperatorIsNotSet)
		if got := list(t, &exprTree); slices.Contains(got, f.patched) {
			t.Fatalf("want the patched session left out, got %v", got)
		}
	})

	t.Run("session id binds the uuid column", func(t *testing.T) {
		exprTree := leaf("session_id", filter.OperatorIn, f.anr.String())
		if got := list(t, &exprTree); !slices.Equal(got, []uuid.UUID{f.anr}) {
			t.Fatalf("want the anr session, got %v", got)
		}
	})

	t.Run("another app's sessions stay out", func(t *testing.T) {
		if got := list(t, nil); slices.Contains(got, f.otherAppSid) {
			t.Fatalf("want the other app's session left out, got %v", got)
		}
	})

	t.Run("pagination flags", func(t *testing.T) {
		flt := f.newFilter(from, to, nil)
		flt.Limit = 1

		sessions, next, previous, err := f.app.GetSessionsWithFilter(f.ctx, deps.RchPool, flt)
		if err != nil {
			t.Fatalf("GetSessionsWithFilter: %v", err)
		}
		if len(sessions) != 1 || !next || previous {
			t.Fatalf("want the first page with more to come, got %d sessions next=%v previous=%v", len(sessions), next, previous)
		}

		flt.Offset = 8
		sessions, next, previous, err = f.app.GetSessionsWithFilter(f.ctx, deps.RchPool, flt)
		if err != nil {
			t.Fatalf("GetSessionsWithFilter: %v", err)
		}
		if len(sessions) != 1 || next || !previous {
			t.Fatalf("want the last page with pages before it, got %d sessions next=%v previous=%v", len(sessions), next, previous)
		}
	})
}

func TestGetSessionsWithCustomKeyFilter(t *testing.T) {
	f, base := newSessionFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	th.SeedUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.UDAttrRow{
		EventID: f.fatalEvent.String(), SessionID: f.fatal.String(),
		Key: "plan", Value: "pro", Timestamp: base,
	})
	th.SeedUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.UDAttrRow{
		SessionID: f.alice.String(),
		Key:       "plan", Value: "free", Timestamp: base.Add(5 * time.Minute),
	})

	list := func(t *testing.T, exprTree filter.ExprTree) []uuid.UUID {
		t.Helper()
		flt := f.newFilter(from, to, &exprTree)
		resolveCustomKeys(t, flt)
		return sessionIDs(t, flt, f)
	}

	t.Run("a value narrows to its session", func(t *testing.T) {
		if got := list(t, leaf("custom.plan", filter.OperatorIn, "pro")); !slices.Equal(got, []uuid.UUID{f.fatal}) {
			t.Fatalf("want the fatal session, got %v", got)
		}
	})

	t.Run("a custom key beside a built-in key", func(t *testing.T) {
		got := list(t, filter.ExprTree{LogicalOperator: filter.LogicalAnd, Children: []filter.ExprTree{
			leaf("custom.plan", filter.OperatorIn, "pro", "free"),
			leaf("session_events", filter.OperatorIn, "fatal_error"),
		}})
		if !slices.Equal(got, []uuid.UUID{f.fatal}) {
			t.Fatalf("want the fatal session, got %v", got)
		}
	})
}

func TestGetSessionsInstancesPlotWithFilter(t *testing.T) {
	f, base := newSessionFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	total := func(t *testing.T, exprTree *filter.ExprTree) uint64 {
		t.Helper()
		flt := f.newFilter(from, to, exprTree)
		flt.PlotTimeGroup = filter.PlotTimeGroupDays
		items, err := f.app.GetSessionsInstancesPlot(f.ctx, deps.RchPool, flt)
		if err != nil {
			t.Fatalf("GetSessionsInstancesPlot: %v", err)
		}
		var sum uint64
		for _, item := range items {
			sum += *item.Instances
		}
		return sum
	}

	t.Run("every session of the app", func(t *testing.T) {
		if got := total(t, nil); got != 9 {
			t.Fatalf("want 9 sessions, got %d", got)
		}
	})

	t.Run("narrowed by event kind", func(t *testing.T) {
		exprTree := leaf("session_events", filter.OperatorIn, "anr")
		if got := total(t, &exprTree); got != 1 {
			t.Fatalf("want the one anr session, got %d", got)
		}
	})
}

// newSessionTextFixture seeds one session per kind of searchable text: a
// custom event, a log, a legacy log string, a screen view, an activity, an
// exception and an ANR.
func newSessionTextFixture(t *testing.T) (sessionFixture, time.Time) {
	t.Helper()

	ctx := context.Background()
	cleanupAll(ctx, t)

	f := sessionFixture{
		ctx:        ctx,
		teamID:     uuid.New(),
		appID:      uuid.New(),
		custom:     uuid.New(),
		log:        uuid.New(),
		logString:  uuid.New(),
		screenView: uuid.New(),
		activity:   uuid.New(),
		fatal:      uuid.New(),
		anr:        uuid.New(),
	}
	f.app = App{ID: &f.appID, TeamId: f.teamID}
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "custom", SessionID: f.custom.String(),
		CustomName: "checkout_completed", Timestamp: base,
	})
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "log", SessionID: f.log.String(),
		LogBody: "payment gateway timed out", Timestamp: base.Add(time.Minute),
	})
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "string", SessionID: f.logString.String(),
		LogString: "legacy log line", Timestamp: base.Add(2 * time.Minute),
	})
	th.SeedScreenViewInSession(ctx, t, f.teamID.String(), f.appID.String(), f.screenView.String(), "CheckoutScreen", base.Add(3*time.Minute))
	th.SeedLifecycleActivityInSession(ctx, t, f.teamID.String(), f.appID.String(), f.activity.String(), "created", "com.app.HomeActivity", base.Add(4*time.Minute))
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "exception", SessionID: f.fatal.String(), Fingerprint: "text-fatal-fp", Severity: "fatal",
		ExceptionsJSON: `{"type":"NullPointerException","message":"boom on checkout","file_name":"Main.kt","class_name":"MainActivity","method_name":"onCreate"}`,
		Timestamp:      base.Add(5 * time.Minute),
	})
	th.SeedEventRows(ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.EventRow{
		Type: "anr", SessionID: f.anr.String(), Fingerprint: "text-anr-fp",
		ExceptionsJSON: `{"type":"ApplicationNotResponding","message":"input dispatch froze","file_name":"Main.kt","class_name":"MainActivity","method_name":"onResume"}`,
		Timestamp:      base.Add(6 * time.Minute),
	})

	return f, base
}

func TestGetSessionsWithTextFilter(t *testing.T) {
	f, base := newSessionTextFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	list := func(t *testing.T, keyName string, operator filter.Operator, text string) []uuid.UUID {
		t.Helper()
		exprTree := leaf(keyName, operator, text)
		return sessionIDs(t, f.newFilter(from, to, &exprTree), f)
	}

	tests := []struct {
		name     string
		keyName  string
		operator filter.Operator
		text     string
		want     uuid.UUID
	}{
		{"custom event by name", "session_custom_event", filter.OperatorIn, "checkout_completed", f.custom},
		{"custom event by substring", "session_custom_event", filter.OperatorContains, "checkout", f.custom},
		{"log body", "session_log", filter.OperatorContains, "gateway", f.log},
		{"log string", "session_log", filter.OperatorContains, "legacy", f.logString},
		{"exception type", "session_error_text", filter.OperatorContains, "NullPointer", f.fatal},
		{"exception message", "session_error_text", filter.OperatorContains, "boom on checkout", f.fatal},
		{"anr message", "session_error_text", filter.OperatorContains, "input dispatch", f.anr},
		{"screen view name", "session_screen", filter.OperatorIn, "CheckoutScreen", f.screenView},
		{"activity class name", "session_screen", filter.OperatorContains, "HomeActivity", f.activity},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := list(t, test.keyName, test.operator, test.text); !slices.Equal(got, []uuid.UUID{test.want}) {
				t.Fatalf("want %v, got %v", test.want, got)
			}
		})
	}

	t.Run("text nothing carries matches no session", func(t *testing.T) {
		if got := list(t, "session_error_text", filter.OperatorContains, "nowhere"); len(got) != 0 {
			t.Fatalf("want no sessions, got %v", got)
		}
	})
}

func TestGetSessionsWithFilterOverUnmergedSessionRows(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	if err := deps.ChPool.Exec(ctx, "SYSTEM STOP MERGES sessions"); err != nil {
		t.Fatalf("stop merges: %v", err)
	}
	t.Cleanup(func() {
		if err := deps.ChPool.Exec(ctx, "SYSTEM START MERGES sessions"); err != nil {
			t.Fatalf("start merges: %v", err)
		}
	})

	teamID, appID, sessionID := uuid.New(), uuid.New(), uuid.New()
	app := App{ID: &appID, TeamId: teamID}
	base := time.Date(2026, 2, 3, 10, 0, 0, 0, time.UTC)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "log", SessionID: sessionID.String(),
		LogBody: "checkout failed", Timestamp: base,
	})
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "exception", SessionID: sessionID.String(),
		Fingerprint: "fatal-fp", Severity: "fatal", Timestamp: base.Add(time.Minute),
	})

	var rowCount uint64
	if err := deps.ChPool.QueryRow(ctx, "select count() from sessions where session_id = toUUID(?)", sessionID).Scan(&rowCount); err != nil {
		t.Fatalf("count session rows: %v", err)
	}
	if rowCount != 2 {
		t.Fatalf("want the session split across 2 unmerged rows, got %d", rowCount)
	}

	newFilter := func(exprTree filter.ExprTree) *filter.Filter {
		return &filter.Filter{
			AppID:    appID,
			TeamID:   teamID,
			Entity:   filter.SessionsEntity,
			From:     from,
			To:       to,
			Timezone: "UTC",
			Limit:    10,
			ExprTree: &exprTree,
		}
	}

	found := func(t *testing.T, exprTree filter.ExprTree) bool {
		t.Helper()
		sessions, _, _, err := app.GetSessionsWithFilter(ctx, deps.RchPool, newFilter(exprTree))
		if err != nil {
			t.Fatalf("GetSessionsWithFilter: %v", err)
		}
		return slices.ContainsFunc(sessions, func(sess SessionDisplay) bool {
			return sess.SessionID == sessionID
		})
	}

	instances := func(t *testing.T, exprTree filter.ExprTree) uint64 {
		t.Helper()
		items, err := app.GetSessionsInstancesPlot(ctx, deps.RchPool, newFilter(exprTree))
		if err != nil {
			t.Fatalf("GetSessionsInstancesPlot: %v", err)
		}
		var total uint64
		for _, item := range items {
			if item.Instances != nil {
				total += *item.Instances
			}
		}
		return total
	}

	hasFatal := leaf("session_events", filter.OperatorIn, "fatal_error")
	noFatal := leaf("session_events", filter.OperatorNotIn, "fatal_error")
	logAndFatal := filter.ExprTree{LogicalOperator: filter.LogicalAnd, Children: []filter.ExprTree{
		leaf("session_log", filter.OperatorContains, "checkout failed"),
		leaf("session_events", filter.OperatorIn, "fatal_error"),
	}}
	logOrANR := filter.ExprTree{LogicalOperator: filter.LogicalOr, Children: []filter.ExprTree{
		leaf("session_log", filter.OperatorContains, "checkout failed"),
		leaf("session_events", filter.OperatorIn, "anr"),
	}}

	t.Run("an event kind one row carries", func(t *testing.T) {
		if !found(t, hasFatal) {
			t.Error("want the session found by its fatal exception")
		}
		if got := instances(t, hasFatal); got != 1 {
			t.Errorf("want 1 instance plotted, got %d", got)
		}
	})

	t.Run("a negation reads the whole session", func(t *testing.T) {
		if found(t, noFatal) {
			t.Error("want the session left out, its second row holds a fatal exception")
		}
		if got := instances(t, noFatal); got != 0 {
			t.Errorf("want no instances plotted, got %d", got)
		}
	})

	t.Run("a conjunction spread over both rows", func(t *testing.T) {
		if !found(t, logAndFatal) {
			t.Error("want the session found by its log and its fatal exception")
		}
		if got := instances(t, logAndFatal); got != 1 {
			t.Errorf("want 1 instance plotted, got %d", got)
		}
	})

	t.Run("a disjunction one row satisfies", func(t *testing.T) {
		if !found(t, logOrANR) {
			t.Error("want the session found by its log")
		}
	})
}
