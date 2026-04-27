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
// During "fetching", only FileName and Phase are set (the streaming reader
// has no eager byte-progress signal). During "processing", DIFsUploaded
// and BytesUploaded are running totals — total is unknown upfront.
type FetchProgressUpdate struct {
	FileName      string
	Phase         string // "fetching" | "processing"
	DIFsUploaded  int
	BytesUploaded int64
}
