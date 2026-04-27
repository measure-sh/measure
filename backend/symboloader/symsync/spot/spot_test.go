package spot

import (
	"errors"
	"testing"

	"symboloader/symsync/pipeline"
)

// fixtureCatalog mirrors enumerate/testdata/readme.md so test expectations
// match the production README format.
func fixtureCatalog() *pipeline.Catalog {
	return &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/26"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/18-late"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/18-early"},
			{Versions: []string{"18.0 beta1", "18.1 beta3"}, URL: "https://example.com/18-beta"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/17"},
		},
	}
}

// folderURLs is a helper to extract URLs from folder slices for test assertions.
func folderURLs(folders []pipeline.DriveFolder) []string {
	out := make([]string, len(folders))
	for i, f := range folders {
		out[i] = f.URL
	}
	return out
}

// stringsEqual compares two slices ignoring order.
func stringsEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	seen := make(map[string]int, len(a))
	for _, s := range a {
		seen[s]++
	}
	for _, s := range b {
		seen[s]--
		if seen[s] < 0 {
			return false
		}
	}
	return true
}

func TestValidateVersionsValid(t *testing.T) {
	tests := []struct {
		name    string
		version string
	}{
		{"wildcard all", "*"},
		{"major.minor", "26.0"},
		{"major.minor.patch", "26.0.1"},
		{"major wildcard", "26.x"},
		{"range wildcard", "18.x-26.x"},
		{"range specific", "17.5-18.7"},
		{"range mixed", "17.5-18.x"},
		{"range with patch", "17.5.1-18.x"},
		{"last n versions", "last 5 versions"},
		{"whitespace trimmed", " 26.0 "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateVersions([]string{tt.version}); err != nil {
				t.Errorf("ValidateVersions(%q) unexpected error: %v", tt.version, err)
			}
		})
	}
}

func TestValidateVersionsInvalid(t *testing.T) {
	tests := []struct {
		name    string
		version string
		target  error
	}{
		{"empty string", "", ErrEmptyVersion},
		{"whitespace only", "  ", ErrEmptyVersion},
		{"bare major", "26", ErrInvalidVersion},
		{"trailing dot", "26.", ErrInvalidVersion},
		{"leading dot", ".26", ErrInvalidVersion},
		{"wildcard not final", "26.x.1", ErrInvalidVersion},
		{"bare x", "x", ErrInvalidVersion},
		{"wildcard in major", "x.26", ErrInvalidVersion},
		{"alphabetic", "abc", ErrInvalidVersion},
		{"range missing end", "26.0-", ErrInvalidVersion},
		{"range missing start", "-26.0", ErrInvalidVersion},
		{"star in range", "*-26.x", ErrInvalidVersion},
		{"double dot", "26..0", ErrInvalidVersion},
		{"whitespace inside version", "26 .0", ErrInvalidVersion},
		{"four components", "26.0.1.2", ErrInvalidVersion},
		{"non-numeric component", "26.abc", ErrInvalidVersion},
		{"range with three endpoints", "17.x-18.1-26.x", ErrInvalidVersion},
		{"range start greater than end", "26.x-18.x", ErrInvalidVersion},
		{"range start greater specific", "18.7-17.5", ErrInvalidVersion},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateVersions([]string{tt.version})
			if err == nil {
				t.Errorf("ValidateVersions(%q) expected error, got nil", tt.version)
				return
			}
			if !errors.Is(err, tt.target) {
				t.Errorf("ValidateVersions(%q) expected %v, got: %v", tt.version, tt.target, err)
			}
		})
	}
}

func TestValidateVersionsMultiple(t *testing.T) {
	t.Run("all valid", func(t *testing.T) {
		if err := ValidateVersions([]string{"26.0", "18.x", "17.5-18.7"}); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("stops at first invalid", func(t *testing.T) {
		err := ValidateVersions([]string{"26.0", "abc", "18.x"})
		if !errors.Is(err, ErrInvalidVersion) {
			t.Errorf("expected ErrInvalidVersion, got: %v", err)
		}
	})

	t.Run("star combined with others", func(t *testing.T) {
		err := ValidateVersions([]string{"*", "26.0"})
		if !errors.Is(err, ErrInvalidVersion) {
			t.Errorf("expected ErrInvalidVersion, got: %v", err)
		}
	})

	t.Run("nil slice", func(t *testing.T) {
		if err := ValidateVersions(nil); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})
}

func TestValidateVersionsRejectsInvalid(t *testing.T) {
	err := ValidateVersions([]string{"invalid..version"})
	if err == nil {
		t.Error("expected validation error for invalid version")
	}
}

func TestIsLastNVersions(t *testing.T) {
	tests := []struct {
		input string
		valid bool
	}{
		{"last 5 versions", true},
		{"last 1 versions", true},
		{"last 10 versions", true},
		{"last 0 versions", false},
		{"last -5 versions", false},
		{"last abc versions", false},
		{"last  5 versions", false},
		{"first 5 versions", false},
		{"last 5", false},
		{"last 5 v", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := isLastNVersions(tt.input)
			if got != tt.valid {
				t.Errorf("isLastNVersions(%q) = %v, want %v", tt.input, got, tt.valid)
			}
		})
	}
}

func TestMajorOf(t *testing.T) {
	tests := []struct {
		in   string
		want int
	}{
		{"26.4.1", 26},
		{"26.0", 26},
		{"26.x", 26},
		{"18.0 beta1", 18},
		{"17", 17},
		{"", 0},
		{"x", 0},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			if got := majorOf(tt.in); got != tt.want {
				t.Errorf("majorOf(%q) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

func TestCatalogMajors(t *testing.T) {
	got := catalogMajors(fixtureCatalog())
	want := []int{26, 18, 17}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i, m := range want {
		if got[i] != m {
			t.Errorf("majors[%d] = %d, want %d", i, got[i], m)
		}
	}
}

func TestTopNMajors(t *testing.T) {
	c := fixtureCatalog()
	tests := []struct {
		n    int
		want []int
	}{
		{1, []int{26}},
		{2, []int{26, 18}},
		{3, []int{26, 18, 17}},
		{10, []int{26, 18, 17}}, // capped at what exists
		{0, []int{}},
	}
	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			got := topNMajors(c, tt.n)
			if len(got) != len(tt.want) {
				t.Fatalf("topNMajors(_, %d) = %v, want %v", tt.n, got, tt.want)
			}
			for i, m := range tt.want {
				if got[i] != m {
					t.Errorf("topNMajors(_, %d)[%d] = %d, want %d", tt.n, i, got[i], m)
				}
			}
		})
	}
}

func TestSelectFoldersWildcard(t *testing.T) {
	c := fixtureCatalog()

	t.Run("26.x", func(t *testing.T) {
		got := folderURLs(selectFolders(c, []string{"26.x"}))
		want := []string{"https://example.com/26"}
		if !stringsEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("18.x", func(t *testing.T) {
		got := folderURLs(selectFolders(c, []string{"18.x"}))
		want := []string{
			"https://example.com/18-late",
			"https://example.com/18-early",
			"https://example.com/18-beta",
		}
		if !stringsEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})
}

func TestSelectFoldersSpecific(t *testing.T) {
	c := fixtureCatalog()
	got := folderURLs(selectFolders(c, []string{"17.6.1"}))
	want := []string{"https://example.com/17"}
	if !stringsEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestSelectFoldersRange(t *testing.T) {
	c := fixtureCatalog()
	got := folderURLs(selectFolders(c, []string{"17.5-18.7"}))
	want := []string{
		"https://example.com/17",
		"https://example.com/18-early",
		"https://example.com/18-late",
		"https://example.com/18-beta",
	}
	if !stringsEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestSelectFoldersLastN(t *testing.T) {
	c := fixtureCatalog()

	t.Run("last 1 versions", func(t *testing.T) {
		got := folderURLs(selectFolders(c, []string{"last 1 versions"}))
		want := []string{"https://example.com/26"}
		if !stringsEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("last 3 versions", func(t *testing.T) {
		got := folderURLs(selectFolders(c, []string{"last 3 versions"}))
		want := []string{
			"https://example.com/26",
			"https://example.com/18-late",
			"https://example.com/18-early",
			"https://example.com/18-beta",
			"https://example.com/17",
		}
		if !stringsEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("last 100 versions caps at catalog", func(t *testing.T) {
		got := folderURLs(selectFolders(c, []string{"last 100 versions"}))
		want := []string{
			"https://example.com/26",
			"https://example.com/18-late",
			"https://example.com/18-early",
			"https://example.com/18-beta",
			"https://example.com/17",
		}
		if !stringsEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})
}

func TestSelectFoldersAll(t *testing.T) {
	c := fixtureCatalog()
	got := folderURLs(selectFolders(c, []string{"*"}))
	want := folderURLs(c.Folders)
	if !stringsEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestSelectFoldersUnion(t *testing.T) {
	c := fixtureCatalog()
	got := folderURLs(selectFolders(c, []string{"26.x", "17.x"}))
	want := []string{
		"https://example.com/26",
		"https://example.com/17",
	}
	if !stringsEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestArchiveMatchesSpec(t *testing.T) {
	tests := []struct {
		version string
		spec    string
		want    bool
	}{
		// User-reported case: 26.0.1 must match 26.x.
		{"26.0.1", "26.x", true},
		// Specific spec is exact: "26.0" does NOT match "26.0.1".
		{"26.0.1", "26.0", false},
		{"26.0", "26.0", true},
		{"26.0", "26.x", true},

		// Mid-range version that the old code dropped.
		{"18.3.2", "17.5-18.7", true},
		{"18.0", "17.5-18.7", true},   // in range
		{"17.4", "17.5-18.7", false},  // below range
		{"18.8", "17.5-18.7", false},  // above range
		{"18.7.6", "17.5-18.7", false}, // 18.7.6 > 18.7 upper bound

		// Wildcard-all bound.
		{"99.99.99", "*", true},

		// Specific-vs-specific.
		{"18.0", "18.0", true},
		{"18.0", "18.1", false},
	}
	for _, tt := range tests {
		t.Run(tt.version+"_vs_"+tt.spec, func(t *testing.T) {
			got := archiveMatchesSpec(tt.version, tt.spec)
			if got != tt.want {
				t.Errorf("archiveMatchesSpec(%q, %q) = %v, want %v", tt.version, tt.spec, got, tt.want)
			}
		})
	}
}

// TestArchivesPassingSpecsLastN captures the user-reported regression:
// the 26.x folder contains 9 archives spanning 26.0 to 26.4.1, all of which
// must be selected by "last 1 versions" (since 26 is the top major).
func TestArchivesPassingSpecsLastN(t *testing.T) {
	c := fixtureCatalog()
	all := []pipeline.Target{
		{FileName: "26.0 (23A341) arm64e.7z"},
		{FileName: "26.0.1 (23A355) arm64e.7z"},
		{FileName: "26.1 (23B85) arm64e.7z"},
		{FileName: "26.2 (23C55) arm64e.7z"},
		{FileName: "26.2.1 (23C71) arm64e.7z"},
		{FileName: "26.3 (23D127) arm64e.7z"},
		{FileName: "26.3.1 (23D8133) arm64e.7z"},
		{FileName: "26.4 (23E246) arm64e.7z"},
		{FileName: "26.4.1 (23E254) arm64e.7z"},
	}

	got := archivesPassingSpecs(all, []string{"last 1 versions"}, c)
	if len(got) != len(all) {
		t.Fatalf("expected all 9 archives kept; got %d", len(got))
	}
}

// TestArchivesPassingSpecsCombined verifies union semantics across last-N
// and a wildcard spec.
func TestArchivesPassingSpecsCombined(t *testing.T) {
	c := fixtureCatalog()
	all := []pipeline.Target{
		{FileName: "26.4.1 (23E254) arm64e.7z"},   // 26 — top major
		{FileName: "18.5 (22F76) arm64e.7z"},      // 18 — not top, but not 17.x either
		{FileName: "17.6.1 (21G101) arm64e.7z"},   // 17.x — kept by spec
	}

	got := archivesPassingSpecs(all, []string{"last 1 versions", "17.x"}, c)
	if len(got) != 2 {
		t.Fatalf("expected 2 archives; got %d (%v)", len(got), got)
	}
	keptNames := map[string]bool{}
	for _, t := range got {
		keptNames[t.FileName] = true
	}
	if !keptNames["26.4.1 (23E254) arm64e.7z"] {
		t.Errorf("expected 26.4.1 (top major) kept")
	}
	if !keptNames["17.6.1 (21G101) arm64e.7z"] {
		t.Errorf("expected 17.6.1 (matched 17.x) kept")
	}
	if keptNames["18.5 (22F76) arm64e.7z"] {
		t.Errorf("18.5 should not be in the union")
	}
}

// TestArchivesPassingSpecsRangeIncludesMidVersions captures the in-range
// drop bug for non-last-N specs: 18.3.2 sits inside 17.5-18.7 and must
// pass, even though it's not a labelled folder endpoint.
func TestArchivesPassingSpecsRangeIncludesMidVersions(t *testing.T) {
	c := fixtureCatalog()
	all := []pipeline.Target{
		{FileName: "18.3.2 (22D8082) arm64e.7z"}, // mid-range, kept
		{FileName: "18.5 (22F76) arm64e.7z"},     // mid-range, kept
		{FileName: "18.7.6 (22H320) arm64e.7z"},  // 18.7.6 > 18.7 upper bound, dropped
		{FileName: "16.0 (20A362) arm64e.7z"},    // below range, dropped
	}

	got := archivesPassingSpecs(all, []string{"17.5-18.7"}, c)
	keptNames := map[string]bool{}
	for _, t := range got {
		keptNames[t.FileName] = true
	}
	if !keptNames["18.3.2 (22D8082) arm64e.7z"] {
		t.Errorf("18.3.2 should be in range and kept (the regression)")
	}
	if !keptNames["18.5 (22F76) arm64e.7z"] {
		t.Errorf("18.5 should be in range and kept")
	}
	if keptNames["18.7.6 (22H320) arm64e.7z"] {
		t.Errorf("18.7.6 must be dropped — exceeds upper bound 18.7")
	}
	if keptNames["16.0 (20A362) arm64e.7z"] {
		t.Errorf("16.0 must be dropped — below lower bound 17.5")
	}
}

func TestDedupByChecksum(t *testing.T) {
	tests := []struct {
		name      string
		targets   []pipeline.Target
		wantKept  int
		wantDrops int
	}{
		{
			name: "same checksum across two folders collapses to one",
			targets: []pipeline.Target{
				{FileID: "id-A", FileName: "17.6.1 (21G93) arm64e.7z", Checksum: "abc"},
				{FileID: "id-B", FileName: "17.6.1 (21G93) arm64e.7z", Checksum: "abc"},
			},
			wantKept:  1,
			wantDrops: 1,
		},
		{
			name: "different checksums on same VBA both kept",
			targets: []pipeline.Target{
				{FileID: "id-A", FileName: "18.0 (22A3351) arm64e.7z", Checksum: "abc"},
				{FileID: "id-B", FileName: "18.0 (22A3351) arm64e.7z", Checksum: "def"},
			},
			wantKept:  2,
			wantDrops: 0,
		},
		{
			name: "empty checksums are not deduped",
			targets: []pipeline.Target{
				{FileID: "id-A", FileName: "x.7z", Checksum: ""},
				{FileID: "id-B", FileName: "y.7z", Checksum: ""},
			},
			wantKept:  2,
			wantDrops: 0,
		},
		{
			name: "first-seen wins, preserving order",
			targets: []pipeline.Target{
				{FileID: "first", Checksum: "abc"},
				{FileID: "second", Checksum: "abc"},
				{FileID: "third", Checksum: "def"},
			},
			wantKept:  2,
			wantDrops: 1,
		},
		{
			name:      "empty input returns empty",
			targets:   nil,
			wantKept:  0,
			wantDrops: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kept, dropped := dedupByChecksum(tt.targets)
			if len(kept) != tt.wantKept {
				t.Errorf("kept=%d, want %d", len(kept), tt.wantKept)
			}
			if dropped != tt.wantDrops {
				t.Errorf("dropped=%d, want %d", dropped, tt.wantDrops)
			}
		})
	}

	t.Run("first-seen target retained", func(t *testing.T) {
		targets := []pipeline.Target{
			{FileID: "first", Checksum: "abc"},
			{FileID: "second", Checksum: "abc"},
		}
		kept, _ := dedupByChecksum(targets)
		if len(kept) != 1 || kept[0].FileID != "first" {
			t.Errorf("expected first-seen target retained; got %+v", kept)
		}
	})
}
