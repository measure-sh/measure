package processor

import (
	"sort"
	"testing"
)

// sortPatterns sorts by path for deterministic comparison.
func sortPatterns(ps []PatternResult) {
	sort.Slice(ps, func(i, j int) bool {
		return ps[i].Path < ps[j].Path
	})
}

func assertPatterns(t *testing.T, got []PatternResult, want []PatternResult) {
	t.Helper()
	sortPatterns(got)
	sortPatterns(want)

	if len(got) != len(want) {
		t.Fatalf("got %d patterns, want %d\ngot:  %v\nwant: %v", len(got), len(want), got, want)
	}
	for i := range got {
		if got[i].Path != want[i].Path || got[i].Count != want[i].Count {
			t.Errorf("pattern[%d]: got %v, want %v", i, got[i], want[i])
		}
	}
}

func TestTrie_NoCollapsing(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users", 10)
	trie.Insert("/api/posts", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api/users", Count: 10},
		{Path: "/api/posts", Count: 20},
	})
}

func TestTrie_CollapseAt3rdChild(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users", 10)
	trie.Insert("/api/posts", 20)
	trie.Insert("/api/comments", 30)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api/*", Count: 60},
	})
}

func TestTrie_CollapsedNodeAbsorbsSubsequent(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users", 10)
	trie.Insert("/api/posts", 20)
	trie.Insert("/api/comments", 30)
	trie.Insert("/api/orders", 5)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api/*", Count: 65},
	})
}

func TestTrie_Depth0NeverCollapses(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/health", 10)
	trie.Insert("/web/home", 20)
	trie.Insert("/static/logo", 30)
	trie.Insert("/auth/login", 5)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api/health", Count: 10},
		{Path: "/web/home", Count: 20},
		{Path: "/static/logo", Count: 30},
		{Path: "/auth/login", Count: 5},
	})
}

func TestTrie_CollapseAtCorrectDepth(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users/profile", 10)
	trie.Insert("/api/users/settings", 20)
	trie.Insert("/api/users/orders", 30)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api/users/*", Count: 60},
	})
}

func TestTrie_MixedBranches(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users/profile", 10)
	trie.Insert("/api/users/settings", 20)
	trie.Insert("/api/users/orders", 30)
	trie.Insert("/api/posts/latest", 40)
	trie.Insert("/web/home", 5)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api/users/*", Count: 60},
		{Path: "/api/posts/latest", Count: 40},
		{Path: "/web/home", Count: 5},
	})
}

func TestTrie_DeepCollapseWithWildcardSegment(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users/*/profile", 50)
	trie.Insert("/api/users/*/settings", 30)
	trie.Insert("/api/users/*/orders", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api/users/*/*", Count: 100},
	})
}

func TestTrie_DifferentDepthsCoexist(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api", 10)
	trie.Insert("/api/users", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/api", Count: 10},
		{Path: "/api/users", Count: 20},
	})
}

func TestTrie_SingleSegmentPath(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/health", 10)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Path: "/health", Count: 10},
	})
}

func TestTrie_Empty(t *testing.T) {
	trie := NewTrie()
	patterns := trie.ExtractPatterns()
	if len(patterns) != 0 {
		t.Fatalf("expected 0 patterns from empty trie, got %d: %v", len(patterns), patterns)
	}
}
