package pipeline

import (
	"bytes"
	"context"
	"errors"
	"io"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeStore is an in-memory ObjectStore used by pipeline tests.
type fakeStore struct {
	mu      sync.Mutex
	objects map[string][]byte
}

func newFakeStore() *fakeStore {
	return &fakeStore{objects: make(map[string][]byte)}
}

func (f *fakeStore) Put(_ context.Context, key string, body io.Reader, _ int64, _ string) error {
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.objects[key] = data
	return nil
}

// putBytes is a test helper that adapts the io.Reader-based Put to a []byte
// caller. Keeps test bodies short.
func putBytes(ctx context.Context, store ObjectStore, key string, data []byte) error {
	return store.Put(ctx, key, bytes.NewReader(data), int64(len(data)), "")
}

func (f *fakeStore) Get(_ context.Context, key string) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	data, ok := f.objects[key]
	if !ok {
		return nil, ErrNotFound
	}
	cp := make([]byte, len(data))
	copy(cp, data)
	return cp, nil
}

func (f *fakeStore) Delete(_ context.Context, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.objects, key)
	return nil
}

func (f *fakeStore) List(_ context.Context, prefix string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var keys []string
	for k := range f.objects {
		if strings.HasPrefix(k, prefix) {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	return keys, nil
}

func TestFakeStorePutGet(t *testing.T) {
	store := newFakeStore()
	ctx := context.Background()

	data := []byte("hello")
	if err := store.Put(ctx, "foo", bytes.NewReader(data), int64(len(data)), "text/plain"); err != nil {
		t.Fatalf("Put: %v", err)
	}
	got, err := store.Get(ctx, "foo")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(got) != "hello" {
		t.Errorf("Get: got %q, want %q", got, "hello")
	}
}

func TestFakeStoreGetNotFound(t *testing.T) {
	store := newFakeStore()
	_, err := store.Get(context.Background(), "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get missing: got %v, want ErrNotFound", err)
	}
}

func TestFakeStoreDeleteIdempotent(t *testing.T) {
	store := newFakeStore()
	ctx := context.Background()
	if err := store.Delete(ctx, "absent"); err != nil {
		t.Fatalf("Delete absent: %v", err)
	}
	if err := putBytes(ctx, store, "k", []byte("v")); err != nil {
		t.Fatalf("Put: %v", err)
	}
	if err := store.Delete(ctx, "k"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := store.Get(ctx, "k"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get after Delete: got %v, want ErrNotFound", err)
	}
}

func TestFakeStoreListPrefix(t *testing.T) {
	store := newFakeStore()
	ctx := context.Background()
	for _, k := range []string{"a/1", "a/2", "b/1"} {
		_ = putBytes(ctx, store, k, []byte("x"))
	}
	got, err := store.List(ctx, "a/")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(got) != 2 || got[0] != "a/1" || got[1] != "a/2" {
		t.Errorf("List a/: got %v", got)
	}
	got, _ = store.List(ctx, "")
	if len(got) != 3 {
		t.Errorf("List empty prefix: expected 3 keys, got %v", got)
	}
}

func TestSaveLoadArchiveEntryRoundTrip(t *testing.T) {
	store := newFakeStore()
	ctx := context.Background()

	entry := ArchiveEntry{
		FileID:       "id-1",
		Filename:     "18.0 (22A3351) arm64e.7z",
		Version:      "18.0",
		Build:        "22A3351",
		Arch:         "arm64e",
		Checksum:     "abc123",
		DebugIDs:     []string{"uuid-1", "uuid-2"},
		DIFsUploaded: 2,
		CompletedAt:  time.Date(2026, 4, 25, 14, 30, 0, 0, time.UTC),
	}
	if err := SaveArchiveEntry(ctx, store, entry); err != nil {
		t.Fatalf("SaveArchiveEntry: %v", err)
	}

	m, err := LoadManifest(ctx, store)
	if err != nil {
		t.Fatalf("LoadManifest: %v", err)
	}
	if len(m.Archives) != 1 {
		t.Fatalf("expected 1 archive, got %d", len(m.Archives))
	}
	a := m.Archives[0]
	if a.FileID != "id-1" || a.Version != "18.0" || a.Build != "22A3351" ||
		a.Arch != "arm64e" || a.Checksum != "abc123" || a.DIFsUploaded != 2 {
		t.Errorf("archive round-trip mismatch: %+v", a)
	}
	if len(a.DebugIDs) != 2 || a.DebugIDs[0] != "uuid-1" {
		t.Errorf("DebugIDs round-trip mismatch: %v", a.DebugIDs)
	}
	if !a.Active() {
		t.Errorf("expected entry to be active")
	}
	if !m.IsCompleted("18.0", "22A3351", "arm64e", "abc123") {
		t.Errorf("IsCompleted: expected true for matching VBAC")
	}
}

func TestLoadManifestEmptyOnNoKeys(t *testing.T) {
	store := newFakeStore()
	m, err := LoadManifest(context.Background(), store)
	if err != nil {
		t.Fatalf("LoadManifest: %v", err)
	}
	if len(m.Archives) != 0 {
		t.Errorf("expected empty manifest, got %d archives", len(m.Archives))
	}
}

func TestIsCompletedRespectsSoftDelete(t *testing.T) {
	m := &Manifest{Archives: []ArchiveEntry{
		{
			Version: "18.0", Build: "22A3351", Arch: "arm64e", Checksum: "abc",
			CompletedAt: time.Now().UTC(),
			DeletedAt:   time.Now().UTC(),
		},
	}}
	if m.IsCompleted("18.0", "22A3351", "arm64e", "abc") {
		t.Errorf("soft-deleted entry should not be considered completed")
	}
}

func TestIsCompletedEmptyChecksumMatchesVBA(t *testing.T) {
	m := &Manifest{Archives: []ArchiveEntry{
		{Version: "17.6.1", Build: "21G101", Arch: "arm64e"},
	}}
	if !m.IsCompleted("17.6.1", "21G101", "arm64e", "any-checksum") {
		t.Errorf("entry with empty checksum should match any checksum on same VBA")
	}
	if m.IsCompleted("17.6.0", "21G101", "arm64e", "any") {
		t.Errorf("different version must not match")
	}
}

func TestUpsertArchiveReplacesExisting(t *testing.T) {
	m := &Manifest{Archives: []ArchiveEntry{
		{Version: "18.0", Build: "22A3351", Arch: "arm64e", Checksum: "c", DIFsUploaded: 1},
	}}
	m.upsertArchive(ArchiveEntry{
		Version: "18.0", Build: "22A3351", Arch: "arm64e", Checksum: "c", DIFsUploaded: 99,
	})
	if len(m.Archives) != 1 || m.Archives[0].DIFsUploaded != 99 {
		t.Errorf("upsert should replace by VBAC, got %+v", m.Archives)
	}

	m.upsertArchive(ArchiveEntry{
		Version: "18.1", Build: "22B83", Arch: "arm64e", Checksum: "d",
	})
	if len(m.Archives) != 2 {
		t.Errorf("upsert with new VBAC should append; got %d", len(m.Archives))
	}
}

func TestSaveRunRecordRoundTrip(t *testing.T) {
	store := newFakeStore()
	ctx := context.Background()

	rec := RunRecord{
		RunID:     NewRunID(time.Date(2026, 4, 25, 14, 30, 0, 0, time.UTC)),
		StartedAt: time.Date(2026, 4, 25, 14, 30, 0, 0, time.UTC),
		ArchivesAdded: []ArchiveRef{{
			Version: "18.0", Build: "22A3351", Arch: "arm64e", Checksum: "abc",
		}},
	}
	if err := SaveRunRecord(ctx, store, rec); err != nil {
		t.Fatalf("SaveRunRecord: %v", err)
	}

	keys, _ := store.List(ctx, runsPrefix)
	if len(keys) != 1 {
		t.Fatalf("expected 1 run record, got %v", keys)
	}
	if !strings.Contains(keys[0], "2026-04-25T14-30-00Z") {
		t.Errorf("expected colon-replaced run id in key, got %s", keys[0])
	}
}
