package journey

import (
	"backend/libs/measure"
)

// Options configures how a journey graph is assembled.
type Options struct {
	// BiGraph keeps both directions of a transition. When false, only the
	// direction seen first survives.
	BiGraph bool
}

// Edge is a transition between two nodes that survived assembly.
type Edge struct {
	Source   string
	Target   string
	Sessions uint64
}

// Issue is a crash or ANR group attached to a node.
type Issue struct {
	Fingerprint string
	Count       uint64
}

// Result is an assembled journey graph.
type Result struct {
	// Nodes are node names in first appearance order.
	Nodes []string

	// Edges are the surviving transitions.
	Edges []Edge

	// Crashes are fatal exceptions keyed by node name.
	Crashes map[string][]Issue

	// ANRs are ANRs keyed by node name.
	ANRs map[string][]Issue
}

// Build assembles aggregate rows into a journey graph. Edges are expected in
// chronological order, that order decides which direction of a transition
// survives when opts.BiGraph is false.
func Build(g measure.JourneyGraph, opts *Options) (r Result) {
	r.Nodes = g.Nodes
	r.Edges = buildEdges(g.Edges, opts.BiGraph)
	r.Crashes, r.ANRs = splitIssues(g.Issues)

	return
}

// buildEdges drops an edge whose reverse was already kept, unless bidirectional
// edges are wanted.
func buildEdges(rows []measure.JourneyEdge, biGraph bool) (edges []Edge) {
	kept := make(map[[2]string]bool, len(rows))

	for _, row := range rows {
		if !biGraph && kept[[2]string{row.Target, row.Source}] {
			continue
		}

		kept[[2]string{row.Source, row.Target}] = true
		edges = append(edges, Edge{
			Source:   row.Source,
			Target:   row.Target,
			Sessions: row.Sessions,
		})
	}

	return
}

// splitIssues groups issue rows by node, separating crashes from ANRs.
func splitIssues(rows []measure.JourneyIssue) (crashes, anrs map[string][]Issue) {
	crashes = make(map[string][]Issue)
	anrs = make(map[string][]Issue)

	for _, row := range rows {
		issue := Issue{Fingerprint: row.Fingerprint, Count: row.Count}
		if row.IsANR {
			anrs[row.Node] = append(anrs[row.Node], issue)
			continue
		}
		crashes[row.Node] = append(crashes[row.Node], issue)
	}

	return
}
