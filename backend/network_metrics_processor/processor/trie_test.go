package processor

import (
	"fmt"
	"sort"
	"testing"
)

// sortPatterns sorts by domain then path for deterministic comparison.
func sortPatterns(ps []PatternResult) {
	sort.Slice(ps, func(i, j int) bool {
		if ps[i].Domain != ps[j].Domain {
			return ps[i].Domain < ps[j].Domain
		}
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
		if got[i].Domain != want[i].Domain || got[i].Path != want[i].Path || got[i].Count != want[i].Count {
			t.Errorf("pattern[%d]: got %v, want %v", i, got[i], want[i])
		}
	}
}

func TestTrie_FirstSegmentNeverCollapse(t *testing.T) {
	// Threshold 2: even with 3 domains (exceeding threshold), depth 0 never collapses.
	trie := NewTrie(2)
	trie.Insert("api.example.com", "/health", 1)
	trie.Insert("web.example.com", "/home", 2)
	trie.Insert("cdn.example.com", "/logo", 3)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/health", Count: 1},
		{Domain: "cdn.example.com", Path: "/logo", Count: 3},
		{Domain: "web.example.com", Path: "/home", Count: 2},
	})
}

func TestTrie_HighCardinalitySegmentsCollapse(t *testing.T) {
	trie := NewTrie(3)
	// Insert 4 children at depth 2 to trigger collapse (4th exceeds threshold of 3).
	for i := range 4 {
		trie.Insert("api.example.com", fmt.Sprintf("/sub/v%d", i), 1)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/*", Count: 4},
	})
}

func TestTrie_NonHighCardinalitySegmentsDoNotCollapse(t *testing.T) {
	trie := NewTrie(3)
	// Insert 3 children at depth 2 — at threshold but not exceeding, so no collapse.
	for i := range 3 {
		trie.Insert("api.example.com", fmt.Sprintf("/sub/v%d", i), 1)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/v0", Count: 1},
		{Domain: "api.example.com", Path: "/sub/v1", Count: 1},
		{Domain: "api.example.com", Path: "/sub/v2", Count: 1},
	})
}

func TestTrie_InsertSegmentToCollapsed(t *testing.T) {
	trie := NewTrie(3)
	// Insert 4 children to trigger collapse into /sub/*.
	for i := range 4 {
		trie.Insert("api.example.com", fmt.Sprintf("/sub/v%d", i), 1)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/*", Count: 4},
	})

	// Insert one more child, should simply increment the count.
	trie.Insert("api.example.com", "/sub/extra", 2)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/*", Count: 6},
	})
}

func TestTrie_WildcardSegmentChildrenStaySeparate(t *testing.T) {
	trie := NewTrie(3)
	trie.Insert("api.example.com", "/users/*/profile", 5)
	trie.Insert("api.example.com", "/users/*/settings", 3)
	trie.Insert("api.example.com", "/users/*/orders", 2)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/users/*/profile", Count: 5},
		{Domain: "api.example.com", Path: "/users/*/settings", Count: 3},
		{Domain: "api.example.com", Path: "/users/*/orders", Count: 2},
	})
}

func TestTrie_LeafAndSubpathsCoexist(t *testing.T) {
	trie := NewTrie(3)
	trie.Insert("api.example.com", "/", 1)
	trie.Insert("api.example.com", "/users", 2)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/", Count: 1},
		{Domain: "api.example.com", Path: "/users", Count: 2},
	})
}

func TestTrie_SinglePath(t *testing.T) {
	trie := NewTrie(3)
	trie.Insert("api.example.com", "/health", 1)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/health", Count: 1},
	})
}

func TestTrie_EmptyTrieReturnsNothing(t *testing.T) {
	trie := NewTrie(3)
	patterns := trie.ExtractPatterns()
	if len(patterns) != 0 {
		t.Fatalf("expected 0 patterns from empty trie, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_DomainsIsolated(t *testing.T) {
	trie := NewTrie(3)
	trie.Insert("api.example.com", "/users", 1)
	trie.Insert("api.example.com", "/posts", 2)
	trie.Insert("cdn.example.com", "/assets/logo", 3)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/users", Count: 1},
		{Domain: "api.example.com", Path: "/posts", Count: 2},
		{Domain: "cdn.example.com", Path: "/assets/logo", Count: 3},
	})
}

func TestTrie_CollapsesDeepSiblings(t *testing.T) {
	trie := NewTrie(3)
	// 4 children under /api/ triggers collapse (exceeds threshold of 3).
	for i := range 4 {
		trie.Insert("example.com", fmt.Sprintf("/api/v%d", i), 1)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/api/*", Count: 4},
	})
}

func TestTrie_ManyDomainsNeverCollapse(t *testing.T) {
	// Threshold 2: even with 5 domains (exceeding threshold), depth 0 never collapses.
	trie := NewTrie(2)
	for i := range 5 {
		trie.Insert(fmt.Sprintf("d%d.example.com", i), "/health", 1)
	}

	patterns := trie.ExtractPatterns()
	if len(patterns) != 5 {
		t.Fatalf("expected 5 patterns, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_TopLevelPathsNeverCollapse(t *testing.T) {
	// Threshold 2: even with 5 first-level segments (exceeding threshold), depth 1 never collapses.
	trie := NewTrie(2)
	for i := range 5 {
		trie.Insert("example.com", fmt.Sprintf("/seg%d/child", i), 1)
	}

	patterns := trie.ExtractPatterns()
	if len(patterns) != 5 {
		t.Fatalf("expected 5 patterns, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_ConsecutiveTrailingWildcardsCollapse(t *testing.T) {
	trie := NewTrie(3)
	trie.Insert("example.com", "/users/*/*", 1)
	trie.Insert("example.com", "/track/*/*/*", 2)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/**", Count: 1},
		{Domain: "example.com", Path: "/track/**", Count: 2},
	})
}

func TestTrie_SingleTrailingWildcardUnchanged(t *testing.T) {
	trie := NewTrie(3)
	trie.Insert("example.com", "/users/*", 1)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/*", Count: 1},
	})
}

func TestTrie_NonTrailingWildcardsUnchanged(t *testing.T) {
	trie := NewTrie(3)
	trie.Insert("example.com", "/users/*/orders/*", 1)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/*/orders/*", Count: 1},
	})
}

func TestTrie_PreNormalizedWildcardPaths(t *testing.T) {
	trie := NewTrie(3)
	// Simulate post-NormalizePath input where * segments already exist.
	trie.Insert("api.example.com", "/users/*/profile", 5)
	trie.Insert("api.example.com", "/users/*/profile", 3)
	trie.Insert("api.example.com", "/users/*/settings", 2)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/users/*/profile", Count: 8},
		{Domain: "api.example.com", Path: "/users/*/settings", Count: 2},
	})
}
