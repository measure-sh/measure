package journey

import (
	"backend/api/event"
	"backend/api/filter"
	"backend/api/group"
	"backend/api/set"
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/yourbasic/graph"
)

// NodeiOS represents each
// node of the journey graph
// for iOS.
type NodeiOS struct {
	// ID is the sequence number
	// of the event in the list
	// of events.
	ID int

	// Name is the name of the
	// lifecycle view controller,
	// lifecycle swift ui class name,
	// or screen view name.
	Name string

	// IsViewController indicates the node
	// is of lifecycle view controller
	// origin.
	IsViewController bool

	// IsSwiftUI indicates the node
	// is of lifecycle swift ui origin.
	IsSwiftUI bool

	// IsScreenView indicates the node
	// is a screen view.
	IsScreenView bool

	// IssueEvents is the list
	// of issue slice index.
	IssueEvents []int
}

// JourneyiOS represents
// a complete journey from
// relevant iOS events.
type JourneyiOS struct {
	// Events is the list of events.
	Events []event.EventField

	// Nodes is the list of nodes.
	Nodes []NodeiOS

	// Graph is the generated journey
	// graph.
	Graph *graph.Mutable

	// nodelut is a lookup table mapping
	// node name to respective nodebag.
	nodelut map[string]*nodebag

	// nodelutinverse is a lookup table
	// mapping vertex id to the node's
	// class name.
	nodelutinverse map[int]string

	// metalut is a lookup table mapping
	// edges where keys look like "v->w"
	// pointing to a UUID set.
	metalut map[string]*set.UUIDSet

	exceptionGroups map[string]*group.ExceptionGroup
	anrGroups       map[string]*group.ANRGroup

	// options is the journey's options
	options *Options
}

// computeIssues resolves issue event UUIDs
// from index and stores them in each node.
func (j *JourneyiOS) computeIssues() {
	for i := range j.Nodes {
		if len(j.Nodes[i].IssueEvents) < 1 {
			continue
		}
		for k := range j.Nodes[i].IssueEvents {
			issueEvent := j.Events[j.Nodes[i].IssueEvents[k]]
			name := j.Nodes[i].Name
			bag, ok := j.nodelut[name]
			if !ok {
				continue
			}
			if issueEvent.IsUnhandledException() {
				bag.exceptionIds.Add(issueEvent.ID)
				bag.exceptionFingerprints = append(bag.exceptionFingerprints, issueEvent.Exception.Fingerprint)

				if j.exceptionGroups == nil {
					j.exceptionGroups = make(map[string]*group.ExceptionGroup)
				}
				j.exceptionGroups[issueEvent.Exception.Fingerprint] = nil
			}
		}
	}
}

// buildGraph builds a graph structure
// from available events data in the
// journey.
//
// Uses a sequential approach to build a journey
// graph from lifecycle events. The algorithm
// maintains the actual sequence of events regardless
// of node type (view controller, swift ui, or screen view).
//
// The algorithm:
// 1. Iterates through nodes in order
// 2. Creates edges from current node to next node
// 3. Tracks session IDs for each edge
// 4. Collapses consecutive duplicate nodes
// 5. Respects session boundaries
func (j *JourneyiOS) buildGraph() {
	j.Graph = graph.New(len(j.nodelut))

	if j.metalut == nil {
		j.metalut = make(map[string]*set.UUIDSet)
	}

	var nodeidxs []int

	for i := range j.Nodes {
		if j.Nodes[i].IsViewController || j.Nodes[i].IsSwiftUI || j.Nodes[i].IsScreenView {
			nodeidxs = append(nodeidxs, i)
		}
	}

	for idx := 0; idx < len(nodeidxs)-1; idx++ {
		i := nodeidxs[idx]
		nextIdx := nodeidxs[idx+1]

		currNode := j.Nodes[i]
		nextNode := j.Nodes[nextIdx]
		currEvent := j.Events[currNode.ID]
		nextEvent := j.Events[nextNode.ID]
		currSession := currEvent.SessionID
		nextSession := nextEvent.SessionID

		sameSession := currSession == nextSession

		vkey := currNode.Name
		wkey := nextNode.Name
		v := j.nodelut[vkey]
		w := j.nodelut[wkey]

		// discard self node loops
		if vkey == wkey {
			continue
		}

		// collapse repeating alike events
		shouldDiscard := false

		if sameSession {
			if currEvent.IsLifecycleViewController() && nextEvent.IsLifecycleViewController() && currNode.Name == nextNode.Name {
				shouldDiscard = true
			}

			if currEvent.IsLifecycleSwiftUI() && nextEvent.IsLifecycleSwiftUI() && currNode.Name == nextNode.Name {
				shouldDiscard = true
			}

			if currEvent.IsScreenView() && nextEvent.IsScreenView() && currNode.Name == nextNode.Name {
				shouldDiscard = true
			}
		}

		if shouldDiscard {
			continue
		}

		// prevent cycles - skip if reverse edge already exists (unless BiGraph mode)
		if !j.options.BiGraph && j.Graph.Edge(w.vertex, v.vertex) {
			continue
		}

		// add edge metadata (session ID)
		j.addEdgeID(v.vertex, w.vertex, currSession)

		// add graph edge
		if j.options.BiGraph {
			if !j.Graph.Edge(v.vertex, w.vertex) {
				j.Graph.Add(v.vertex, w.vertex)
			}
		} else {
			if !j.Graph.Edge(w.vertex, v.vertex) {
				j.Graph.Add(v.vertex, w.vertex)
			}
		}
	}
}

// addEdgeID adds the id to an edge from v to w.
func (j *JourneyiOS) addEdgeID(v, w int, id uuid.UUID) {
	if !j.options.BiGraph && j.Graph.Edge(w, v) {
		return
	}
	key := j.makeKey(v, w)
	uuidset, ok := j.metalut[key]
	if !ok {
		j.metalut[key] = set.NewUUIDSet()
		uuidset = j.metalut[key]
	}

	uuidset.Add(id)
}

// makeKey creates a string key in the form
// of "v->w" from v and w graph vertices.
func (j *JourneyiOS) makeKey(v, w int) string {
	return fmt.Sprintf("%d->%d", v, w)
}

// GetEdgeSessionCount computes the count of sessions
// for the edge `v->w`.
func (j *JourneyiOS) GetEdgeSessionCount(v, w int) int {
	key := j.makeKey(v, w)
	return j.metalut[key].Size()
}

// GetNodeName provides the node name mapped to
// the vertex's index.
func (j *JourneyiOS) GetNodeName(v int) string {
	return j.nodelutinverse[v]
}

// GetNodeVertices provides the graph's node
// vertices in ascending sorted order.
func (j *JourneyiOS) GetNodeVertices() (ids []int) {
	for k := range j.nodelut {
		ids = append(ids, j.nodelut[k].vertex)
	}

	slices.Sort(ids)

	return
}

// GetNodeExceptionCount computes total count of exception
// events occurring in the exception group.
func (j *JourneyiOS) GetNodeExceptionCount(v int, exceptionGroupId string) (crashCount int) {
	name := j.nodelutinverse[v]
	node := j.nodelut[name]

	exceptionGroups := node.exceptionGroups
	exceptionIds := node.exceptionIds.Slice()

	for i := range exceptionGroups {
		if exceptionGroups[i].ID != exceptionGroupId {
			continue
		}
		for j := range exceptionIds {
			if exceptionGroups[i].EventExists(exceptionIds[j]) {
				crashCount += 1
			}
		}
	}

	return
}

// SetNodeExceptionGroups iterates over each node passing
// down exception event ids and expecting matching
// exception groups. It applies received exception
// groups to the journey.
func (j *JourneyiOS) SetNodeExceptionGroups(iterator func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error)) (err error) {
	for k, v := range j.nodelut {
		exceptionGroups, err := iterator(v.exceptionIds.Slice())
		if err != nil {
			return err
		}

		j.nodelut[k].exceptionGroups = exceptionGroups
	}
	return
}

func (j *JourneyiOS) SetExceptionGroups(ctx context.Context, af *filter.AppFilter) (err error) {
	fingerprints := make([]string, 0, len(j.exceptionGroups))
	for k := range j.exceptionGroups {
		fingerprints = append(fingerprints, k)
	}

	groups, err := group.GetExceptionGroupsFromFingerprints(ctx, af, fingerprints)
	if err != nil {
		return
	}

	for i := range groups {
		j.exceptionGroups[groups[i].ID] = &groups[i]
	}

	for k := range j.nodelut {
		for i := range groups {
			for _, fingerprint := range j.nodelut[k].exceptionFingerprints {
				if groups[i].ID == fingerprint && !slices.ContainsFunc(j.nodelut[k].exceptionGroups, func(g group.ExceptionGroup) bool {
					return g.ID == groups[i].ID
				}) {
					j.nodelut[k].exceptionGroups = append(j.nodelut[k].exceptionGroups, groups[i])
				}
			}
		}
	}

	return
}

// GetNodeExceptionGroups gets the exception group for
// a node. Matches with node's string.
func (j *JourneyiOS) GetNodeExceptionGroups(name string) (exceptionGroups []group.ExceptionGroup) {
	return j.nodelut[name].exceptionGroups
}

// String generates a graph represented
// in the graphviz dot format.
func (j JourneyiOS) String() string {
	var b strings.Builder

	b.WriteString("digraph G {\n")
	b.WriteString("  rankdir=LR;\n")

	for v := range j.Graph.Order() {
		j.Graph.Visit(v, func(w int, c int64) bool {
			vName := j.nodelutinverse[v]
			wName := j.nodelutinverse[w]
			key := j.makeKey(v, w)
			n := j.metalut[key].Size()

			fmt.Fprintf(&b,
				"  \"(%d) %s\" -> \"(%d) %s\" [label=\"%d session(s)\"];\n",
				v, vName,
				w, wName,
				n,
			)

			return false
		})
	}

	b.WriteString("}\n")

	return b.String()
}

// NewJourneyiOS creates a journey graph object
// from a list of iOS specific events.
func NewJourneyiOS(events []event.EventField, opts *Options) (journey *JourneyiOS) {
	journey = &JourneyiOS{}

	journey.Events = events
	journey.nodelut = make(map[string]*nodebag)
	journey.nodelutinverse = make(map[int]string)
	journey.options = opts

	for i := range events {
		var node NodeiOS
		node.ID = i
		viewController := events[i].IsLifecycleViewController()
		swiftUI := events[i].IsLifecycleSwiftUI()
		screenView := events[i].IsScreenView()
		issue := i > 0 && events[i].IsUnhandledException()

		if viewController {
			node.Name = events[i].LifecycleViewController.ClassName
			node.IsViewController = true
		} else if swiftUI {
			node.Name = events[i].LifecycleSwiftUI.ClassName
			node.IsSwiftUI = true
		} else if screenView {
			node.Name = events[i].ScreenView.Name
			node.IsScreenView = true
		} else if issue {
			// find the previous view node and
			// attach the issue to that node.
			c := i
			for {
				c--

				// reached the end, we're done
				if c < 0 {
					break
				}

				// we only add issues to view and screen view nodes
				if journey.Nodes[c].IsViewController || journey.Nodes[c].IsSwiftUI || journey.Nodes[c].IsScreenView {
					addIssue := false

					// only add exception if requested and if the issue exists
					// because for crash overview page, we want to show journey
					// with exceptions only.
					if journey.options.ExceptionGroup != nil && journey.options.ExceptionGroup.EventExists(events[i].ID) {
						addIssue = true
					}

					// if exception is not requested, then we want to add
					// exceptions to the nodes because for the overview
					// journey we want to show exceptions
					if journey.options.ExceptionGroup == nil {
						addIssue = true
					}

					if addIssue {
						journey.Nodes[c].IssueEvents = append(journey.Nodes[c].IssueEvents, i)
						break
					}
				}
			}
		}

		journey.Nodes = append(journey.Nodes, node)

		// let's construct lookup tables for this
		// journey because we gonna need to do a bunch
		// of lookups and inverse lookups at a later point
		if node.IsViewController || node.IsSwiftUI || node.IsScreenView {
			_, ok := journey.nodelut[node.Name]
			if !ok {
				vertex := len(journey.nodelut)
				journey.nodelut[node.Name] = &nodebag{
					vertex:       vertex,
					nodeid:       node.ID,
					exceptionIds: set.NewUUIDSet(),
					anrIds:       set.NewUUIDSet(),
				}

				journey.nodelutinverse[vertex] = node.Name
			}
		}
	}

	journey.computeIssues()
	journey.buildGraph()

	return
}
