package journeymap

import (
	"strings"

	"backend/libs/event"
)

// Event is a navigation or tap event of a session. Timestamp is in unix
// milliseconds.
type Event struct {
	SessionID string
	Timestamp int64
	Type      string

	ActivityState string
	Activity      string

	FragmentState  string
	Fragment       string
	FragmentParent string

	ViewControllerState string
	ViewController      string

	SwiftUIState string
	SwiftUI      string

	ScreenView string

	ClickLabel         string
	ClickSemanticLabel string
	ClickTargetID      string
	ClickTarget        string

	// Snapshots are the storage keys of the event's layout snapshots.
	Snapshots []string
}

// snapshotRef is a layout snapshot captured during a visit.
type snapshotRef struct {
	key string
	ts  int64
	// priority is 0 for a snapshot taken when the screen appeared and 1 for
	// one taken at a tap. A snapshot taken on appearing shows the screen as
	// users arrive at it, so it is preferred as the picture of a variant.
	priority int
	// tap is the label of the tap the snapshot was taken at, empty otherwise.
	tap string
}

type tap struct {
	ts    int64
	label string
}

// visit is an uninterrupted stretch of a session on one screen.
type visit struct {
	host      string
	screen    string
	key       string
	start     int64
	snapshots []snapshotRef
	taps      []tap
}

func newVisit(host, screen string, start int64) *visit {
	return &visit{
		host:   host,
		screen: screen,
		key:    screenKey(host, screen),
		start:  start,
	}
}

// hostOnly is true for a visit to a host that never reported a screen.
func (v *visit) hostOnly() bool {
	return v.screen == ""
}

func shortName(className string) string {
	return className[strings.LastIndex(className, ".")+1:]
}

func screenKey(host, screen string) string {
	if host != "" && screen != "" {
		return host + " / " + screen
	}
	if host != "" {
		return host
	}
	return screen
}

func tapLabel(e Event) string {
	for _, value := range []string{e.ClickLabel, e.ClickSemanticLabel, e.ClickTargetID, e.ClickTarget} {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return "tap"
}

func isAppearedViewController(e Event) bool {
	return e.Type == event.TypeLifecycleViewController && e.ViewControllerState == event.LifecycleViewControllerTypeViewDidAppear
}

// collapseViewControllers keeps one view controller out of those that appear
// at the same instant. A navigation controller and the view controller inside
// it appear together, and only the inner one is the screen.
func collapseViewControllers(events []Event) []Event {
	out := make([]Event, 0, len(events))
	for i := 0; i < len(events); {
		e := events[i]
		if !isAppearedViewController(e) {
			out = append(out, e)
			i++
			continue
		}
		j := i + 1
		for j < len(events) && isAppearedViewController(events[j]) && events[j].Timestamp == e.Timestamp {
			j++
		}
		var kept *Event
		for k := i; k < j; k++ {
			if !containerHosts.MatchString(shortName(events[k].ViewController)) {
				kept = &events[k]
			}
		}
		if kept != nil {
			out = append(out, *kept)
		}
		i = j
	}
	return out
}

// replay walks one session's events in time order and returns its visits.
//
// The host is the last activity that resumed or view controller that
// appeared. The screen is the last screen view, resumed fragment or SwiftUI
// view inside that host.
func replay(events []Event) []*visit {
	events = collapseViewControllers(events)

	var visits []*visit
	host, screen := "", ""
	// A host that appears without being created again is the same instance
	// coming back, for example after a dialog closes, so it still shows the
	// screen it last showed.
	freshHosts := map[string]bool{}
	lastScreen := map[string]string{}

	last := func() *visit {
		if len(visits) == 0 {
			return nil
		}
		return visits[len(visits)-1]
	}

	enter := func(newHost, newScreen string, ts int64) {
		host, screen = newHost, newScreen
		key := screenKey(host, screen)
		if key == "" {
			return
		}
		if previous := last(); previous != nil && previous.key == key {
			return
		}
		visits = append(visits, newVisit(host, screen, ts))
	}

	// enterHost starts a visit to a host. A screen view that arrived just
	// before a freshly created host appeared is moved into that host, because
	// Flutter on iOS reports the route before its view controller appears.
	enterHost := func(newHost string, ts int64) {
		fresh := freshHosts[newHost]
		if fresh {
			delete(freshHosts, newHost)
			delete(lastScreen, newHost)
		}
		var carried *visit
		previous := last()
		if fresh && previous != nil && previous.host != newHost && previous.screen != "" &&
			len(previous.taps) == 0 && ts-previous.start < leadMs {
			carried = previous
			visits = visits[:len(visits)-1]
			if s, ok := lastScreen[carried.host]; ok && s == carried.screen {
				delete(lastScreen, carried.host)
			}
		}
		if carried == nil {
			enter(newHost, lastScreen[newHost], ts)
			return
		}
		enter(newHost, carried.screen, carried.start)
		lastScreen[newHost] = carried.screen
		current := last()
		current.snapshots = append(carried.snapshots, current.snapshots...)
	}

	for _, e := range events {
		ts := e.Timestamp
		priority := 1
		switch e.Type {
		case event.TypeLifecycleActivity:
			name := shortName(e.Activity)
			if e.ActivityState == event.LifecycleActivityTypeCreated {
				freshHosts[name] = true
				continue
			}
			enterHost(name, ts)
			priority = 0
		case event.TypeLifecycleViewController:
			name := shortName(e.ViewController)
			if containerHosts.MatchString(name) {
				continue
			}
			if e.ViewControllerState == event.LifecycleViewControllerTypeViewDidLoad {
				freshHosts[name] = true
				continue
			}
			enterHost(name, ts)
			priority = 0
		case event.TypeLifecycleFragment:
			parent := shortName(e.FragmentParent)
			if parent == "" {
				parent = host
			}
			fragment := shortName(e.Fragment)
			lastScreen[parent] = fragment
			enter(parent, fragment, ts)
			priority = 0
		case event.TypeLifecycleSwiftUI:
			name := shortName(e.SwiftUI)
			if host != "" {
				lastScreen[host] = name
			}
			enter(host, name, ts)
			priority = 0
		case event.TypeScreenView:
			if host != "" {
				lastScreen[host] = e.ScreenView
			}
			enter(host, e.ScreenView, ts)
			priority = 0
		case event.TypeGestureClick:
			target := last()
			if target == nil {
				continue
			}
			// Flutter reports the new route before the tap that caused it, so
			// a tap right after a screen change belongs to the screen before.
			if len(visits) > 1 && ts-target.start <= tapLagMs {
				target = visits[len(visits)-2]
			}
			label := tapLabel(e)
			target.taps = append(target.taps, tap{ts: ts, label: label})
			for _, key := range e.Snapshots {
				target.snapshots = append(target.snapshots, snapshotRef{key: key, ts: ts, priority: 1, tap: label})
			}
			continue
		}
		if current := last(); current != nil {
			for _, key := range e.Snapshots {
				current.snapshots = append(current.snapshots, snapshotRef{key: key, ts: ts, priority: priority})
			}
		}
	}

	return mergeTransients(visits)
}

// mergeTransients folds a visit into the next one in the same host when the
// user never saw it on its own: a host that showed its first screen before
// any tap, or a tap-free visit shorter than minVisitMs.
func mergeTransients(visits []*visit) []*visit {
	var merged []*visit
	for i, v := range visits {
		if i+1 < len(visits) {
			next := visits[i+1]
			if next.host == v.host && len(v.taps) == 0 && (v.hostOnly() || next.start-v.start < minVisitMs) {
				next.start = v.start
				next.snapshots = append(v.snapshots, next.snapshots...)
				continue
			}
		}
		if n := len(merged); n > 0 && merged[n-1].key == v.key {
			previous := merged[n-1]
			previous.snapshots = append(previous.snapshots, v.snapshots...)
			previous.taps = append(previous.taps, v.taps...)
			continue
		}
		merged = append(merged, v)
	}
	return merged
}
