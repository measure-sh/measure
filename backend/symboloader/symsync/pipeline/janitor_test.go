package pipeline

import (
	"context"
	"testing"
	"time"

	"symboloader/symbol"
)

func seedDIF(t *testing.T, store *fakeStore, debugID string) {
	t.Helper()
	base := symbol.BuildUnifiedLayout(debugID)
	ctx := context.Background()
	if err := store.Put(ctx, base+"/debuginfo", []byte("dummy"), ""); err != nil {
		t.Fatal(err)
	}
	if err := store.Put(ctx, base+"/meta", []byte("{}"), ""); err != nil {
		t.Fatal(err)
	}
}

func TestJanitorDeletesDIFsAndSoftDeletesEntry(t *testing.T) {
	store := newFakeStore()
	seedDIF(t, store, "uuid-doomed")

	doomed := ArchiveEntry{
		Version:     "17.6",
		Build:       "21G80",
		Arch:        "arm64",
		Checksum:    "c2",
		Filename:    "17.6 (21G80) arm64.7z",
		DebugIDs:    []string{"uuid-doomed"},
		CompletedAt: time.Now().UTC(),
	}
	manifest := &Manifest{Archives: []ArchiveEntry{doomed}}
	plan := &Plan{Deletes: []DeleteAction{{Entry: doomed}}}

	janitor := NewStoreJanitor(store, manifest, 1)
	results := make(chan DeleteResult, 1)
	deleted, err := janitor.Delete(context.Background(), plan, results)
	close(results)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if len(deleted) != 1 {
		t.Errorf("expected 1 deleted ref, got %d", len(deleted))
	}

	// DIF objects gone from bucket.
	base := symbol.BuildUnifiedLayout("uuid-doomed")
	if _, err := store.Get(context.Background(), base+"/debuginfo"); err == nil {
		t.Errorf("debuginfo should be deleted")
	}
	if _, err := store.Get(context.Background(), base+"/meta"); err == nil {
		t.Errorf("meta should be deleted")
	}

	// In-memory entry soft-deleted.
	if manifest.Archives[0].Active() {
		t.Errorf("manifest entry should be soft-deleted")
	}

	// Persisted entry has DeletedAt set.
	keys, _ := store.List(context.Background(), archivesPrefix)
	if len(keys) != 1 {
		t.Fatalf("expected the index file persisted; got %v", keys)
	}
}

func TestJanitorRespectsSharedDebugIDs(t *testing.T) {
	store := newFakeStore()
	seedDIF(t, store, "uuid-shared")

	doomed := ArchiveEntry{
		Version: "17.6", Build: "21G80", Arch: "arm64", Checksum: "c2",
		DebugIDs: []string{"uuid-shared"},
	}
	retained := ArchiveEntry{
		Version: "18.0", Build: "22A3351", Arch: "arm64e", Checksum: "c1",
		DebugIDs: []string{"uuid-shared"},
	}
	manifest := &Manifest{Archives: []ArchiveEntry{doomed, retained}}
	plan := &Plan{Deletes: []DeleteAction{{Entry: doomed}}}

	janitor := NewStoreJanitor(store, manifest, 1)
	results := make(chan DeleteResult, 1)
	_, err := janitor.Delete(context.Background(), plan, results)
	close(results)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// The shared DIF must NOT have been deleted.
	base := symbol.BuildUnifiedLayout("uuid-shared")
	if _, err := store.Get(context.Background(), base+"/debuginfo"); err != nil {
		t.Errorf("shared DIF debuginfo should be retained, got err=%v", err)
	}

	got := <-collectResults(results)
	if got.DIFsDeleted != 0 || got.DIFsRetained != 1 {
		t.Errorf("expected 0 deleted, 1 retained; got %+v", got)
	}
}

// collectResults drains a closed channel, returning a buffered channel for ad-hoc reads.
func collectResults(in <-chan DeleteResult) <-chan DeleteResult {
	out := make(chan DeleteResult, 16)
	go func() {
		for r := range in {
			out <- r
		}
		close(out)
	}()
	return out
}

func TestJanitorNoOpWhenNoDeletes(t *testing.T) {
	store := newFakeStore()
	manifest := &Manifest{}
	plan := &Plan{}

	janitor := NewStoreJanitor(store, manifest, 1)
	results := make(chan DeleteResult, 1)
	deleted, err := janitor.Delete(context.Background(), plan, results)
	close(results)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if len(deleted) != 0 {
		t.Errorf("expected no deletions, got %d", len(deleted))
	}
}

func TestJanitorIdempotentOnMissingDIFs(t *testing.T) {
	// DIF objects already gone from bucket — janitor should still soft-delete cleanly.
	store := newFakeStore()
	doomed := ArchiveEntry{
		Version: "17.6", Build: "21G80", Arch: "arm64", Checksum: "c2",
		DebugIDs: []string{"uuid-already-gone"},
	}
	manifest := &Manifest{Archives: []ArchiveEntry{doomed}}
	plan := &Plan{Deletes: []DeleteAction{{Entry: doomed}}}

	janitor := NewStoreJanitor(store, manifest, 1)
	results := make(chan DeleteResult, 1)
	if _, err := janitor.Delete(context.Background(), plan, results); err != nil {
		t.Fatalf("Delete on missing DIFs: %v", err)
	}
	close(results)
	if manifest.Archives[0].Active() {
		t.Errorf("entry should be soft-deleted even when DIFs were already gone")
	}
}
