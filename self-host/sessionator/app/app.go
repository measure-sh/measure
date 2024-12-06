package app

import (
	"backend/api/event"
	"backend/api/span"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sessionator/config"

	"github.com/BurntSushi/toml"
)

// App represents each combination of app and version
// along with its events and related build info.
type App struct {
	Name              string
	Version           string
	MappingFile       string
	BuildInfo         BuildInfo
	EventAndSpanFiles []string
	BlobFiles         []string
}

type EventAndSpanFileData struct {
	Events []event.EventField `json:"events"`
	Spans  []span.SpanField   `json:"spans"`
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

// Attribute provides the event attribute from the first
// event of the app.
func (a *App) Attribute() (attribute *event.Attribute, err error) {
	content, err := os.ReadFile(a.EventAndSpanFiles[0])
	if err != nil {
		return nil, err
	}

	fileData := EventAndSpanFileData{}

	if err := json.Unmarshal(content, &fileData); err != nil {
		fmt.Println("goo 0")
		return nil, err
	}

	if len(fileData.Events) > 0 {
		attribute = &fileData.Events[0].Attribute
	} else if len(fileData.Spans) > 0 {
		spanAttr := fileData.Spans[0].Attributes

		attribute = &event.Attribute{
			InstallationID:     spanAttr.InstallationID,
			AppVersion:         spanAttr.AppVersion,
			AppBuild:           spanAttr.AppBuild,
			AppUniqueID:        spanAttr.AppUniqueID,
			MeasureSDKVersion:  spanAttr.MeasureSDKVersion,
			Platform:           spanAttr.Platform,
			ThreadName:         spanAttr.ThreadName,
			UserID:             spanAttr.UserID,
			DeviceName:         spanAttr.DeviceName,
			DeviceModel:        spanAttr.DeviceModel,
			DeviceManufacturer: spanAttr.DeviceManufacturer,
			DeviceLocale:       spanAttr.DeviceLocale,
			OSName:             spanAttr.OSName,
			OSVersion:          spanAttr.OSVersion,
			NetworkType:        spanAttr.NetworkType,
			NetworkProvider:    spanAttr.NetworkProvider,
			NetworkGeneration:  spanAttr.NetworkGeneration,
		}
	} else {
		return nil, fmt.Errorf("no events or spans found to fetch attributes")
	}

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

// Lookup looks up the app by name and version
// and returns from the collection.
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
