package pipeline

import "context"

// Target is a resolved version that the user wants to sync,
// pointing to a concrete archive file in Google Drive.
type Target struct {
	Symbol       Symbol
	FileID       string // Google Drive file ID of the 7z archive
	FileName     string // archive filename (e.g., "18.1 (22B83) arm64e.7z")
	Size         int64  // archive size in bytes
	SourceFolder DriveFolder // the source folder containing this archive
}

// Spotter validates user-supplied version targets against the
// catalog and resolves them to concrete archive files.
type Spotter interface {
	Spot(ctx context.Context, catalog *Catalog, versions []string) ([]Target, error)
}
