package pipeline

import (
	"context"
	"errors"
	"sync"
	"testing"
)

// fakeStore is an in-memory ObjectStore used by pipeline tests.
type fakeStore struct {
	mu      sync.Mutex
	objects map[string][]byte
}

func newFakeStore() *fakeStore {
	return &fakeStore{objects: make(map[string][]byte)}
}

func (f *fakeStore) Put(_ context.Context, key string, data []byte, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	cp := make([]byte, len(data))
	copy(cp, data)
	f.objects[key] = cp
	return nil
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

func TestFakeStorePutGet(t *testing.T) {
	store := newFakeStore()
	ctx := context.Background()

	if err := store.Put(ctx, "foo", []byte("hello"), "text/plain"); err != nil {
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

func TestLoadManifestEmptyOnNotFound(t *testing.T) {
	store := newFakeStore()
	m, err := loadManifest(context.Background(), store)
	if err != nil {
		t.Fatalf("loadManifest: %v", err)
	}
	if len(m.Runs) != 0 {
		t.Errorf("expected empty manifest, got %d runs", len(m.Runs))
	}
}

func TestSaveLoadManifestRoundTrip(t *testing.T) {
	store := newFakeStore()
	ctx := context.Background()

	m := &Manifest{Runs: []ManifestRun{{
		Archives: []ManifestArchive{{
			FileID:   "id-1",
			Filename: "18.0 (22A3351) arm64e.7z",
			Version:  "18.0",
			Build:    "22A3351",
			Arch:     "arm64e",
		}},
	}}}
	if err := saveManifest(ctx, store, m); err != nil {
		t.Fatalf("saveManifest: %v", err)
	}

	got, err := loadManifest(ctx, store)
	if err != nil {
		t.Fatalf("loadManifest: %v", err)
	}
	if len(got.Runs) != 1 || len(got.Runs[0].Archives) != 1 {
		t.Fatalf("unexpected manifest shape: %+v", got)
	}
	a := got.Runs[0].Archives[0]
	if a.FileID != "id-1" || a.Version != "18.0" || a.Build != "22A3351" || a.Arch != "arm64e" {
		t.Errorf("archive round-trip mismatch: %+v", a)
	}

	completed := got.completedVBAs()
	if !completed[vbaKey("18.0", "22A3351", "arm64e")] {
		t.Errorf("completedVBAs missing entry")
	}
}
