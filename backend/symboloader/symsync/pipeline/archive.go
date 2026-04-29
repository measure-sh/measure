package pipeline

import "regexp"

// ArchiveInfo contains parsed metadata extracted from a .7z archive filename.
type ArchiveInfo struct {
	Version string // e.g. "18.1"
	Build   string // e.g. "22B83"
	Arch    string // e.g. "arm64", "arm64e"
}

var (
	// "18.0 (22A3351) arm64e.7z" or "13.0 (17A577).7z" (no arch)
	// Build numbers may contain lowercase letters for beta builds, e.g. "22A5282m".
	reSpaceStyle = regexp.MustCompile(`^(\d+\.\d+(?:\.\d+)*)\s+\(([A-Za-z0-9]+)\)(?:\s+(arm64e?))?\.7z$`)
	// "14.0_18A373(arm64).7z"
	reUnderscoreStyle = regexp.MustCompile(`^(\d+\.\d+(?:\.\d+)*)_([A-Za-z0-9]+)\((arm64e?)\)\.7z$`)
)

// ParseArchiveFilename parses a .7z filename into its components.
// Returns ok=false if the filename does not match any known format.
// Arch defaults to "arm64" when not present in the filename.
func ParseArchiveFilename(name string) (ArchiveInfo, bool) {
	if m := reSpaceStyle.FindStringSubmatch(name); m != nil {
		arch := m[3]
		if arch == "" {
			arch = "arm64"
		}
		return ArchiveInfo{Version: m[1], Build: m[2], Arch: arch}, true
	}
	if m := reUnderscoreStyle.FindStringSubmatch(name); m != nil {
		return ArchiveInfo{Version: m[1], Build: m[2], Arch: m[3]}, true
	}
	return ArchiveInfo{}, false
}
