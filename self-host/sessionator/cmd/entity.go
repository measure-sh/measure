package cmd

import (
	"github.com/BurntSushi/toml"
)

// App represents each combination of app and version
// along with its sessions and related build info.
type App struct {
	Name        string
	Version     string
	MappingFile string
	BuildInfo   BuildInfo
	Sessions    []string
}

// ReadBuild decodes and parses build info data
// from build configuration file.
func (a *App) ReadBuild(path string) error {
	_, err := toml.DecodeFile(path, &a.BuildInfo)
	if err != nil {
		return err
	}
	return nil
}

// FullName returns the app's name along with its
// version.
func (a App) FullName() string {
	return a.Name + ":" + a.Version
}

// Metrics stores certain metrics used by the program
// to keep track of progress of ingestion operations.
type Metrics struct {
	AppCount     int
	SessionCount int
	BuildCount   int
}

// Resource represents the required fields used by the
// program for sending build info with the request.
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
