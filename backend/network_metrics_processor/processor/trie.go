package processor

import (
	"strings"
)

// TrieNode represents a node in a URL pattern trie that
// groups similar paths into wildcard patterns.
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

// Insert adds a path with its count to the trie.
func (t *TrieNode) Insert(path string, count uint64) {
	segments := splitPath(path)
	t.insert(segments, count, 0)
}

// InsertWithDomain adds a path with its count to the trie
// under the given domain.
func (t *TrieNode) InsertWithDomain(domain, path string, count uint64) {
	segments := append([]string{domain}, splitPath(path)...)
	t.insert(segments, count, 0)
}

// ExtractPatterns walks the trie and returns all patterns
// with their accumulated counts.
func (t *TrieNode) ExtractPatterns() []PatternResult {
	var results []PatternResult
	t.extract(nil, &results)
	collapseTrailingWildcards(results)
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

	if _, exists := t.children[segment]; !exists && len(t.children) >= 10 && depth > 1 {
		// Adding an 11th child at depth > 1 triggers collapse.
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
		domain, pathSegs := splitDomainPrefix(prefix)
		path := "/" + strings.Join(pathSegs, "/") + "/*"
		*results = append(*results, PatternResult{
			Domain: domain,
			Path:   path,
			Count:  t.count,
		})
		return
	}

	if t.isLeaf {
		domain, pathSegs := splitDomainPrefix(prefix)
		path := "/" + strings.Join(pathSegs, "/")
		*results = append(*results, PatternResult{
			Domain: domain,
			Path:   path,
			Count:  t.count,
		})
	}

	for seg, child := range t.children {
		childPrefix := make([]string, len(prefix)+1)
		copy(childPrefix, prefix)
		childPrefix[len(prefix)] = seg
		child.extract(childPrefix, results)
	}
}

// splitDomainPrefix splits the first segment as domain from
// the remaining path segments.
func splitDomainPrefix(prefix []string) (string, []string) {
	if len(prefix) == 0 {
		return "", nil
	}
	return prefix[0], prefix[1:]
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

// collapseTrailingWildcards replaces consecutive trailing
// "/*" segments with a single "/**" in each pattern path.
// e.g. /users/*/* becomes /users/**.
func collapseTrailingWildcards(results []PatternResult) {
	for i, r := range results {
		segs := strings.Split(r.Path, "/")
		// Count consecutive "*" from the end.
		trailing := 0
		for j := len(segs) - 1; j >= 0; j-- {
			if segs[j] == "*" {
				trailing++
			} else {
				break
			}
		}
		if trailing >= 2 {
			results[i].Path = strings.Join(segs[:len(segs)-trailing], "/") + "/**"
		}
	}
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
