package journey

import (
	"testing"
	"time"

	"backend/libs/measure"
)

// edgeAt builds an edge row seen at the given offset, mimicking the FirstSeen
// ordering the aggregate returns.
func edgeAt(source, target string, sessions uint64, offset int) measure.JourneyEdge {
	return measure.JourneyEdge{
		Source:    source,
		Target:    target,
		Sessions:  sessions,
		FirstSeen: time.Unix(int64(offset), 0).UTC(),
	}
}

// pairs flattens edges to "source->target" strings for comparison.
func pairs(edges []Edge) (out []string) {
	for _, edge := range edges {
		out = append(out, edge.Source+"->"+edge.Target)
	}
	return
}

func TestBuildEdges(t *testing.T) {
	rows := []measure.JourneyEdge{
		edgeAt("Home", "Detail", 5, 1),
		edgeAt("Detail", "Home", 3, 2),
		edgeAt("Detail", "Settings", 2, 3),
	}

	cases := []struct {
		name    string
		biGraph bool
		want    []string
	}{
		{"suppresses reverse", false, []string{"Home->Detail", "Detail->Settings"}},
		{"keeps both directions", true, []string{"Home->Detail", "Detail->Home", "Detail->Settings"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := Build(measure.JourneyGraph{Edges: rows}, &Options{BiGraph: c.biGraph})

			got := pairs(r.Edges)
			if len(got) != len(c.want) {
				t.Fatalf("edges = %v, want %v", got, c.want)
			}
			for i := range got {
				if got[i] != c.want[i] {
					t.Errorf("edge %d = %s, want %s", i, got[i], c.want[i])
				}
			}
			if r.Edges[0].Sessions != 5 {
				t.Errorf("Home->Detail sessions = %d, want 5", r.Edges[0].Sessions)
			}
		})
	}
}

func TestBuildNodesWithoutEdges(t *testing.T) {
	g := measure.JourneyGraph{
		Nodes: []string{"Home", "Detail", "Orphan"},
		Edges: []measure.JourneyEdge{edgeAt("Home", "Detail", 1, 1)},
	}

	r := Build(g, &Options{})

	want := []string{"Home", "Detail", "Orphan"}
	if len(r.Nodes) != len(want) {
		t.Fatalf("nodes = %v, want %v", r.Nodes, want)
	}
	for i := range want {
		if r.Nodes[i] != want[i] {
			t.Errorf("node %d = %s, want %s", i, r.Nodes[i], want[i])
		}
	}
}

func TestBuildIssues(t *testing.T) {
	g := measure.JourneyGraph{
		Nodes: []string{"Home", "Detail"},
		Issues: []measure.JourneyIssue{
			{Node: "Home", Fingerprint: "fp-crash", Count: 4},
			{Node: "Home", Fingerprint: "fp-anr", IsANR: true, Count: 2},
			{Node: "Detail", Fingerprint: "fp-crash", Count: 1},
		},
	}

	r := Build(g, &Options{})

	if got := r.Crashes["Home"]; len(got) != 1 || got[0].Fingerprint != "fp-crash" || got[0].Count != 4 {
		t.Errorf("Home crashes = %+v, want one fp-crash with count 4", got)
	}
	if got := r.ANRs["Home"]; len(got) != 1 || got[0].Fingerprint != "fp-anr" || got[0].Count != 2 {
		t.Errorf("Home ANRs = %+v, want one fp-anr with count 2", got)
	}
	if got := r.Crashes["Detail"]; len(got) != 1 || got[0].Count != 1 {
		t.Errorf("Detail crashes = %+v, want one issue with count 1", got)
	}
	if got := r.ANRs["Detail"]; len(got) != 0 {
		t.Errorf("Detail ANRs = %+v, want none", got)
	}
}
