package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sessionator/config"

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

// Resource provides the session resource from the first
// session of the app.
func (a *App) Resource() (resource *Resource, err error) {
	content, err := os.ReadFile(a.Sessions[0])
	if err != nil {
		return nil, err
	}

	session := &Session{}

	if err := json.Unmarshal(content, session); err != nil {
		return nil, err
	}

	resource = &session.Resource
	return
}

// FullName returns the app's name along with its
// version.
func (a App) FullName() string {
	return a.Name + ":" + a.Version
}

// Apps is a collection of apps.
type Apps struct {
	index map[[2]string]int
	Items []App
}

// Add adds a new app to the apps collection.
func (apps *Apps) Add(name, version string) {
	app := App{
		Name:    name,
		Version: version,
	}

	if apps.index == nil {
		apps.index = map[[2]string]int{}
	}

	apps.Items = append(apps.Items, app)
	apps.index[[2]string{name, version}] = len(apps.Items) - 1
}

// Lookup looks up the app by name and
// returns from the collection.
func (apps *Apps) Lookup(name, version string) *App {
	index := apps.index[[2]string{name, version}]
	return &apps.Items[index]
}

// ValidateConfig validates sessionator configuration against
// all the scanned apps.
func (apps *Apps) ValidateConfig(config *config.Config) (err error) {
	for _, app := range apps.Items {
		if config.Apps[app.Name].ApiKey == "" {
			msg := fmt.Sprintf("api key not found for %q. check build config.", app.Name)
			err = errors.New(msg)
			break
		}
	}

	return err
}
