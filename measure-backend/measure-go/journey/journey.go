package journey

import (
	"fmt"
	"measure-backend/measure-go/event"
	"strings"

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

func (j JourneyAndroid) String() string {
	var b strings.Builder

	b.WriteString("digraph G {\n")
	b.WriteString("  rankdir=LR;\n")

	for v := range j.Graph.Order() {
		j.Graph.Visit(v, func(w int, c int64) bool {
			// if j.Graph.Edge(v, w) {
			// 	prefix := "au.com.shiftyjelly.pocketcasts."
			// 	vName, _ := strings.CutPrefix(j.Nodes[v].Name, prefix)
			// 	wName, _ := strings.CutPrefix(j.Nodes[w].Name, prefix)
			// 	b.WriteString(fmt.Sprintf("  %s -> %s;\n", fmt.Sprintf("\"(%d) %s\"", v, vName), fmt.Sprintf("\"(%d) %s\"", w, wName)))
			// }
			prefix := ""
			vName, _ := strings.CutPrefix(j.Nodes[v].Name, prefix)
			wName, _ := strings.CutPrefix(j.Nodes[w].Name, prefix)
			b.WriteString(fmt.Sprintf("  %s -> %s;\n", fmt.Sprintf("\"(%d) %s\"", v, vName), fmt.Sprintf("\"(%d) %s\"", w, wName)))
			return false
		})
	}

	b.WriteString("}\n")

	return b.String()

}

func (j *JourneyAndroid) init() {
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

		if first {
			lastActivity = i
		}

		sameSession := currSession == nextSession

		if currNode.IsActivity {
			lastActivity = i
		}

		fmt.Printf("i: %d, same session: %v, last activity: %d\n", i, sameSession, lastActivity)
		fmt.Printf("\n")

		if !sameSession {
			continue
		}

		v := j.Nodes[lastActivity].ID
		w := nextNode.ID

		if nextNode.IsFragment && !j.isFragmentOrphan(nextNode.ID) {
			j.Graph.Add(v, w)
			fmt.Printf("v:%d --> w:%d\n", v, w)
			fmt.Printf("\n")
			continue
		}

		if nextNode.IsActivity {
			j.Graph.Add(v, w)
			fmt.Printf("v:%d --> w:%d\n", v, w)
			fmt.Printf("\n")
			continue
		}
	}

	fmt.Println("graph", j.Graph.String(), "order", j.Graph.Order())
	fmt.Println("nodelut", j.nodelut)
}

func (j *JourneyAndroid) buildGraph() {
	j.Graph = graph.New(len(j.nodelut))
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

		vkey := j.Nodes[lastActivity].Name
		wkey := nextNode.Name
		v := j.nodelut[vkey]
		w := j.nodelut[wkey]

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

	fmt.Println("graph", j.Graph.String())
	fmt.Println("order", j.Graph.Order())
	fmt.Println("acyclic", graph.Acyclic(j.Graph))
	fmt.Println("nodelut", j.nodelut)
}

// func (j *JourneyAndroid) AddEdgeID(v, w int, id uuid.UUID) {
// 	// bit shift w to upper 32 bits and bitwise OR with v
// 	// to combine and obtain unique integer key for map
// 	key := (uint64(v) << 32) | uint64(w)

// 	// set := NewUUIDSet()
// 	if j.lut[key] == nil {
// 		j.lut[key] = NewUUIDSet()
// 	}
// 	set := j.lut[key]
// 	set.Add(id)
// }

func (j JourneyAndroid) isFragmentOrphan(i int) bool {
	event := j.Events[i]
	return event.IsLifecycleFragment() && event.LifecycleFragment.ParentActivity == ""
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
