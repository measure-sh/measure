package enumerate

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func loadFixture(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile("testdata/readme.md")
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}
	return string(data)
}

func TestParseDriveLinks(t *testing.T) {
	content := loadFixture(t)
	folders := parseDriveLinks(content)

	if len(folders) != 5 {
		t.Fatalf("expected 5 drive folders, got %d", len(folders))
	}

	tests := []struct {
		versions []string
		url      string
	}{
		{[]string{"26.0", "26.4.1"}, "https://drive.google.com/drive/folders/1V-JfRPx8WL_MVXDHHbMiGrQKW3U45yxb?usp=sharing"},
		{[]string{"18.6.1", "18.7.6"}, "https://drive.google.com/drive/folders/1y5rE-KPuP-5uM11FgD_gh4GJ6T8UpDTM?usp=sharing"},
		{[]string{"18.0", "18.5"}, "https://drive.google.com/drive/folders/1jWUAHcpU9OjdA1aCSSis9qOGd4kjyAf7?usp=sharing"},
		{[]string{"18.0 beta1", "18.1 beta3"}, "https://drive.google.com/drive/folders/1YwKHYA_-KOOYXsz2L2nq8WnPuyvxqLid?usp=drive_link"},
		{[]string{"17.0", "17.6.1"}, "https://drive.google.com/drive/folders/1wKCTyvhA5B39aJFxT8u92qpOaMA5-f19?usp=sharing"},
	}

	for i, tt := range tests {
		if len(folders[i].Versions) != len(tt.versions) {
			t.Errorf("folder[%d] versions length: got %d, want %d", i, len(folders[i].Versions), len(tt.versions))
			continue
		}
		for j, v := range tt.versions {
			if folders[i].Versions[j] != v {
				t.Errorf("folder[%d] versions[%d]: got %q, want %q", i, j, folders[i].Versions[j], v)
			}
		}
		if folders[i].URL != tt.url {
			t.Errorf("folder[%d] url: got %q, want %q", i, folders[i].URL, tt.url)
		}
	}
}

func TestParseGroups(t *testing.T) {
	content := loadFixture(t)
	groups := parseGroups(content)

	if len(groups) != 4 {
		t.Fatalf("expected 4 groups, got %d", len(groups))
	}

	expectedNames := []string{"26.x", "18.x", "18.x Beta", "17.x"}
	for i, name := range expectedNames {
		if groups[i].Name != name {
			t.Errorf("group[%d] name: got %q, want %q", i, groups[i].Name, name)
		}
	}

	expectedCounts := []int{4, 5, 2, 3}
	for i, count := range expectedCounts {
		if len(groups[i].Symbols) != count {
			t.Errorf("group[%d] %q: got %d symbols, want %d", i, groups[i].Name, len(groups[i].Symbols), count)
		}
	}
}

func TestParseGroupsSymbolFields(t *testing.T) {
	content := loadFixture(t)
	groups := parseGroups(content)

	// 26.x first entry
	sym := groups[0].Symbols[0]
	if sym.OSVersion != "26.4.1 (23E254)" {
		t.Errorf("osVersion: got %q, want %q", sym.OSVersion, "26.4.1 (23E254)")
	}
	if len(sym.Arch) != 1 || sym.Arch[0] != "arm64e" {
		t.Errorf("arch: got %v, want [arm64e]", sym.Arch)
	}
	if sym.Description != "" {
		t.Errorf("description: got %q, want empty", sym.Description)
	}
}

func TestParseGroupsMultiArch(t *testing.T) {
	content := loadFixture(t)
	groups := parseGroups(content)

	// 17.x last entry has "arm64 arm64e"
	sym := groups[3].Symbols[2]
	if sym.OSVersion != "17.0 (21A329)" {
		t.Errorf("osVersion: got %q, want %q", sym.OSVersion, "17.0 (21A329)")
	}
	if len(sym.Arch) != 2 || sym.Arch[0] != "arm64" || sym.Arch[1] != "arm64e" {
		t.Errorf("arch: got %v, want [arm64 arm64e]", sym.Arch)
	}
}

func TestParseGroupsDescription(t *testing.T) {
	content := loadFixture(t)
	groups := parseGroups(content)

	// 18.x third entry has description
	sym := groups[1].Symbols[2]
	if sym.OSVersion != "18.3.2 (22D8082)" {
		t.Errorf("osVersion: got %q, want %q", sym.OSVersion, "18.3.2 (22D8082)")
	}
	if sym.Description != "iPhone 16e only" {
		t.Errorf("description: got %q, want %q", sym.Description, "iPhone 16e only")
	}
}

func TestParseGroupsBetaSection(t *testing.T) {
	content := loadFixture(t)
	groups := parseGroups(content)

	beta := groups[2]
	if beta.Name != "18.x Beta" {
		t.Errorf("beta group name: got %q, want %q", beta.Name, "18.x Beta")
	}
	if len(beta.Symbols) != 2 {
		t.Fatalf("beta symbols count: got %d, want 2", len(beta.Symbols))
	}
	if beta.Symbols[0].OSVersion != "18.7.6 (22H320)" {
		t.Errorf("beta first symbol: got %q, want %q", beta.Symbols[0].OSVersion, "18.7.6 (22H320)")
	}
}

func TestParseTableRowSkipsHeaders(t *testing.T) {
	lines := []string{
		"|    OS Version    | Collected Architecture | Description |",
		"| :--------------: | :--------------------: | :---------: |",
		"| :-------: | :----: | :--: |",
	}

	for _, line := range lines {
		if _, ok := parseTableRow(line); ok {
			t.Errorf("expected header/alignment row to be skipped: %q", line)
		}
	}
}

func TestParseTableRowNonTableLine(t *testing.T) {
	lines := []string{
		"# Some heading",
		"",
		"plain text line",
		"[link](url)",
	}

	for _, line := range lines {
		if _, ok := parseTableRow(line); ok {
			t.Errorf("expected non-table line to be skipped: %q", line)
		}
	}
}

func TestParseGroupsDuplicateVersions(t *testing.T) {
	content := loadFixture(t)
	groups := parseGroups(content)

	// 18.x has two entries for 18.0 with different build codes
	var count int
	for _, sym := range groups[1].Symbols {
		if len(sym.OSVersion) >= 4 && sym.OSVersion[:4] == "18.0" {
			count++
		}
	}
	if count != 2 {
		t.Errorf("expected 2 entries for 18.0, got %d", count)
	}
}

func TestEnumerateServerDown(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}))
	defer srv.Close()

	e := &ReadmeEnumerator{ReadmeURL: srv.URL}
	_, err := e.Enumerate(context.Background())
	if !errors.Is(err, ErrFetchReadme) {
		t.Errorf("expected ErrFetchReadme, got: %v", err)
	}
	if !errors.Is(err, ErrUnexpectedStatus) {
		t.Errorf("expected ErrUnexpectedStatus, got: %v", err)
	}
}

func TestEnumerateUnreachable(t *testing.T) {
	e := &ReadmeEnumerator{ReadmeURL: "http://127.0.0.1:1"}
	_, err := e.Enumerate(context.Background())
	if !errors.Is(err, ErrFetchReadme) {
		t.Errorf("expected ErrFetchReadme, got: %v", err)
	}
}

func TestEnumerateContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	e := &ReadmeEnumerator{ReadmeURL: srv.URL}
	_, err := e.Enumerate(ctx)
	if !errors.Is(err, ErrFetchReadme) {
		t.Errorf("expected ErrFetchReadme, got: %v", err)
	}
}

func TestEnumerateNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer srv.Close()

	e := &ReadmeEnumerator{ReadmeURL: srv.URL}
	_, err := e.Enumerate(context.Background())
	if !errors.Is(err, ErrFetchReadme) {
		t.Errorf("expected ErrFetchReadme, got: %v", err)
	}
	if !errors.Is(err, ErrUnexpectedStatus) {
		t.Errorf("expected ErrUnexpectedStatus, got: %v", err)
	}
}
