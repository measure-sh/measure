package journeymap

import (
	"bytes"
	"compress/gzip"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math"
	"strings"
)

// element is one node of a layout snapshot's element tree.
type element struct {
	ID       string    `json:"id"`
	Label    string    `json:"label"`
	Type     string    `json:"type"`
	X        float64   `json:"x"`
	Y        float64   `json:"y"`
	Width    float64   `json:"width"`
	Height   float64   `json:"height"`
	Children []element `json:"children"`
}

func (e element) kind() string {
	return e.Label + "|" + e.ID + "|" + e.Type
}

// Wireframe is a snapshot drawn as boxes in paint order. Each box is
// [x, y, width, height, isText] in the snapshot's own coordinates.
type Wireframe struct {
	Width  int      `json:"width"`
	Height int      `json:"height"`
	Boxes  [][5]int `json:"boxes"`
}

// kindPair is an element's kind together with its parent's kind.
type kindPair struct {
	parent string
	kind   string
}

// snapshot is what variant grouping and drawing need from one layout
// snapshot, so the element tree itself does not have to be kept.
type snapshot struct {
	signature string
	bag       map[kindPair]int
	elements  int
	wireframe Wireframe
}

// parseSnapshot reads a layout snapshot, gzipped or not.
func parseSnapshot(raw []byte) (*snapshot, error) {
	if len(raw) >= 2 && raw[0] == 0x1f && raw[1] == 0x8b {
		reader, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			return nil, err
		}
		if raw, err = io.ReadAll(reader); err != nil {
			return nil, err
		}
	}
	var root element
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	if root.Width <= 0 && root.Height <= 0 && len(root.Children) == 0 {
		return nil, errors.New("not a layout element tree")
	}
	s := &snapshot{
		signature: signature(root),
		bag:       map[kindPair]int{},
		elements:  countElements(root),
		wireframe: Wireframe{
			Width:  max(int(math.Round(root.Width)), 1),
			Height: max(int(math.Round(root.Height)), 1),
		},
	}
	collectKinds(root, "", s.bag)
	collectBoxes(root, &s.wireframe.Boxes)
	return s, nil
}

// signature hashes a snapshot's structure: labels, ids and types in tree
// order. A run of identical sibling subtrees counts once, so a list with three
// rows and one with thirty match. Positions are left out, so a scrolled screen
// matches too.
func signature(e element) string {
	var children []string
	for _, child := range e.Children {
		c := signature(child)
		if len(children) == 0 || children[len(children)-1] != c {
			children = append(children, c)
		}
	}
	sum := sha1.Sum([]byte(e.kind() + "(" + strings.Join(children, ",") + ")"))
	return hex.EncodeToString(sum[:])
}

func countElements(e element) int {
	n := 1
	for _, child := range e.Children {
		n += countElements(child)
	}
	return n
}

func collectKinds(e element, parent string, bag map[kindPair]int) {
	kind := e.kind()
	bag[kindPair{parent: parent, kind: kind}]++
	for _, child := range e.Children {
		collectKinds(child, kind, bag)
	}
}

// collectBoxes skips an element with no area and its children, since none of
// them are on screen.
func collectBoxes(e element, boxes *[][5]int) {
	if e.Width <= 0 || e.Height <= 0 {
		return
	}
	text := 0
	if e.Type == "text" {
		text = 1
	}
	*boxes = append(*boxes, [5]int{
		int(math.Round(e.X)),
		int(math.Round(e.Y)),
		int(math.Round(e.Width)),
		int(math.Round(e.Height)),
		text,
	})
	for _, child := range e.Children {
		collectBoxes(child, boxes)
	}
}

// similarity compares two snapshots as multisets of (parent kind, kind)
// pairs: the size of their intersection over the size of their union.
func similarity(a, b map[kindPair]int) float64 {
	shared, union := 0, 0
	for pair, n := range a {
		m := b[pair]
		shared += min(n, m)
		union += max(n, m)
	}
	for pair, m := range b {
		if _, ok := a[pair]; !ok {
			union += m
		}
	}
	if union == 0 {
		return 1
	}
	return float64(shared) / float64(union)
}
