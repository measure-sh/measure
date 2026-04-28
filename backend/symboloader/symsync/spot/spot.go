package spot

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"

	"symboloader/symsync/pipeline"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
)

var ErrEmptyVersion = errors.New("version string is empty")
var ErrInvalidVersion = errors.New("invalid version string")

// ErrInvalidAPIKey is returned when Google Drive rejects the API key.
var ErrInvalidAPIKey = errors.New("Drive API key is invalid: set a valid key via DRIVE_API_KEY or DRIVE_API_KEY_FILE")

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

// majorOf returns the leading integer of v. Examples:
//
//	"26.4.1"      -> 26
//	"26.x"        -> 26
//	"18.0 beta1"  -> 18
//	""            ->  0
func majorOf(v string) int {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0
	}
	dot := strings.Index(v, ".")
	if dot < 0 {
		dot = len(v)
	}
	n, _ := strconv.Atoi(v[:dot])
	return n
}

// catalogMajors returns the unique majors derived from every folder's
// Versions slice, sorted descending (newest first).
func catalogMajors(c *pipeline.Catalog) []int {
	if c == nil {
		return nil
	}
	seen := make(map[int]bool)
	var majors []int
	for _, folder := range c.Folders {
		for _, v := range folder.Versions {
			m := majorOf(v)
			if m == 0 || seen[m] {
				continue
			}
			seen[m] = true
			majors = append(majors, m)
		}
	}
	sort.Sort(sort.Reverse(sort.IntSlice(majors)))
	return majors
}

// topNMajors returns the first n majors in catalogMajors. Caps at the number
// of majors actually present; never returns more than exist.
func topNMajors(c *pipeline.Catalog, n int) []int {
	majors := catalogMajors(c)
	if n > len(majors) {
		n = len(majors)
	}
	return majors[:n]
}

// targetMajors returns sorted-desc unique majors derived from each target's
// parsed filename version. Used by SpotFromFolder so "last N versions"
// resolves against the actual destination-folder contents instead of the
// README catalog.
func targetMajors(targets []pipeline.Target) []int {
	seen := make(map[int]bool)
	var majors []int
	for _, t := range targets {
		info, ok := pipeline.ParseArchiveFilename(t.FileName)
		if !ok {
			continue
		}
		m := majorOf(info.Version)
		if m == 0 || seen[m] {
			continue
		}
		seen[m] = true
		majors = append(majors, m)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(majors)))
	return majors
}

// folderCoversMajor reports whether any of f.Versions has the given major.
func folderCoversMajor(f pipeline.DriveFolder, m int) bool {
	for _, v := range f.Versions {
		if majorOf(v) == m {
			return true
		}
	}
	return false
}

// folderOverlapsRange reports whether [f.Versions[first], f.Versions[last]]
// overlaps the inclusive range [lo, hi]. lo and hi are user-supplied tokens
// that may contain "x"; they are normalized before comparison.
func folderOverlapsRange(f pipeline.DriveFolder, lo, hi string) bool {
	if len(f.Versions) == 0 {
		return false
	}
	fStart := f.Versions[0]
	fEnd := f.Versions[len(f.Versions)-1]
	rangeLo := normalizeLowerBound(lo)
	rangeHi := normalizeUpperBound(hi)
	// Overlap: fStart <= rangeHi AND rangeLo <= fEnd
	return versionLE(fStart, rangeHi) && versionLE(rangeLo, fEnd)
}

// folderMatchesSpec reports whether f should be listed for the given user spec.
// Specs that operate at major granularity (last-N) are not handled here —
// callers must invoke folderCoversMajor against pre-computed top majors.
func folderMatchesSpec(f pipeline.DriveFolder, spec string) bool {
	spec = strings.TrimSpace(spec)
	if isAll(spec) {
		return true
	}
	if isRange(spec) {
		idx := strings.Index(spec, "-")
		return folderOverlapsRange(f, spec[:idx], spec[idx+1:])
	}
	// Single token (specific or wildcard) — treat as a 1-element range.
	return folderOverlapsRange(f, spec, spec)
}

// selectFolders returns the union of folders that should be listed for the
// given specs. Folders are deduped by URL. Order is the catalog's original
// folder order (stable for tests).
func selectFolders(c *pipeline.Catalog, specs []string) []pipeline.DriveFolder {
	if c == nil || len(c.Folders) == 0 {
		return nil
	}

	keep := make(map[string]bool)
	var topMajors map[int]bool

	for _, spec := range specs {
		spec = strings.TrimSpace(spec)
		if isLastNVersions(spec) {
			if topMajors == nil {
				topMajors = make(map[int]bool)
			}
			parts := strings.SplitN(spec, " ", 3)
			n, _ := strconv.Atoi(parts[1])
			for _, m := range topNMajors(c, n) {
				topMajors[m] = true
			}
			continue
		}
		for _, folder := range c.Folders {
			if folderMatchesSpec(folder, spec) {
				keep[folder.URL] = true
			}
		}
	}

	if topMajors != nil {
		for _, folder := range c.Folders {
			for m := range topMajors {
				if folderCoversMajor(folder, m) {
					keep[folder.URL] = true
					break
				}
			}
		}
	}

	var out []pipeline.DriveFolder
	for _, folder := range c.Folders {
		if keep[folder.URL] {
			out = append(out, folder)
		}
	}
	return out
}

// versionInRange reports whether v falls within [start, end] inclusive,
// after normalizing wildcards in the bounds.
func versionInRange(v, start, end string) bool {
	lo := normalizeLowerBound(start)
	hi := normalizeUpperBound(end)
	return versionLE(lo, v) && versionLE(v, hi)
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

// archiveMatchesSpec reports whether an archive's parsed version satisfies
// a single non-last-N user spec. last-N is handled by archivesPassingSpecs
// because it requires the catalog to compute top majors.
//
// Spec semantics at file level:
//   - "*"        → match anything
//   - "X.x"      → wildcard prefix (any version with major X)
//   - "X.Y[.Z]"  → exact equality with the parsed archive version
//   - "A-B"      → inclusive range (with wildcard expansion on bounds)
func archiveMatchesSpec(version, spec string) bool {
	spec = strings.TrimSpace(spec)
	if isAll(spec) {
		return true
	}
	if isRange(spec) {
		idx := strings.Index(spec, "-")
		return versionInRange(version, spec[:idx], spec[idx+1:])
	}
	if strings.Contains(spec, "x") {
		return versionMatches(version, spec)
	}
	return version == spec
}

// archivesPassingSpecs filters all listed archives down to those matching
// at least one of the user specs (union semantics). last-N specs are
// resolved against `availableMajors` — the sorted-desc list of majors
// the caller considers in scope (catalog majors for the README path,
// destination-folder archive majors for the cloned-mirror path).
func archivesPassingSpecs(all []pipeline.Target, specs []string, availableMajors []int) []pipeline.Target {
	if len(all) == 0 {
		return nil
	}

	// Pre-compute the top-N major set across all last-N specs.
	majorAllow := make(map[int]bool)
	for _, spec := range specs {
		spec = strings.TrimSpace(spec)
		if !isLastNVersions(spec) {
			continue
		}
		parts := strings.SplitN(spec, " ", 3)
		n, _ := strconv.Atoi(parts[1])
		if n > len(availableMajors) {
			n = len(availableMajors)
		}
		for i := 0; i < n; i++ {
			majorAllow[availableMajors[i]] = true
		}
	}

	out := make([]pipeline.Target, 0, len(all))
	for _, t := range all {
		info, ok := pipeline.ParseArchiveFilename(t.FileName)
		if !ok {
			continue
		}
		matched := false
		if len(majorAllow) > 0 && majorAllow[majorOf(info.Version)] {
			matched = true
		}
		if !matched {
			for _, spec := range specs {
				spec = strings.TrimSpace(spec)
				if isLastNVersions(spec) {
					continue
				}
				if archiveMatchesSpec(info.Version, spec) {
					matched = true
					break
				}
			}
		}
		if matched {
			out = append(out, t)
		}
	}
	return out
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


// DriveSpotter resolves user-supplied version specs into concrete archive
// targets by combining the README catalog with live Drive folder listings.
type DriveSpotter struct {
	client *drive.Service
}

// NewDriveSpotter builds a DriveSpotter with a Drive client constructed from
// the supplied API key. The upstream catalog folders are public, so an API
// key alone is sufficient for both listing and downloading. Used by the
// no-flags code path where the README catalog is the source of truth.
func NewDriveSpotter(apiKey string) (*DriveSpotter, error) {
	svc, err := drive.NewService(context.Background(), option.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("drive service: %w", err)
	}
	return &DriveSpotter{client: svc}, nil
}

// NewDriveSpotterWithService wraps a pre-built Drive service. Used by the
// --drive-folder-id code path where credentials are SA-based (so the caller
// has already invoked drive.NewService with the right scopes).
func NewDriveSpotterWithService(svc *drive.Service) *DriveSpotter {
	return &DriveSpotter{client: svc}
}

// validateProbeFileID is an obviously-fake Drive file ID used by ValidateAPIKey.
// Drive checks API-key validity before resource lookup, so a bad key surfaces
// as 400 API_KEY_INVALID and a good key on a nonexistent ID surfaces as 404.
const validateProbeFileID = "symboloader_validate_probe_nonexistent_file_id"

// ValidateAPIKey issues a minimal Drive request to confirm the configured
// API key is accepted. A 404 on the fake probe ID means the key worked.
// Returns ErrInvalidAPIKey when the key is rejected; other Drive errors
// (network, 5xx, quota) bubble through verbatim.
func (s *DriveSpotter) ValidateAPIKey(ctx context.Context) error {
	_, err := s.client.Files.Get(validateProbeFileID).Context(ctx).Fields("id").Do()
	if err == nil {
		return nil
	}
	var gErr *googleapi.Error
	if errors.As(err, &gErr) && gErr.Code == 404 {
		return nil
	}
	return cleanDriveError(err)
}

// Spot validates user-supplied specs, pre-selects candidate folders from the
// catalog, lists every .7z archive in those folders, then filters each
// archive's parsed version against the user's specs (union). Catalog folder
// labels are version *ranges* (e.g. "26.0-26.4.1"), so the actual file
// versions inside can only be discovered by listing Drive — we cannot rely
// on catalog labels alone for archive selection.
func (s *DriveSpotter) Spot(ctx context.Context, catalog *pipeline.Catalog, versions []string) ([]pipeline.Target, error) {
	if err := ValidateVersions(versions); err != nil {
		return nil, err
	}
	if catalog == nil || len(catalog.Folders) == 0 {
		return nil, nil
	}

	folders := selectFolders(catalog, versions)

	var all []pipeline.Target
	for _, folder := range folders {
		folderID, err := pipeline.ExtractFolderID(folder.URL)
		if err != nil {
			return nil, err
		}
		files, err := s.listAllArchives(ctx, folderID, folder)
		if err != nil {
			return nil, fmt.Errorf("list archives in folder %s: %w", folderID, err)
		}
		all = append(all, files...)
	}

	matched := archivesPassingSpecs(all, versions, catalogMajors(catalog))
	deduped, collapsed := dedupByChecksum(matched)

	slog.Info("spotter: resolved targets",
		"version_specs", versions,
		"folders_selected", len(folders),
		"archives_listed", len(all),
		"archives_matched", len(matched),
		"targets", len(deduped),
		"collapsed_duplicates", collapsed,
	)

	return deduped, nil
}

// dedupByChecksum collapses targets with identical md5Checksum to a single entry.
// Targets with empty checksum pass through unchanged (no dedup signal available).
// Among duplicates, the first-seen target wins, preserving the source-folder
// iteration order chosen by the catalog.
func dedupByChecksum(targets []pipeline.Target) (kept []pipeline.Target, collapsed int) {
	seen := make(map[string]bool, len(targets))
	kept = make([]pipeline.Target, 0, len(targets))
	for _, t := range targets {
		if t.Checksum == "" {
			kept = append(kept, t)
			continue
		}
		if seen[t.Checksum] {
			slog.Info("spotter: collapsing duplicate by checksum",
				"filename", t.FileName,
				"checksum", t.Checksum,
				"source_folder", t.SourceFolder.URL,
			)
			collapsed++
			continue
		}
		seen[t.Checksum] = true
		kept = append(kept, t)
	}
	return kept, collapsed
}

// cleanDriveError replaces verbose googleapi error payloads with a concise
// sentinel when the reason is API_KEY_INVALID. Modern Google APIs report the
// reason via gRPC-style Details (ErrorInfo), while legacy responses use the
// Errors slice; we check both, then fall back to the message text.
func cleanDriveError(err error) error {
	var gErr *googleapi.Error
	if !errors.As(err, &gErr) {
		return err
	}
	for _, e := range gErr.Errors {
		if e.Reason == "API_KEY_INVALID" {
			return ErrInvalidAPIKey
		}
	}
	for _, d := range gErr.Details {
		m, ok := d.(map[string]any)
		if !ok {
			continue
		}
		if reason, _ := m["reason"].(string); reason == "API_KEY_INVALID" {
			return ErrInvalidAPIKey
		}
	}
	if gErr.Code == 400 && strings.Contains(gErr.Message, "API key not valid") {
		return ErrInvalidAPIKey
	}
	return err
}

// SpotFromFolder lists a single Drive folder (the operator-provided
// destination from --drive-folder-id) and filters the entries against
// user version specs. Used in the cloned-mirror code path where the
// destination is the source of truth and the README catalog isn't
// consulted for archive selection.
//
// Each Target's FileID is the destination-folder file's ID — i.e. the
// SA-owned `Files.copy()` result. Downloads via that ID hit the SA's
// quota rather than the upstream public file's per-file 24h cap.
func (s *DriveSpotter) SpotFromFolder(ctx context.Context, folderID string, versions []string) ([]pipeline.Target, error) {
	if err := ValidateVersions(versions); err != nil {
		return nil, err
	}
	if folderID == "" {
		return nil, errors.New("SpotFromFolder: empty folder ID")
	}

	all, err := s.listAllArchives(ctx, folderID, pipeline.DriveFolder{})
	if err != nil {
		return nil, fmt.Errorf("list archives in folder %s: %w", folderID, err)
	}

	matched := archivesPassingSpecs(all, versions, targetMajors(all))
	deduped, collapsed := dedupByChecksum(matched)

	slog.Info("spotter: resolved targets from destination folder",
		"folder_id", folderID,
		"version_specs", versions,
		"archives_listed", len(all),
		"archives_matched", len(matched),
		"targets", len(deduped),
		"collapsed_duplicates", collapsed,
	)

	return deduped, nil
}

// listAllArchives lists every parseable .7z archive in a single Drive folder.
// No version-set filtering is applied — file-level filtering happens in
// archivesPassingSpecs against the user's specs.
func (s *DriveSpotter) listAllArchives(ctx context.Context, folderID string, folder pipeline.DriveFolder) ([]pipeline.Target, error) {
	var targets []pipeline.Target
	pageToken := ""
	for {
		query := fmt.Sprintf("'%s' in parents and trashed=false", folderID)
		result, err := s.client.Files.List().Context(ctx).
			Q(query).
			Spaces("drive").
			Fields("files(id, name, size, md5Checksum), nextPageToken").
			PageSize(200).
			PageToken(pageToken).
			SupportsAllDrives(true).
			IncludeItemsFromAllDrives(true).
			Do()
		if err != nil {
			return nil, fmt.Errorf("list files: %w", cleanDriveError(err))
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
			targets = append(targets, pipeline.Target{
				Symbol: pipeline.Symbol{
					OSVersion: fmt.Sprintf("%s (%s)", info.Version, info.Build),
					Arch:      []string{info.Arch},
				},
				FileID:       f.Id,
				FileName:     f.Name,
				Size:         f.Size,
				Checksum:     f.Md5Checksum,
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
