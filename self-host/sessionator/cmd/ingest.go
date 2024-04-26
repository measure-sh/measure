package cmd

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sessionator/app"
	"sessionator/config"

	"github.com/spf13/cobra"
)

// multipartBoundary is the boundary used for
// multipart upload mapping file request.
const multipartBoundary = "___sessionator___"

// sourceDir is the source directory where the program
// reads and processes the sessions, build info and
// mapping file(s).
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

// metrics is used to store progress of ingestion
// operations.
var metrics Metrics

func init() {
	ingestCmd.Flags().StringVarP(&sourceDir, "source", "s", "../session-data", "source diretory to read sessions from")
	ingestCmd.Flags().StringVarP(&origin, "origin", "o", "http://localhost:8080", "origin of session ingestion server")
	ingestCmd.Flags().StringVarP(&configLocation, "config", "c", "../session-data/config.toml", "location to config.toml file")
	rootCmd.AddCommand(ingestCmd)
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

// IngestSerial serially ingests each session and
// build of each app version.
func IngestSerial(apps *app.Apps, origin string) {
	sessionURL := fmt.Sprintf("%s/sessions", origin)
	mappingURL := fmt.Sprintf("%s/builds", origin)

	for _, app := range apps.Items {
		fmt.Printf("%s\n", app.FullName())

		if len(app.Sessions) < 1 {
			fmt.Printf("app %q has no sessions, skipping...\n", app.FullName())
			continue
		}

		apiKey := configData.Apps[app.Name].ApiKey

		fmt.Printf("Uploading build info... ")
		status, err := UploadBuild(mappingURL, apiKey, app)
		if err != nil {
			if status == "" {
				status = err.Error()
			}
			fmt.Printf("🔴 %s \n", status)
			log.Fatal(err)
		}

		fmt.Printf("🟢 %s \n", status)
		metrics.bumpBuild()

		for j := range app.Sessions {
			session := app.Sessions[j]
			content, err := os.ReadFile(session)
			if err != nil {
				log.Fatal(err)
			}
			base := filepath.Base(session)
			fmt.Printf("Ingesting session %q... ", base)
			status, err := UploadSession(sessionURL, apiKey, content)
			if err != nil {
				if status == "" {
					status = err.Error()
				}
				fmt.Printf("🔴 %s \n", status)
				log.Fatal(err)
			}
			fmt.Printf("🟢 %s \n", status)
			metrics.bumpSession()
		}

		fmt.Printf("\n")
		metrics.bumpApp()
	}
}

// UploadBuild prepares & sends the request to
// upload mapping file & build info.
func UploadBuild(url, apiKey string, app app.App) (string, error) {
	var buff bytes.Buffer
	w := multipart.NewWriter(&buff)
	w.SetBoundary(multipartBoundary)

	resource, err := app.Resource()
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

	if app.MappingFile != "" {
		f, err := os.Open(app.MappingFile)
		if err != nil {
			return "", err
		}

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
	}

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

	headers := map[string]string{
		"Content-Type": fmt.Sprintf("multipart/form-data; boundary=%s", multipartBoundary),
	}

	return sendRequest(url, apiKey, headers, buff.Bytes())
}

// UploadSession prepares & sends the request to upload
// session files.
func UploadSession(url, apiKey string, data []byte) (string, error) {
	headers := map[string]string{
		"Content-Type": "application/json",
	}

	return sendRequest(url, apiKey, headers, data)
}

// sendRequest prepares a request and sends a put
// request to the given url.
func sendRequest(url, apiKey string, headers map[string]string, data []byte) (status string, err error) {
	reader := bytes.NewReader(data)
	req, err := http.NewRequest("PUT", url, reader)
	if err != nil {
		return
	}

	req.Header.Set("User-Agent", "sessionator")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	for key, value := range headers {
		if key != "" && value != "" {
			req.Header.Set(key, value)
		}
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}

	defer resp.Body.Close()
	status = resp.Status

	if resp.StatusCode > 399 {
		errorBody, errRead := io.ReadAll(resp.Body)
		if errRead != nil {
			err = errRead
			return
		}
		if len(errorBody) > 0 {
			err = errors.New(string(errorBody))
		} else {
			err = errors.New(`request failed with no content`)
		}
		return
	}

	return
}

var ingestCmd = &cobra.Command{
	Use:   "ingest",
	Short: "Ingest sessions",
	Long: `Ingest sessions from a local directory.

Structure of "session-data" directory:` + "\n" + DirTree() + "\n" + ValidNote(),
	Run: func(cmd *cobra.Command, args []string) {
		sourceDir, err := filepath.Abs(filepath.Clean(sourceDir))
		if err != nil {
			log.Fatal(err)
		}

		if !ValidateFlags() {
			os.Exit(1)
		}

		apps, err := app.Scan(sourceDir)
		if err != nil {
			fmt.Println(err.Error())
			os.Exit(1)
		}

		configData, err = config.Init(configLocation)
		if err != nil {
			log.Fatal(err)
		}

		if err := apps.ValidateConfig(configData); err != nil {
			log.Fatal(err)
		}

		// log info about parsed apps
		fmt.Printf("number of apps: %d\n\n", len(apps.Items))

		for i, app := range apps.Items {
			mapping := "not found"
			if app.MappingFile != "" {
				mapping = "found"
			}
			fmt.Printf("app (%d): %s\n", i+1, app.FullName())
			fmt.Printf("session count: %d\n", len(app.Sessions))
			fmt.Printf("mapping file: %s\n\n", mapping)
		}

		IngestSerial(apps, origin)

		fmt.Printf("\nSummary\n=======\n\n")

		fmt.Printf("apps: %d\n", metrics.AppCount)
		fmt.Printf("builds: %d\n", metrics.BuildCount)
		fmt.Printf("sessions: %d\n", metrics.SessionCount)
	},
}
