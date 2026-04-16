package enumerate

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"symboloader/internal/symsync/pipeline"
)

var ErrFetchReadme = errors.New("failed to fetch readme")
var ErrUnexpectedStatus = errors.New("unexpected http status")

var driveLinkRe = regexp.MustCompile(`\[iOS system symbol files\(([^)]+)\)\]\((https://drive\.google\.com/drive/folders/[^)]+)\)`)

var sectionHeaderRe = regexp.MustCompile(`^###\s+(.+?)\s+Symbols List\s*$`)

// ReadmeEnumerator fetches and parses a GitHub README to discover
// available iOS system symbol versions.
type ReadmeEnumerator struct {
	ReadmeURL string
}

func (e *ReadmeEnumerator) Enumerate(ctx context.Context) (*pipeline.Catalog, error) {
	content, err := e.fetch(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrFetchReadme, err)
	}

	catalog := &pipeline.Catalog{
		Folders: parseDriveLinks(content),
		Groups:  parseGroups(content),
	}

	return catalog, nil
}

func (e *ReadmeEnumerator) fetch(ctx context.Context) (content string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, e.ReadmeURL, nil)
	if err != nil {
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("%w: %d", ErrUnexpectedStatus, resp.StatusCode)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	content = string(body)
	return
}

// parseDriveLinks extracts all Google Drive folder links from the README.
func parseDriveLinks(content string) (folders []pipeline.DriveFolder) {
	matches := driveLinkRe.FindAllStringSubmatch(content, -1)
	folders = make([]pipeline.DriveFolder, 0, len(matches))
	for _, m := range matches {
		folders = append(folders, pipeline.DriveFolder{
			Versions: parseVersionRange(m[1]),
			URL:      m[2],
		})
	}
	return
}

// parseVersionRange splits a label like "26.0-26.4.1" into
// ["26.0", "26.4.1"]. Single versions like "17.6.1" yield ["17.6.1"].
func parseVersionRange(label string) []string {
	parts := strings.SplitN(label, "-", 2)
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}

// parseGroups splits content by section headers and parses tables.
func parseGroups(content string) (groups []pipeline.VersionGroup) {
	lines := strings.Split(content, "\n")
	var current *pipeline.VersionGroup

	for _, line := range lines {
		if m := sectionHeaderRe.FindStringSubmatch(line); m != nil {
			if current != nil {
				groups = append(groups, *current)
			}
			current = &pipeline.VersionGroup{Name: m[1]}
			continue
		}

		if current == nil {
			continue
		}

		if sym, ok := parseTableRow(line); ok {
			current.Symbols = append(current.Symbols, sym)
		}
	}

	if current != nil {
		groups = append(groups, *current)
	}

	return
}

// parseTableRow tries to parse a markdown table data row into a Symbol.
// Returns ok=false for header rows, alignment rows, or non-table lines.
func parseTableRow(line string) (sym pipeline.Symbol, ok bool) {
	line = strings.TrimSpace(line)
	if !strings.HasPrefix(line, "|") {
		return
	}

	parts := strings.Split(line, "|")
	// Trim empty first/last elements from leading/trailing pipes.
	if len(parts) > 0 && strings.TrimSpace(parts[0]) == "" {
		parts = parts[1:]
	}
	if len(parts) > 0 && strings.TrimSpace(parts[len(parts)-1]) == "" {
		parts = parts[:len(parts)-1]
	}

	if len(parts) < 2 {
		return
	}

	osVersion := strings.TrimSpace(parts[0])

	// Skip header and alignment rows.
	if osVersion == "OS Version" || strings.Contains(osVersion, "---") || strings.Contains(osVersion, ":-") {
		return
	}

	// OS version must start with a digit (e.g., "26.4.1 (23E254)").
	if len(osVersion) == 0 || osVersion[0] < '0' || osVersion[0] > '9' {
		return
	}

	sym.OSVersion = osVersion
	sym.Arch = strings.Fields(parts[1])
	if len(parts) >= 3 {
		sym.Description = strings.TrimSpace(parts[2])
	}

	ok = true
	return
}
