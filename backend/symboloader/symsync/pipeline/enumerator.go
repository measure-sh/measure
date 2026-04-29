package pipeline

// DriveFolder is a Google Drive folder link parsed from the README.
type DriveFolder struct {
	// URL is the full Google Drive folder URL.
	URL string

	// Versions is the version range parsed from the link text.
	// [0] is the lower bound, [1] is the upper bound if a range.
	// Single-version folders have only [0], e.g. ["17.6.1"].
	Versions []string
}

// Symbol is a single row from a version group's symbols table.
type Symbol struct {
	// OSVersion is the full version with build code, e.g. "26.4.1 (23E254)".
	OSVersion string

	// Arch is the list of collected architectures, e.g. ["arm64e"] or ["arm64", "arm64e"].
	Arch []string

	// Description is an optional note, e.g. "iPhone 14 / Plus / Pro / Pro max only".
	Description string
}

// VersionGroup is a section like "### 26.x Symbols List"
// containing all its symbol entries.
type VersionGroup struct {
	// Name is the group identifier, e.g. "26.x" or "18.x Beta".
	Name string

	// Symbols is the list of symbol entries in this group.
	Symbols []Symbol
}

// Catalog is the full parsed result of the upstream README.
type Catalog struct {
	// Folders is the list of Google Drive folder links.
	Folders []DriveFolder

	// Groups is the list of version groups with their symbol entries.
	Groups []VersionGroup
}
