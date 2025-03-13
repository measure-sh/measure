package app

import (
	"fmt"
)

// BuildInfo represents build metadata for an
// app version's build.
type BuildInfo struct {
	Size uint   `toml:"size"`
	Type string `toml:"type"`
}

// GetSize returns string representation of
// build's size.
func (b BuildInfo) GetSize() string {
	return fmt.Sprintf(`%d`, b.Size)
}
