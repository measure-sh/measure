package journey

import (
	"fmt"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/group"
	"measure-backend/measure-go/set"
	"strings"

	"github.com/google/uuid"
	"github.com/yourbasic/graph"
)

// Journey is the interface to express
// and operate journey maps.
type Journey interface {
	// GetEdgeSessions computes list of unique session ids
	// for the edge `v->w`.
	GetEdgeSessions(v, w int) (sessionIds []uuid.UUID)

	// GetEdgeSessionCount computes the count of sessions
	// for the edge `v->w`.
	GetEdgeSessionCount(v, w int) int

	// GetNodeName provides the node name mapped to
	// the vertex's index.
	GetNodeName(v int) string

	// IterNodeExceptions iterates over each node passing
	// down exception event ids and expecting matching
	// exception groups.
	IterNodeExceptions(iterator func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error)) (err error)

	// IterNodeANRs iterates over each node passing
	// down exception event ids and expecting matching
	// exception groups.
	IterNodeANRs(iterator func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error)) (err error)

	// GetNodeExceptionGroups gets the exception group for
	// a node. Matches with node's string.
	GetNodeExceptionGroups(name string) (exceptionGroups []group.ExceptionGroup)

	// GetNodeANRGroups gets the anr group for
	// a node. Matches with node's string.
	GetNodeANRGroups(name string) (anrGroups []group.ANRGroup)
}

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

	// IssueEvents is the list
	// of issue slice index.
	IssueEvents []int
}

// nodebag represents a journey
// graph's node's additional
// properties like vertex index,
// node index, issue ids and
// issue groups.
type nodebag struct {
	// vertex is the vertex id
	// of the graph's node.
	vertex int

	// nodeid is the id of the
	// node.
	nodeid int

	// exceptionIds stores a set
	// of UUIDs associated with
	// this node.
	exceptionIds *set.UUIDSet

	// anrIds stores a set of
	// UUIDs associated with
	// this node.
	anrIds *set.UUIDSet

	// exceptionGroups stores a
	// slice of exception groups
	// associated with this node.
	exceptionGroups []group.ExceptionGroup

	// anrGroups stores a slice of
	// anr groups associated with
	// this node.
	anrGroups []group.ANRGroup
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
	// "v->w" string key to respective
	// set of ids.
	metalut map[string]*set.UUIDSet
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
func (j *JourneyAndroid) buildGraph() {
	j.Graph = graph.New(len(j.nodelut))
	if j.metalut == nil {
		j.metalut = make(map[string]*set.UUIDSet)
	}
	lastActivity := -1

	for i := range j.Nodes {
		first := i == 0
		last := i == len(j.Nodes)-1

		if last {
			break
		}

		currNode := j.Nodes[i]
		nextNode := j.Nodes[i+1]
		currSession := j.Events[currNode.ID].SessionID
		nextSession := j.Events[nextNode.ID].SessionID
		currEvent := j.Events[currNode.ID]
		nextEvent := j.Events[nextNode.ID]

		if first {
			lastActivity = i
		}

		sameSession := currSession == nextSession

		if currNode.IsActivity {
			lastActivity = i
		}

		vkey := j.Nodes[lastActivity].Name
		wkey := nextNode.Name
		v := j.nodelut[vkey]
		w := j.nodelut[wkey]

		if nextNode.IsFragment && !j.isFragmentOrphan(nextNode.ID) {
			j.addEdgeID(v.vertex, w.vertex, currSession)
		}

		if nextNode.IsActivity {
			j.addEdgeID(v.vertex, w.vertex, currSession)
		}

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
			if !j.Graph.Edge(v.vertex, w.vertex) {
				j.Graph.Add(v.vertex, w.vertex)
			}
			continue
		}

		if nextNode.IsActivity {
			if !j.Graph.Edge(v.vertex, w.vertex) {
				j.Graph.Add(v.vertex, w.vertex)
			}
			continue
		}
	}
}

// addEdgeID adds the id to an edge from v to w.
func (j *JourneyAndroid) addEdgeID(v, w int, id uuid.UUID) {
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

// GetEdgeSessions computes list of unique session ids
// for the edge `v->w`.
func (j *JourneyAndroid) GetEdgeSessions(v, w int) (sessionIds []uuid.UUID) {
	key := j.makeKey(v, w)
	return j.metalut[key].Slice()
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

// SetNodeExceptionGroups iterates over each node passing
// down exception event ids and expecting matching
// exception groups. It applies received exception
// groups to the journe.
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

// isFragmentOrphan tells if the event indexed by `i`
// is a lifecycle fragment and if the lifecycle fragment
// lacks a parent activity.
func (j JourneyAndroid) isFragmentOrphan(i int) bool {
	event := j.Events[i]
	return event.IsLifecycleFragment() && event.LifecycleFragment.ParentActivity == ""
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

// NewJourneyAndroid creates a journey graph object
// from a list of events.
func NewJourneyAndroid(events []event.EventField) (journey JourneyAndroid) {
	journey.Events = events
	journey.nodelut = make(map[string]*nodebag)
	journey.nodelutinverse = make(map[int]string)

	for i := range events {
		var node NodeAndroid
		node.ID = i

		if events[i].IsLifecycleActivity() {
			node.Name = events[i].LifecycleActivity.ClassName
			node.IsActivity = true
		} else if events[i].IsLifecycleFragment() {
			node.Name = events[i].LifecycleFragment.ClassName
			node.IsFragment = true
		} else if i > 0 && events[i].IsUnhandledException() || events[i].IsANR() {
			// find the previous activity or fragment node
			// and attach the issue to the node.
			c := i
			for {
				c--
				if journey.Nodes[c].IsActivity || journey.Nodes[c].IsFragment {
					journey.Nodes[c].IssueEvents = append(journey.Nodes[c].IssueEvents, i)
					break
				}
			}
		}

		journey.Nodes = append(journey.Nodes, node)

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
