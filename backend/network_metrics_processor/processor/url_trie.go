package processor

type UrlNode struct {
	name     string
	depth    int
	children map[string]*UrlNode
	count    int
}

// UrlTrie manages the collection of
// URLs and automatically generalizes
// high-cardinality segments.
type UrlTrie struct {
	Root                     *UrlNode
	HighCardinalityThreshold int
}

// UrlPattern represents a discovered
// endpoint signature.
type UrlPattern struct {
	Segments  []string
	Frequency int
}

// Creates a new tree with a configured
// high cardinality threshold.
func NewUrlTrie(highCardinalityThreshld int) *UrlTrie {
	return &UrlTrie{
		Root: &UrlNode{
			name:     "$",
			depth:    0,
			children: make(map[string]*UrlNode),
		},
		HighCardinalityThreshold: highCardinalityThreshld,
	}
}

func (n *UrlNode) findChild(name string) *UrlNode {
	return n.children[name]
}

// addChild creates or returns an existing
// child node.
func (n *UrlNode) addChild(name string) *UrlNode {
	if child, exists := n.children[name]; exists {
		return child
	}
	child := &UrlNode{
		name:     name,
		depth:    n.depth + 1,
		children: make(map[string]*UrlNode),
	}
	n.children[name] = child
	return child
}

// mergeSubtree recursively merges "other"
// into "n". Used when collapsing multiple
// paths into a single wildcard path.
func (n *UrlNode) mergeSubtree(other *UrlNode) {
	n.count += other.count

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
func (n *UrlNode) collapseToWildcard() {
	if existing, ok := n.children["*"]; ok && len(n.children) == 1 {
		_ = existing
		return
	}

	starNode := &UrlNode{
		name:     "*",
		depth:    n.depth + 1,
		children: make(map[string]*UrlNode),
	}

	for _, child := range n.children {
		starNode.mergeSubtree(child)
	}

	n.children = map[string]*UrlNode{"*": starNode}
}

// collect flattens the tree by generating all
// path sequences and counts from this node down.
func (n *UrlNode) collect() []UrlPattern {
	var results []UrlPattern

	if n.count > 0 {
		results = append(results, UrlPattern{
			Segments:  []string{n.name},
			Frequency: n.count,
		})
	}

	for _, child := range n.children {
		childResults := child.collect()

		for _, res := range childResults {
			fullPath := append([]string{n.name}, res.Segments...)
			results = append(results, UrlPattern{
				Segments:  fullPath,
				Frequency: res.Frequency,
			})
		}
	}
	return results
}

// Insert adds a sequence of segments, collapsing
// any high cardinality segments during insertion.
func (t *UrlTrie) Insert(segments []string) {
	current := t.Root

	for _, segment := range segments {
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

	current.count++
}

// GetPatterns returns all accumulated patterns
// found starting from the tree root.
func (t *UrlTrie) GetPatterns() []UrlPattern {
	if t.Root == nil {
		return []UrlPattern{}
	}
	var results []UrlPattern
	for _, child := range t.Root.children {
		results = append(results, child.collect()...)
	}
	return results
}
