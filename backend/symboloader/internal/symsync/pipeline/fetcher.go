package pipeline

import "context"

// FetchResult records the outcome of fetching a single archive.
type FetchResult struct {
	Target       Target
	DifsUploaded int
	BytesFetched int64
	Err          error
}

// Fetcher downloads archives from Google Drive, extracts binaries,
// creates DIFs, and uploads them to the configured object store.
type Fetcher interface {
	Fetch(ctx context.Context, plan *Plan, progress chan<- FetchResult) error
}
