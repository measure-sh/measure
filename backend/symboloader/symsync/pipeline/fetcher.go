package pipeline

import "context"

// FetchResult records the outcome of fetching a single archive.
type FetchResult struct {
	Target        Target
	DifsUploaded  int
	BytesFetched  int64
	BytesUploaded int64
	Err           error
}

// FetchProgressUpdate reports the current phase of an in-flight archive.
// During "downloading", BytesDone and BytesTotal are populated.
// During "processing", DifsUploaded and BytesUploaded are running totals (total unknown upfront).
type FetchProgressUpdate struct {
	FileName      string
	Phase         string // "downloading" | "processing"
	BytesDone     int64
	BytesTotal    int64
	DifsUploaded  int
	BytesUploaded int64
}

// Fetcher downloads archives from Google Drive, extracts binaries,
// creates DIFs, and uploads them to the configured object store.
type Fetcher interface {
	Fetch(ctx context.Context, plan *Plan, progress chan<- FetchResult) error
}
