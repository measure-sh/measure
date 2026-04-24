package spot

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"

	"symboloader/symsync/pipeline"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
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

	sortDescending(versions)

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

// resolveTargetVersionSet builds the concrete set of version strings that match
// the given specs against the catalog. Used for both folder selection and
// per-archive filtering.
func resolveTargetVersionSet(catalog *pipeline.Catalog, versions []string) map[string]bool {
	targetVersions := make(map[string]bool)
	for _, spec := range versions {
		spec = strings.TrimSpace(spec)
		if isAll(spec) {
			for _, folder := range catalog.Folders {
				for _, v := range folder.Versions {
					targetVersions[v] = true
				}
			}
		} else if isLastNVersions(spec) {
			parts := strings.SplitN(spec, " ", 3)
			n, _ := strconv.Atoi(parts[1])
			for _, v := range LatestVersions(catalog, n) {
				targetVersions[v] = true
			}
		} else if isRange(spec) {
			idx := strings.Index(spec, "-")
			addRangeVersions(catalog, spec[:idx], spec[idx+1:], targetVersions)
		} else {
			addMatchingVersions(catalog, spec, targetVersions)
		}
	}
	return targetVersions
}

// ResolveVersions takes version specifiers (validated strings) and resolves them
// to a list of unique DriveFolder entries from the catalog that match those versions.
func ResolveVersions(catalog *pipeline.Catalog, versions []string) (folders []pipeline.DriveFolder, err error) {
	if catalog == nil || len(versions) == 0 {
		return []pipeline.DriveFolder{}, nil
	}

	targetVersions := resolveTargetVersionSet(catalog, versions)

	seen := make(map[string]bool)
	for _, folder := range catalog.Folders {
		if seen[folder.URL] {
			continue
		}
		for _, v := range folder.Versions {
			if targetVersions[v] {
				folders = append(folders, folder)
				seen[folder.URL] = true
				break
			}
		}
	}

	return
}

func addMatchingVersions(catalog *pipeline.Catalog, spec string, target map[string]bool) {
	for _, folder := range catalog.Folders {
		for _, v := range folder.Versions {
			if versionMatches(v, spec) {
				target[v] = true
			}
		}
	}
}

func versionMatches(v, spec string) bool {
	vparts := strings.Split(v, ".")
	sparts := strings.Split(spec, ".")

	if len(sparts) > len(vparts) {
		return false
	}

	for i, sp := range sparts {
		if sp == "x" {
			return true
		}
		if vparts[i] != sp {
			return false
		}
	}
	return true
}

func addRangeVersions(catalog *pipeline.Catalog, start, end string, target map[string]bool) {
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

func normalizeLowerBound(s string) string {
	parts := strings.Split(s, ".")
	for i, p := range parts {
		if p == "x" {
			parts[i] = "0"
		}
	}
	return strings.Join(parts, ".")
}

func normalizeUpperBound(s string) string {
	parts := strings.Split(s, ".")
	for i, p := range parts {
		if p == "x" {
			parts[i] = "9999"
		}
	}
	return strings.Join(parts, ".")
}

var reFolderID = regexp.MustCompile(`/folders/([a-zA-Z0-9_-]+)`)

func extractFolderID(url string) (string, error) {
	m := reFolderID.FindStringSubmatch(url)
	if len(m) < 2 {
		return "", fmt.Errorf("cannot extract folder ID from URL: %s", url)
	}
	return m[1], nil
}

// SpotterImpl implements the pipeline.Spotter interface using version validation,
// resolution logic, and Google Drive file enumeration.
type SpotterImpl struct {
	client *drive.Service
}

// NewSpotterImpl creates a SpotterImpl with a Drive client for reading source folders.
// Uses apiKey when provided (sufficient for public folders), otherwise falls back to creds.
func NewSpotterImpl(creds *google.Credentials, apiKey string) (*SpotterImpl, error) {
	var svc *drive.Service
	var err error
	if apiKey != "" {
		svc, err = drive.NewService(context.Background(), option.WithAPIKey(apiKey))
	} else {
		svc, err = drive.NewService(context.Background(), option.WithCredentials(creds))
	}
	if err != nil {
		return nil, fmt.Errorf("drive service: %w", err)
	}
	return &SpotterImpl{client: svc}, nil
}

// Spot validates user-supplied version specs, resolves them to Drive folders,
// then enumerates the individual .7z archives within each folder to produce
// one Target per archive file, filtered to only the requested versions.
func (s *SpotterImpl) Spot(ctx context.Context, catalog *pipeline.Catalog, versions []string) ([]pipeline.Target, error) {
	if err := ValidateVersions(versions); err != nil {
		return nil, err
	}

	folders, err := ResolveVersions(catalog, versions)
	if err != nil {
		return nil, err
	}

	targetVersions := resolveTargetVersionSet(catalog, versions)

	var targets []pipeline.Target
	for _, folder := range folders {
		folderID, err := extractFolderID(folder.URL)
		if err != nil {
			return nil, err
		}
		files, err := s.listArchives(ctx, folderID, folder, targetVersions)
		if err != nil {
			return nil, fmt.Errorf("list archives in folder %s: %w", folderID, err)
		}
		targets = append(targets, files...)
	}

	slog.Info("spotter: resolved targets",
		"version_specs", versions,
		"folders", len(folders),
		"targets", len(targets),
	)

	return targets, nil
}

// listArchives lists .7z files in a Drive folder, filtered to the given version set.
func (s *SpotterImpl) listArchives(ctx context.Context, folderID string, folder pipeline.DriveFolder, targetVersions map[string]bool) ([]pipeline.Target, error) {
	var targets []pipeline.Target
	pageToken := ""
	for {
		query := fmt.Sprintf("'%s' in parents and trashed=false", folderID)
		result, err := s.client.Files.List().Context(ctx).
			Q(query).
			Spaces("drive").
			Fields("files(id, name, size), nextPageToken").
			PageSize(200).
			PageToken(pageToken).
			Do()
		if err != nil {
			return nil, fmt.Errorf("list files: %w", err)
		}

		for _, f := range result.Files {
			if !strings.HasSuffix(f.Name, ".7z") {
				continue
			}
			info, ok := pipeline.ParseArchiveFilename(f.Name)
			if !ok {
				slog.Warn("spotter: skipping unparseable filename", "name", f.Name)
				continue
			}
			if !targetVersions[info.Version] {
				continue
			}
			targets = append(targets, pipeline.Target{
				Symbol: pipeline.Symbol{
					OSVersion: fmt.Sprintf("%s (%s)", info.Version, info.Build),
					Arch:      []string{info.Arch},
				},
				FileID:       f.Id,
				FileName:     f.Name,
				Size:         f.Size,
				SourceFolder: folder,
			})
		}

		if result.NextPageToken == "" {
			break
		}
		pageToken = result.NextPageToken
	}
	return targets, nil
}
