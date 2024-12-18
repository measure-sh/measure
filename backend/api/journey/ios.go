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

// NodeiOS represents each
// node of the journey graph
// for iOS.
type NodeiOS struct {
	// ID is the sequence number
	// of the event in the list
	// of events.
	ID int

	// Name is the name of the
	// lifecycle view controller or
	// lifecycle swift ui class name.
	Name string

	// IsUIKit indicates the node
	// is of lifecycle view controller
	// origin.
	IsUIKit bool

	// IsSwiftUI indicates the node
	// is of lifecycle swift ui origin.
	IsSwiftUI bool

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
func (j *JourneyiOS) buildGraph() {
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
func (j *JourneyiOS) GetNodeExceptionCount(v int, exceptionGroupId uuid.UUID) (crashCount int) {
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

			b.WriteString(fmt.Sprintf("  %s -> %s [label=\"%d session(s)\"];\n", fmt.Sprintf("\"(%d) %s\"", v, vName), fmt.Sprintf("\"(%d) %s\"", w, wName), n))

			return false
		})
	}

	b.WriteString("}\n")

	return b.String()
}

// GetLastView finds the last iOS view
// node by traversing towards start direction.
func (j JourneyiOS) GetLastView(node *NodeiOS) (parent *NodeiOS) {
	c := node.ID

	for {
		c--

		if c < 0 {
			break
		}

		if j.Nodes[c].IsUIKit || j.Nodes[c].IsSwiftUI {
			return &j.Nodes[c]
		}
	}

	return
}

// NewJourneyiOS creates a journey graph object
// from a list of iOS specific events.
func NewJourneyiOS(events []event.EventField, opts *Options) (journey JourneyiOS) {
	return
}
