package journey

import (
	"fmt"
	"measure-backend/measure-go/event"
	"strings"

	"github.com/google/uuid"
	"github.com/yourbasic/graph"
)

// TODO: Create a node interface

type NodeAndroid struct {
	ID         int
	Name       string
	IsActivity bool
	IsFragment bool
}

type nodetuple struct {
	vertex int
	nodeid int
}

type JourneyAndroid struct {
	Events  []event.EventField
	Nodes   []NodeAndroid
	Graph   *graph.Mutable
	nodelut map[string]nodetuple
	metalut map[string]*UUIDSet
}

func (j *JourneyAndroid) buildGraph() {
	j.Graph = graph.New(len(j.nodelut))
	if j.metalut == nil {
		j.metalut = make(map[string]*UUIDSet)
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
				fmt.Printf("v:%d --> w:%d\n", v.vertex, w.vertex)
			}
			continue
		}

		if nextNode.IsActivity {
			if !j.Graph.Edge(v.vertex, w.vertex) {
				j.Graph.Add(v.vertex, w.vertex)
				fmt.Printf("v:%d --> w:%d\n", v.vertex, w.vertex)
			}
			continue
		}
	}

	for v := range j.Graph.Order() {
		j.Graph.Visit(v, func(w int, c int64) bool {
			if j.Graph.Edge(v, w) {
				key := j.makeKey(v, w)
				fmt.Printf("%d -> %d: size(%d) slice(%v)\n", v, w, j.metalut[key].Size(), j.metalut[key].Slice())
			}
			return false
		})
	}

	fmt.Println("graph", j.Graph.String())
	fmt.Println("order", j.Graph.Order())
	fmt.Println("acyclic", graph.Acyclic(j.Graph))
	fmt.Println("nodelut", j.nodelut)
	fmt.Println("metalut", j.metalut)
}

func (j *JourneyAndroid) addEdgeID(v, w int, id uuid.UUID) {
	key := j.makeKey(v, w)
	set, ok := j.metalut[key]
	if !ok {
		j.metalut[key] = NewUUIDSet()
		set = j.metalut[key]
	}

	set.Add(id)
}

func (j *JourneyAndroid) makeKey(v, w int) string {
	return fmt.Sprintf("%d->%d", v, w)
}

func (j *JourneyAndroid) GetEdgeSessions(v, w int) (sessionIds []uuid.UUID) {
	key := j.makeKey(v, w)
	return j.metalut[key].Slice()
}

func (j JourneyAndroid) isFragmentOrphan(i int) bool {
	event := j.Events[i]
	return event.IsLifecycleFragment() && event.LifecycleFragment.ParentActivity == ""
}

func (j JourneyAndroid) String() string {
	var b strings.Builder

	// need a reverse map that looks
	// up node's name from it's graph
	// vertex.
	reverse := make(map[int]string)
	for k, v := range j.nodelut {
		reverse[v.vertex] = k
	}

	b.WriteString("digraph G {\n")
	b.WriteString("  rankdir=LR;\n")

	for v := range j.Graph.Order() {
		j.Graph.Visit(v, func(w int, c int64) bool {
			vName := reverse[v]
			wName := reverse[w]
			key := j.makeKey(v, w)
			n := j.metalut[key].Size()

			b.WriteString(fmt.Sprintf("  %s -> %s [label=\"%d session(s)\"];\n", fmt.Sprintf("\"(%d) %s\"", v, vName), fmt.Sprintf("\"(%d) %s\"", w, wName), n))

			return false
		})
	}

	b.WriteString("}\n")

	return b.String()

}

func NewJourneyAndroid(events []event.EventField) (journey JourneyAndroid) {
	journey.Events = events
	journey.nodelut = make(map[string]nodetuple)

	for i := range events {
		var node NodeAndroid
		node.ID = i

		if events[i].IsLifecycleActivity() {
			node.Name = events[i].LifecycleActivity.ClassName
			node.IsActivity = true
		} else if events[i].IsLifecycleFragment() {
			node.Name = events[i].LifecycleFragment.ClassName
			node.IsFragment = true
		}

		journey.Nodes = append(journey.Nodes, node)

		_, ok := journey.nodelut[node.Name]
		if !ok {
			journey.nodelut[node.Name] = nodetuple{
				vertex: len(journey.nodelut),
				nodeid: node.ID,
			}
		}
	}

	journey.buildGraph()

	return
}
