package journeymap

import (
	"context"
	"fmt"
	"sort"
	"sync"

	"golang.org/x/sync/errgroup"
)

// Fetch reads the layout snapshot stored at key.
type Fetch func(ctx context.Context, key string) ([]byte, error)

// Map is the screens of an app and the forward moves between them.
type Map struct {
	Screens     []Screen     `json:"screens"`
	Transitions []Transition `json:"transitions"`
}

// Count is how often something with a label happened.
type Count struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// Screen is a host, or a screen shown inside a host.
type Screen struct {
	Key    string `json:"key"`
	Host   string `json:"host"`
	Screen string `json:"screen"`
	Visits int    `json:"visits"`
	// Entries counts sessions that started on the screen.
	Entries int `json:"entries"`
	// SnapshotVisits counts visits with at least one snapshot, the total a
	// variant's visits are a share of.
	SnapshotVisits int `json:"snapshot_visits"`
	// Variants are the states the screen was seen in, most seen first. The
	// first one is the screen's picture.
	Variants []Variant `json:"variants"`
}

// Variant is a screen in one state, such as with a section expanded or a
// sheet open.
type Variant struct {
	Visits  int  `json:"visits"`
	Loading bool `json:"loading"`
	// Inbound is how visits arrived in this state: the tap that led there, or
	// "session start".
	Inbound []Count `json:"inbound"`
	// Taps are the taps made while in this state.
	Taps      []Count   `json:"taps"`
	Wireframe Wireframe `json:"wireframe"`
}

// Transition is a forward move from one screen to another.
type Transition struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Count int    `json:"count"`
	// Triggers are the taps that caused the transition.
	Triggers []Count `json:"triggers"`
}

// counter counts labels, breaking ties by which label was seen first.
type counter struct {
	order  []string
	counts map[string]int
}

func newCounter() *counter {
	return &counter{counts: map[string]int{}}
}

func (c *counter) add(label string) {
	if _, ok := c.counts[label]; !ok {
		c.order = append(c.order, label)
	}
	c.counts[label]++
}

// sorted returns every label, most counted first.
func (c *counter) sorted() []Count {
	out := make([]Count, 0, len(c.order))
	for _, label := range c.order {
		out = append(out, Count{Label: label, Count: c.counts[label]})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	return out
}

// snapshotRecord is a snapshot of a screen and the visit it was taken in.
type snapshotRecord struct {
	snapshotRef
	// visit identifies the visit across all sessions.
	visit int
	// inbound is the tap that led to the visit or "session start". It is
	// empty for a visit reached without a tap or by going back.
	inbound string
	// snapshot is nil until the snapshot is read.
	snapshot *snapshot
}

type screenStats struct {
	Screen
	snapshots []snapshotRecord
}

type transitionStats struct {
	Transition
	triggers *counter
}

// returnTo reports whether key is on the navigation stack below the current
// screen, which means the user went back to it, and pops the stack to it.
func returnTo(stack []string, key string) ([]string, bool) {
	for i := len(stack) - 2; i >= 0; i-- {
		if stack[i] == key {
			return stack[:i+1], true
		}
	}
	return stack, false
}

// Build replays every session and aggregates the visits into a map. Events
// must be grouped by session and in time order within each session. Snapshots
// are read with fetch.
func Build(ctx context.Context, events []Event, fetch Fetch) (Map, error) {
	var sessionIDs []string
	bySession := map[string][]Event{}
	for _, e := range events {
		if _, ok := bySession[e.SessionID]; !ok {
			sessionIDs = append(sessionIDs, e.SessionID)
		}
		bySession[e.SessionID] = append(bySession[e.SessionID], e)
	}

	screens := map[string]*screenStats{}
	var screenOrder []string
	transitions := map[[2]string]*transitionStats{}
	var transitionOrder [][2]string
	visitID := 0

	for _, sessionID := range sessionIDs {
		visits := replay(bySession[sessionID])
		// stack holds the screens the user moved forward through to reach the
		// current one, oldest first.
		var stack []string
		for index, v := range visits {
			s, ok := screens[v.key]
			if !ok {
				s = &screenStats{
					Screen: Screen{Key: v.key, Host: v.host, Screen: v.screen, Variants: []Variant{}},
				}
				screens[v.key] = s
				screenOrder = append(screenOrder, v.key)
			}
			s.Visits++
			if index == 0 {
				s.Entries++
			}

			inbound := ""
			if index == 0 {
				inbound = "session start"
				stack = []string{v.key}
			} else if back, wentBack := returnTo(stack, v.key); wentBack {
				stack = back
			} else {
				previous := visits[index-1]
				pair := [2]string{previous.key, v.key}
				t, ok := transitions[pair]
				if !ok {
					t = &transitionStats{
						Transition: Transition{From: previous.key, To: v.key},
						triggers:   newCounter(),
					}
					transitions[pair] = t
					transitionOrder = append(transitionOrder, pair)
				}
				t.Count++
				if n := len(previous.taps); n > 0 && v.start-previous.taps[n-1].ts <= triggerWindowMs {
					inbound = previous.taps[n-1].label
					t.triggers.add(inbound)
				}
				stack = append(stack, v.key)
			}

			for _, ref := range v.snapshots {
				s.snapshots = append(s.snapshots, snapshotRecord{snapshotRef: ref, visit: visitID, inbound: inbound})
			}
			visitID++
		}
	}

	ordered := make([]*screenStats, 0, len(screenOrder))
	for _, key := range screenOrder {
		ordered = append(ordered, screens[key])
	}
	sort.SliceStable(ordered, func(i, j int) bool {
		a, b := ordered[i], ordered[j]
		if a.Visits != b.Visits {
			return a.Visits > b.Visits
		}
		return a.Key < b.Key
	})

	m := Map{Screens: []Screen{}, Transitions: []Transition{}}
	for _, s := range ordered {
		if err := readVariants(ctx, s, fetch); err != nil {
			return Map{}, err
		}
		m.Screens = append(m.Screens, s.Screen)
	}

	for _, pair := range transitionOrder {
		t := transitions[pair]
		t.Triggers = t.triggers.sorted()
		m.Transitions = append(m.Transitions, t.Transition)
	}
	sort.SliceStable(m.Transitions, func(i, j int) bool { return m.Transitions[i].Count > m.Transitions[j].Count })

	return m, nil
}

// readVariants reads every snapshot of the screen and groups them into
// variants. A snapshot that cannot be read is left out, so one missing object
// does not fail the whole map.
func readVariants(ctx context.Context, s *screenStats, fetch Fetch) error {
	records := append([]snapshotRecord(nil), s.snapshots...)
	sort.SliceStable(records, func(i, j int) bool { return records[i].ts > records[j].ts })
	seen := map[string]bool{}
	var picked []*snapshotRecord
	for i := range records {
		if seen[records[i].key] {
			continue
		}
		seen[records[i].key] = true
		picked = append(picked, &records[i])
	}

	var mu sync.Mutex
	unread := 0
	var firstErr error
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(fetchWorkers)
	for _, rec := range picked {
		g.Go(func() error {
			raw, err := fetch(gctx, rec.key)
			if err == nil {
				rec.snapshot, err = parseSnapshot(raw)
			}
			if err != nil {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				mu.Lock()
				unread++
				if firstErr == nil {
					firstErr = fmt.Errorf("snapshot %s: %w", rec.key, err)
				}
				mu.Unlock()
			}
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return err
	}
	if firstErr != nil {
		fmt.Println("journey map: failed to read", unread, "snapshots of", s.Key, firstErr)
	}

	var loaded []*snapshotRecord
	for _, rec := range picked {
		if rec.snapshot != nil {
			loaded = append(loaded, rec)
		}
	}
	buildVariants(s, loaded)
	return nil
}

type variantGroup struct {
	records        []*snapshotRecord
	representative *snapshotRecord
	visits         map[int]bool
	inbound        *counter
	taps           *counter
	loading        bool
}

// buildVariants groups a screen's snapshots into variants. Snapshots with the
// same signature are one variant. Groups at least variantSimilarity alike are
// merged too, so a lazily built list that laid out a few more rows is not a
// variant of its own.
func buildVariants(s *screenStats, loaded []*snapshotRecord) {
	if len(loaded) == 0 {
		return
	}

	var signatures []string
	exact := map[string][]*snapshotRecord{}
	for _, rec := range loaded {
		sig := rec.snapshot.signature
		if _, ok := exact[sig]; !ok {
			signatures = append(signatures, sig)
		}
		exact[sig] = append(exact[sig], rec)
	}
	sort.SliceStable(signatures, func(i, j int) bool { return len(exact[signatures[i]]) > len(exact[signatures[j]]) })

	var groups []*variantGroup
	for _, sig := range signatures {
		recs := exact[sig]
		var home *variantGroup
		for _, candidate := range groups {
			if similarity(candidate.representative.snapshot.bag, recs[0].snapshot.bag) >= variantSimilarity {
				home = candidate
				break
			}
		}
		if home == nil {
			home = &variantGroup{representative: recs[0], inbound: newCounter(), taps: newCounter()}
			groups = append(groups, home)
		}
		home.records = append(home.records, recs...)
	}

	// A visit arrived in the variant its earliest snapshot shows, so that is
	// where its inbound tap is counted. Every variant seen during a visit
	// counts the visit.
	groupOf := map[*snapshotRecord]*variantGroup{}
	for _, g := range groups {
		for _, rec := range g.records {
			groupOf[rec] = g
		}
	}
	firstByVisit := map[int]*snapshotRecord{}
	var visitOrder []int
	for _, rec := range loaded {
		current, ok := firstByVisit[rec.visit]
		if !ok {
			visitOrder = append(visitOrder, rec.visit)
		}
		if !ok || rec.ts < current.ts {
			firstByVisit[rec.visit] = rec
		}
	}
	for _, visit := range visitOrder {
		rec := firstByVisit[visit]
		if rec.inbound != "" {
			groupOf[rec].inbound.add(rec.inbound)
		}
	}

	mostElements := 0
	for _, g := range groups {
		g.visits = map[int]bool{}
		for _, rec := range g.records {
			g.visits[rec.visit] = true
			if rec.tap != "" {
				g.taps.add(rec.tap)
			}
		}
		g.representative = g.records[0]
		for _, rec := range g.records[1:] {
			best := g.representative
			if rec.priority < best.priority || (rec.priority == best.priority && rec.ts > best.ts) {
				g.representative = rec
			}
		}
		mostElements = max(mostElements, g.representative.snapshot.elements)
	}

	// A loading variant is reported but never becomes the screen's picture.
	var kept []*variantGroup
	for _, g := range groups {
		g.loading = len(groups) > 1 && float64(g.representative.snapshot.elements) < loadingShare*float64(mostElements)
		if !g.loading && len(g.visits) >= minVariantVisits {
			kept = append(kept, g)
		}
	}
	if len(kept) == 0 {
		best := groups[0]
		for _, g := range groups[1:] {
			if betterFallback(g, best) {
				best = g
			}
		}
		kept = []*variantGroup{best}
	}
	sort.SliceStable(kept, func(i, j int) bool {
		if len(kept[i].visits) != len(kept[j].visits) {
			return len(kept[i].visits) > len(kept[j].visits)
		}
		return len(kept[i].records) > len(kept[j].records)
	})

	snapshotVisits := map[int]bool{}
	for _, g := range kept {
		for visit := range g.visits {
			snapshotVisits[visit] = true
		}
		s.Variants = append(s.Variants, Variant{
			Visits:    len(g.visits),
			Loading:   g.loading,
			Inbound:   g.inbound.sorted(),
			Taps:      g.taps.sorted(),
			Wireframe: g.representative.snapshot.wireframe,
		})
	}
	s.SnapshotVisits = len(snapshotVisits)
}

// betterFallback reports whether a is a better picture of a screen than b,
// used when no variant was seen often enough to be reported: loaded content
// first, then the most visits, then the most snapshots.
func betterFallback(a, b *variantGroup) bool {
	if a.loading != b.loading {
		return !a.loading
	}
	if len(a.visits) != len(b.visits) {
		return len(a.visits) > len(b.visits)
	}
	return len(a.records) > len(b.records)
}
