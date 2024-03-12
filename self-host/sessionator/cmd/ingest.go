package cmd

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sessionator/config"
	"strings"

	"github.com/spf13/cobra"
)

// multipartBoundary is the boundary used for
// multipart upload mapping file request.
const multipartBoundary = "___sessionator___"

// sourceDir is the source directory where the program
// reads and processes the sessions, build info and
// mapping file.
var sourceDir string

// origin is the origin of the server where the program
// will send and upload sessions, build info and
// mapping file.
var origin string

// configLocation is the path to the `config.toml` file
// containing each app's details and their api keys.
var configLocation string

// configData holds the parsed configuration data from
// `config.toml` file.
var configData *config.Config

// bumpBuild bumps the build count of
// Metrics.
func (m *Metrics) bumpBuild() {
	m.BuildCount = m.BuildCount + 1
}

// bumpSession bumps the session count of
// Metrics.
func (m *Metrics) bumpSession() {
	m.SessionCount = m.SessionCount + 1
}

// setAppCount sets the count of the number
// of apps the program processes.
func (m *Metrics) setAppCount(c int) {
	m.AppCount = c
}

var apps []*App
var metrics Metrics

func init() {
	ingestCmd.Flags().StringVarP(&sourceDir, "source", "s", "../session-data", "source diretory to read sessions from")
	ingestCmd.Flags().StringVarP(&origin, "origin", "o", "http://localhost:8080", "origin of session ingestion server")
	ingestCmd.Flags().StringVarP(&configLocation, "config", "c", "../session-data/config.toml", "location to config.toml file")
	rootCmd.AddCommand(ingestCmd)
}

// NewApp creates an empty app and returns
// a pointer to it.
func NewApp() *App {
	var app App
	return &app
}

// ValidateFlags validates the commmand line
// flags
func ValidateFlags() bool {
	fileInfo, err := os.Stat(sourceDir)
	if err != nil {
		log.Fatal(err)
	}

	if !fileInfo.IsDir() {
		fmt.Printf("%q is not a valid directory path\n", sourceDir)
		return false
	}

	return true
}

// FileExists silently asserts that the
// underlying file exists on disk.
func FileExists(path string) bool {
	_, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false
		} else {
			log.Fatal(err)
		}
	}

	return true
}

// getMappingMeta reads & returns the resource object
// from the first session of app.
func getMappingMeta(a *App) *Resource {
	sessionFile := a.Sessions[0]
	content, err := os.ReadFile(sessionFile)
	if err != nil {
		log.Fatal(err)
	}

	session := &Session{}

	if err := json.Unmarshal(content, session); err != nil {
		log.Fatal(err)
	}

	return &session.Resource
}

// IngestSerial serially ingests each session and
// build of each app version.
func IngestSerial(origin string) {
	sessionURL := fmt.Sprintf("%s/sessions", origin)
	mappingURL := fmt.Sprintf("%s/builds", origin)
	for i := range apps {
		app := apps[i]

		fmt.Printf("app: %s:%s\n", app.Name, app.Version)

		if len(app.Sessions) < 1 {
			fmt.Printf("app \"%s:%s\" has no sessions, skipping...\n", app.Name, app.Version)
			continue
		}

		apiKey := configData.Apps[app.Name].ApiKey

		if app.MappingFile != "" {
			resource := getMappingMeta(app)
			base := filepath.Base(app.MappingFile)
			fmt.Printf("Uploading build info %q... ", base)
			status, err := UploadBuild(mappingURL, apiKey, app, resource)
			if err != nil {
				fmt.Printf("🔴 %s \n", status)
				log.Fatal(err)
			}

			fmt.Printf("🟢 %s \n", status)
		}

		for j := range app.Sessions {
			session := app.Sessions[j]
			content, err := os.ReadFile(session)
			if err != nil {
				log.Fatal(err)
			}
			base := filepath.Base(session)
			fmt.Printf("Ingesting session file %q... ", base)
			status, err := UploadSession(sessionURL, apiKey, content)
			if err != nil {
				fmt.Printf("🔴 %s \n", status)
				log.Fatal(err)
			}
			fmt.Printf("🟢 %s \n", status)
		}

		fmt.Printf("\n")
	}
}

// UploadBuild prepares & sends the request to
// upload mapping file & build info.
func UploadBuild(url, apiKey string, app *App, resource *Resource) (string, error) {
	var buff bytes.Buffer
	w := multipart.NewWriter(&buff)
	w.SetBoundary(multipartBoundary)

	f, err := os.Open(app.MappingFile)
	if err != nil {
		return "", err
	}

	fw, err := w.CreateFormField("version_name")
	if err != nil {
		return "", err
	}
	fw.Write([]byte(resource.AppVersion))

	fw, err = w.CreateFormField("version_code")
	if err != nil {
		return "", err
	}
	fw.Write([]byte(resource.AppBuild))

	fw, err = w.CreateFormFile("mapping_file", filepath.Base(app.MappingFile))
	if err != nil {
		return "", err
	}
	io.Copy(fw, f)

	fw, err = w.CreateFormField("mapping_type")
	if err != nil {
		return "", err
	}
	fw.Write([]byte("proguard"))

	fw, err = w.CreateFormField("build_size")
	if err != nil {
		return "", err
	}
	fw.Write([]byte(app.BuildInfo.GetSize()))

	fw, err = w.CreateFormField("build_type")
	if err != nil {
		return "", err
	}
	fw.Write([]byte(app.BuildInfo.Type))

	w.Close()

	req, err := http.NewRequest("PUT", url, &buff)
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", multipartBoundary))
	req.Header.Set("User-Agent", "sessionator")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}

	if resp.StatusCode > 399 {
		return resp.Status, errors.New("failed to upload build info")
	}

	defer resp.Body.Close()

	return resp.Status, nil
}

// UploadSession prepares & sends the request to upload
// session files.
func UploadSession(url, apiKey string, data []byte) (string, error) {
	reader := bytes.NewReader(data)
	req, err := http.NewRequest("PUT", url, reader)
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "sessionator")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	if resp.StatusCode > 399 {
		errorBody, errRead := io.ReadAll(resp.Body)
		if errRead != nil {
			return resp.Status, errors.New("failed to ingest session")
		}
		return resp.Status, errors.New("failed to ingest session: " + string(errorBody))
	}

	return resp.Status, nil
}

// Setup reads source directory and sets up everything
// for successfully uploading sessions and builds.
func Setup(dir string) {
	fmt.Printf("reading session data from %q\n", dir)
	fsys := os.DirFS(dir)
	sessionFiles, err := fs.Glob(fsys, "**/**/*.json")
	if err != nil {
		log.Fatal(err)
	}

	var app = NewApp()

	for i := range sessionFiles {
		parts := strings.Split(sessionFiles[i], string(os.PathSeparator))
		name := parts[0]
		version := parts[1]

		configApp := configData.Apps[name]

		if configApp.ApiKey == "" {
			log.Fatalf("api key not found for app %q. please update config at %q", name, configLocation)
		}

		if name != app.Name || version != app.Version {
			app = NewApp()
			app.Name = name
			app.Version = version
			mappingPath := filepath.Join(dir, app.Name, app.Version, "mapping.txt")
			buildPath := filepath.Join(dir, app.Name, app.Version, "build.toml")
			if FileExists(mappingPath) && FileExists(buildPath) {
				app.MappingFile = mappingPath
				if err := app.ReadBuild(buildPath); err != nil {
					log.Fatalf(`failed to read build info %q for app %q with err: %v`, buildPath, app.FullName(), err)
				}
				metrics.bumpBuild()
			} else {
				log.Fatalf(`could not read build info for app %q`, app.FullName())
			}

			app.Sessions = append(app.Sessions, filepath.Join(dir, sessionFiles[i]))
			metrics.bumpSession()
			apps = append(apps, app)
		} else {
			app.Sessions = append(app.Sessions, filepath.Join(dir, sessionFiles[i]))
			metrics.bumpSession()
		}
	}

	metrics.setAppCount(len(apps))
}

var ingestCmd = &cobra.Command{
	Use:   "ingest",
	Short: "Ingest sessions",
	Long: `Ingest sessions from a local directory.

Structure of "session-data" directory:

+ root
- foo						# app name dir
  - 1.2.3					# app version dir
    - 04cc1c6d-853b-4926-8d04-4501965a8d5e.json	# session json file
    - 7e2f676c-8604-4dd0-b5d8-3669e333f714.json # session json file
    - mapping.txt				# mapping file
	- build.toml				# build info
- bar						# app name dir
  - 4.5.6					# app version dir
    - e2f676c-8604-4dd0-b5d8-3669e333f714.json	# session json file
    - 55300a74-ba16-4e62-a699-0cd41f5e43c0.json	# session json file
    - mapping.txt				# mapping file
	- build.toml				# build info`,
	Run: func(cmd *cobra.Command, args []string) {
		sourceDir, err := filepath.Abs(filepath.Clean(sourceDir))
		if err != nil {
			log.Fatal(err)
		}

		if !ValidateFlags() {
			os.Exit(1)
		}

		configData, err = config.Init(configLocation)
		if err != nil {
			log.Fatal(err)
		}

		Setup(sourceDir)

		// log info about parsed apps
		fmt.Printf("number of apps: %d\n\n", len(apps))

		for i := range apps {
			mapping := "not found"
			if apps[i].MappingFile != "" {
				mapping = "found"
			}
			fmt.Printf("app %d: %s:%s\n", i+1, apps[i].Name, apps[i].Version)
			fmt.Printf("session count: %d\n", len(apps[i].Sessions))
			fmt.Printf("mapping file: %s\n\n", mapping)
		}

		IngestSerial(origin)

		fmt.Printf("\nSummary\n=======\n\n")

		fmt.Printf("apps: %d\n", metrics.AppCount)
		fmt.Printf("builds: %d\n", metrics.BuildCount)
		fmt.Printf("sessions: %d\n", metrics.SessionCount)
	},
}
