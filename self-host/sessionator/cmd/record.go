package cmd

import (
	"backend/api/event"
	"backend/api/span"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sessionator/app"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/klauspost/compress/zstd"

	"github.com/BurntSushi/toml"
	"github.com/spf13/cobra"
)

type Batch struct {
	Events []json.RawMessage `json:"events,omitempty"`
	Spans  []json.RawMessage `json:"spans,omitempty"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// The path to output directory
var outputDir string

// The port to run the server
var port string

func init() {
	recordCmd.Flags().StringVarP(&outputDir, "path", "p", "../session-data", "path to store event requests")
	recordCmd.Flags().StringVarP(&port, "port", "P", "8080", "port to run the server")
	recordCmd.Flags().SortFlags = false
}

var recordCmd = &cobra.Command{
	Use:   "record",
	Short: "Record events, spans & builds",
	Long: `Record events & builds to disk.

Structue of "session-data" directory once written:` + "\n" + DirTree() + "\n" + ValidNote(),
	Run: func(cmd *cobra.Command, args []string) {
		r := gin.Default()

		r.PUT("/builds", writeBuild)
		r.PUT("/events", writeEvent)

		r.Run(":" + port)
	},
}

func writeEvent(c *gin.Context) {
	reqIdKey := `msr-req-id`
	reqId := c.Request.Header.Get(reqIdKey)
	if reqId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("%q header is missing from request headers", reqIdKey),
		})
		return
	}

	if err := uuid.Validate(reqId); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("%q header value is not a valid UUID", reqIdKey),
		})
		return
	}

	pathErr := func(dir string) error {
		return fmt.Errorf(`failed to acquire directory: %q`, dir)
	}
	parseErr := func(details string) error {
		return fmt.Errorf(`failed to parse multipart request: %s`, details)
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": parseErr("multipart form").Error(),
		})
		return
	}

	eventFields := form.Value["event"]
	if len(eventFields) < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "payload should contain at least 1 event",
		})
		return
	}

	events := []event.EventField{}
	rawEvents := []json.RawMessage{}
	hasBlob := false
	blobCount := 0

	for i := range eventFields {
		if eventFields[i] == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "payload should not contain any empty event",
			})
			return
		}
		if !json.Valid([]byte(eventFields[i])) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": parseErr("contains invalid json").Error(),
			})
			return
		}

		var event event.EventField
		bytes := []byte(eventFields[i])
		if err := json.Unmarshal(bytes, &event); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": parseErr("failed to parse events json").Error(),
			})
			return
		}

		if len(event.Attachments) > 0 {
			hasBlob = true
			blobCount = blobCount + len(event.Attachments)
		}

		events = append(events, event)
		rawEvents = append(rawEvents, json.RawMessage(eventFields[i]))
	}

	// Parse spans
	spanFields := form.Value["span"]
	spans := []span.SpanField{}
	rawSpans := []json.RawMessage{}

	for i := range spanFields {
		if spanFields[i] == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "payload should not contain any empty span",
			})
			return
		}
		if !json.Valid([]byte(spanFields[i])) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": parseErr("contains invalid span json").Error(),
			})
			return
		}

		var span span.SpanField
		bytes := []byte(spanFields[i])
		if err := json.Unmarshal(bytes, &span); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": parseErr("failed to parse span json").Error(),
			})
			return
		}

		spans = append(spans, span)
		rawSpans = append(rawSpans, json.RawMessage(spanFields[i]))
	}

	fmt.Printf("found %d event(s)\n", len(eventFields))
	fmt.Printf("found %d spans(s)\n", len(spanFields))
	fmt.Printf("found %d blob(s)\n", blobCount)

	rootDir, err := filepath.Abs(outputDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": pathErr(rootDir).Error(),
		})
		return
	}

	var appDir string
	if len(events) > 0 {
		appDir = filepath.Join(rootDir, events[0].Attribute.AppUniqueID, events[0].Attribute.AppVersion)
	} else {
		appDir = filepath.Join(rootDir, spans[0].Attributes.AppUniqueID, spans[0].Attributes.AppVersion)
	}
	batchFile := filepath.Join(appDir, reqId+".json")
	blobsDir := filepath.Join(appDir, "blobs")

	if _, err := os.Stat(appDir); errors.Is(err, fs.ErrNotExist) {
		if err := os.MkdirAll(appDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": pathErr(appDir).Error(),
			})
			return
		}
	}

	fileContent := Batch{
		Events: rawEvents,
		Spans:  rawSpans,
	}

	// Write combined file
	jsonBytes, err := json.Marshal(fileContent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to encode event file content as json",
		})
		return
	}
	if err := os.WriteFile(batchFile, jsonBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Errorf("failed to write to %q", batchFile).Error(),
		})
		return
	}
	fmt.Printf("written %d event(s) and %d span(s) to %q\n", len(eventFields), len(spanFields), batchFile)

	// Handle blobs if any exist
	if hasBlob {
		if _, err := os.Stat(blobsDir); errors.Is(err, fs.ErrNotExist) {
			if err := os.MkdirAll(blobsDir, 0755); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": pathErr(blobsDir).Error(),
				})
				return
			}
		}
	}

	for i := range events {
		if len(events[i].Attachments) < 1 {
			continue
		}
		for j := range events[i].Attachments {
			id := events[i].Attachments[j].ID.String()
			key := "blob-" + id
			blobFile := filepath.Join(blobsDir, id)
			files := form.File[key]
			if len(files) < 1 {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("no file field %q in payload", key),
				})
				return
			}
			file := files[0]
			if file == nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("no file field %q in payload", key),
				})
				return
			}

			dst, err := os.Create(blobFile)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": pathErr(blobFile),
				})
				return
			}
			defer dst.Close()

			src, err := file.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": fmt.Sprintf("failed to open blob with id %q", key),
				})
				return
			}
			defer src.Close()

			written, err := io.Copy(dst, src)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": fmt.Sprintf("failed to write %q to disk", blobFile),
				})
				return
			}

			fmt.Printf("written %d bytes to blob file %q\n", written, blobFile)
		}
	}

	c.JSON(http.StatusAccepted, gin.H{
		"ok": "accepted",
	})
}

func writeBuild(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(100 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unable to parse multipart form: " + err.Error(),
		})
		return
	}

	appUniqueID := c.Request.FormValue("app_unique_id")
	versionName := c.Request.FormValue("version_name")
	mappingType := c.Request.FormValue("type")

	if appUniqueID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "app_unique_id is required",
		})
		return
	}
	if versionName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "version_name is required",
		})
		return
	}

	filename := "mapping"
	extension := ".txt"

	// validate presence and correctness
	// of mapping type
	switch mappingType {
	case "", "proguard":
		// default to "proguard"
		// when empty
		mappingType = "proguard"
	case "dsym":
		mappingType = "dsym"
		extension = ".dsym.zst"
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Errorf("%q should be either %q or %q", "mapping_type", "proguard", "dsym"),
		})
		return
	}

	file, header, err := c.Request.FormFile("mapping_file")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Errorf("failed to read %q from multipart request", "mapping_file"),
		})
		return
	}
	if header == nil || header.Size < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Errorf("failed to read header of %q from multipart request", "mapping_file"),
		})
		return
	}

	defer file.Close()

	mappingFile := filename + extension
	mappingFilePath := filepath.Join(outputDir, appUniqueID, versionName, mappingFile)
	if err := os.MkdirAll(filepath.Dir(mappingFilePath), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create mapping file: " + err.Error(),
		})
		return
	}

	out, err := os.Create(mappingFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create mapping file: " + err.Error(),
		})
		return
	}
	defer out.Close()

	switch mappingType {
	case "dsym":
		enc, err := zstd.NewWriter(out)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Errorf("failed to compress %q file: %v", mappingFile, err),
			})
			return
		}
		defer enc.Close()
		_, err = io.Copy(enc, file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Errorf("failed to compress %q file: %v", mappingFile, err),
			})
			return
		}
	case "proguard":
		_, err = io.Copy(out, file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Errorf("failed to write %q file: %v", mappingFile, err),
			})
			return
		}
	}

	buildType := c.Request.FormValue("build_type")
	buildSize, err := strconv.Atoi(c.Request.FormValue("build_size"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "failed to parse build_size: " + err.Error(),
		})
		return
	}

	buildFilePath := filepath.Join(outputDir, appUniqueID, versionName, "build.toml")
	out, err = os.Create(buildFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed create build.toml file: " + err.Error(),
		})
		return
	}

	defer out.Close()

	buildInfo := app.BuildInfo{
		Size: uint32(buildSize),
		Type: buildType,
	}

	if err := toml.NewEncoder(out).Encode(buildInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create build.toml file: " + err.Error(),
		})
		return
	}

	c.Status(http.StatusAccepted)
}
