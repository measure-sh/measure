package reporter

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"symboloader/symsync/pipeline"
)

func archiveEntry(version, build, arch string, completedAt time.Time, deletedAt time.Time) pipeline.ArchiveEntry {
	return pipeline.ArchiveEntry{
		Version:      version,
		Build:        build,
		Arch:         arch,
		DIFsUploaded: 12,
		CompletedAt:  completedAt,
		DeletedAt:    deletedAt,
	}
}

func TestSortedEntriesByCompletedAtDesc(t *testing.T) {
	t1 := time.Date(2026, 4, 22, 9, 15, 0, 0, time.UTC)
	t2 := time.Date(2026, 4, 25, 14, 30, 0, 0, time.UTC)
	t3 := time.Date(2026, 4, 25, 14, 31, 0, 0, time.UTC)

	entries := []pipeline.ArchiveEntry{
		archiveEntry("17.6.1", "21G93", "arm64", t1, time.Time{}),
		archiveEntry("18.0", "22A3351", "arm64e", t2, time.Time{}),
		archiveEntry("18.1", "22B83", "arm64e", t3, time.Time{}),
	}
	sorted := sortedEntries(entries, false)
	if sorted[0].Version != "18.1" || sorted[1].Version != "18.0" || sorted[2].Version != "17.6.1" {
		t.Errorf("descending sort failed: %v", sorted)
	}
}

func TestSortedEntriesByDeletedAtDesc(t *testing.T) {
	d1 := time.Date(2026, 4, 25, 14, 30, 0, 0, time.UTC)
	d2 := time.Date(2026, 4, 25, 14, 35, 0, 0, time.UTC)
	entries := []pipeline.ArchiveEntry{
		archiveEntry("17.6", "21G80", "arm64", time.Time{}, d1),
		archiveEntry("12.0", "16A366", "arm64", time.Time{}, d2),
	}
	sorted := sortedEntries(entries, true)
	if sorted[0].Version != "12.0" {
		t.Errorf("by-deletedAt desc failed: %v", sorted)
	}
}

func TestFormatManifestRowAlignment(t *testing.T) {
	e := pipeline.ArchiveEntry{
		Version:      "18.0",
		Build:        "22A3351",
		Arch:         "arm64e",
		DIFsUploaded: 12,
	}
	got := formatManifestRow(e, time.Date(2026, 4, 25, 14, 30, 21, 0, time.UTC))
	want := "18.0      22A3351    arm64e    12 DIFs  2026-04-25T14:30:21Z"
	if got != want {
		t.Errorf("\n got: %q\nwant: %q", got, want)
	}
}

func TestWriteManifestSummaryNonTTY(t *testing.T) {
	t1 := time.Date(2026, 4, 22, 9, 15, 0, 0, time.UTC)
	t2 := time.Date(2026, 4, 25, 14, 31, 0, 0, time.UTC)
	d1 := time.Date(2026, 4, 25, 14, 35, 0, 0, time.UTC)

	c := ManifestCategorized{
		Added: []pipeline.ArchiveEntry{
			archiveEntry("18.1", "22B83", "arm64e", t2, time.Time{}),
		},
		Kept: []pipeline.ArchiveEntry{
			archiveEntry("17.6.1", "21G93", "arm64", t1, time.Time{}),
		},
		Deleted: []pipeline.ArchiveEntry{
			archiveEntry("12.0", "16A366", "arm64", t1, d1),
		},
	}
	var buf bytes.Buffer
	writeManifestSummary(&buf, c)
	out := buf.String()

	if !strings.Contains(out, "manifest: 2 active archives, 1 added, 1 deleted in this run") {
		t.Errorf("missing header line: %q", out)
	}
	if !strings.Contains(out, " + 18.1") {
		t.Errorf("expected `+ 18.1` for added row: %q", out)
	}
	if !strings.Contains(out, "   17.6.1") {
		t.Errorf("expected unprefixed kept row: %q", out)
	}
	if !strings.Contains(out, " - 12.0") {
		t.Errorf("expected `- 12.0` for deleted row: %q", out)
	}
	if !strings.Contains(out, "(+ = added, - = deleted in this run)") {
		t.Errorf("missing legend: %q", out)
	}
}

func TestManifestCategorizedIsEmpty(t *testing.T) {
	if !(ManifestCategorized{}).IsEmpty() {
		t.Errorf("zero value should be empty")
	}
	c := ManifestCategorized{Added: []pipeline.ArchiveEntry{{}}}
	if c.IsEmpty() {
		t.Errorf("non-empty Added should not be IsEmpty")
	}
	if c.ActiveCount() != 1 {
		t.Errorf("ActiveCount with one Added = 1, got %d", c.ActiveCount())
	}
}
