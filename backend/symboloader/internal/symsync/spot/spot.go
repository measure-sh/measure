package spot

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"symboloader/internal/symsync/pipeline"
)

var ErrEmptyVersion = errors.New("version string is empty")
var ErrInvalidVersion = errors.New("invalid version string")

// isAll reports whether s is the wildcard-all token "*".
func isAll(s string) bool {
	return s == "*"
}

// isRange reports whether s is a range expression: two version tokens joined
// by exactly one "-", with no wildcard-all endpoints.
func isRange(s string) bool {
	idx := strings.Index(s, "-")
	if idx <= 0 {
		return false
	}
	start, end := s[:idx], s[idx+1:]
	if end == "" || strings.Contains(end, "-") {
		return false
	}
	return !isAll(start) && !isAll(end)
}

// isLastNVersions reports whether s is a "last N versions" expression.
func isLastNVersions(s string) bool {
	if !strings.HasPrefix(s, "last ") {
		return false
	}
	parts := strings.SplitN(s, " ", 3)
	if len(parts) != 3 || parts[2] != "versions" {
		return false
	}
	n, err := strconv.Atoi(parts[1])
	return err == nil && n > 0
}

// ValidateVersions validates each version string in the slice.
// Returns the first validation error encountered.
func ValidateVersions(versions []string) error {
	for _, v := range versions {
		v = strings.TrimSpace(v)
		if v == "" {
			return ErrEmptyVersion
		}
		if isAll(v) {
			if len(versions) > 1 {
				return fmt.Errorf("%w: \"*\" cannot be combined with other versions", ErrInvalidVersion)
			}
			continue
		}
		if isLastNVersions(v) {
			continue
		}
		if isRange(v) {
			if err := validateRange(v); err != nil {
				return err
			}
			continue
		}
		if err := validateToken(v); err != nil {
			return err
		}
	}
	return nil
}

func validateRange(s string) (err error) {
	idx := strings.Index(s, "-")
	start, end := s[:idx], s[idx+1:]
	if err = validateToken(start); err != nil {
		return
	}
	if err = validateToken(end); err != nil {
		return
	}
	if !versionLE(start, end) {
		err = fmt.Errorf("%w: range start %q is greater than end %q", ErrInvalidVersion, start, end)
	}
	return
}

func validateToken(s string) error {
	if strings.ContainsAny(s, " \t") {
		return fmt.Errorf("%w: %q contains internal whitespace", ErrInvalidVersion, s)
	}
	parts := strings.Split(s, ".")
	if len(parts) < 2 || len(parts) > 3 {
		return fmt.Errorf("%w: %q", ErrInvalidVersion, s)
	}
	for i, p := range parts {
		if p == "" {
			return fmt.Errorf("%w: %q has empty component", ErrInvalidVersion, s)
		}
		if p == "x" {
			if i == 0 {
				return fmt.Errorf("%w: wildcard in major position in %q", ErrInvalidVersion, s)
			}
			if i < len(parts)-1 {
				return fmt.Errorf("%w: wildcard not in final position in %q", ErrInvalidVersion, s)
			}
			continue
		}
		if _, err := strconv.ParseUint(p, 10, 64); err != nil {
			return fmt.Errorf("%w: non-numeric component in %q", ErrInvalidVersion, s)
		}
	}
	return nil
}

const maxVersionComponent = 1<<31 - 1

func versionLE(a, b string) bool {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	n := min(len(pa), len(pb))
	for i := range n {
		ai, bi := componentVal(pa[i]), componentVal(pb[i])
		if ai < bi {
			return true
		}
		if ai > bi {
			return false
		}
	}
	// All compared components are equal.
	// If lengths differ, the shorter version is less.
	// E.g., "18.6" < "18.6.1"
	return len(pa) <= len(pb)
}

func componentVal(s string) int {
	if s == "x" {
		return maxVersionComponent
	}
	v, _ := strconv.Atoi(s)
	return v
}

// LatestVersions extracts all unique versions from the catalog's drive folders
// and returns the top n versions in descending order (newest first).
func LatestVersions(catalog *pipeline.Catalog, n int) []string {
	if n <= 0 || catalog == nil {
		return []string{}
	}

	// Collect all unique versions from drive folder endpoints.
	seen := make(map[string]bool)
	var versions []string
	for _, folder := range catalog.Folders {
		for _, v := range folder.Versions {
			if !seen[v] {
				seen[v] = true
				versions = append(versions, v)
			}
		}
	}

	// Sort in descending order (newest first).
	sortDescending(versions)

	// Return top n.
	if n > len(versions) {
		n = len(versions)
	}
	return versions[:n]
}

// sortDescending sorts version strings in descending order (newest first).
func sortDescending(versions []string) {
	for i := range len(versions) {
		for j := i + 1; j < len(versions); j++ {
			if versionLE(versions[i], versions[j]) {
				versions[i], versions[j] = versions[j], versions[i]
			}
		}
	}
}

// ResolveVersions takes version specifiers (validated strings) and resolves them
// to a list of unique DriveFolder entries from the catalog that match those versions.
// Handles: specific versions (26.0), wildcards (26.x), ranges (18.x-26.x), "last N versions".
func ResolveVersions(catalog *pipeline.Catalog, versions []string) (folders []pipeline.DriveFolder, err error) {
	if catalog == nil || len(versions) == 0 {
		return []pipeline.DriveFolder{}, nil
	}

	// Expand all version specifiers to concrete versions
	targetVersions := make(map[string]bool)

	for _, spec := range versions {
		spec = strings.TrimSpace(spec)
		if isAll(spec) {
			// "*" matches all versions in all folders
			for _, folder := range catalog.Folders {
				for _, v := range folder.Versions {
					targetVersions[v] = true
				}
			}
		} else if isLastNVersions(spec) {
			// "last N versions" → extract N and get latest versions
			parts := strings.SplitN(spec, " ", 3)
			n, _ := strconv.Atoi(parts[1])
			latest := LatestVersions(catalog, n)
			for _, v := range latest {
				targetVersions[v] = true
			}
		} else if isRange(spec) {
			// Range like "18.x-26.x" → find all versions that fall within it
			idx := strings.Index(spec, "-")
			start := spec[:idx]
			end := spec[idx+1:]
			addRangeVersions(catalog, start, end, targetVersions)
		} else {
			// Specific version or wildcard pattern like "26.x"
			addMatchingVersions(catalog, spec, targetVersions)
		}
	}

	// Build result: find folders that contain any of the target versions
	seen := make(map[string]bool)
	for _, folder := range catalog.Folders {
		folderKey := folder.URL // Use URL as unique identifier
		if seen[folderKey] {
			continue
		}
		for _, v := range folder.Versions {
			if targetVersions[v] {
				folders = append(folders, folder)
				seen[folderKey] = true
				break
			}
		}
	}

	return
}

// addMatchingVersions adds all versions from catalog that match spec to the target set.
// Handles: specific (26.0) or wildcard (26.x).
func addMatchingVersions(catalog *pipeline.Catalog, spec string, target map[string]bool) {
	for _, folder := range catalog.Folders {
		for _, v := range folder.Versions {
			if versionMatches(v, spec) {
				target[v] = true
			}
		}
	}
}

// versionMatches reports whether version v matches pattern spec.
// Pattern can be: "26.0" (exact), "26.x" (any 26.minor), "26.0.x" (any 26.0.patch).
func versionMatches(v, spec string) bool {
	vparts := strings.Split(v, ".")
	sparts := strings.Split(spec, ".")

	if len(sparts) > len(vparts) {
		return false
	}

	for i, sp := range sparts {
		if sp == "x" {
			return true // Rest matches wildcard
		}
		if vparts[i] != sp {
			return false
		}
	}
	return true
}

// addRangeVersions adds all versions from catalog that fall within [start, end] to target.
// Handles wildcards in endpoints: "18.x" means [18.0, 18.any].
func addRangeVersions(catalog *pipeline.Catalog, start, end string, target map[string]bool) {
	// Normalize range endpoints to remove wildcards for comparison.
	// "18.x" → compare as "18.0" for lower bound
	// "26.x" → compare as "26.z" (max patch) for upper bound
	startBound := normalizeLowerBound(start)
	endBound := normalizeUpperBound(end)

	for _, folder := range catalog.Folders {
		for _, v := range folder.Versions {
			if versionLE(startBound, v) && versionLE(v, endBound) {
				target[v] = true
			}
		}
	}
}

// normalizeLowerBound converts a range start (possibly with wildcards) to a concrete lower bound.
// "18.x" → "18.0" (lowest version in that series)
// "18.5" → "18.5"
func normalizeLowerBound(s string) string {
	parts := strings.Split(s, ".")
	for i, p := range parts {
		if p == "x" {
			parts[i] = "0"
		}
	}
	return strings.Join(parts, ".")
}

// normalizeUpperBound converts a range end (possibly with wildcards) to a concrete upper bound.
// "26.x" → "26.9999" (highest version in that series)
// "26.4.1" → "26.4.1"
func normalizeUpperBound(s string) string {
	parts := strings.Split(s, ".")
	for i, p := range parts {
		if p == "x" {
			parts[i] = "9999"
		}
	}
	return strings.Join(parts, ".")
}

// SpotterImpl implements the pipeline.Spotter interface using version validation
// and resolution logic.
type SpotterImpl struct{}

// Spot validates user-supplied version targets against the catalog and
// resolves them to concrete archive folders.
func (s *SpotterImpl) Spot(ctx context.Context, catalog *pipeline.Catalog, versions []string) ([]pipeline.Target, error) {
	// Validate versions
	if err := ValidateVersions(versions); err != nil {
		return nil, err
	}

	// Resolve versions to folders
	folders, err := ResolveVersions(catalog, versions)
	if err != nil {
		return nil, err
	}

	// Convert folders to targets
	var targets []pipeline.Target
	for _, folder := range folders {
		// For now, create a single target per folder representing the folder itself
		// In a full implementation, this would enumerate files within the folder
		targets = append(targets, pipeline.Target{
			Symbol: pipeline.Symbol{
				OSVersion: strings.Join(folder.Versions, "-"),
			},
			SourceFolder: folder,
		})
	}

	return targets, nil
}
