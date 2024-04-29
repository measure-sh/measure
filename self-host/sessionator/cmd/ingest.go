package cmd

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"measure-backend/measure-go/event"
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
// reads and processes the events, build info and
// mapping file(s).
var sourceDir string

// origin is the origin of the server where the program
// will send and upload events, attachments, build info
// and mapping file.
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
	ingestCmd.Flags().StringVarP(&sourceDir, "source", "s", "../session-data", "source diretory to read events from")
	ingestCmd.Flags().StringVarP(&origin, "origin", "o", "http://localhost:8080", "origin of event ingestion server")
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

// IngestSerial serially ingests batches of
// events and build of each app version.
func IngestSerial(apps *app.Apps, origin string) {
	eventURL := fmt.Sprintf("%s/events", origin)
	mappingURL := fmt.Sprintf("%s/builds", origin)

	for _, app := range apps.Items {
		fmt.Printf("%s\n", app.FullName())

		if len(app.EventFiles) < 1 {
			fmt.Printf("app %q has no events, skipping...\n", app.FullName())
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

		for i := range app.EventFiles {
			eventFile := app.EventFiles[i]
			content, err := prepareEvents(eventFile)
			if err != nil {
				log.Fatal(err)
			}
			base := filepath.Base(eventFile)
			fmt.Printf("Ingesting events %q...", base)
			reqId := base[:len(base)-len(filepath.Ext(base))]
			status, err := UploadEvents(eventURL, apiKey, reqId, content)
			if err != nil {
				if status == "" {
					status = err.Error()
				}
				fmt.Printf("🔴 %s \n", status)
				log.Fatal(err)
			}
			fmt.Printf("🟢 %s \n", status)
			metrics.bumpEvent()
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

	attribute, err := app.Attribute()
	if err != nil {
		return "", err
	}

	fw, err := w.CreateFormField("version_name")
	if err != nil {
		return "", err
	}
	fw.Write([]byte(attribute.AppVersion))

	fw, err = w.CreateFormField("version_code")
	if err != nil {
		return "", err
	}
	fw.Write([]byte(attribute.AppBuild))

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

// prepareEvents prepares request for events.
func prepareEvents(eventFile string) (data []byte, err error) {
	events := []event.EventField{}
	rawEvents := []json.RawMessage{}
	content, err := os.ReadFile(eventFile)
	if err != nil {
		return
	}
	if err := json.Unmarshal(content, &events); err != nil {
		return data, err
	}

	decoder := json.NewDecoder(bytes.NewBuffer(content))
	_, err = decoder.Token()
	if err != nil {
		return
	}
	for decoder.More() {
		var r json.RawMessage
		if err = decoder.Decode(&r); err != nil {
			return
		}
		rawEvents = append(rawEvents, r)
	}

	if len(rawEvents) != len(events) {
		err = fmt.Errorf("mismatch found in number of events while preparing events request")
		return
	}

	var buff bytes.Buffer
	w := multipart.NewWriter(&buff)
	w.SetBoundary(multipartBoundary)

	for i := range rawEvents {
		fw, err := w.CreateFormField("event")
		if err != nil {
			return data, err
		}
		fw.Write(rawEvents[i])

		if len(events[i].Attachments) < 1 {
			continue
		}

		for j := range events[i].Attachments {
			appDir := filepath.Dir(eventFile)
			id := events[i].Attachments[j].ID.String()
			filename := events[i].Attachments[j].Name
			key := `blob-` + id
			blobPath := filepath.Join(appDir, "blobs", id)
			blobFile, err := os.Open(blobPath)
			if err != nil {
				return data, err
			}
			ff, err := w.CreateFormFile(key, filename)
			if err != nil {
				return data, err
			}

			_, err = io.Copy(ff, blobFile)
			if err != nil {
				return data, err
			}
			if err := blobFile.Close(); err != nil {
				return data, err
			}
		}
	}

	data = buff.Bytes()

	return
}

// UploadEvents prepares & sends the request to upload
// events.
func UploadEvents(url, apiKey, reqId string, data []byte) (status string, err error) {
	events := []event.EventField{}
	if err := json.Unmarshal(data, &events); err != nil {
		return "", err
	}

	headers := map[string]string{
		"msr-req-id":   reqId,
		"Content-Type": fmt.Sprintf("multipart/form-data; boundary=%s", multipartBoundary),
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
	Short: "Ingest events",
	Long: `Ingest events from a local directory.

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
			fmt.Printf("event batch count: %d\n", len(app.EventFiles))
			fmt.Printf("mapping file: %s\n\n", mapping)
		}

		IngestSerial(apps, origin)

		fmt.Printf("\nSummary\n=======\n\n")

		fmt.Printf("apps: %d\n", metrics.AppCount)
		fmt.Printf("builds: %d\n", metrics.BuildCount)
		fmt.Printf("events: %d\n", metrics.EventCount)
	},
}
