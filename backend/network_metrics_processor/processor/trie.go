package processor

import (
	"fmt"
	"sort"
	"strings"
)

// Enable debug logging
var enableDebugLogs = true

// TrieNode represents a URL in the trie
// and accumulates hit counts for patterns
// as URLs are inserted.
type TrieNode struct {
	// hitCount is the accumulated number of
	// requests for paths terminating at this
	// node.
	hitCount uint64

	// children maps the next path segment to
	// its child node.
	children map[string]*TrieNode

	// segmentCardinalityThreshold is the max cardinality
	// of a segment before collapsing it into a
	// wildcard.
	segmentCardinalityThreshold int

	// isCollapsed indicates that this node's
	// children were replaced by a wildcard.
	isCollapsed bool
}

// NewTrie creates a new root TrieNode.
func NewTrie(collapseThreshold int) *TrieNode {
	return &TrieNode{
		children:                    make(map[string]*TrieNode),
		segmentCardinalityThreshold: collapseThreshold,
	}
}

// Insert adds segments into the trie with the given hit count.
func (t *TrieNode) Insert(segments []string, hitCount uint64) {
	t.insert(segments, hitCount, 0)
}

// ExtractPatterns walks the trie and returns all patterns
// with their accumulated hit counts.
func (t *TrieNode) ExtractPatterns() []PatternResult {
	if enableDebugLogs {
		fmt.Println(t.String())
	}
	var results []PatternResult
	t.extract(nil, &results)
	collapseTrailingWildcards(results)
	return results
}

func (t *TrieNode) insert(segments []string, hitCount uint64, depth int) {
	if len(segments) == 0 {
		t.hitCount += hitCount
		return
	}

	if t.isCollapsed {
		t.hitCount += hitCount
		return
	}

	segment := segments[0]
	rest := segments[1:]

	if _, exists := t.children[segment]; !exists && len(t.children) >= t.segmentCardinalityThreshold && depth > 1 {
		// Exceeding threshold at depth > 1 triggers collapse.
		t.hitCount += subtreeCount(t) + hitCount
		t.children = make(map[string]*TrieNode)
		t.isCollapsed = true
		return
	}

	if _, exists := t.children[segment]; !exists {
		t.children[segment] = NewTrie(t.segmentCardinalityThreshold)
	}
	t.children[segment].insert(rest, hitCount, depth+1)
}

func (t *TrieNode) extract(prefix []string, results *[]PatternResult) {
	if t.isCollapsed {
		domain, pathSegs := splitDomainPrefix(prefix)
		path := "/" + strings.Join(pathSegs, "/") + "/*"
		*results = append(*results, PatternResult{
			Domain: domain,
			Path:   path,
			Count:  t.hitCount,
		})
		return
	}

	if t.hitCount > 0 {
		domain, pathSegs := splitDomainPrefix(prefix)
		path := "/" + strings.Join(pathSegs, "/")
		*results = append(*results, PatternResult{
			Domain: domain,
			Path:   path,
			Count:  t.hitCount,
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

// subtreeCount sums all leaf and collapsed hit counts in
// the subtree rooted at node (excluding node's own count).
func subtreeCount(node *TrieNode) uint64 {
	var total uint64
	for _, child := range node.children {
		total += childCount(child)
	}
	return total
}

func childCount(node *TrieNode) uint64 {
	var total uint64
	if node.hitCount > 0 {
		total += node.hitCount
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

// String returns a pretty-printed representation of the trie.
func (t *TrieNode) String() string {
	var b strings.Builder
	b.WriteString("(root)")
	if t.hitCount > 0 {
		fmt.Fprintf(&b, " [hits: %d]", t.hitCount)
	}
	if t.isCollapsed {
		b.WriteString(" [collapsed]")
	}
	b.WriteByte('\n')
	t.printTree(&b, "")
	return b.String()
}

func (t *TrieNode) printTree(b *strings.Builder, indent string) {
	keys := make([]string, 0, len(t.children))
	for k := range t.children {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for i, k := range keys {
		child := t.children[k]
		isLast := i == len(keys)-1

		connector := "├── "
		if isLast {
			connector = "└── "
		}

		fmt.Fprintf(b, "%s%s%s", indent, connector, k)
		if child.hitCount > 0 {
			fmt.Fprintf(b, " [hits: %d]", child.hitCount)
		}
		if child.isCollapsed {
			b.WriteString(" [collapsed]")
		}
		b.WriteByte('\n')

		childIndent := indent + "│   "
		if isLast {
			childIndent = indent + "    "
		}
		child.printTree(b, childIndent)
	}
}
