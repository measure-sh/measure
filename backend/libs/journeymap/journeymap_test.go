package journeymap

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"backend/libs/event"
)

const session = "s1"

func activityCreated(ts int64, name string) Event {
	return Event{SessionID: session, Timestamp: ts, Type: event.TypeLifecycleActivity, ActivityState: event.LifecycleActivityTypeCreated, Activity: name}
}

func activityResumed(ts int64, name string) Event {
	return Event{SessionID: session, Timestamp: ts, Type: event.TypeLifecycleActivity, ActivityState: event.LifecycleActivityTypeResumed, Activity: name}
}

func viewDidLoad(ts int64, name string) Event {
	return Event{SessionID: session, Timestamp: ts, Type: event.TypeLifecycleViewController, ViewControllerState: event.LifecycleViewControllerTypeViewDidLoad, ViewController: name}
}

func viewDidAppear(ts int64, name string) Event {
	return Event{SessionID: session, Timestamp: ts, Type: event.TypeLifecycleViewController, ViewControllerState: event.LifecycleViewControllerTypeViewDidAppear, ViewController: name}
}

func screenView(ts int64, name string) Event {
	return Event{SessionID: session, Timestamp: ts, Type: event.TypeScreenView, ScreenView: name}
}

func click(ts int64, label string) Event {
	return Event{SessionID: session, Timestamp: ts, Type: event.TypeGestureClick, ClickLabel: label}
}

func withSnapshot(e Event, key string) Event {
	e.Snapshots = []string{key}
	return e
}

func noFetch(context.Context, string) ([]byte, error) {
	return nil, errors.New("no snapshots in this test")
}

func build(t *testing.T, events []Event, fetch Fetch) Map {
	t.Helper()
	m, err := Build(context.Background(), events, fetch)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	return m
}

func screenKeys(m Map) []string {
	var keys []string
	for _, s := range m.Screens {
		keys = append(keys, s.Key)
	}
	return keys
}

func transitionPairs(m Map) [][2]string {
	var pairs [][2]string
	for _, t := range m.Transitions {
		pairs = append(pairs, [2]string{t.From, t.To})
	}
	return pairs
}

func TestTransitionIsLabelledByTheTapThatCausedIt(t *testing.T) {
	m := build(t, []Event{
		activityCreated(0, "com.example.MainActivity"),
		activityResumed(10, "com.example.MainActivity"),
		click(2000, "Settings"),
		activityCreated(2100, "com.example.SettingsActivity"),
		activityResumed(2200, "com.example.SettingsActivity"),
	}, noFetch)

	want := []Transition{
		{From: "MainActivity", To: "SettingsActivity", Count: 1, Triggers: []Count{{Label: "Settings", Count: 1}}},
	}
	if !reflect.DeepEqual(m.Transitions, want) {
		t.Errorf("transitions = %+v, want %+v", m.Transitions, want)
	}
}

func TestGoingBackIsNotATransition(t *testing.T) {
	m := build(t, []Event{
		activityResumed(0, "HomeActivity"),
		click(1000, "Cart"),
		activityCreated(1100, "CartActivity"),
		activityResumed(1200, "CartActivity"),
		click(2000, "Pay"),
		activityCreated(2100, "PayActivity"),
		activityResumed(2200, "PayActivity"),
		// back twice, to Home
		activityResumed(5000, "CartActivity"),
		activityResumed(8000, "HomeActivity"),
		click(9000, "Settings"),
		activityCreated(9100, "SettingsActivity"),
		activityResumed(9200, "SettingsActivity"),
	}, noFetch)

	want := [][2]string{
		{"HomeActivity", "CartActivity"},
		{"CartActivity", "PayActivity"},
		{"HomeActivity", "SettingsActivity"},
	}
	if got := transitionPairs(m); !reflect.DeepEqual(got, want) {
		t.Errorf("transitions = %v, want %v", got, want)
	}
}

func TestHostThatShowsAScreenBeforeAnyTapIsFoldedIntoIt(t *testing.T) {
	m := build(t, []Event{
		activityCreated(0, "MainActivity"),
		activityResumed(10, "MainActivity"),
		screenView(900, "home"),
	}, noFetch)

	if got, want := screenKeys(m), []string{"MainActivity / home"}; !reflect.DeepEqual(got, want) {
		t.Errorf("screens = %v, want %v", got, want)
	}
	if got := m.Screens[0].Entries; got != 1 {
		t.Errorf("entries = %d, want 1", got)
	}
}

func TestTapJustAfterAScreenChangeBelongsToThePreviousScreen(t *testing.T) {
	m := build(t, []Event{
		activityResumed(0, "FlutterActivity"),
		screenView(10, "home"),
		screenView(5000, "details"),
		click(5100, "Open details"),
	}, noFetch)

	if len(m.Transitions) != 1 {
		t.Fatalf("transitions = %+v, want one", m.Transitions)
	}
	if got, want := m.Transitions[0].Triggers, []Count{{Label: "Open details", Count: 1}}; !reflect.DeepEqual(got, want) {
		t.Errorf("triggers = %+v, want %+v", got, want)
	}
}

func TestContainerViewControllersAreSkipped(t *testing.T) {
	m := build(t, []Event{
		viewDidLoad(0, "UINavigationController"),
		viewDidLoad(0, "HomeViewController"),
		viewDidAppear(100, "UINavigationController"),
		viewDidAppear(100, "HomeViewController"),
	}, noFetch)

	if got, want := screenKeys(m), []string{"HomeViewController"}; !reflect.DeepEqual(got, want) {
		t.Errorf("screens = %v, want %v", got, want)
	}
}

func TestHostThatComesBackKeepsItsLastScreen(t *testing.T) {
	m := build(t, []Event{
		activityCreated(0, "MainActivity"),
		activityResumed(10, "MainActivity"),
		screenView(20, "cart"),
		click(3000, "Share"),
		activityCreated(3100, "ShareActivity"),
		activityResumed(3200, "ShareActivity"),
		activityResumed(6000, "MainActivity"),
	}, noFetch)

	if got, want := screenKeys(m), []string{"MainActivity / cart", "ShareActivity"}; !reflect.DeepEqual(got, want) {
		t.Errorf("screens = %v, want %v", got, want)
	}
	if got, want := transitionPairs(m), [][2]string{{"MainActivity / cart", "ShareActivity"}}; !reflect.DeepEqual(got, want) {
		t.Errorf("transitions = %v, want %v", got, want)
	}
}

func TestScreenViewReportedBeforeItsHostAppearsMovesIntoTheHost(t *testing.T) {
	m := build(t, []Event{
		viewDidLoad(0, "HomeViewController"),
		viewDidAppear(10, "HomeViewController"),
		click(3000, "Open"),
		viewDidLoad(3100, "DetailsHostController"),
		screenView(3200, "details"),
		viewDidAppear(3500, "DetailsHostController"),
	}, noFetch)

	want := [][2]string{{"HomeViewController", "DetailsHostController / details"}}
	if got := transitionPairs(m); !reflect.DeepEqual(got, want) {
		t.Errorf("transitions = %v, want %v", got, want)
	}
}

type testElement struct {
	ID       *string       `json:"id"`
	Label    string        `json:"label"`
	Type     string        `json:"type"`
	X        int           `json:"x"`
	Y        int           `json:"y"`
	Width    int           `json:"width"`
	Height   int           `json:"height"`
	Children []testElement `json:"children"`
}

func layout(rows int, extra ...testElement) []byte {
	var children []testElement
	for i := range rows {
		children = append(children, testElement{Label: "Row", Type: "text", Y: 100 * i, Width: 400, Height: 90})
	}
	children = append(children, extra...)
	raw, _ := json.Marshal(testElement{Label: "Root", Type: "container", Width: 400, Height: 800, Children: children})
	return raw
}

func TestSnapshotsAreGroupedIntoVariants(t *testing.T) {
	dialog := testElement{Label: "Dialog", Type: "container", Y: 300, Width: 300, Height: 200, Children: []testElement{
		{Label: "Title", Type: "text", Width: 200, Height: 40},
		{Label: "Body", Type: "text", Width: 200, Height: 40},
		{Label: "Ok", Type: "container", Width: 80, Height: 40},
		{Label: "Cancel", Type: "container", Width: 80, Height: 40},
	}}
	snapshots := map[string][]byte{
		// A list and the same list a few rows longer are one variant.
		"list-3":  layout(3),
		"list-30": layout(30),
		"list-4":  layout(4),
		// A dialog on top is another.
		"dialog-1": layout(3, dialog),
		"dialog-2": layout(3, dialog),
	}
	fetch := func(_ context.Context, key string) ([]byte, error) { return snapshots[key], nil }

	var events []Event
	visit := func(ts int64, key string) {
		events = append(events,
			withSnapshot(activityResumed(ts, "ListActivity"), key),
			activityResumed(ts+2000, "OtherActivity"),
		)
	}
	visit(0, "list-3")
	visit(10000, "list-30")
	visit(20000, "list-4")
	visit(30000, "dialog-1")
	visit(40000, "dialog-2")

	m := build(t, events, fetch)

	var list *Screen
	for i := range m.Screens {
		if m.Screens[i].Key == "ListActivity" {
			list = &m.Screens[i]
		}
	}
	if list == nil {
		t.Fatalf("no ListActivity in %v", screenKeys(m))
	}
	var visits []int
	for _, v := range list.Variants {
		visits = append(visits, v.Visits)
	}
	if want := []int{3, 2}; !reflect.DeepEqual(visits, want) {
		t.Errorf("variant visits = %v, want %v", visits, want)
	}
	if got, want := list.SnapshotVisits, 5; got != want {
		t.Errorf("snapshot visits = %d, want %d", got, want)
	}
	// The newest snapshot of the most seen variant draws the screen.
	if got, want := len(list.Variants[0].Wireframe.Boxes), 5; got != want {
		t.Errorf("wireframe boxes = %d, want %d", got, want)
	}
}

func TestLoadingShellNeverStandsForTheScreen(t *testing.T) {
	snapshots := map[string][]byte{
		"shell-1": layout(0),
		"shell-2": layout(0),
		"shell-3": layout(0),
		"full-1":  layout(10),
		"full-2":  layout(10),
	}
	fetch := func(_ context.Context, key string) ([]byte, error) { return snapshots[key], nil }

	var events []Event
	for i, key := range []string{"shell-1", "full-1", "shell-2", "full-2", "shell-3"} {
		events = append(events,
			withSnapshot(activityResumed(int64(i)*10000, "ReactActivity"), key),
			activityResumed(int64(i)*10000+2000, "OtherActivity"),
		)
	}

	m := build(t, events, fetch)

	for _, s := range m.Screens {
		if s.Key != "ReactActivity" {
			continue
		}
		if len(s.Variants) != 1 || s.Variants[0].Loading || len(s.Variants[0].Wireframe.Boxes) != 11 {
			t.Errorf("variants = %+v, want the full layout only", s.Variants)
		}
		return
	}
	t.Fatalf("no ReactActivity in %v", screenKeys(m))
}

func TestUnreadableSnapshotIsLeftOut(t *testing.T) {
	m := build(t, []Event{
		withSnapshot(activityResumed(0, "MainActivity"), "missing"),
	}, noFetch)

	if len(m.Screens) != 1 || len(m.Screens[0].Variants) != 0 {
		t.Errorf("screens = %+v, want one screen with no variants", m.Screens)
	}
}
