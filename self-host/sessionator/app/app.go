package app

import (
	"backend/api/event"
	"backend/api/opsys"
	"backend/api/span"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sessionator/config"
	"slices"
	"sort"
	"strconv"

	"github.com/BurntSushi/toml"
	"github.com/blang/semver/v4"
)

type Build struct {
	VersionCode  string
	MappingTypes []string
	MappingFiles []string
	BuildInfo    BuildInfo
}

// App represents each combination of app and version
// along with its events and related build info.
type App struct {
	Name              string
	VersionName       string
	Builds            map[string]*Build
	EventAndSpanFiles []string
	BlobFiles         []string
}

type EventAndSpanFileData struct {
	Events []event.EventField `json:"events"`
	Spans  []span.SpanField   `json:"spans"`
}

// ReadBuild decodes and parses build info data
// from build configuration file.
func (a *App) ReadBuild(path string, target any) error {
	_, err := toml.DecodeFile(path, target)
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
	return a.Name + ":" + a.VersionName
}

// Validate checks if app's data and builds
// are valid.
func (a App) Validate() (ok bool, err error) {
	// events and/or spans should not be empty
	if len(a.EventAndSpanFiles) < 1 {
		ok = false
		err = fmt.Errorf(`app %q has zero event and span files. make sure the directory is not empty.`, a.FullName())
		return
	}

	attribute, err := a.Attribute()
	if err != nil {
		return
	}

	switch opsys.ToFamily(attribute.OSName) {
	case opsys.Android:
		codes := []int{}

		for code := range a.Builds {
			codeNum, erri := strconv.Atoi(code)
			if erri != nil {
				err = erri
				return
			}
			codes = append(codes, codeNum)
		}

		slices.Sort(codes)

		// Android app version codes should be in
		// increasing order.
		// Although, slices.IsSorted/slices.IsSortedFunc are better
		// functions implemented using generics, unfortunately those
		// functions do not assert strictness. We need to assert
		// strict increasing order here.
		if !sort.SliceIsSorted(codes, func(i, j int) bool {
			return codes[i] < codes[j]
		}) {
			err = errors.New("Android version codes must be in increasing order")
			return
		}
	case opsys.AppleFamily:
	default:
		err = fmt.Errorf("Unknown %q detected in app - %q's os_name attribute", attribute.OSName, a.FullName())
		return
	}

	ok = true

	return
}

// Apps is a collection of apps.
type Apps struct {
	index map[[2]string]int
	Items []App
}

// Add adds a new app to the apps collection.
func (apps *Apps) Add(name, version string) {
	app := App{
		Name:        name,
		VersionName: version,
		Builds:      make(map[string]*Build),
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
	appleAppVersions := make(map[string][]semver.Version)

	for _, app := range apps.Items {
		if config.Apps[app.Name].ApiKey == "" {
			err = fmt.Errorf("api key not found for %q. check build config.", app.Name)
			break
		}

		ok, err := app.Validate()
		if err != nil {
			return err
		}

		if !ok {
			err = fmt.Errorf("Validation failed for app %q", app.Name)
			break
		}

		attribute, err := app.Attribute()
		if err != nil {
			return err
		}

		if opsys.ToFamily(attribute.OSName) == opsys.AppleFamily {
			version, err := semver.New(app.VersionName)
			if err != nil {
				return err
			}
			appleAppVersions[app.Name] = append(appleAppVersions[app.Name], *version)
			semver.Sort(appleAppVersions[app.Name])

			// Apple app version names should be in
			// semver increasing order.
			// Although, slices.IsSorted/slices.IsSortedFunc are better
			// functions implemented using generics, unfortunately those
			// functions do not assert strictness. We need to assert
			// strict increasing order here.
			if !sort.SliceIsSorted(appleAppVersions[app.Name], func(i, j int) bool {
				return appleAppVersions[app.Name][i].LT(appleAppVersions[app.Name][j])
			}) {
				err = errors.New("Apple version codes must be in increasing order")
				return err
			}
		}
	}

	return
}
