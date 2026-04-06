package measure

import (
	"backend/api/event"
	"backend/api/span"
	"backend/ingest/server"
	"backend/libs/objstore"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	credentials "cloud.google.com/go/iam/credentials/apiv1"
	"cloud.google.com/go/iam/credentials/apiv1/credentialspb"
	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
	"golang.org/x/sync/errgroup"
)

// maxBatchSize is the maximum allowed payload
// size of event request in bytes.
var maxBatchSize = 10 * 1024 * 1024

var ingestBatchPublishCount metric.Int64Counter

func init() {
	meter := otel.Meter("measure/ingest")
	counter, err := meter.Int64Counter(
		"ingest_batch_publish_count",
		metric.WithDescription("Number of ingest batches successfully published to the bus"),
	)
	if err != nil {
		panic(err)
	}
	ingestBatchPublishCount = counter
}

// ExpiryDuration is the default expiry duration
// for signed upload URLs.
const ExpiryDuration = time.Hour * 24 * 7

// blob represents each blob present in the
// event request batch during ingestion.
type blob struct {
	// id is the unique id of the blob
	id uuid.UUID
	// name is the filename with extension
	// from SDK
	name string
	// key is the s3-like object storage key
	key string
	// location is the fully qualified URL
	// of the s3-like object
	location string
	// header is the file bytes which can be
	// opened and read
	header *multipart.FileHeader
	// uploadedAttempted indicates if the blob
	// was attempted for upload at least once
	// during ingestion.
	uploadedAttempted bool
}

// IngestBatch is a serializable representation
// of an ingest request batch for publishing
// to a message bus.
type IngestBatch struct {
	BatchID  string             `json:"batch_id"`
	AppID    string             `json:"app_id"`
	TeamID   string             `json:"team_id"`
	OsName   string             `json:"os_name"`
	ClientIP string             `json:"client_ip"`
	Size     uint64             `json:"size"`
	Events   []event.EventField `json:"events"`
	Spans    []span.SpanField   `json:"spans"`
}

// eventreq represents the ingest batch
type eventreq struct {
	// id is the unique id identifying the request
	// batch
	id uuid.UUID
	// appId is the id of the app
	appId uuid.UUID
	// teamId is the id of the team
	teamId uuid.UUID
	// json indicates that content type is JSON
	json bool
	// seen indicates whether this request batch
	// was previously ingested
	seen bool
	// osName is operating system runtime of the SDK
	osName string
	// size keeps track of the ingest payload size
	size uint64
	// events is the list of events in the ingest
	// batch
	events []event.EventField
	// spans is the list of spans in the ingest
	// batch
	spans []span.SpanField
	// attachments is look up table for attachment
	// blobs
	attachments map[uuid.UUID]*blob
	// attachmentUploadInfos stores attachment upload
	// metadata
	attachmentUploadInfos []AttachmentUploadInfo
}

// IngestRequest is the ingestion request for JSON
// payload.
type IngestRequest struct {
	Events []event.EventField `json:"events"`
	Spans  []span.SpanField   `json:"spans"`
}

// IngestResponse represents the response data for
// JSON payload ingest request.
type IngestResponse struct {
	AttachmentUploadInfo []AttachmentUploadInfo `json:"attachments"`
}

// AttachmentUploadInfo contains the signed URL
// and related metadata for clients to upload
// attachments.
type AttachmentUploadInfo struct {
	ID        uuid.UUID         `json:"id"`
	Type      string            `json:"type"`
	Filename  string            `json:"filename"`
	UploadURL string            `json:"upload_url"`
	ExpiresAt time.Time         `json:"expires_at"`
	Headers   map[string]string `json:"headers,omitempty"`
	Key       string            `json:"-"`
	Location  string            `json:"-"`
}

// uploadAttachments prepares and uploads each attachment.
func (e *eventreq) uploadAttachments() error {
	for id, attachment := range e.attachments {
		if attachment == nil {
			return fmt.Errorf("attachment[%s]: nil blob", id)
		}

		if attachment.header == nil {
			return fmt.Errorf("attachment[%s] (%s): header is nil", id, attachment.name)
		}

		ext := filepath.Ext(attachment.name)
		key := attachment.id.String() + ext

		// pre-fill the key and location
		attachment.key = key
		// for now, we construct the location manually
		// implement a better solution later using
		// EndpointResolverV2 with custom resolvers
		// for non-AWS clouds like GCS
		attachment.location = event.BuildAttachmentLocation(key, event.LocationConfig{
			IsCloud:                 server.Server.Config.IsCloud(),
			AWSEndpoint:             server.Server.Config.AWSEndpoint,
			AttachmentsBucket:       server.Server.Config.AttachmentsBucket,
			AttachmentsBucketRegion: server.Server.Config.AttachmentsBucketRegion,
		})

		eventAttachment := event.Attachment{
			ID:   id,
			Name: key,
			Key:  key,
		}

		file, err := attachment.header.Open()
		if err != nil {
			return err
		}

		eventAttachment.Reader = file

		go func() {
			defer file.Close()
			// create fresh context for the upload
			// operation. ensure uploads proceed even if
			// the request fails for extra safety.
			//
			// better to be safe and process uploads as much
			// as you can.
			bgCtx := context.Background()

			if err := eventAttachment.Upload(bgCtx, event.UploadConfig{
				IsCloud:                    server.Server.Config.IsCloud(),
				AWSEndpoint:                server.Server.Config.AWSEndpoint,
				AttachmentsBucket:          server.Server.Config.AttachmentsBucket,
				AttachmentsBucketRegion:    server.Server.Config.AttachmentsBucketRegion,
				AttachmentsAccessKey:       server.Server.Config.AttachmentsAccessKey,
				AttachmentsSecretAccessKey: server.Server.Config.AttachmentsSecretAccessKey,
			}); err != nil {
				fmt.Printf("failed to upload attachment async: key: %s : %v\n", key, err)
				return
			}
		}()

		// this is just a soft flag to indicate the attachment upload
		// has been attempted, but does not reflect actual upload completion
		// or success.
		attachment.uploadedAttempted = true
	}

	return nil
}

// bumpSize increases the payload size of
// events in bytes.
func (e *eventreq) bumpSize(n uint64) {
	e.size = e.size + n
}

// estimateAttachmentSize returns an estimated size in bytes
// for an attachment based on its filename extension. Used for
// JSON ingest requests where attachments are uploaded
// out-of-band via signed URLs.
func estimateAttachmentSize(filename string) uint64 {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".webp", ".jpeg", ".jpg", ".png", ".svg":
		return 50 * 1024 // 50 KB
	default:
		return 1024 // 1 KB (layout snapshots, etc.)
	}
}

// checkSeen checks & remembers if this request batch was
// previously ingested.
func (e *eventreq) checkSeen(ctx context.Context) (err error) {
	stmt := sqlf.From("ingested_batches final").
		Select("1").
		Where("team_id = ?", e.teamId).
		Where("app_id = ?", e.appId).
		Where("batch_id = ?", e.id).
		Limit(1)

	defer stmt.Close()
	var result uint8
	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&result); err != nil {
		if err == sql.ErrNoRows {
			err = nil
		}
		return
	}

	if result == 1 {
		e.seen = true
	}

	return
}

// readMultipartRequest parses and validates the event request payload for
// events and attachments.
func (e *eventreq) readMultipartRequest(c *gin.Context) error {
	form, err := c.MultipartForm()
	if err != nil {
		return err
	}

	events := form.Value["event"]
	spans := form.Value["span"]
	if len(events) < 1 && len(spans) < 1 {
		return fmt.Errorf(`payload must contain at least 1 event or 1 span`)
	}

	dupEvent := make(map[uuid.UUID]struct{})

	for i := range events {
		if events[i] == "" {
			return fmt.Errorf(`any event field must not be empty`)
		}

		var ev event.EventField
		bytes := []byte(events[i])
		if err := json.Unmarshal(bytes, &ev); err != nil {
			return err
		}

		// debug null anr/exception in payload cases
		//
		// suspicion: this happens for these payloads
		// {
		//   "id": "<uuid>,
		//   "session_id: "<uuid>",
		//   "type": "exception",
		//   "exception": null,
		// }
		// {
		//   "id": "<uuid>,
		//   "session_id: "<uuid>",
		//   "type": "anr",
		//   "anr": null,
		// }
		//
		// most likely, these orginiate from Android 11, 12
		// & 13 Redmi devices with user agent as "Dalvik/2.1.0 (Linux; U; Android 11; 2201116SI Build/RKQ1.211001.001)".
		//
		// since, the SDK has no fix for this issue, we handle
		// the panic & send a 400 - which would eventually lead
		// the SDK to delete such events.
		//
		// has been observed for exception & ANRs, but other
		// event types may be affected as well.
		//
		// see: https://github.com/measure-sh/measure/issues/2965
		if ev.IsException() && ev.Exception == nil {
			return fmt.Errorf(`%q must not be null`, `exception`)
		}
		if ev.IsANR() && ev.ANR == nil {
			return fmt.Errorf(`%q must not be null`, `anr`)
		}

		// discard batch if duplicate
		// event ids found
		_, ok := dupEvent[ev.ID]
		if ok {
			return fmt.Errorf("duplicate event id %q found, discarding batch", ev.ID)
		} else {
			dupEvent[ev.ID] = struct{}{}
		}

		e.bumpSize(uint64(len(bytes)))
		ev.AppID = e.appId

		// partially prepare list of attachments
		// to extract the filename with extension
		// because extracting filename from form
		// field header is not reliable
		//
		// form field header may lack file extension
		// in some cases
		//
		// see https://github.com/measure-sh/measure/issues/1736
		for _, attachment := range ev.Attachments {
			e.attachments[attachment.ID] = &blob{
				id:   attachment.ID,
				name: attachment.Name,
			}
		}

		// attachment blobs must be present if
		// any event has attachments
		if e.hasAttachmentBlobs() && len(form.File) < 1 {
			return fmt.Errorf(`some events has attachments, but payload does not contain any attachment blob`)
		}

		// compute launch timings
		ev.ComputeLaunchTimes()

		// read OS name from payload
		// if we haven't figured out
		// already.
		if e.osName == "" {
			e.osName = strings.ToLower(ev.Attribute.OSName)
		}

		e.events = append(e.events, ev)
	}

	dupSpan := make(map[string]struct{})

	for i := range spans {
		if spans[i] == "" {
			return fmt.Errorf(`any span field must not be empty`)
		}
		var sp span.SpanField
		bytes := []byte(spans[i])
		if err := json.Unmarshal(bytes, &sp); err != nil {
			return err
		}

		// discard batch if duplicate
		// span ids found
		_, ok := dupSpan[sp.SpanID]
		if ok {
			return fmt.Errorf("duplicate span id %q found, discarding batch", sp.SpanID)
		} else {
			dupSpan[sp.SpanID] = struct{}{}
		}

		e.bumpSize(uint64(len(bytes)))
		sp.AppID = e.appId

		// read OS name from payload
		// if we haven't figured out
		// already.
		if e.osName == "" {
			e.osName = strings.ToLower(sp.Attributes.OSName)
		}

		e.spans = append(e.spans, sp)
	}

	for key, headers := range form.File {
		id, ok := strings.CutPrefix(key, "blob-")
		if !ok {
			continue
		}
		blobId, err := uuid.Parse(id)
		if err != nil {
			return err
		}
		if len(headers) < 1 {
			return fmt.Errorf(`blob attachments must not be empty`)
		}
		header := headers[0]
		if header == nil {
			continue
		}
		e.bumpSize(uint64(header.Size))

		// inject the form field header to
		// the previously constructed partial
		// attachment
		if e.attachments[blobId] != nil {
			e.attachments[blobId].header = header
		}
	}

	return nil
}

// readJsonRequest reads and validates the JSON event request payload for
// events and spans. Attachment metadata is extracted but files are not
// uploaded inline - signed URLs will be returned for separate upload.
func (e *eventreq) readJsonRequest(payload *IngestRequest) error {
	if len(payload.Events) < 1 && len(payload.Spans) < 1 {
		return fmt.Errorf(`payload must contain at least 1 event or 1 span`)
	}

	dupEvent := make(map[uuid.UUID]struct{})

	for i := range payload.Events {
		ev := payload.Events[i]

		// debug null anr/exception in payload cases
		//
		// suspicion: this happens for these payloads
		// {
		//   "id": "<uuid>,
		//   "session_id: "<uuid>",
		//   "type": "exception",
		//   "exception": null,
		// }
		// {
		//   "id": "<uuid>,
		//   "session_id: "<uuid>",
		//   "type": "anr",
		//   "anr": null,
		// }
		//
		// most likely, these orginiate from Android 11, 12
		// & 13 Redmi devices with user agent as "Dalvik/2.1.0 (Linux; U; Android 11; 2201116SI Build/RKQ1.211001.001)".
		//
		// since, the SDK has no fix for this issue, we handle
		// the panic & send a 400 - which would eventually lead
		// the SDK to delete such events.
		//
		// has been observed for exception & ANRs, but other
		// event types may be affected as well.
		//
		// see: https://github.com/measure-sh/measure/issues/2965
		if ev.IsException() && ev.Exception == nil {
			return fmt.Errorf(`%q must not be null`, `exception`)
		}
		if ev.IsANR() && ev.ANR == nil {
			return fmt.Errorf(`%q must not be null`, `anr`)
		}

		// discard batch if duplicate event ids found
		_, ok := dupEvent[ev.ID]
		if ok {
			return fmt.Errorf("duplicate event id %q found, discarding batch", ev.ID)
		}
		dupEvent[ev.ID] = struct{}{}

		bytes, err := json.Marshal(ev)
		if err != nil {
			return err
		}

		e.bumpSize(uint64(len(bytes)))
		ev.AppID = e.appId

		for _, attachment := range ev.Attachments {
			attachmentUploadInfo := AttachmentUploadInfo{
				ID:       attachment.ID,
				Type:     attachment.Type,
				Filename: attachment.Name,
			}

			e.attachmentUploadInfos = append(e.attachmentUploadInfos, attachmentUploadInfo)

			// Use actual attachment size for billing if provided
			// by newer SDKs. Fall back to estimates for older
			// SDKs that don't send size.
			if attachment.Size > 0 {
				e.bumpSize(attachment.Size)
			} else {
				e.bumpSize(estimateAttachmentSize(attachment.Name))
			}
		}

		// compute launch timings
		ev.ComputeLaunchTimes()

		// read OS name from payload if we haven't figured out already
		if e.osName == "" {
			e.osName = strings.ToLower(ev.Attribute.OSName)
		}

		e.events = append(e.events, ev)
	}

	dupSpan := make(map[string]struct{})

	for i := range payload.Spans {
		sp := payload.Spans[i]

		// discard batch if duplicate span ids found
		_, ok := dupSpan[sp.SpanID]
		if ok {
			return fmt.Errorf("duplicate span id %q found, discarding batch", sp.SpanID)
		}
		dupSpan[sp.SpanID] = struct{}{}

		bytes, err := json.Marshal(sp)
		if err != nil {
			return err
		}

		e.bumpSize(uint64(len(bytes)))
		sp.AppID = e.appId

		// read OS name from payload if we haven't figured out already
		if e.osName == "" {
			e.osName = strings.ToLower(sp.Attributes.OSName)
		}

		e.spans = append(e.spans, sp)
	}

	return nil
}

// generateAttachmentUploadURLs generates signed URLs for attachments
// to be uploaded by clients.
func (e *eventreq) generateAttachmentUploadURLs(ctx context.Context) error {
	config := server.Server.Config

	if config.IsCloud() {
		// GCS flow for cloud deployments
		client, err := objstore.CreateGCSClient(ctx)
		if err != nil {
			return fmt.Errorf("failed to create GCS client: %w", err)
		}
		defer client.Close()

		// for creating signed URLs, we need to tie the service account
		// identity along with the credentials. otherwise, the signed
		// URLs can't be generated and won't work as expected.
		iamClient, err := credentials.NewIamCredentialsClient(ctx)
		if err != nil {
			return fmt.Errorf("failed to create IAM client: %w", err)
		}
		defer iamClient.Close()

		signBytes := func(b []byte) ([]byte, error) {
			resp, err := iamClient.SignBlob(ctx, &credentialspb.SignBlobRequest{
				Name:    "projects/-/serviceAccounts/" + config.ServiceAccountEmail,
				Payload: b,
			})
			if err != nil {
				return nil, err
			}
			return resp.SignedBlob, nil
		}

		var signgroup errgroup.Group
		signgroup.SetLimit(16)

		for i := range e.attachmentUploadInfos {
			id := e.attachmentUploadInfos[i].ID
			filename := e.attachmentUploadInfos[i].Filename
			ext := filepath.Ext(filename)

			// Generate upload key and location
			uploadKey := id.String() + ext
			uploadLocation := event.BuildAttachmentLocation(uploadKey, event.LocationConfig{
				IsCloud:                 server.Server.Config.IsCloud(),
				AWSEndpoint:             server.Server.Config.AWSEndpoint,
				AttachmentsBucket:       server.Server.Config.AttachmentsBucket,
				AttachmentsBucketRegion: server.Server.Config.AttachmentsBucketRegion,
			})
			expiry := time.Now().Add(ExpiryDuration)

			metadata := []string{
				fmt.Sprintf("x-goog-meta-original_file_name: %s", filename),
			}

			signOptions := &storage.SignedURLOptions{
				GoogleAccessID: config.ServiceAccountEmail,
				SignBytes:      signBytes,
				Scheme:         storage.SigningSchemeV4,
				Method:         "PUT",
				Expires:        expiry,
				Headers:        metadata,
			}

			signgroup.Go(func() error {
				url, err := objstore.CreateGCSPUTPreSignedURL(client, config.AttachmentsBucket, uploadKey, signOptions)
				if err != nil {
					return fmt.Errorf("failed to create GCS PUT pre-signed URL for %v: %w", filename, err)
				}

				// Update the attachment info with URL and metadata
				e.attachmentUploadInfos[i].UploadURL = url
				e.attachmentUploadInfos[i].ExpiresAt = expiry
				e.attachmentUploadInfos[i].Headers = map[string]string{
					"x-goog-meta-original_file_name": filename,
				}
				e.attachmentUploadInfos[i].Key = uploadKey
				e.attachmentUploadInfos[i].Location = uploadLocation

				return nil
			})
		}

		if err := signgroup.Wait(); err != nil {
			return err
		}
	} else {
		// S3 flow for self-hosted deployments
		client := objstore.CreateS3Client(ctx, config.AttachmentsAccessKey, config.AttachmentsSecretAccessKey, config.AttachmentsBucketRegion, config.AWSEndpoint)

		for i := range e.attachmentUploadInfos {
			id := e.attachmentUploadInfos[i].ID
			filename := e.attachmentUploadInfos[i].Filename
			ext := filepath.Ext(filename)

			// Generate upload key and location (same format as multipart flow)
			uploadKey := id.String() + ext
			uploadLocation := event.BuildAttachmentLocation(uploadKey, event.LocationConfig{
				IsCloud:                 server.Server.Config.IsCloud(),
				AWSEndpoint:             server.Server.Config.AWSEndpoint,
				AttachmentsBucket:       server.Server.Config.AttachmentsBucket,
				AttachmentsBucketRegion: server.Server.Config.AttachmentsBucketRegion,
			})

			signedUrl, err := objstore.CreateS3PUTPreSignedURL(ctx, client, &s3.PutObjectInput{
				Bucket: aws.String(config.AttachmentsBucket),
				Key:    aws.String(uploadKey),
				Metadata: map[string]string{
					"original_file_name": filename,
				},
			}, s3.WithPresignExpires(time.Duration(ExpiryDuration)))

			if err != nil {
				return fmt.Errorf("failed to create S3 PUT pre-signed URL for %v: %w", filename, err)
			}

			// proxy the url for self-hosted
			proxyUrl := fmt.Sprintf("%s/proxy/attachments?payload=%s", config.APIOrigin, url.QueryEscape(signedUrl))

			// Update the attachment info with URL and metadata
			e.attachmentUploadInfos[i].UploadURL = proxyUrl
			e.attachmentUploadInfos[i].ExpiresAt = time.Now().Add(ExpiryDuration)
			e.attachmentUploadInfos[i].Headers = map[string]string{
				"x-amz-meta-original_file_name": filename,
			}
			e.attachmentUploadInfos[i].Key = uploadKey
			e.attachmentUploadInfos[i].Location = uploadLocation
		}
	}

	return nil
}

// hasAttachmentBlobs returns true if payload
// contains attachment blobs to be processed.
func (e eventreq) hasAttachmentBlobs() bool {
	return len(e.attachments) > 0
}

// hasAttachmentUploadInfos returns true if payload
// contains attachment upload infos to be processed.
func (e eventreq) hasAttachmentUploadInfos() bool {
	return len(e.attachmentUploadInfos) > 0
}

// validate validates the integrity of each event
// and corresponding attachments.
func (e eventreq) validate() error {
	if len(e.events) < 1 && len(e.spans) < 1 {
		return fmt.Errorf(`payload must contain at least 1 event or 1 span`)
	}

	for i := range e.events {
		if err := e.events[i].Validate(); err != nil {
			return err
		}
		if err := e.events[i].Attribute.Validate(); err != nil {
			return err
		}

		// only process user defined attributes
		// if the payload contains any.
		//
		// this check is super important to have
		// because SDKs without support for user
		// defined attributes won't ever send these.
		if !e.events[i].UserDefinedAttribute.Empty() {
			if err := e.events[i].UserDefinedAttribute.Validate(); err != nil {
				return err
			}
		}

		if e.hasAttachmentBlobs() || e.hasAttachmentUploadInfos() {
			for j := range e.events[i].Attachments {
				if err := e.events[i].Attachments[j].Validate(); err != nil {
					return err
				}
			}
		}
	}

	for i := range e.spans {
		if err := e.spans[i].Validate(); err != nil {
			return err
		}

		// only process user defined attributes
		// if the payload contains any.
		//
		// this check is super important to have
		// because SDKs without support for user
		// defined attributes won't ever send these.
		if !e.spans[i].UserDefinedAttribute.Empty() {
			if err := e.spans[i].UserDefinedAttribute.Validate(); err != nil {
				return err
			}
		}
	}

	if e.size >= uint64(maxBatchSize) {
		return fmt.Errorf(`payload cannot exceed maximum allowed size of %d`, maxBatchSize)
	}

	return nil
}

func PutEvents(c *gin.Context) {
	ingestReqTracer := otel.Tracer("ingest-req-tracer")
	ingestReqCtx, ingestReqSpan := ingestReqTracer.Start(context.Background(), "ingest-request")
	defer ingestReqSpan.End()

	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `error parsing app's uuid`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if err := CheckIngestAllowedForApp(c, appId); err != nil {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	reqIdKey := `msr-req-id`
	reqIdVal := c.Request.Header.Get(reqIdKey)
	if reqIdVal == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Errorf("no %q header value found", reqIdKey),
		})
		return
	}

	reqId, err := uuid.Parse(reqIdVal)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Errorf("%q value is not a valid UUID", reqIdKey),
		})
		return
	}

	_, selectAppSpan := ingestReqTracer.Start(ctx, "select-app")
	defer selectAppSpan.End()

	app, err := SelectApp(ctx, appId)
	if app == nil || err != nil {
		msg := `failed to lookup app`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	selectAppSpan.End()

	msg := `failed to parse event request payload`
	eventReq := eventreq{
		id:          reqId,
		appId:       appId,
		teamId:      app.TeamId,
		json:        strings.HasPrefix(c.ContentType(), "application/json"),
		osName:      app.OSName,
		attachments: make(map[uuid.UUID]*blob),
	}

	if eventReq.json {
		ingestPayload := IngestRequest{}

		_, parseJSONSpan := ingestReqTracer.Start(ingestReqCtx, "parse-json")
		defer parseJSONSpan.End()

		if err := c.ShouldBindJSON(&ingestPayload); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		parseJSONSpan.End()

		_, readRequestSpan := ingestReqTracer.Start(ingestReqCtx, "read")
		defer readRequestSpan.End()

		if err := eventReq.readJsonRequest(&ingestPayload); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		readRequestSpan.End()
	} else {
		if err := eventReq.readMultipartRequest(c); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if err := eventReq.checkSeen(ingestReqCtx); err != nil {
		msg := "failed to check for duplicate event request batch"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	// return early if we can recall this batch
	if eventReq.seen {
		if eventReq.json {
			if eventReq.hasAttachmentUploadInfos() {
				if err := eventReq.generateAttachmentUploadURLs(ingestReqCtx); err != nil {
					msg := `failed to generate attachment upload URLs for seen request`
					fmt.Println(msg, err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": msg,
					})
					return
				}
			}
			// for JSON requests, we return the attachment
			// upload info again, so that the client can
			// proceed to upload attachments if any.
			c.JSON(http.StatusOK, IngestResponse{
				AttachmentUploadInfo: eventReq.attachmentUploadInfos,
			})
		} else {
			c.JSON(http.StatusAccepted, gin.H{
				"ok": "accepted, known event request",
			})
		}
		return
	}

	_, validateReqSpan := ingestReqTracer.Start(ingestReqCtx, "validate")
	defer validateReqSpan.End()

	if err := eventReq.validate(); err != nil {
		msg := `failed to validate event request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	validateReqSpan.End()

	if eventReq.hasAttachmentBlobs() {
		// start span to trace attachment uploads
		_, uploadAttachmentSpan := ingestReqTracer.Start(ingestReqCtx, "upload-attachments")

		defer uploadAttachmentSpan.End()

		if err := eventReq.uploadAttachments(); err != nil {
			msg := `failed to upload attachments`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		uploadAttachmentSpan.End()

		for i := range eventReq.events {
			if !eventReq.events[i].HasAttachments() {
				continue
			}

			for j := range eventReq.events[i].Attachments {
				id := eventReq.events[i].Attachments[j].ID
				attachment, ok := eventReq.attachments[id]
				if !ok {
					continue
				}
				if !attachment.uploadedAttempted {
					fmt.Printf("attachment %q failed to upload for event %q, skipping\n", attachment.id, id)
					continue
				}

				eventReq.events[i].Attachments[j].Location = attachment.location
				eventReq.events[i].Attachments[j].Key = attachment.key
			}
		}
	}

	if eventReq.hasAttachmentUploadInfos() {
		_, genSignedURLsSpan := ingestReqTracer.Start(ingestReqCtx, "generate-signed-urls")
		defer genSignedURLsSpan.End()

		if err := eventReq.generateAttachmentUploadURLs(ingestReqCtx); err != nil {
			msg := `failed to generate attachment upload URLs`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		// Update event attachments with key and location from upload infos
		for i := range eventReq.events {
			if !eventReq.events[i].HasAttachments() {
				continue
			}

			for j := range eventReq.events[i].Attachments {
				id := eventReq.events[i].Attachments[j].ID
				// Find the corresponding attachment upload info
				for _, uploadInfo := range eventReq.attachmentUploadInfos {
					if uploadInfo.ID == id {
						eventReq.events[i].Attachments[j].Location = uploadInfo.Location
						eventReq.events[i].Attachments[j].Key = uploadInfo.Key
						break
					}
				}
			}
		}

		genSignedURLsSpan.End()
	}

	if eventReq.json {
		c.JSON(http.StatusOK, IngestResponse{
			AttachmentUploadInfo: eventReq.attachmentUploadInfos,
		})
	} else {
		c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
	}

	ingestReqSpan.End()

	batch := IngestBatch{
		BatchID:  eventReq.id.String(),
		AppID:    eventReq.appId.String(),
		TeamID:   eventReq.teamId.String(),
		OsName:   eventReq.osName,
		ClientIP: c.ClientIP(),
		Size:     eventReq.size,
		Events:   eventReq.events,
		Spans:    eventReq.spans,
	}

	payload, err := json.Marshal(batch)
	if err != nil {
		fmt.Println("failed to marshal ingest batch for publish:", err)
		return
	}

	if err := server.Server.BusProducer.Publish(context.Background(), payload); err != nil {
		fmt.Println("failed to publish ingest batch:", err)
	} else {
		ingestBatchPublishCount.Add(c.Request.Context(), 1)
	}
}
