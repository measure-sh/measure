package pipeline

// FetchResult records the outcome of fetching a single archive.
type FetchResult struct {
	Target        Target
	DIFsUploaded  int
	DebugIDs      []string
	BytesFetched  int64
	BytesUploaded int64
	Err           error
}

// FetchProgressUpdate reports the current phase of an in-flight archive.
// During "downloading", BytesDone and BytesTotal are populated.
// During "processing", DIFsUploaded and BytesUploaded are running totals (total unknown upfront).
type FetchProgressUpdate struct {
	FileName      string
	Phase         string // "downloading" | "processing"
	BytesDone     int64
	BytesTotal    int64
	DIFsUploaded  int
	BytesUploaded int64
}
