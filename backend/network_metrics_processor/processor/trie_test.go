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

func TestTrie_SiblingPathsRemainDistinct(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users", 10)
	trie.Insert("/api/posts", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/users", Count: 10},
		{Domain: "api", Path: "/posts", Count: 20},
	})
}

func TestTrie_FirstLevelChildrenNeverCollapse(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users", 10)
	trie.Insert("/api/posts", 20)
	trie.Insert("/api/comments", 30)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/users", Count: 10},
		{Domain: "api", Path: "/posts", Count: 20},
		{Domain: "api", Path: "/comments", Count: 30},
	})
}

func TestTrie_ManyFirstLevelChildrenNeverCollapse(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users", 10)
	trie.Insert("/api/posts", 20)
	trie.Insert("/api/comments", 30)
	trie.Insert("/api/orders", 5)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/users", Count: 10},
		{Domain: "api", Path: "/posts", Count: 20},
		{Domain: "api", Path: "/comments", Count: 30},
		{Domain: "api", Path: "/orders", Count: 5},
	})
}

func TestTrie_RootChildrenNeverCollapse(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/health", 10)
	trie.Insert("/web/home", 20)
	trie.Insert("/static/logo", 30)
	trie.Insert("/auth/login", 5)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/health", Count: 10},
		{Domain: "auth", Path: "/login", Count: 5},
		{Domain: "static", Path: "/logo", Count: 30},
		{Domain: "web", Path: "/home", Count: 20},
	})
}

func TestTrie_BelowThresholdSiblingsStaySeparate(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users/profile", 10)
	trie.Insert("/api/users/settings", 20)
	trie.Insert("/api/users/orders", 30)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/users/profile", Count: 10},
		{Domain: "api", Path: "/users/settings", Count: 20},
		{Domain: "api", Path: "/users/orders", Count: 30},
	})
}

func TestTrie_EleventhChildTriggersWildcard(t *testing.T) {
	trie := NewTrie()
	// Insert 11 children at depth 2 to trigger collapse.
	for i := 0; i < 11; i++ {
		trie.Insert(fmt.Sprintf("/api/sub/v%d", i), 10)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/sub/*", Count: 110},
	})
}

func TestTrie_InsertsAfterCollapseAreAbsorbed(t *testing.T) {
	trie := NewTrie()
	// Insert 12: the 11th triggers collapse, 12th is absorbed.
	for i := 0; i < 12; i++ {
		trie.Insert(fmt.Sprintf("/api/sub/v%d", i), 10)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/sub/*", Count: 120},
	})
}

func TestTrie_IndependentBranchesCoexist(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users/profile", 10)
	trie.Insert("/api/users/settings", 20)
	trie.Insert("/api/users/orders", 30)
	trie.Insert("/api/posts/latest", 40)
	trie.Insert("/web/home", 5)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/users/profile", Count: 10},
		{Domain: "api", Path: "/users/settings", Count: 20},
		{Domain: "api", Path: "/users/orders", Count: 30},
		{Domain: "api", Path: "/posts/latest", Count: 40},
		{Domain: "web", Path: "/home", Count: 5},
	})
}

func TestTrie_WildcardSegmentChildrenStaySeparate(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api/users/*/profile", 50)
	trie.Insert("/api/users/*/settings", 30)
	trie.Insert("/api/users/*/orders", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/users/*/profile", Count: 50},
		{Domain: "api", Path: "/users/*/settings", Count: 30},
		{Domain: "api", Path: "/users/*/orders", Count: 20},
	})
}

func TestTrie_LeafAndSubpathsCoexist(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/api", 10)
	trie.Insert("/api/users", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api", Path: "/", Count: 10},
		{Domain: "api", Path: "/users", Count: 20},
	})
}

func TestTrie_SingleSegment(t *testing.T) {
	trie := NewTrie()
	trie.Insert("/health", 10)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "health", Path: "/", Count: 10},
	})
}

func TestTrie_EmptyTrieReturnsNothing(t *testing.T) {
	trie := NewTrie()
	patterns := trie.ExtractPatterns()
	if len(patterns) != 0 {
		t.Fatalf("expected 0 patterns from empty trie, got %d: %v", len(patterns), patterns)
	}
}

// --- InsertWithDomain tests ---

func TestTrie_InsertWithDomain_KeepsDomainsIsolated(t *testing.T) {
	trie := NewTrie()
	trie.InsertWithDomain("api.example.com", "/users", 10)
	trie.InsertWithDomain("api.example.com", "/posts", 20)
	trie.InsertWithDomain("cdn.example.com", "/assets/logo", 30)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "api.example.com", Path: "/users", Count: 10},
		{Domain: "api.example.com", Path: "/posts", Count: 20},
		{Domain: "cdn.example.com", Path: "/assets/logo", Count: 30},
	})
}

func TestTrie_InsertWithDomain_CollapsesDeepSiblings(t *testing.T) {
	trie := NewTrie()
	// 11 children under /api/ for the same domain triggers collapse.
	for i := 0; i < 11; i++ {
		trie.InsertWithDomain("example.com", fmt.Sprintf("/api/v%d", i), 10)
	}

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/api/*", Count: 110},
	})
}

func TestTrie_InsertWithDomain_ManyDomainsNeverCollapse(t *testing.T) {
	trie := NewTrie()
	// Even with many domains, depth 0 never collapses.
	for i := 0; i < 20; i++ {
		trie.InsertWithDomain(fmt.Sprintf("d%d.example.com", i), "/health", 5)
	}

	patterns := trie.ExtractPatterns()
	if len(patterns) != 20 {
		t.Fatalf("expected 20 patterns, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_InsertWithDomain_TopLevelPathsNeverCollapse(t *testing.T) {
	trie := NewTrie()
	// Many first-level path segments under one domain — depth 1 never collapses.
	for i := 0; i < 20; i++ {
		trie.InsertWithDomain("example.com", fmt.Sprintf("/seg%d/child", i), 5)
	}

	patterns := trie.ExtractPatterns()
	if len(patterns) != 20 {
		t.Fatalf("expected 20 patterns, got %d: %v", len(patterns), patterns)
	}
}

func TestTrie_ConsecutiveTrailingWildcardsCollapse(t *testing.T) {
	trie := NewTrie()
	trie.InsertWithDomain("example.com", "/users/*/*", 10)
	trie.InsertWithDomain("example.com", "/track/*/*/*", 20)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/**", Count: 10},
		{Domain: "example.com", Path: "/track/**", Count: 20},
	})
}

func TestTrie_SingleTrailingWildcardUnchanged(t *testing.T) {
	trie := NewTrie()
	trie.InsertWithDomain("example.com", "/users/*", 10)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/*", Count: 10},
	})
}

func TestTrie_NonTrailingWildcardsUnchanged(t *testing.T) {
	trie := NewTrie()
	trie.InsertWithDomain("example.com", "/users/*/orders/*", 10)

	assertPatterns(t, trie.ExtractPatterns(), []PatternResult{
		{Domain: "example.com", Path: "/users/*/orders/*", Count: 10},
	})
}
