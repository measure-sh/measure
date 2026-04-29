package pipeline

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/BurntSushi/toml"
	"golang.org/x/sync/errgroup"
)

const (
	// archivesPrefix holds one TOML file per archive entry.
	archivesPrefix = "manifest/archives/"
	// runsPrefix holds one TOML audit log per sync run.
	runsPrefix = "manifest/runs/"
	// manifestLoadConcurrency caps parallel Get calls when listing archives.
	manifestLoadConcurrency = 16
)

// ArchiveEntry is the per-archive record persisted under archivesPrefix.
// It is the source of truth for "have we synced (V,B,A,C)?" and the data
// the janitor needs to clean up DIFs.
type ArchiveEntry struct {
	FileID       string    `toml:"file_id"`
	Filename     string    `toml:"filename"`
	Version      string    `toml:"version"`
	Build        string    `toml:"build"`
	Arch         string    `toml:"arch"`
	Checksum     string    `toml:"checksum,omitempty"`
	DebugIDs     []string  `toml:"debug_ids"`
	DIFsUploaded int       `toml:"difs_uploaded"`
	CompletedAt  time.Time `toml:"completed_at"`
	DeletedAt    time.Time `toml:"deleted_at,omitempty"`
}

// Active reports whether the entry is not soft-deleted.
func (e ArchiveEntry) Active() bool { return e.DeletedAt.IsZero() }

// VBAC returns the version|build|arch|checksum identifier.
func (e ArchiveEntry) VBAC() string {
	return joinVBAC(e.Version, e.Build, e.Arch, e.Checksum)
}

// ObjectKey returns the bucket key for this entry's TOML file.
func (e ArchiveEntry) ObjectKey() string {
	return archivesPrefix + e.VBAC() + ".toml"
}

// Ref returns an ArchiveRef pointing at this entry.
func (e ArchiveEntry) Ref() ArchiveRef {
	return ArchiveRef{
		Version:  e.Version,
		Build:    e.Build,
		Arch:     e.Arch,
		Checksum: e.Checksum,
		Filename: e.Filename,
	}
}

// ArchiveRef is a lightweight pointer to an archive used in run audit logs.
type ArchiveRef struct {
	Version  string `toml:"version"`
	Build    string `toml:"build"`
	Arch     string `toml:"arch"`
	Checksum string `toml:"checksum,omitempty"`
	Filename string `toml:"filename"`
}

// VBAC returns the version|build|arch|checksum identifier matching ArchiveEntry.VBAC.
func (r ArchiveRef) VBAC() string {
	return joinVBAC(r.Version, r.Build, r.Arch, r.Checksum)
}

func joinVBAC(version, build, arch, checksum string) string {
	return fmt.Sprintf("%s_%s_%s_%s", version, build, arch, checksum)
}

// Manifest is the in-memory view of all archive entries in the bucket.
type Manifest struct {
	Archives []ArchiveEntry
}

// IsCompleted reports whether (version, build, arch, checksum) was uploaded
// in any prior run and is still active (not soft-deleted). Empty Checksum on
// the manifest entry matches any checksum on the same VBA — preserved for
// transitional entries where a download lacked an md5Checksum from Drive.
func (m *Manifest) IsCompleted(version, build, arch, checksum string) bool {
	for _, e := range m.Archives {
		if !e.Active() {
			continue
		}
		if e.Version != version || e.Build != build || e.Arch != arch {
			continue
		}
		if e.Checksum == "" || e.Checksum == checksum {
			return true
		}
	}
	return false
}

// LoadManifest lists every archive index file under archivesPrefix and
// fetches them in parallel, returning the assembled in-memory Manifest.
// An empty bucket yields an empty Manifest (no error).
func LoadManifest(ctx context.Context, store ObjectStore) (*Manifest, error) {
	keys, err := store.List(ctx, archivesPrefix)
	if err != nil {
		return nil, fmt.Errorf("list manifest archives: %w", err)
	}
	if len(keys) == 0 {
		return &Manifest{}, nil
	}

	entries := make([]ArchiveEntry, len(keys))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(manifestLoadConcurrency)
	for i, key := range keys {
		i, key := i, key
		g.Go(func() error {
			data, err := store.Get(gctx, key)
			if err != nil {
				return fmt.Errorf("get %s: %w", key, err)
			}
			var e ArchiveEntry
			if _, err := toml.Decode(string(data), &e); err != nil {
				return fmt.Errorf("decode %s: %w", key, err)
			}
			entries[i] = e
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].CompletedAt.Before(entries[j].CompletedAt)
	})
	return &Manifest{Archives: entries}, nil
}

// SaveArchiveEntry encodes the entry and writes it to its index key.
func SaveArchiveEntry(ctx context.Context, store ObjectStore, e ArchiveEntry) error {
	var buf bytes.Buffer
	if err := toml.NewEncoder(&buf).Encode(e); err != nil {
		return fmt.Errorf("encode entry %s: %w", e.VBAC(), err)
	}
	body := bytes.NewReader(buf.Bytes())
	if err := store.Put(ctx, e.ObjectKey(), body, int64(buf.Len()), "application/toml"); err != nil {
		return fmt.Errorf("put entry %s: %w", e.VBAC(), err)
	}
	return nil
}

// upsertArchive merges newEntry into m.Archives by VBAC: if an active entry
// with the same VBAC exists, it is replaced; otherwise the entry is appended.
// Used by the fetcher and janitor to keep the in-memory manifest aligned
// with what was just persisted to the bucket.
func (m *Manifest) upsertArchive(newEntry ArchiveEntry) {
	for i := range m.Archives {
		if m.Archives[i].VBAC() == newEntry.VBAC() {
			m.Archives[i] = newEntry
			return
		}
	}
	m.Archives = append(m.Archives, newEntry)
}

// upsertGuard guards Manifest.upsertArchive against concurrent fetcher writes.
type upsertGuard struct {
	mu sync.Mutex
	m  *Manifest
}

func (u *upsertGuard) upsert(e ArchiveEntry) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.m.upsertArchive(e)
}

// RunRecord is the per-run audit log written to runsPrefix at end of run.
type RunRecord struct {
	RunID           string       `toml:"run_id"`
	StartedAt       time.Time    `toml:"started_at"`
	FinishedAt      time.Time    `toml:"finished_at,omitempty"`
	ArchivesAdded   []ArchiveRef `toml:"archives_added,omitempty"`
	ArchivesDeleted []ArchiveRef `toml:"archives_deleted,omitempty"`
}

// NewRunID formats a filesystem- and URL-safe identifier from t.
func NewRunID(t time.Time) string {
	return strings.ReplaceAll(t.UTC().Format(time.RFC3339), ":", "-")
}

// SaveRunRecord writes the audit log for a run.
func SaveRunRecord(ctx context.Context, store ObjectStore, r RunRecord) error {
	var buf bytes.Buffer
	if err := toml.NewEncoder(&buf).Encode(r); err != nil {
		return fmt.Errorf("encode run record %s: %w", r.RunID, err)
	}
	key := runsPrefix + r.RunID + ".toml"
	body := bytes.NewReader(buf.Bytes())
	if err := store.Put(ctx, key, body, int64(buf.Len()), "application/toml"); err != nil {
		return fmt.Errorf("put run record: %w", err)
	}
	return nil
}
