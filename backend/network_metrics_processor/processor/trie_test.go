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
	trie := NewTrie(10)
	trie.Insert("api.example.com", "/health", 10)
	trie.Insert("web.example.com", "/home", 20)
	trie.Insert("cdn.example.com", "/logo", 30)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/health", Count: 10},
		{Domain: "cdn.example.com", Path: "/logo", Count: 30},
		{Domain: "web.example.com", Path: "/home", Count: 20},
	})
}

func TestTrie_HighCardinalitySegmentsCollapse(t *testing.T) {
	trie := NewTrie(10)
	// Insert 11 children at depth 2 to trigger collapse.
	for i := range 11 {
		trie.Insert("api.example.com", fmt.Sprintf("/sub/v%d", i), 10)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/*", Count: 110},
	})
}

func TestTrie_NonHighCardinalitySegmentsDoNotCollapse(t *testing.T) {
	trie := NewTrie(10)
	// Insert 14 children at depth 2 to trigger collapse.
	for i := range 11 {
		trie.Insert("api.example.com", fmt.Sprintf("/sub/v%d", i), 10)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/*", Count: 110},
	})
}

func TestTrie_InsertSegmentToCollapsed(t *testing.T) {
	trie := NewTrie(10)
	// Insert 11 children to generate /sub/* pattern.
	for i := range 11 {
		trie.Insert("api.example.com", fmt.Sprintf("/sub/v%d", i), 10)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/*", Count: 110},
	})

	// Insert one more child, should simply increment the count
	trie.Insert("api.example.com", "/sub/extra", 5)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/sub/*", Count: 115},
	})
}

func TestTrie_WildcardSegmentChildrenStaySeparate(t *testing.T) {
	trie := NewTrie(10)
	trie.Insert("api.example.com", "/users/*/profile", 50)
	trie.Insert("api.example.com", "/users/*/settings", 30)
	trie.Insert("api.example.com", "/users/*/orders", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/users/*/profile", Count: 50},
		{Domain: "api.example.com", Path: "/users/*/settings", Count: 30},
		{Domain: "api.example.com", Path: "/users/*/orders", Count: 20},
	})
}

func TestTrie_LeafAndSubpathsCoexist(t *testing.T) {
	trie := NewTrie(10)
	trie.Insert("api.example.com", "/", 10)
	trie.Insert("api.example.com", "/users", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/", Count: 10},
		{Domain: "api.example.com", Path: "/users", Count: 20},
	})
}

func TestTrie_SinglePath(t *testing.T) {
	trie := NewTrie(10)
	trie.Insert("api.example.com", "/health", 10)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/health", Count: 10},
	})
}

func TestTrie_EmptyTrieReturnsNothing(t *testing.T) {
	trie := NewTrie(10)
	patterns := trie.ExtractPatterns()
	if len(patterns) != 0 {
		t.Fatalf("expected 0 patterns from empty trie, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_DomainsIsolated(t *testing.T) {
	trie := NewTrie(10)
	trie.Insert("api.example.com", "/users", 10)
	trie.Insert("api.example.com", "/posts", 20)
	trie.Insert("cdn.example.com", "/assets/logo", 30)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/users", Count: 10},
		{Domain: "api.example.com", Path: "/posts", Count: 20},
		{Domain: "cdn.example.com", Path: "/assets/logo", Count: 30},
	})
}

func TestTrie_CollapsesDeepSiblings(t *testing.T) {
	trie := NewTrie(10)
	// 11 children under /api/ for the same domain triggers collapse.
	for i := 0; i < 11; i++ {
		trie.Insert("example.com", fmt.Sprintf("/api/v%d", i), 10)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/api/*", Count: 110},
	})
}

func TestTrie_ManyDomainsNeverCollapse(t *testing.T) {
	trie := NewTrie(10)
	// Even with many domains, depth 0 never collapses.
	for i := 0; i < 20; i++ {
		trie.Insert(fmt.Sprintf("d%d.example.com", i), "/health", 5)
	}

	patterns := trie.ExtractPatterns()
	if len(patterns) != 20 {
		t.Fatalf("expected 20 patterns, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_TopLevelPathsNeverCollapse(t *testing.T) {
	trie := NewTrie(10)
	// Many first-level path segments under one domain — depth 1 never collapses.
	for i := 0; i < 20; i++ {
		trie.Insert("example.com", fmt.Sprintf("/seg%d/child", i), 5)
	}

	patterns := trie.ExtractPatterns()
	if len(patterns) != 20 {
		t.Fatalf("expected 20 patterns, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_ConsecutiveTrailingWildcardsCollapse(t *testing.T) {
	trie := NewTrie(10)
	trie.Insert("example.com", "/users/*/*", 10)
	trie.Insert("example.com", "/track/*/*/*", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/**", Count: 10},
		{Domain: "example.com", Path: "/track/**", Count: 20},
	})
}

func TestTrie_SingleTrailingWildcardUnchanged(t *testing.T) {
	trie := NewTrie(10)
	trie.Insert("example.com", "/users/*", 10)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/*", Count: 10},
	})
}

func TestTrie_NonTrailingWildcardsUnchanged(t *testing.T) {
	trie := NewTrie(10)
	trie.Insert("example.com", "/users/*/orders/*", 10)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/*/orders/*", Count: 10},
	})
}
