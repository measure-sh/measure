package journey

import (
	"backend/api/event"
	"backend/api/group"
	"backend/api/set"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/yourbasic/graph"
)

// NodeAndroid represents each
// node of the journey graph
// for android.
type NodeAndroid struct {
	// ID is the sequence number
	// of the event in the list
	// of events.
	ID int

	// Name is the name of the
	// lifecycle activity or
	// fragment's class name.
	Name string

	// IsActivity indicates the node
	// is a lifecycle activity.
	IsActivity bool

	// IsFragment indicates the node
	// is a lifecycle fragment.
	IsFragment bool

	// IsFragmentParent indicates the fragment
	// node is maybe a parent fragment.
	IsFragmentParent bool

	// IssueEvents is the list
	// of issue slice index.
	IssueEvents []int
}

// JourneyAndroid represents
// a complete journey from
// relevant Android events.
type JourneyAndroid struct {
	// Events is the list of events.
	Events []event.EventField

	// Nodes is the list of nodes.
	Nodes []NodeAndroid

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

	// options is the journey's options
	options *Options
}

// computeIssues resolves issue event UUIDs
// from index and stores them in each node.
func (j *JourneyAndroid) computeIssues() {
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
			} else if issueEvent.IsANR() {
				bag.anrIds.Add(issueEvent.ID)
			}
		}
	}
}

// buildGraph builds a graph structure
// from available events data in the
// journey.
//
// Uses a greedy approach to build a journey
// graph from lifecycle events. The algorithm
// has 4 broad sections.
//
// In the first section, it tries to predict
// which node should be the parent node.
//
// In the second section, it attaches extra
// metadata to edges like session ids.
//
// In the third section, it collapses continous
// series of exactly same nodes.
//
// In the fourth section, it establishes edges
// between the nodes. Optionally, if bigraph
// setting is true, then it establishes edges
// in both forward and reverse directions.
func (j *JourneyAndroid) buildGraph() {
	j.Graph = graph.New(len(j.nodelut))

	if j.metalut == nil {
		j.metalut = make(map[string]*set.UUIDSet)
	}

	// keep track of who should be parent
	lastParent := -1

	var nodeidxs []int

	for i := range j.Nodes {
		if j.Nodes[i].IsActivity || j.Nodes[i].IsFragment {
			nodeidxs = append(nodeidxs, i)
		}
	}

	for _, i := range nodeidxs {
		first := i == 0
		last := i == len(j.Nodes)-1

		if last {
			break
		}

		currNode := j.Nodes[i]
		nextNode := j.Nodes[i+1]
		currEvent := j.Events[currNode.ID]
		nextEvent := j.Events[nextNode.ID]
		currSession := currEvent.SessionID
		nextSession := nextEvent.SessionID

		// assumption is first node will be
		// an activity
		if first {
			lastParent = i
		}

		sameSession := currSession == nextSession

		if currNode.IsActivity {
			lastParent = i
		}

		// an activity node should not create an edge directly
		// to a child fragment.
		if currNode.IsActivity && nextNode.IsFragment && !nextNode.IsFragmentParent {
			continue
		}

		// perform some basic heuristics to
		// look for a parent node when current
		// node is a fragment
		if currNode.IsFragment {
			// determine parent when current node
			// is a fragment.
			if currNode.IsFragmentParent {
				lastParent = i
			} else {
				parentNode := j.getParentFragmentNode(&currNode)
				if parentNode != nil {
					lastParent = parentNode.ID
				}
			}

			// if next node is a child fragment, only establish an edge
			// if the fragment's parent node matches the current event's
			// fragment class name.
			if !nextNode.IsFragmentParent {
				parentNode := j.getParentFragmentNode(&nextNode)
				if parentNode != nil {
					if nextEvent.LifecycleFragment.ParentFragment != currEvent.LifecycleFragment.ClassName {
						continue
					}
				}
			}

			// if going from fragment to activity, we find the
			// last activity and set that as the next activity's
			// parent node.
			if nextNode.IsActivity {
				parentNode := j.GetLastActivity(&currNode)
				if parentNode != nil {
					lastParent = parentNode.ID
				} else {
					// did not find a parent activity
					// wil not create an edge
					continue
				}
			}
		}

		vkey := j.Nodes[lastParent].Name
		wkey := nextNode.Name
		v := j.nodelut[vkey]
		w := j.nodelut[wkey]

		// discard self node loops
		if vkey == wkey {
			continue
		}

		if nextNode.IsFragment && !j.isFragmentOrphan(nextNode.ID) {
			j.addEdgeID(v.vertex, w.vertex, currSession)
		}

		if nextNode.IsActivity {
			j.addEdgeID(v.vertex, w.vertex, currSession)
		}

		// session has changed, so let's start over
		if !sameSession {
			continue
		}

		// collapse repeating alike events
		shouldDiscard := false

		if currEvent.IsLifecycleActivity() && nextEvent.IsLifecycleActivity() && currNode.Name == nextNode.Name {
			shouldDiscard = true
		}

		if currEvent.IsLifecycleFragment() && nextEvent.IsLifecycleFragment() && currNode.Name == nextNode.Name {
			shouldDiscard = true
		}

		if shouldDiscard {
			continue
		}

		if nextNode.IsFragment && !j.isFragmentOrphan(nextNode.ID) {
			if j.options.BiGraph {
				if !j.Graph.Edge(v.vertex, w.vertex) {
					j.Graph.Add(v.vertex, w.vertex)
				}
			} else {
				if !j.Graph.Edge(w.vertex, v.vertex) {
					j.Graph.Add(v.vertex, w.vertex)
				}
			}
			continue
		}

		if nextNode.IsActivity {
			if j.options.BiGraph {
				if !j.Graph.Edge(v.vertex, w.vertex) {
					j.Graph.Add(v.vertex, w.vertex)
				}
			} else {
				if !j.Graph.Edge(w.vertex, v.vertex) {
					j.Graph.Add(v.vertex, w.vertex)
				}
			}
			continue
		}
	}
}

// addEdgeID adds the id to an edge from v to w.
func (j *JourneyAndroid) addEdgeID(v, w int, id uuid.UUID) {
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
func (j *JourneyAndroid) makeKey(v, w int) string {
	return fmt.Sprintf("%d->%d", v, w)
}

// GetEdgeSessionCount computes the count of sessions
// for the edge `v->w`.
func (j *JourneyAndroid) GetEdgeSessionCount(v, w int) int {
	key := j.makeKey(v, w)
	return j.metalut[key].Size()
}

// GetNodeName provides the node name mapped to
// the vertex's index.
func (j *JourneyAndroid) GetNodeName(v int) string {
	return j.nodelutinverse[v]
}

// GetNodeVertices provides the graph's node
// vertices in ascending sorted order.
func (j *JourneyAndroid) GetNodeVertices() (ids []int) {
	for k := range j.nodelut {
		ids = append(ids, j.nodelut[k].vertex)
	}

	slices.Sort(ids)

	return
}

// GetNodeANRCount computes total count of ANR events
// occurring in the ANR group.
func (j *JourneyAndroid) GetNodeANRCount(v int, anrGroupId string) (anrCount int) {
	name := j.nodelutinverse[v]
	node := j.nodelut[name]

	anrGroups := node.anrGroups
	anrIds := node.anrIds.Slice()

	for i := range anrGroups {
		if anrGroups[i].ID != anrGroupId {
			continue
		}
		for j := range anrIds {
			if anrGroups[i].EventExists(anrIds[j]) {
				anrCount += 1
			}
		}
	}

	return
}

// GetNodeExceptionCount computes total count of exception
// events occurring in the exception group.
func (j *JourneyAndroid) GetNodeExceptionCount(v int, exceptionGroupId string) (crashCount int) {
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
func (j *JourneyAndroid) SetNodeExceptionGroups(iterator func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error)) (err error) {
	for k, v := range j.nodelut {
		exceptionGroups, err := iterator(v.exceptionIds.Slice())
		if err != nil {
			return err
		}

		j.nodelut[k].exceptionGroups = exceptionGroups
	}
	return
}

// SetNodeANRGroups iterates over each node passing
// down exception event ids and expecting matching
// exception groups. It applies received exception
// groups to the journey.
func (j *JourneyAndroid) SetNodeANRGroups(iterator func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error)) (err error) {
	for k, v := range j.nodelut {
		anrGroups, err := iterator(v.anrIds.Slice())
		if err != nil {
			return err
		}

		j.nodelut[k].anrGroups = anrGroups
	}
	return
}

// GetNodeExceptionGroups gets the exception group for
// a node. Matches with node's string.
func (j *JourneyAndroid) GetNodeExceptionGroups(name string) (exceptionGroups []group.ExceptionGroup) {
	return j.nodelut[name].exceptionGroups
}

// GetNodeANRGroups gets the anr group for
// a node. Matches with node's string.
func (j *JourneyAndroid) GetNodeANRGroups(name string) (anrGroups []group.ANRGroup) {
	return j.nodelut[name].anrGroups
}

// String generates a graph represented
// in the graphviz dot format.
func (j JourneyAndroid) String() string {
	var b strings.Builder

	b.WriteString("digraph G {\n")
	b.WriteString("  rankdir=LR;\n")

	for v := range j.Graph.Order() {
		j.Graph.Visit(v, func(w int, c int64) bool {
			vName := j.nodelutinverse[v]
			wName := j.nodelutinverse[w]
			key := j.makeKey(v, w)
			n := j.metalut[key].Size()

			b.WriteString(fmt.Sprintf("  %s -> %s [label=\"%d session(s)\"];\n", fmt.Sprintf("\"(%d) %s\"", v, vName), fmt.Sprintf("\"(%d) %s\"", w, wName), n))

			return false
		})
	}

	b.WriteString("}\n")

	return b.String()
}

// isFragmentOrphan tells if the event indexed by `i`
// is a lifecycle fragment and if the lifecycle fragment
// lacks a parent activity.
func (j JourneyAndroid) isFragmentOrphan(i int) bool {
	event := j.Events[i]
	return event.IsLifecycleFragment() && event.LifecycleFragment.ParentActivity == ""
}

// getParentFragmentNode gets the fragment's parent node.
func (j JourneyAndroid) getParentFragmentNode(node *NodeAndroid) (parent *NodeAndroid) {
	if !node.IsFragment {
		return
	}
	name := j.Events[node.ID].LifecycleFragment.ParentFragment
	nodebag := j.nodelut[name]
	// some fragments may not have a parent
	// fragment set, for those fragments,
	// we may not find a legit parent fragment node.
	if nodebag == nil {
		return
	}
	return &j.Nodes[nodebag.nodeid]
}

// GetLastActivity finds the last activity
// node by traversing towards start direction.
func (j JourneyAndroid) GetLastActivity(node *NodeAndroid) (parent *NodeAndroid) {
	c := node.ID

	for {
		c--

		if c < 0 {
			break
		}

		if j.Nodes[c].IsActivity {
			return &j.Nodes[c]
		}
	}

	return
}

// NewJourneyAndroid creates a journey graph object
// from a list of Android specific events.
func NewJourneyAndroid(events []event.EventField, opts *Options) (journey *JourneyAndroid) {
	if opts.ExceptionGroup != nil && opts.ANRGroup != nil {
		panic("cannot accept exception & ANR group both.")
	}

	journey = &JourneyAndroid{}

	journey.Events = events
	journey.nodelut = make(map[string]*nodebag)
	journey.nodelutinverse = make(map[int]string)
	journey.options = opts

	for i := range events {
		var node NodeAndroid
		node.ID = i
		activity := events[i].IsLifecycleActivity()
		fragment := events[i].IsLifecycleFragment()
		issue := i > 0 && events[i].IsUnhandledException() || events[i].IsANR()

		if activity {
			node.Name = events[i].LifecycleActivity.ClassName
			node.IsActivity = true
		} else if fragment {
			fragmentEvent := events[i].LifecycleFragment
			node.Name = fragmentEvent.ClassName
			node.IsFragment = true

			if fragmentEvent.ParentFragment == "" {
				node.IsFragmentParent = true
			}

		} else if issue {
			// find the previous activity node
			// and attach the issue to that node.
			c := i
			for {
				c--

				// reached the end, we're done
				if c < 0 {
					break
				}

				// we only add issues to activity nodes
				if journey.Nodes[c].IsActivity {
					addIssue := false

					// only add exception if requested and if the issue exists
					// because for crash overview page, we want to show journey
					// with exceptions only.
					if journey.options.ExceptionGroup != nil && journey.options.ExceptionGroup.EventExists(events[i].ID) {
						addIssue = true
					}

					// only add ANR if requested and if the ANR exists
					// because for ANR overview page, we want to show journey
					// with ANRs only.
					if journey.options.ANRGroup != nil && journey.options.ANRGroup.EventExists(events[i].ID) {
						addIssue = true
					}

					// if neither exception or ANR is requested, then we want to add both
					// exceptions and ANRs to the nodes because for the overview journey
					// we want to show both exceptions and ANRs
					if journey.options.ExceptionGroup == nil && journey.options.ANRGroup == nil {
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
		if node.IsActivity || node.IsFragment {
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
