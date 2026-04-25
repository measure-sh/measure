package pipeline

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/BurntSushi/toml"
)

const manifestKey = "manifest.toml"

// ManifestArchive records the outcome of processing one .7z archive.
type ManifestArchive struct {
	FileID       string    `toml:"file_id"`
	Filename     string    `toml:"filename"`
	Version      string    `toml:"version"`
	Build        string    `toml:"build"`
	Arch         string    `toml:"arch"`
	DifsUploaded int       `toml:"difs_uploaded"`
	CompletedAt  time.Time `toml:"completed_at"`
}

// ManifestRun records one execution of the sync pipeline.
type ManifestRun struct {
	StartedAt  time.Time         `toml:"started_at"`
	FinishedAt time.Time         `toml:"finished_at,omitempty"`
	Archives   []ManifestArchive `toml:"archives"`
}

// Manifest is the full history of all sync runs, stored as manifest.toml
// at the root of the symbols bucket.
type Manifest struct {
	Runs []ManifestRun `toml:"runs"`
}

// completedVBAs returns the set of version|build|arch keys that have been
// successfully processed across all historical runs. Using VBA instead of
// file_id makes the check stable when the same archive appears under multiple
// Drive file IDs (e.g. copies in different source folders).
func (m *Manifest) completedVBAs() map[string]bool {
	vbas := make(map[string]bool)
	for _, run := range m.Runs {
		for _, a := range run.Archives {
			vbas[vbaKey(a.Version, a.Build, a.Arch)] = true
		}
	}
	return vbas
}

// loadManifest reads manifest.toml from the bucket root.
// Returns an empty Manifest on first run (object not found).
func loadManifest(ctx context.Context, store ObjectStore) (*Manifest, error) {
	data, err := store.Get(ctx, manifestKey)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return &Manifest{}, nil
		}
		return nil, fmt.Errorf("get manifest: %w", err)
	}

	var m Manifest
	if _, err := toml.Decode(string(data), &m); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}
	return &m, nil
}

// saveManifest encodes the manifest as TOML and writes it to the bucket root.
func saveManifest(ctx context.Context, store ObjectStore, m *Manifest) error {
	var buf bytes.Buffer
	if err := toml.NewEncoder(&buf).Encode(m); err != nil {
		return fmt.Errorf("encode manifest: %w", err)
	}
	if err := store.Put(ctx, manifestKey, buf.Bytes(), "application/toml"); err != nil {
		return fmt.Errorf("put manifest: %w", err)
	}
	return nil
}
