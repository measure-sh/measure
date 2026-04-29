package pipeline

// Target is a resolved version that the user wants to sync,
// pointing to a concrete archive file in Google Drive.
type Target struct {
	Symbol       Symbol
	FileID       string      // Google Drive file ID of the 7z archive
	FileName     string      // archive filename (e.g., "18.1 (22B83) arm64e.7z")
	Size         int64       // archive size in bytes
	Checksum     string      // md5Checksum from Drive metadata; may be empty
	SourceFolder DriveFolder // the source folder containing this archive
}
