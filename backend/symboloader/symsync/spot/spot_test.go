package spot

import (
	"errors"
	"strconv"
	"strings"
	"testing"

	"symboloader/symsync/pipeline"
)

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

	t.Run("star after others", func(t *testing.T) {
		err := ValidateVersions([]string{"18.x", "*"})
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

func TestLatestVersions(t *testing.T) {
	// Simulated catalog from enumerator results (drive folder version endpoints)
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/1"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/2"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/3"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/4"},
		},
	}

	tests := []struct {
		n    int
		want []string
	}{
		{
			n:    1,
			want: []string{"26.4.1"},
		},
		{
			n:    3,
			want: []string{"26.4.1", "26.0", "18.7.6"},
		},
		{
			n:    5,
			want: []string{"26.4.1", "26.0", "18.7.6", "18.6.1", "18.5"},
		},
		{
			n:    10,
			want: []string{"26.4.1", "26.0", "18.7.6", "18.6.1", "18.5", "18.0", "17.6.1", "17.0"},
		},
	}

	for _, tt := range tests {
		t.Run("n="+string(rune(tt.n)), func(t *testing.T) {
			got := LatestVersions(catalog, tt.n)
			if len(got) != len(tt.want) {
				t.Fatalf("got %d versions, want %d", len(got), len(tt.want))
			}
			for i, v := range got {
				if v != tt.want[i] {
					t.Errorf("version[%d]: got %q, want %q", i, v, tt.want[i])
				}
			}
		})
	}
}

func TestLastNVersionsResolution(t *testing.T) {
	// Simulated catalog from enumerator results
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/1"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/2"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/3"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/4"},
		},
	}

	tests := []struct {
		versionSpec string
		want        []string
	}{
		{
			versionSpec: "last 5 versions",
			want:        []string{"26.4.1", "26.0", "18.7.6", "18.6.1", "18.5"},
		},
		{
			versionSpec: "last 3 versions",
			want:        []string{"26.4.1", "26.0", "18.7.6"},
		},
		{
			versionSpec: "last 1 versions",
			want:        []string{"26.4.1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.versionSpec, func(t *testing.T) {
			// Validate the version spec is recognized as valid
			if err := ValidateVersions([]string{tt.versionSpec}); err != nil {
				t.Fatalf("ValidateVersions(%q) unexpected error: %v", tt.versionSpec, err)
			}

			// Extract N from "last N versions" and resolve to actual versions
			if !isLastNVersions(tt.versionSpec) {
				t.Fatalf("isLastNVersions(%q) should be true", tt.versionSpec)
			}

			parts := strings.SplitN(tt.versionSpec, " ", 3)
			n, _ := strconv.Atoi(parts[1])
			got := LatestVersions(catalog, n)

			if len(got) != len(tt.want) {
				t.Fatalf("got %d versions, want %d", len(got), len(tt.want))
			}
			for i, v := range got {
				if v != tt.want[i] {
					t.Errorf("version[%d]: got %q, want %q", i, v, tt.want[i])
				}
			}
		})
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

func TestResolveVersionsSpecific(t *testing.T) {
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/1"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/2"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/3"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/4"},
		},
	}

	tests := []struct {
		name     string
		versions []string
		want     []string // URLs of matched folders
	}{
		{
			name:     "specific version 26.0",
			versions: []string{"26.0"},
			want:     []string{"https://example.com/1"},
		},
		{
			name:     "specific version 18.7.6",
			versions: []string{"18.7.6"},
			want:     []string{"https://example.com/2"},
		},
		{
			name:     "multiple specific versions",
			versions: []string{"26.0", "18.0"},
			want:     []string{"https://example.com/1", "https://example.com/3"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveVersions(catalog, tt.versions)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("got %d folders, want %d", len(got), len(tt.want))
			}
			for i, folder := range got {
				if folder.URL != tt.want[i] {
					t.Errorf("folder[%d]: got %q, want %q", i, folder.URL, tt.want[i])
				}
			}
		})
	}
}

func TestResolveVersionsWildcard(t *testing.T) {
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/1"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/2"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/3"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/4"},
		},
	}

	tests := []struct {
		name     string
		versions []string
		want     []string
	}{
		{
			name:     "major wildcard 26.x",
			versions: []string{"26.x"},
			want:     []string{"https://example.com/1"},
		},
		{
			name:     "major wildcard 18.x",
			versions: []string{"18.x"},
			want:     []string{"https://example.com/2", "https://example.com/3"},
		},
		{
			name:     "wildcard all *",
			versions: []string{"*"},
			want:     []string{"https://example.com/1", "https://example.com/2", "https://example.com/3", "https://example.com/4"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveVersions(catalog, tt.versions)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("got %d folders, want %d", len(got), len(tt.want))
			}
			for i, folder := range got {
				if folder.URL != tt.want[i] {
					t.Errorf("folder[%d]: got %q, want %q", i, folder.URL, tt.want[i])
				}
			}
		})
	}
}

func TestResolveVersionsRange(t *testing.T) {
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/1"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/2"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/3"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/4"},
		},
	}

	tests := []struct {
		name     string
		versions []string
		want     []string
	}{
		{
			name:     "range 18.x-26.x",
			versions: []string{"18.x-26.x"},
			want:     []string{"https://example.com/1", "https://example.com/2", "https://example.com/3"},
		},
		{
			name:     "range 17.5-18.7",
			versions: []string{"17.5-18.7"},
			want:     []string{"https://example.com/2", "https://example.com/3", "https://example.com/4"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveVersions(catalog, tt.versions)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("got %d folders, want %d", len(got), len(tt.want))
			}
			for i, folder := range got {
				if folder.URL != tt.want[i] {
					t.Errorf("folder[%d]: got %q, want %q", i, folder.URL, tt.want[i])
				}
			}
		})
	}
}

func TestResolveVersionsLastN(t *testing.T) {
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/1"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/2"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/3"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/4"},
		},
	}

	tests := []struct {
		name     string
		versions []string
		want     []string
	}{
		{
			name:     "last 3 versions",
			versions: []string{"last 3 versions"},
			want:     []string{"https://example.com/1", "https://example.com/2"},
		},
		{
			name:     "last 1 version",
			versions: []string{"last 1 versions"},
			want:     []string{"https://example.com/1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveVersions(catalog, tt.versions)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("got %d folders, want %d", len(got), len(tt.want))
			}
			for i, folder := range got {
				if folder.URL != tt.want[i] {
					t.Errorf("folder[%d]: got %q, want %q", i, folder.URL, tt.want[i])
				}
			}
		})
	}
}

func TestResolveVersionsMixed(t *testing.T) {
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{Versions: []string{"26.0", "26.4.1"}, URL: "https://example.com/1"},
			{Versions: []string{"18.6.1", "18.7.6"}, URL: "https://example.com/2"},
			{Versions: []string{"18.0", "18.5"}, URL: "https://example.com/3"},
			{Versions: []string{"17.0", "17.6.1"}, URL: "https://example.com/4"},
		},
	}

	t.Run("mixed: specific + wildcard + range", func(t *testing.T) {
		// "26.0" (specific) + "17.x" (wildcard) + "18.0-18.6" (range)
		versions := []string{"26.0", "17.x", "18.0-18.6"}
		got, err := ResolveVersions(catalog, versions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Should match: 26.0 (folder 1), 17.0, 17.6.1 (folder 4), 18.0, 18.5 (folder 3)
		// Folders: 1, 3, 4
		want := []string{"https://example.com/1", "https://example.com/3", "https://example.com/4"}
		if len(got) != len(want) {
			t.Fatalf("got %d folders, want %d", len(got), len(want))
		}
		for i, folder := range got {
			if folder.URL != want[i] {
				t.Errorf("folder[%d]: got %q, want %q", i, folder.URL, want[i])
			}
		}
	})
}

func TestValidateVersionsRejectsInvalid(t *testing.T) {
	err := ValidateVersions([]string{"invalid..version"})
	if err == nil {
		t.Error("expected validation error for invalid version")
	}
}

func TestResolveVersionsMatchesFolders(t *testing.T) {
	catalog := &pipeline.Catalog{
		Folders: []pipeline.DriveFolder{
			{URL: "https://drive.google.com/drive/folders/folder1", Versions: []string{"26.0"}},
			{URL: "https://drive.google.com/drive/folders/folder2", Versions: []string{"18.0", "18.1"}},
		},
	}

	folders, err := ResolveVersions(catalog, []string{"26.0", "18.x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(folders) != 2 {
		t.Errorf("expected 2 folders, got %d", len(folders))
	}

	urls := map[string]bool{}
	for _, f := range folders {
		urls[f.URL] = true
	}

	if !urls["https://drive.google.com/drive/folders/folder1"] {
		t.Error("expected folder1 for version 26.0")
	}
	if !urls["https://drive.google.com/drive/folders/folder2"] {
		t.Error("expected folder2 for versions 18.x")
	}
}
