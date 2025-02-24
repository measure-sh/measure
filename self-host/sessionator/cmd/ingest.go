package cmd

import (
	"backend/api/codec"
	"backend/api/platform"
	"bytes"
	"encoding/json"
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
	"sync"
	"time"

	"github.com/google/uuid"
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

// clean if true is used to remove data for matching
// apps in config.
var clean bool

// cleanAll if true is used to clear all the data.
var cleanAll bool

// dryRun is used to simulate ingestion.
var dryRun bool

// frequency is used to control frequency of virtual
// event batch ingestion.
var frequency uint

// duration is used to control the total
// duration for virtual event batch ingestion.
var duration time.Duration

// parallel is used to enable virtualization.
var parallel bool

// skipApps is used to skip processing
// of specified apps.
var skipApps []string

// metrics is used to store progress of ingestion
// operations.
var metrics Metrics

func init() {
	ingestCmd.
		Flags().
		StringVarP(&sourceDir, "source", "s", "../session-data", "source directory to read events from")

	ingestCmd.
		Flags().
		StringVarP(&origin, "origin", "o", "http://localhost:8080", "origin of event ingestion server")

	ingestCmd.
		Flags().
		StringVarP(&configLocation, "config", "c", "../session-data/config.toml", "location to config.toml")

	ingestCmd.
		Flags().
		UintVarP(&frequency, "frequency", "f", 1, "frequency of virtual ingestion. greater numbers consume more system resources.")

	ingestCmd.
		Flags().
		DurationVarP(&duration, "duration", "d", time.Minute*0, "duration of virutal ingestion")

	ingestCmd.
		Flags().
		BoolVarP(&dryRun, "dry-run", "n", false, "when true, all write operations are simulated")

	ingestCmd.
		Flags().
		BoolVarP(&clean, "clean", "x", false, "remove builds, events & attachments for configured apps before ingestion")

	ingestCmd.
		Flags().
		BoolVarP(&cleanAll, "clean-all", "X", false, "remove all builds, events & attachments before ingestion")

	ingestCmd.
		Flags().
		StringSliceVar(&skipApps, "skip-apps", nil, "list of apps to skip ingestion")

	ingestCmd.Flags().SortFlags = false
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

	if frequency > 1 {
		parallel = true
	}

	if duration < 1*time.Minute {
		parallel = false
	}

	return true
}

// IngestSerial serially ingests batches of
// events and build of each app version.
func IngestSerial(apps *app.Apps, origin string) {
	startTime := time.Now()
	eventURL := fmt.Sprintf("%s/events", origin)
	buildURL := fmt.Sprintf("%s/builds", origin)
	virtualizer := NewVirtualizer()

	for _, app := range apps.Items {
		fmt.Printf("Processing %q\n", app.FullName())

		if len(app.EventAndSpanFiles) < 1 {
			fmt.Println("No event and span files found, skipping...")
			continue
		}

		apiKey := configData.Apps[app.Name].ApiKey

		fmt.Printf("Uploading build info...")
		status, err := UploadBuilds(buildURL, apiKey, app)
		if err != nil {
			if status == "" {
				status = err.Error()
			}
			fmt.Printf("🔴 %s \n", status)
			log.Fatal(err)
		}

		fmt.Printf("🟢 %s \n", status)
		metrics.bumpBuild()

		for i := range app.EventAndSpanFiles {
			eventAndSpanFile := app.EventAndSpanFiles[i]
			content, eventCount, spanCount, err := prepareEventsAndSpans(eventAndSpanFile, virtualizer)
			if err != nil {
				log.Fatal(err)
			}
			base := filepath.Base(eventAndSpanFile)
			fmt.Printf("%3d) Ingesting events and spans %q...", i+1, base)
			reqId := base[:len(base)-len(filepath.Ext(base))]
			status, err := UploadEventsAndSpans(eventURL, apiKey, reqId, content)
			if err != nil {
				if status == "" {
					status = err.Error()
				}
				fmt.Printf("🔴 %s \n", status)
				log.Fatal(err)
			}
			fmt.Printf("🟢 %s \n", status)
			metrics.bumpEventAndSpanFile()
			metrics.bumpEvent(eventCount)
			metrics.bumpSpan(spanCount)
		}

		fmt.Printf("\n")
		metrics.bumpApp()
	}

	metrics.setIngestDuration(time.Since(startTime))
}

// IngestParallel repeteadly ingests batches of
// events and build of each app version.
func IngestParallel(apps *app.Apps, origin string) {
	startTime := time.Now()
	eventURL := fmt.Sprintf("%s/events", origin)
	buildURL := fmt.Sprintf("%s/builds", origin)

	var logResults = func(results *[]string) {
		for _, result := range *results {
			fmt.Print(result)
		}
		results = nil
	}

	for _, app := range apps.Items {
		fmt.Printf("Processing %q\n", app.FullName())

		if len(app.EventAndSpanFiles) < 1 {
			fmt.Println("No event and span files found, skipping...")
			continue
		}

		apiKey := configData.Apps[app.Name].ApiKey

		fmt.Printf("Uploading build info...")
		status, err := UploadBuilds(buildURL, apiKey, app)
		if err != nil {
			if status == "" {
				status = err.Error()
			}
			fmt.Printf("🔴 %s \n", status)
			log.Fatal(err)
		}

		fmt.Printf("🟢 %s \n", status)
		metrics.bumpBuild()

		count := int(frequency)
		done := make(chan struct{})
		timeout := duration / time.Duration(len(apps.Items))
		var wg sync.WaitGroup

		time.AfterFunc(timeout, func() {
			close(done)
		})

		for i := 0; i < count; i += 1 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				select {
				case <-done:
					fmt.Println("Timeout, exiting.")
					return
				default:
					virtualizer := NewVirtualizer().Event().Session()
					for j := range app.EventAndSpanFiles {
						results := []string{}
						eventAndSpanFile := app.EventAndSpanFiles[j]
						content, eventCount, spanCount, err := prepareEventsAndSpans(eventAndSpanFile, virtualizer)
						if err != nil {
							log.Fatal(err)
						}
						reqId := uuid.New().String()
						result := fmt.Sprintf("Ingesting virtual events and spans %q...", reqId)
						status, err := UploadEventsAndSpans(eventURL, apiKey, reqId, content)
						if err != nil {
							if status == "" {
								status = err.Error()
							}
							result += fmt.Sprintf("🔴 %s \n", status)
							results = append(results, result)
							logResults(&results)
							fmt.Println("event and span file", eventAndSpanFile)
							log.Fatal(err)
						}
						result += fmt.Sprintf("🟢 %s \n", status)
						results = append(results, result)
						logResults(&results)

						metrics.bumpEventAndSpanFile()
						metrics.bumpEvent(eventCount)
						metrics.bumpSpan(spanCount)
					}
				}
			}()
		}

		wg.Wait()

		fmt.Printf("\n")
		metrics.bumpApp()
	}

	metrics.setIngestDuration(time.Since(startTime))
}

// UploadBuilds prepares & sends the request to
// upload mapping file & build info.
func UploadBuilds(url, apiKey string, app app.App) (string, error) {
	if dryRun {
		return http.StatusText(http.StatusOK), nil
	}
	attribute, err := app.Attribute()
	if err != nil {
		return "", err
	}
	headers := map[string]string{
		"Content-Type": fmt.Sprintf("multipart/form-data; boundary=%s", multipartBoundary),
	}

	for code, build := range app.Builds {
		var buff bytes.Buffer
		w := multipart.NewWriter(&buff)
		w.SetBoundary(multipartBoundary)

		fw, err := w.CreateFormField("version_name")
		if err != nil {
			return "", err
		}
		fw.Write([]byte(attribute.AppVersion))

		fw, err = w.CreateFormField("version_code")
		if err != nil {
			return "", err
		}
		fw.Write([]byte(code))
		for _, mappingFile := range build.MappingFiles {
			f, err := os.Open(mappingFile)
			if err != nil {
				return "", err
			}

			defer f.Close()

			fw, err = w.CreateFormFile("mapping_file", filepath.Base(mappingFile))
			if err != nil {
				return "", err
			}

			io.Copy(fw, f)

			fw, err = w.CreateFormField("mapping_type")
			if err != nil {
				return "", err
			}

			mappingType := "proguard"

			switch attribute.Platform {
			case platform.IOS:
				if err := codec.IsTarGz(f); err != nil {
					return "", err
				}
				mappingType = "dsym"
			}

			fw.Write([]byte(mappingType))
		}

		fw, err = w.CreateFormField("build_size")
		if err != nil {
			return "", err
		}
		fw.Write([]byte(build.BuildInfo.GetSize()))

		fw, err = w.CreateFormField("build_type")
		if err != nil {
			return "", err
		}
		fw.Write([]byte(build.BuildInfo.Type))
		w.Close()
		status, err := sendRequest(url, apiKey, headers, buff.Bytes())

		if err != nil {
			return status, err
		}

		metrics.bumpBuild()
	}

	return http.StatusText(http.StatusOK), nil
}

// prepareEventsAndSpansAndSpans prepares request for events.
func prepareEventsAndSpans(eventAndSpanFile string, virtualizer *virtualizer) (data []byte, eventCount int, spanCount int, err error) {
	fileData := app.EventAndSpanFileData{}
	rawEvents := []json.RawMessage{}
	rawSpans := []json.RawMessage{}
	content, err := os.ReadFile(eventAndSpanFile)
	if err != nil {
		return
	}
	if err = json.Unmarshal(content, &fileData); err != nil {
		return
	}

	decoder := json.NewDecoder(bytes.NewBuffer(content))
	if _, err = decoder.Token(); err != nil { // Read the initial '{'
		return data, eventCount, spanCount, fmt.Errorf("error reading JSON object start: %v", err)
	}

	for decoder.More() { // Loop through top-level keys
		// Read the next key
		token, err := decoder.Token()
		if err != nil {
			return data, eventCount, spanCount, fmt.Errorf("error reading JSON key: %v", err)
		}

		if key, ok := token.(string); ok {
			switch key {
			case "events":
				if _, err = decoder.Token(); err != nil { // Skip '['
					return data, eventCount, spanCount, fmt.Errorf("error reading events array start: %v", err)
				}

				for decoder.More() {
					var rawEvent json.RawMessage
					if err = decoder.Decode(&rawEvent); err != nil {
						return data, eventCount, spanCount, fmt.Errorf("error decoding event: %v", err)
					}
					if err = virtualizer.Virtualize(&rawEvent); err != nil {
						return data, eventCount, spanCount, fmt.Errorf("error virtualizing event: %v", err)
					}
					rawEvents = append(rawEvents, rawEvent)
					eventCount++
				}

				if _, err = decoder.Token(); err != nil { // Skip ']'
					return data, eventCount, spanCount, fmt.Errorf("error reading events array end: %v", err)
				}

			case "spans":
				if _, err = decoder.Token(); err != nil { // Skip '['
					return data, eventCount, spanCount, fmt.Errorf("error reading spans array start: %v", err)
				}

				for decoder.More() {
					var rawSpan json.RawMessage
					if err = decoder.Decode(&rawSpan); err != nil {
						return data, eventCount, spanCount, fmt.Errorf("error decoding span: %v", err)
					}
					rawSpans = append(rawSpans, rawSpan)
					spanCount++
				}

				if _, err = decoder.Token(); err != nil { // Skip ']'
					return data, eventCount, spanCount, fmt.Errorf("error reading spans array end: %v", err)
				}
			}
		}
	}

	if len(rawEvents) != len(fileData.Events) {
		err = errors.New("mismatch found in number of events while preparing events request")
		return
	}

	if len(rawSpans) != len(fileData.Spans) {
		err = errors.New("mismatch found in number of spans while preparing spans request")
		return
	}

	var buff bytes.Buffer
	w := multipart.NewWriter(&buff)
	w.SetBoundary(multipartBoundary)

	for i := range rawEvents {
		fw, err := w.CreateFormField("event")
		if err != nil {
			return data, eventCount, spanCount, err
		}
		_, err = fw.Write(rawEvents[i])
		if err != nil {
			return data, eventCount, spanCount, err
		}

		if len(fileData.Events[i].Attachments) < 1 {
			continue
		}

		for j := range fileData.Events[i].Attachments {
			appDir := filepath.Dir(eventAndSpanFile)
			id := fileData.Events[i].Attachments[j].ID.String()
			filename := fileData.Events[i].Attachments[j].Name
			key := `blob-` + id
			blobPath := filepath.Join(appDir, "blobs", id)
			blobFile, err := os.Open(blobPath)
			if err != nil {
				return data, eventCount, spanCount, err
			}
			ff, err := w.CreateFormFile(key, filename)
			if err != nil {
				return data, eventCount, spanCount, err
			}

			_, err = io.Copy(ff, blobFile)
			if err != nil {
				return data, eventCount, spanCount, err
			}
			if err := blobFile.Close(); err != nil {
				return data, eventCount, spanCount, err
			}
		}
	}

	for i := range rawSpans {
		fw, err := w.CreateFormField("span")
		if err != nil {
			return data, eventCount, spanCount, err
		}
		_, err = fw.Write(rawSpans[i])
		if err != nil {
			return data, eventCount, spanCount, err
		}
	}

	// important to close the writer
	// to indicate that we are done writing
	w.Close()
	data = buff.Bytes()

	return
}

// UploadEventsAndSpans prepares & sends the request to upload
// events.
func UploadEventsAndSpans(url, apiKey, reqId string, data []byte) (status string, err error) {
	if dryRun {
		return http.StatusText(http.StatusAccepted), nil
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
	Short: "Ingest events, spans & builds",
	Long: `Ingest events, spans & builds from disk.

Structure of "session-data" directory:` + "\n" + DirTree() + "\n" + ValidNote(),
	Run: func(cmd *cobra.Command, args []string) {
		sourceDir, err := filepath.Abs(filepath.Clean(sourceDir))
		if err != nil {
			log.Fatal(err)
		}

		if !ValidateFlags() {
			os.Exit(1)
		}

		apps, err := app.Scan(sourceDir, &app.ScanOpts{
			SkipApps: skipApps,
		})
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
		fmt.Printf("number of apps found: %d\n\n", len(apps.Items))

		for i, app := range apps.Items {
			mapping := "not found"
			count := 0
			for _, build := range app.Builds {
				count += len(build.MappingFiles)
			}
			if count > 0 {
				mapping = fmt.Sprintf("found %d", count)
			}
			fmt.Printf("app (%d): %s\n", i+1, app.FullName())
			fmt.Printf("event and span files count: %d\n", len(app.EventAndSpanFiles))
			fmt.Printf("blob files count: %d\n", len(app.BlobFiles))
			fmt.Printf("mapping file: %s\n\n", mapping)
		}

		if clean || cleanAll {
			if err := configData.ValidateStorage(); err != nil {
				log.Fatal(err)
			}
		}

		ctx := cmd.Context()

		if clean {
			if err := rmAppResources(ctx, configData); err != nil {
				log.Fatal("failed to clean old data", err)
			}
		} else if cleanAll {
			if err := rmAll(ctx, configData); err != nil {
				log.Fatal("failed to clean all old data", err)
			}
		}

		if parallel {
			IngestParallel(apps, origin)
		} else {
			IngestSerial(apps, origin)
		}

		fmt.Printf("\nSummary\n=======\n\n")

		fmt.Printf("apps: %d\n", metrics.AppCount)
		fmt.Printf("builds: %d\n", metrics.BuildCount)
		fmt.Printf("event and span files: %d\n", metrics.EventAndSpanFileCount)
		fmt.Printf("events: %d\n", metrics.EventCount)
		fmt.Printf("spans: %d\n", metrics.SpanCount)
		fmt.Printf("ingest took: %v\n", metrics.ingestDuration)
	},
}
