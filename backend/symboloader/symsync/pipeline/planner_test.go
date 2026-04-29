package pipeline

import (
	"testing"
	"time"
)

func tgt(version, build, arch, checksum string) Target {
	return Target{
		FileName: version + " (" + build + ") " + arch + ".7z",
		Checksum: checksum,
		FileID:   "f-" + version + "-" + build,
	}
}

func entry(version, build, arch, checksum string, deleted bool) ArchiveEntry {
	e := ArchiveEntry{
		Version:     version,
		Build:       build,
		Arch:        arch,
		Checksum:    checksum,
		Filename:    version + " (" + build + ") " + arch + ".7z",
		CompletedAt: time.Now().UTC(),
	}
	if deleted {
		e.DeletedAt = time.Now().UTC()
	}
	return e
}

func TestNewPlanFetchAllWhenManifestEmpty(t *testing.T) {
	targets := []Target{tgt("18.0", "22A3351", "arm64e", "c1")}
	plan := NewPlan(targets, &Manifest{})

	if len(plan.Actions) != 1 {
		t.Errorf("expected 1 fetch action, got %d", len(plan.Actions))
	}
	if len(plan.Deletes) != 0 {
		t.Errorf("expected 0 deletes, got %d", len(plan.Deletes))
	}
}

func TestNewPlanDeletesEntriesNotInTargets(t *testing.T) {
	targets := []Target{
		tgt("18.0", "22A3351", "arm64e", "c1"),
	}
	manifest := &Manifest{Archives: []ArchiveEntry{
		entry("18.0", "22A3351", "arm64e", "c1", false), // kept (matches target)
		entry("17.6", "21G80", "arm64", "c2", false),    // delete (not in target)
	}}

	plan := NewPlan(targets, manifest)

	if len(plan.Actions) != 1 {
		t.Errorf("expected 1 fetch action, got %d", len(plan.Actions))
	}
	if len(plan.Deletes) != 1 {
		t.Fatalf("expected 1 delete, got %d", len(plan.Deletes))
	}
	if plan.Deletes[0].Entry.Version != "17.6" {
		t.Errorf("expected 17.6 deletion, got %s", plan.Deletes[0].Entry.Version)
	}
}

func TestNewPlanIgnoresSoftDeletedEntries(t *testing.T) {
	manifest := &Manifest{Archives: []ArchiveEntry{
		entry("17.6", "21G80", "arm64", "c2", true), // already soft-deleted
	}}
	plan := NewPlan(nil, manifest)
	if len(plan.Deletes) != 0 {
		t.Errorf("soft-deleted entries must not appear in plan.Deletes; got %d", len(plan.Deletes))
	}
}

func TestNewPlanRetainsExplicitlyTargetedVersion(t *testing.T) {
	// Operator wants "last 5 + 12.x". The 12.x explicit pin must keep its entry
	// even though it would otherwise fall outside the rolling target window.
	targets := []Target{
		tgt("18.0", "22A3351", "arm64e", "c1"),
		tgt("12.0", "16A366", "arm64", "c12"),
	}
	manifest := &Manifest{Archives: []ArchiveEntry{
		entry("18.0", "22A3351", "arm64e", "c1", false),
		entry("12.0", "16A366", "arm64", "c12", false),
	}}
	plan := NewPlan(targets, manifest)
	if len(plan.Deletes) != 0 {
		t.Errorf("12.x must be retained when explicitly targeted; got deletes %+v", plan.Deletes)
	}
}

func TestNewPlanDeleteCount(t *testing.T) {
	manifest := &Manifest{Archives: []ArchiveEntry{
		entry("a", "b", "c", "d", false),
		entry("e", "f", "g", "h", false),
	}}
	plan := NewPlan(nil, manifest)
	if got := plan.DeleteCount(); got != 2 {
		t.Errorf("DeleteCount = %d, want 2", got)
	}
}
