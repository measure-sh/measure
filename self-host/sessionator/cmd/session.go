package cmd

// App represents each combination of app and version
// along with its sessions and related mapping file.
type App struct {
	Name        string
	Version     string
	MappingFile string
	Sessions    []string
}

// Metrics stores certain metrics used by the program
// to keep track of progress of ingestion operations.
type Metrics struct {
	AppCount     int
	SessionCount int
	MappingCount int
}

// Resource represents the required fields used by the
// program for sending mapping files upload request.
type Resource struct {
	AppVersion  string `json:"app_version" binding:"required"`
	AppBuild    string `json:"app_build" binding:"required"`
	AppUniqueID string `json:"app_unique_id" binding:"required"`
}

// Session represents the session for parsing and reading
// certain resource fields.
type Session struct {
	SessionID string   `json:"session_id" binding:"required"`
	Resource  Resource `json:"resource" binding:"required"`
}
