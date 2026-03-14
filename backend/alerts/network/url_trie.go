package network

// urlNode represents a single segment of a URL
// including the domain and the path.
// Example: "example.com/path/to/resource" -> [example.com, path, to, resource]".
type urlNode struct {
	// The name of the segment
	name string

	// depth of this node in the trie
	depth int

	// children is a map of child nodes by name
	children map[string]*urlNode

	// frequency tracks how many URLs macthed
	// the pattern ending at this node
	frequency uint64
}

// UrlTrie manages the collection of
// URLs and automatically generalizes
// high-cardinality segments.
type UrlTrie struct {
	Root                     *urlNode
	HighCardinalityThreshold int
}

// UrlPattern represents a pattern produced
// by the trie, it includes the segments of
// the pattern and the frequency of URLs that
// match the pattern.
type UrlPattern struct {
	Parts     []string
	Frequency uint64
}

// isPattern returns true if this node represents a complete URL
// pattern recorded in the trie.
//
// A node can be a pattern (e.g., /api) even if it has children
// (e.g., /api/v1), as long as it has a non-zero frequency.
func (n *urlNode) isPattern() bool {
	return n.frequency > 0
}

func (n *urlNode) findChild(name string) *urlNode {
	return n.children[name]
}

// addChild creates or returns an existing
// child node.
func (n *urlNode) addChild(name string) *urlNode {
	if child, exists := n.children[name]; exists {
		return child
	}
	child := &urlNode{
		name:     name,
		depth:    n.depth + 1,
		children: make(map[string]*urlNode),
	}
	n.children[name] = child
	return child
}

// mergeSubtree recursively merges "other"
// into "n". Used when collapsing multiple
// paths into a single wildcard path.
func (n *urlNode) mergeSubtree(other *urlNode) {
	n.frequency += other.frequency

	for _, otherChild := range other.children {
		if targetChild, exists := n.children[otherChild.name]; exists {
			targetChild.mergeSubtree(otherChild)
		} else {
			n.children[otherChild.name] = otherChild
		}
	}
}

// collapseToWildcard converts all
// distinct children into a single
// "*" node.
func (n *urlNode) collapseToWildcard() {
	if existing, ok := n.children["*"]; ok && len(n.children) == 1 {
		_ = existing
		return
	}

	starNode := &urlNode{
		name:     "*",
		depth:    n.depth + 1,
		children: make(map[string]*urlNode),
	}

	for _, child := range n.children {
		starNode.mergeSubtree(child)
	}

	n.children = map[string]*urlNode{"*": starNode}
}

// collect flattens the tree by generating all
// path sequences and counts from this node down.
func (n *urlNode) collect() []UrlPattern {
	var results []UrlPattern

	if n.isPattern() {
		results = append(results, UrlPattern{
			Parts:     []string{n.name},
			Frequency: n.frequency,
		})
	}

	for _, child := range n.children {
		childResults := child.collect()

		for _, res := range childResults {
			fullPath := append([]string{n.name}, res.Parts...)
			results = append(results, UrlPattern{
				Parts:     fullPath,
				Frequency: res.Frequency,
			})
		}
	}
	return results
}

// Creates a new tree with a configured
// high cardinality threshold.
func NewUrlTrie(highCardinalityThreshld int) *UrlTrie {
	return &UrlTrie{
		Root: &urlNode{
			name:     "$",
			depth:    0,
			children: make(map[string]*urlNode),
		},
		HighCardinalityThreshold: highCardinalityThreshld,
	}
}

// Insert inserts a pattern into the trie,
// collapsing any high cardinality segments
// during insertion.
func (t *UrlTrie) Insert(pattern UrlPattern) {
	current := t.Root

	for _, segment := range pattern.Parts {
		if wildcard, ok := current.children["*"]; ok {
			current = wildcard
			continue
		}

		if segment == "*" {
			current.collapseToWildcard()
			current = current.children["*"]
			continue
		}

		if len(current.children) >= t.HighCardinalityThreshold {
			current.collapseToWildcard()
			current = current.children["*"]
			continue
		}

		current = current.addChild(segment)
	}

	current.frequency += pattern.Frequency
}

// GetPatterns returns all accumulated patterns
// found starting from the tree root. Root children
// are treated as domain nodes and the remaining
// segments are joined into a path.
func (t *UrlTrie) GetPatterns() []UrlPattern {
	if t.Root == nil {
		return nil
	}

	var results []UrlPattern

	for _, node := range t.Root.children {
		for _, r := range node.collect() {
			if len(r.Parts) == 0 {
				continue
			}

			results = append(results, UrlPattern{
				Parts:     append([]string(nil), r.Parts...),
				Frequency: uint64(r.Frequency),
			})
		}
	}

	return results
}
