package cmd

import (
	"backend/api/event"
	"backend/api/span"
	"backend/libs/codec"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sessionator/app"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

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

// uploadInfo mirrors the ingest service's attachment upload descriptor: the
// SDK uploads the file with a plain PUT to UploadURL after the events request
// returns. See backend/ingest/measure/event.go (AttachmentUploadInfo).
type uploadInfo struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Filename  string            `json:"filename"`
	UploadURL string            `json:"upload_url"`
	ExpiresAt time.Time         `json:"expires_at"`
	Headers   map[string]string `json:"headers,omitempty"`
}

// mapping mirrors the ingest service's build mapping descriptor, used in both
// the PUT /builds request and response. See backend/ingest/measure/build.go.
type mapping struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Filename  string            `json:"filename"`
	Key       string            `json:"key,omitempty"`
	Checksum  string            `json:"checksum,omitempty"`
	Size      int64             `json:"size,omitempty"`
	UploadURL string            `json:"upload_url,omitempty"`
	ExpiresAt time.Time         `json:"expires_at"`
	Headers   map[string]string `json:"headers,omitempty"`
	PatchID   string            `json:"patch_id,omitempty"`
}

// buildRequest is the JSON payload PUT /builds accepts from newer SDKs.
type buildRequest struct {
	AppUniqueID string     `json:"app_unique_id"`
	VersionName string     `json:"version_name"`
	VersionCode string     `json:"version_code"`
	Type        string     `json:"build_type"`
	Size        uint       `json:"build_size"`
	PatchID     string     `json:"patch_id"`
	Mappings    []*mapping `json:"mappings"`
}

// uploadExpiry is a cosmetic expiry stamped on the upload URLs we return.
// record never enforces it — the SDK uploads immediately after the request.
const uploadExpiry = time.Hour * 24 * 7

// uploadURL builds a presigned-style URL pointing back at this recorder. The
// destination path (relative to outputDir) is encoded so writeUpload can land
// the bytes on disk where app/scan.go expects them.
func uploadURL(c *gin.Context, relPath string) string {
	return fmt.Sprintf("http://%s/upload?dst=%s", c.Request.Host, url.QueryEscape(relPath))
}

// The path to output directory
var outputDir string

// The port to run the server
var port string

func init() {
	recordCmd.Flags().StringVarP(&outputDir, "path", "p", "../session-data", "path to store event requests")
	recordCmd.Flags().StringVarP(&port, "port", "P", "8085", "port to run the server")
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
		r.PUT("/upload", writeUpload)

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

	// newer SDKs send a JSON payload and upload attachments out-of-band via
	// the presigned URLs we return; older SDKs send everything as multipart.
	if strings.HasPrefix(c.ContentType(), "application/json") {
		writeEventJSON(c, reqId)
		return
	}

	writeEventMultipart(c, reqId)
}

func writeEventMultipart(c *gin.Context, reqId string) {
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

	var appUniqueID, appVersion string
	if len(events) > 0 {
		appUniqueID = events[0].Attribute.AppUniqueID
		appVersion = events[0].Attribute.AppVersion
	} else {
		appUniqueID = spans[0].Attributes.AppUniqueID
		appVersion = spans[0].Attributes.AppVersion
	}
	if !safePathComponent(appUniqueID) || !safePathComponent(appVersion) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_unique_id or app_version"})
		return
	}
	appDir := filepath.Join(rootDir, appUniqueID, appVersion)
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
	// newer SDKs send a JSON payload and upload mapping files out-of-band via
	// the presigned URLs we return; older SDKs send everything as multipart.
	if strings.HasPrefix(c.ContentType(), "application/json") {
		writeBuildJSON(c)
		return
	}

	writeBuildMultipart(c)
}

func writeBuildMultipart(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(100 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unable to parse multipart form: " + err.Error(),
		})
		return
	}

	appUniqueID := c.Request.FormValue("app_unique_id")
	versionName := c.Request.FormValue("version_name")
	versionCode := c.Request.FormValue("version_code")
	mappingTypes := c.Request.Form["mapping_type"]

	if appUniqueID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "app_unique_id is required",
		})
		return
	}
	if versionName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": `"version_name" is required`,
		})
		return
	}
	if versionCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": `"version_code" is required`,
		})
		return
	}
	if !safePathComponent(appUniqueID) || !safePathComponent(versionName) || !safePathComponent(versionCode) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid app_unique_id, version_name or version_code",
		})
		return
	}

	for i := range mappingTypes {
		if mappingTypes[i] != "proguard" && mappingTypes[i] != "dsym" && mappingTypes[i] != "elf_debug" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Errorf(`"mapping_file" should be either %q, %q or %q`, "proguard", "dsym", "elf_debug"),
			})
			return
		}
	}

	files := c.Request.MultipartForm.File["mapping_file"]

	if len(files) != len(mappingTypes) {
		fmt.Printf("number of mapping files (%d) does not match number of mapping types (%d)\n", len(files), len(mappingTypes))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("number of mapping files (%d) does not match number of mapping types (%d)", len(files), len(mappingTypes)),
		})
		return
	}

	for i, mappingType := range mappingTypes {
		header := files[i]
		if header.Header == nil || header.Size < 1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Errorf("failed to read header of mapping file %q from multipart request indexed %d", header.Filename, i),
			})
			return
		}
		file, err := header.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   fmt.Errorf("failed to read mapping file %q with index %d", header.Filename, i),
				"details": err.Error(),
			})
		}

		var filename string

		switch mappingType {
		case "proguard":
			filename = "mapping.txt"
		case "dsym":
			if err := codec.IsTarGz(file); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   fmt.Errorf("mapping file %q is not a gzipped tarball", header.Filename),
					"details": err.Error(),
				})
				return
			}

			filename = header.Filename
			filename = strings.ReplaceAll(filename, " ", "")
		case "elf_debug":
			filename = header.Filename
			filename = strings.ReplaceAll(filename, " ", "")
		}

		// header.Filename is attacker-controlled; reject any value that
		// would escape the version directory.
		if !safePathComponent(filename) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("invalid mapping filename %q", header.Filename),
			})
			return
		}

		mappingFilePath := filepath.Join(outputDir, appUniqueID, versionName, versionCode, filename)
		if err := os.MkdirAll(filepath.Dir(mappingFilePath), 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to create directory for mapping file %q: `, err.Error()),
			})
			return
		}

		out, err := os.Create(mappingFilePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to create mapping file %q:`, err.Error()),
			})
			return
		}

		_, err = io.Copy(out, file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Errorf("failed to write mapping file %q: %v", mappingFilePath, err),
			})
			return
		}

		file.Close()
		out.Close()
	}

	buildType := c.Request.FormValue("build_type")
	buildSize, err := strconv.Atoi(c.Request.FormValue("build_size"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "failed to parse build_size: " + err.Error(),
		})
		return
	}

	buildFilePath := filepath.Join(outputDir, appUniqueID, versionName, versionCode, "build.toml")
	if err := os.MkdirAll(filepath.Dir(buildFilePath), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to create directory for build file %q: `, err.Error()),
		})
		return
	}
	out, err := os.Create(buildFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to create build.toml file %q: %v`, buildFilePath, err.Error()),
		})
		return
	}

	defer out.Close()

	buildInfo := app.BuildInfo{
		Size: uint(buildSize),
		Type: buildType,
	}

	if err := toml.NewEncoder(out).Encode(buildInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create build.toml file: " + err.Error(),
		})
		return
	}

	c.Status(http.StatusOK)
}

// writeEventJSON handles the JSON variant of PUT /events. It writes the batch
// file in the same on-disk format as the multipart path, then returns presigned
// upload URLs for each attachment. Attachment bytes arrive later via writeUpload.
func writeEventJSON(c *gin.Context, reqId string) {
	var req struct {
		Events []json.RawMessage `json:"events"`
		Spans  []json.RawMessage `json:"spans"`
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read request body"})
		return
	}
	if err := json.Unmarshal(body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse json payload: " + err.Error()})
		return
	}
	if len(req.Events) < 1 && len(req.Spans) < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload should contain at least 1 event or span"})
		return
	}

	// parse events for app coordinates and attachment metadata
	events := make([]event.EventField, 0, len(req.Events))
	for i := range req.Events {
		var e event.EventField
		if err := json.Unmarshal(req.Events[i], &e); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse event json: " + err.Error()})
			return
		}
		events = append(events, e)
	}

	var appUniqueID, appVersion string
	if len(events) > 0 {
		appUniqueID = events[0].Attribute.AppUniqueID
		appVersion = events[0].Attribute.AppVersion
	} else {
		var s span.SpanField
		if err := json.Unmarshal(req.Spans[0], &s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse span json: " + err.Error()})
			return
		}
		appUniqueID = s.Attributes.AppUniqueID
		appVersion = s.Attributes.AppVersion
	}

	if !safePathComponent(appUniqueID) || !safePathComponent(appVersion) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_unique_id or app_version"})
		return
	}

	rootDir, err := filepath.Abs(outputDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to acquire directory: %q", rootDir)})
		return
	}

	appDir := filepath.Join(rootDir, appUniqueID, appVersion)
	if err := os.MkdirAll(appDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to acquire directory: %q", appDir)})
		return
	}

	batchFile := filepath.Join(appDir, reqId+".json")
	jsonBytes, err := json.Marshal(Batch{Events: req.Events, Spans: req.Spans})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode event file content as json"})
		return
	}
	if err := os.WriteFile(batchFile, jsonBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Errorf("failed to write to %q", batchFile).Error()})
		return
	}
	fmt.Printf("written %d event(s) and %d span(s) to %q\n", len(req.Events), len(req.Spans), batchFile)

	// hand out an upload URL per attachment. blobs land at blobs/{id} (no
	// extension) to match app/scan.go's expectations.
	attachments := []uploadInfo{}
	for i := range events {
		for j := range events[i].Attachments {
			id := events[i].Attachments[j].ID.String()
			relPath := filepath.Join(appUniqueID, appVersion, "blobs", id)
			attachments = append(attachments, uploadInfo{
				ID:        id,
				Type:      events[i].Attachments[j].Type,
				Filename:  events[i].Attachments[j].Name,
				UploadURL: uploadURL(c, relPath),
				ExpiresAt: time.Now().Add(uploadExpiry),
			})
		}
	}
	fmt.Printf("returning %d attachment upload url(s)\n", len(attachments))

	c.JSON(http.StatusAccepted, gin.H{"attachments": attachments})
}

// writeBuildJSON handles the JSON variant of PUT /builds. It writes build.toml
// and returns presigned upload URLs for each mapping file. Mapping bytes arrive
// later via writeUpload.
func writeBuildJSON(c *gin.Context) {
	var req buildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse json payload: " + err.Error()})
		return
	}
	if req.AppUniqueID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_unique_id is required"})
		return
	}
	if req.VersionName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `"version_name" is required`})
		return
	}
	if req.VersionCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `"version_code" is required`})
		return
	}
	if !safePathComponent(req.AppUniqueID) || !safePathComponent(req.VersionName) || !safePathComponent(req.VersionCode) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app_unique_id, version_name or version_code"})
		return
	}

	versionDir := filepath.Join(outputDir, req.AppUniqueID, req.VersionName, req.VersionCode)
	buildFilePath := filepath.Join(versionDir, "build.toml")
	if err := os.MkdirAll(filepath.Dir(buildFilePath), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to create directory for build file %q: `, err.Error())})
		return
	}

	out, err := os.Create(buildFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to create build.toml file %q: %v`, buildFilePath, err.Error())})
		return
	}
	defer out.Close()

	if err := toml.NewEncoder(out).Encode(app.BuildInfo{Size: req.Size, Type: req.Type}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create build.toml file: " + err.Error()})
		return
	}
	fmt.Printf("written build.toml to %q\n", buildFilePath)

	if len(req.Mappings) < 1 {
		c.JSON(http.StatusOK, gin.H{"ok": "build info updated"})
		return
	}

	for _, m := range req.Mappings {
		if m.Type != "proguard" && m.Type != "dsym" && m.Type != "elf_debug" && m.Type != "jsbundle" {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf(`"type" should be one of %q, %q, %q or %q`, "proguard", "dsym", "elf_debug", "jsbundle")})
			return
		}

		filename := strings.ReplaceAll(m.Filename, " ", "")
		if m.Type == "proguard" {
			filename = "mapping.txt"
		}

		// jsbundle archives are .tgz, same as dsym, and their filenames
		// differ across platforms (main.jsbundle*.tgz on iOS,
		// index.android.bundle*.tgz on Android) — so the type can't be
		// recovered from the extension on replay. Nest them under jsbundle/
		// so app/scan.go recognizes the type structurally.
		relPath := filepath.Join(req.AppUniqueID, req.VersionName, req.VersionCode, filename)
		if m.Type == "jsbundle" {
			relPath = filepath.Join(req.AppUniqueID, req.VersionName, req.VersionCode, "jsbundle", filename)
		}
		m.ID = uuid.NewString()
		m.UploadURL = uploadURL(c, relPath)
		m.ExpiresAt = time.Now().Add(uploadExpiry)
	}
	fmt.Printf("returning %d mapping upload url(s)\n", len(req.Mappings))

	c.JSON(http.StatusOK, gin.H{"mappings": req.Mappings})
}

// safePathComponent reports whether v is safe to use as a single path
// segment built from untrusted request data (app_unique_id, version names,
// etc.) — it must be non-empty and free of separators or ".." traversal.
func safePathComponent(v string) bool {
	if v == "" {
		return false
	}
	return !strings.ContainsAny(v, `/\`) && !strings.Contains(v, "..")
}

// resolveUploadPath joins dst onto rootDir, rejecting any path that would
// escape rootDir (absolute paths, traversal via "..").
func resolveUploadPath(rootDir, dst string) (full string, err error) {
	clean := filepath.Clean(dst)
	if filepath.IsAbs(clean) || strings.HasPrefix(clean, "..") {
		return "", fmt.Errorf("invalid dst path: %q", dst)
	}
	full = filepath.Join(rootDir, clean)
	if !strings.HasPrefix(full, rootDir+string(os.PathSeparator)) {
		return "", fmt.Errorf("dst path escapes output directory: %q", dst)
	}
	return full, nil
}

// writeUpload is the sink for presigned-style uploads handed out by the JSON
// event/build handlers. The destination path (relative to outputDir) is taken
// from the "dst" query param and sanitized to prevent path traversal.
func writeUpload(c *gin.Context) {
	dst := c.Query("dst")
	if dst == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing dst query param"})
		return
	}

	rootDir, err := filepath.Abs(outputDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve output directory"})
		return
	}

	full, err := resolveUploadPath(rootDir, dst)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := os.MkdirAll(filepath.Dir(full), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create directory for upload"})
		return
	}

	file, err := os.Create(full)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create file %q", full)})
		return
	}
	defer file.Close()

	written, err := io.Copy(file, c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to write %q to disk", full)})
		return
	}
	fmt.Printf("written %d bytes to %q\n", written, full)

	c.Status(http.StatusOK)
}
