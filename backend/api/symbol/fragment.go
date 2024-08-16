package symbol

import "github.com/google/uuid"

// Fragment represents a uniquely identified
// list of obfuscated string values.
type Fragment struct {
	ID     uuid.UUID `json:"id"`
	Values []string  `json:"values"`
}

// NewFragment constructs a new Fragment
// with a freshly populated unique id.
func NewFragment() Fragment {
	return Fragment{
		ID: uuid.New(),
	}
}
