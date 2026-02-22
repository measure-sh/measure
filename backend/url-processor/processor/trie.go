package processor

import (
	"strings"
)

// TrieNode represents a node in the URL pattern trie.
// The trie eagerly collapses nodes at depth > 0 when a
// 3rd child would be added, keeping memory bounded.
type TrieNode struct {
	children    map[string]*TrieNode
	count       uint64
	isLeaf      bool
	isCollapsed bool
}

// NewTrie creates a new root TrieNode.
func NewTrie() *TrieNode {
	return &TrieNode{
		children: make(map[string]*TrieNode),
	}
}

// Insert adds a path with its count to the trie. The path
// is split by "/" (empty segments from leading slash are
// skipped). Nodes at depth > 0 are collapsed when a 3rd
// child would be added.
func (t *TrieNode) Insert(path string, count uint64) {
	segments := splitPath(path)
	t.insert(segments, count, 0)
}

// ExtractPatterns walks the trie and returns all patterns
// with their accumulated counts.
func (t *TrieNode) ExtractPatterns() []PatternResult {
	var results []PatternResult
	t.extract(nil, &results)
	return results
}

func (t *TrieNode) insert(segments []string, count uint64, depth int) {
	if len(segments) == 0 {
		t.count += count
		t.isLeaf = true
		return
	}

	if t.isCollapsed {
		t.count += count
		return
	}

	segment := segments[0]
	rest := segments[1:]

	if _, exists := t.children[segment]; !exists && len(t.children) >= 10 && depth > 0 {
		// Adding a 11th child at depth > 0 triggers collapse.
		t.count += subtreeCount(t) + count
		t.children = make(map[string]*TrieNode)
		t.isLeaf = true
		t.isCollapsed = true
		return
	}

	if _, exists := t.children[segment]; !exists {
		t.children[segment] = NewTrie()
	}
	t.children[segment].insert(rest, count, depth+1)
}

func (t *TrieNode) extract(prefix []string, results *[]PatternResult) {
	if t.isCollapsed {
		path := buildCollapsedPath(prefix)
		*results = append(*results, PatternResult{
			Path:  path,
			Count: t.count,
		})
		return
	}

	if t.isLeaf {
		path := "/" + strings.Join(prefix, "/")
		*results = append(*results, PatternResult{
			Path:  path,
			Count: t.count,
		})
	}

	for seg, child := range t.children {
		childPrefix := make([]string, len(prefix)+1)
		copy(childPrefix, prefix)
		childPrefix[len(prefix)] = seg
		child.extract(childPrefix, results)
	}
}

// buildCollapsedPath builds the pattern path for a collapsed
// node. It always appends "/*" to preserve the path depth
// structure.
func buildCollapsedPath(prefix []string) string {
	return "/" + strings.Join(prefix, "/") + "/*"
}

// subtreeCount sums all leaf and collapsed counts in the
// subtree rooted at node (excluding node's own count).
func subtreeCount(node *TrieNode) uint64 {
	var total uint64
	for _, child := range node.children {
		total += childCount(child)
	}
	return total
}

func childCount(node *TrieNode) uint64 {
	var total uint64
	if node.isLeaf || node.isCollapsed {
		total += node.count
	}
	for _, child := range node.children {
		total += childCount(child)
	}
	return total
}

// splitPath splits a URL path by "/" and removes empty
// segments (e.g., leading slash produces an empty first
// element).
func splitPath(path string) []string {
	parts := strings.Split(path, "/")
	segments := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			segments = append(segments, p)
		}
	}
	return segments
}
