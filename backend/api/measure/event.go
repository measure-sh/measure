package measure

import (
	"backend/api/ambient"
	"backend/api/chrono"
	"backend/api/concur"
	"backend/api/event"
	"backend/api/group"
	"backend/api/inet"
	"backend/api/objstore"
	"backend/api/opsys"
	"backend/api/server"
	"backend/api/span"
	"backend/api/symbolicator"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	credentials "cloud.google.com/go/iam/credentials/apiv1"
	"cloud.google.com/go/iam/credentials/apiv1/credentialspb"
	"cloud.google.com/go/storage"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
	"golang.org/x/sync/errgroup"
)

// maxBatchSize is the maximum allowed payload
// size of event request in bytes.
var maxBatchSize = 20 * 1024 * 1024

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
	// symbolicateEvents is a look up table to find
	// the events that need symbolication
	symbolicateEvents map[uuid.UUID]int
	// symbolicateSpans is a look up table to find
	// the spans that need symbolication
	symbolicateSpans map[string]int
	// exceptionIds is a list of all unhandled exception
	// event ids
	exceptionIds []int
	// anrIds is a list of all ANR event IDs
	anrIds []int
	// size keeps track of the ingest payload size
	size int64
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
		attachment.location = event.BuildAttachmentLocation(key)

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

			if err := eventAttachment.Upload(bgCtx); err != nil {
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
func (e *eventreq) bumpSize(n int64) {
	e.size = e.size + n
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

		// debug null exception in payload cases
		//
		// suspicion: this happens for the payload
		// {
		//   "id": "<uuid>,
		//   "session_id: "<uuid>",
		//   "type": "exception",
		//   "exception": null,
		// }
		//
		// to better track what's going on, for now
		// handle the condition to prevent panic
		// downstream. if we don't see any more panics
		// then that means it's an SDK side issue.
		//
		// FIXME: improve & refactor later.
		//
		// see: https://github.com/measure-sh/measure/issues/2965
		if ev.IsException() && ev.Exception == nil {
			return fmt.Errorf(`%q must not be null`, `exception`)
		}

		// discard batch if duplicate
		// event ids found
		_, ok := dupEvent[ev.ID]
		if ok {
			return fmt.Errorf("duplicate event id %q found, discarding batch", ev.ID)
		} else {
			dupEvent[ev.ID] = struct{}{}
		}

		e.bumpSize(int64(len(bytes)))
		ev.AppID = e.appId

		if ev.NeedsSymbolication() {
			e.symbolicateEvents[ev.ID] = i
		}

		if ev.IsUnhandledException() {
			e.exceptionIds = append(e.exceptionIds, i)
		}

		if ev.IsANR() {
			e.anrIds = append(e.anrIds, i)
		}

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

		e.bumpSize(int64(len(bytes)))
		sp.AppID = e.appId

		if sp.NeedsSymbolication() {
			e.symbolicateSpans[sp.SpanName] = i
		}

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
		e.bumpSize(header.Size)

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

		// debug null exception in payload cases
		//
		// suspicion: this happens for the payload
		// {
		//   "id": "<uuid>,
		//   "session_id: "<uuid>",
		//   "type": "exception",
		//   "exception": null,
		// }
		//
		// to better track what's going on, for now
		// handle the condition to prevent panic
		// downstream. if we don't see any more panics
		// then that means it's an SDK side issue.
		//
		// FIXME: improve & refactor later.
		//
		// see: https://github.com/measure-sh/measure/issues/2965
		if ev.IsException() && ev.Exception == nil {
			return fmt.Errorf(`%q must not be null`, `exception`)
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

		e.bumpSize(int64(len(bytes)))
		ev.AppID = e.appId

		if ev.NeedsSymbolication() {
			e.symbolicateEvents[ev.ID] = i
		}

		if ev.IsUnhandledException() {
			e.exceptionIds = append(e.exceptionIds, i)
		}

		if ev.IsANR() {
			e.anrIds = append(e.anrIds, i)
		}

		for _, attachment := range ev.Attachments {
			attachmentUploadInfo := AttachmentUploadInfo{
				ID:       attachment.ID,
				Type:     attachment.Type,
				Filename: attachment.Name,
			}

			e.attachmentUploadInfos = append(e.attachmentUploadInfos, attachmentUploadInfo)
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

		e.bumpSize(int64(len(bytes)))
		sp.AppID = e.appId

		if sp.NeedsSymbolication() {
			e.symbolicateSpans[sp.SpanName] = i
		}

		// read OS name from payload if we haven't figured out already
		if e.osName == "" {
			e.osName = strings.ToLower(sp.Attributes.OSName)
		}

		e.spans = append(e.spans, sp)
	}

	return nil
}

// infuseInet looks up the country code for the IP
// and infuses the country code and IP info to each event.
func (e *eventreq) infuseInet(rawIP string) error {
	ip := net.ParseIP(rawIP)
	country, err := inet.CountryCode(ip)
	if err != nil {
		return err
	}

	v4 := inet.Isv4(ip)

	for i := range e.events {
		if v4 {
			e.events[i].IPv4 = ip
		} else {
			e.events[i].IPv6 = ip
		}

		if country != "" {
			e.events[i].CountryCode = country
		} else if inet.IsBogon(ip) {
			e.events[i].CountryCode = "bogon"
		} else {
			e.events[i].CountryCode = "n/a"
		}
	}

	for i := range e.spans {
		if country != "" {
			e.spans[i].Attributes.CountryCode = country
		} else if inet.IsBogon(ip) {
			e.spans[i].Attributes.CountryCode = "bogon"
		} else {
			e.spans[i].Attributes.CountryCode = "n/a"
		}
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
			uploadLocation := event.BuildAttachmentLocation(uploadKey)
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
			uploadLocation := event.BuildAttachmentLocation(uploadKey)

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

func (e *eventreq) countMetrics() (sessions, events, spans, attachments uint32) {
	events = uint32(len(e.events))

	sessions = 0
	for _, ev := range e.events {
		if ev.Type == event.TypeSessionStart {
			sessions++
		}
	}

	if e.hasAttachmentBlobs() {
		attachments = uint32(len(e.attachments))
	} else if e.hasAttachmentUploadInfos() {
		attachments = uint32(len(e.attachmentUploadInfos))
	}

	spans = uint32(len(e.spans))

	return sessions, events, spans, attachments
}

// onboardable determines if the ingest batch
// meets the conditions for onboarding the app.
func (e eventreq) onboardable() (ok bool) {
	if len(e.events) > 0 || len(e.spans) > 0 {
		ok = true
	}
	return
}

// remember stores the ingest batch record for future idempotency
func (e eventreq) remember(ctx context.Context) (err error) {
	stmt := sqlf.InsertInto("ingested_batches").
		NewRow().
		Set("team_id", e.teamId).
		Set("app_id", e.appId).
		Set("batch_id", e.id).
		Set("timestamp", time.Now())

	defer stmt.Close()

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
}

// hasUnhandledExceptions returns true if event payload
// contains unhandled exceptions.
func (e eventreq) hasUnhandledExceptions() bool {
	return len(e.exceptionIds) > 0
}

// hasANRs returns true if event payload contains
// ANRs.
func (e eventreq) hasANRs() bool {
	return len(e.anrIds) > 0
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

// getOSName extracts the operating system name
// of the app from ingest batch.
func (e eventreq) getOSName() (osName string) {
	if len(e.events) > 0 {
		return strings.ToLower(e.events[0].Attribute.OSName)
	}

	return strings.ToLower(e.spans[0].Attributes.OSName)
}

// getOSVersion extracts the operating system version
// of the app from ingest batch.
func (e eventreq) getOSVersion() (osVersion string) {
	if len(e.events) > 0 {
		return strings.ToLower(e.events[0].Attribute.OSVersion)
	}

	return strings.ToLower(e.spans[0].Attributes.OSVersion)
}

// getAppUniqueID extracts the app's unique identifier from
// ingest batch.
func (e eventreq) getAppUniqueID() (appUniqueID string) {
	if len(e.events) > 0 {
		return strings.ToLower(e.events[0].Attribute.AppUniqueID)
	}

	return strings.ToLower(e.spans[0].Attributes.AppUniqueID)
}

// getUnhandledExceptions returns unhandled exceptions
// from the event payload.
func (e eventreq) getUnhandledExceptions() (events []event.EventField) {
	if !e.hasUnhandledExceptions() {
		return
	}
	for _, v := range e.exceptionIds {
		events = append(events, e.events[v])
	}
	return
}

// getANRs returns ANRs from the event payload.
func (e eventreq) getANRs() (events []event.EventField) {
	if !e.hasANRs() {
		return
	}
	for _, v := range e.anrIds {
		events = append(events, e.events[v])
	}
	return
}

// bucketUnhandledExceptions groups unhandled exceptions
// based on similarity.
func (e eventreq) bucketUnhandledExceptions(ctx context.Context) (err error) {
	events := e.getUnhandledExceptions()

	for i := range events {
		if events[i].Exception.Fingerprint == "" {
			msg := fmt.Sprintf("no fingerprint found for event %q, cannot bucket exception", events[i].ID)
			fmt.Println(msg)
			continue
		}

		exceptionGroup := group.NewExceptionGroup(
			events[i].AppID,
			events[i].CountryCode,
			events[i].Attribute,
			events[i].Exception.Fingerprint,
			events[i].Exception.GetType(),
			events[i].Exception.GetMessage(),
			events[i].Exception.GetMethodName(),
			events[i].Exception.GetFileName(),
			events[i].Exception.GetLineNumber(),
			events[i].Timestamp,
		)

		if err = exceptionGroup.Insert(ctx); err != nil {
			return
		}
	}

	return
}

// bucketANRs groups ANRs based on similarity.
func (e eventreq) bucketANRs(ctx context.Context) (err error) {
	events := e.getANRs()

	for i := range events {
		if events[i].ANR.Fingerprint == "" {
			msg := fmt.Sprintf("no fingerprint found for event %q, cannot bucket ANR", events[i].ID)
			fmt.Println(msg)
			continue
		}

		anrGroup := group.NewANRGroup(
			events[i].AppID,
			events[i].CountryCode,
			events[i].Attribute,
			events[i].ANR.Fingerprint,
			events[i].ANR.GetType(),
			events[i].ANR.GetMessage(),
			events[i].ANR.GetMethodName(),
			events[i].ANR.GetFileName(),
			events[i].ANR.GetLineNumber(),
			events[i].Timestamp,
		)

		if err := anrGroup.Insert(ctx); err != nil {
			return err
		}
	}

	return
}

// needsSymbolication returns true if payload
// contains events that should be symbolicated.
func (e eventreq) needsSymbolication() bool {
	return len(e.symbolicateEvents) > 0 || len(e.symbolicateSpans) > 0
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

	if e.size >= int64(maxBatchSize) {
		return fmt.Errorf(`payload cannot exceed maximum allowed size of %d`, maxBatchSize)
	}

	return nil
}

// ingestEvents writes the events to database.
func (e eventreq) ingestEvents(ctx context.Context) error {
	if len(e.events) == 0 {
		return nil
	}

	stmt := sqlf.InsertInto(`events`)
	defer stmt.Close()

	for i := range e.events {
		anrExceptions := "[]"
		anrThreads := "[]"
		exceptionExceptions := "[]"
		exceptionThreads := "[]"
		attachments := "[]"
		binaryImages := "[]"
		error := "{}"

		if e.events[i].IsANR() {
			marshalledExceptions, err := json.Marshal(e.events[i].ANR.Exceptions)
			if err != nil {
				return err
			}
			anrExceptions = string(marshalledExceptions)
			marshalledThreads, err := json.Marshal(e.events[i].ANR.Threads)
			if err != nil {
				return err
			}
			anrThreads = string(marshalledThreads)
			if err := e.events[i].ANR.ComputeFingerprint(); err != nil {
				return err
			}
		}
		if e.events[i].IsException() {
			marshalledExceptions, err := json.Marshal(e.events[i].Exception.Exceptions)
			if err != nil {
				return err
			}
			exceptionExceptions = string(marshalledExceptions)

			marshalledThreads, err := json.Marshal(e.events[i].Exception.Threads)
			if err != nil {
				return err
			}
			exceptionThreads = string(marshalledThreads)
			if err := e.events[i].Exception.ComputeFingerprint(); err != nil {
				return err
			}

			if len(e.events[i].Exception.BinaryImages) > 0 {
				marshalledImages, err := json.Marshal(e.events[i].Exception.BinaryImages)
				if err != nil {
					return err
				}
				binaryImages = string(marshalledImages)
			}

			if e.events[i].Exception.HasError() {
				marshalledError, err := json.Marshal(e.events[i].Exception.Error)
				if err != nil {
					return err
				}

				error = string(marshalledError)
			}
		}

		if e.events[i].HasAttachments() {
			marshalledAttachments, err := json.Marshal(e.events[i].Attachments)
			if err != nil {
				return err
			}
			attachments = string(marshalledAttachments)
		}

		row := stmt.NewRow().
			Set(`id`, e.events[i].ID).
			Set(`team_id`, e.teamId).
			Set(`app_id`, e.events[i].AppID).
			Set(`session_id`, e.events[i].SessionID).
			Set(`timestamp`, e.events[i].Timestamp.Format(chrono.MSTimeFormat)).
			Set(`type`, e.events[i].Type).
			Set(`user_triggered`, e.events[i].UserTriggered).
			Set(`inet.ipv4`, e.events[i].IPv4).
			Set(`inet.ipv6`, e.events[i].IPv6).
			Set(`inet.country_code`, e.events[i].CountryCode).

			// attribute
			Set(`attribute.installation_id`, e.events[i].Attribute.InstallationID).
			Set(`attribute.app_version`, e.events[i].Attribute.AppVersion).
			Set(`attribute.app_build`, e.events[i].Attribute.AppBuild).
			Set(`attribute.app_unique_id`, e.events[i].Attribute.AppUniqueID).
			Set(`attribute.platform`, e.events[i].Attribute.Platform).
			Set(`attribute.measure_sdk_version`, e.events[i].Attribute.MeasureSDKVersion).
			Set(`attribute.thread_name`, e.events[i].Attribute.ThreadName).
			Set(`attribute.user_id`, e.events[i].Attribute.UserID).
			Set(`attribute.device_name`, e.events[i].Attribute.DeviceName).
			Set(`attribute.device_model`, e.events[i].Attribute.DeviceModel).
			Set(`attribute.device_manufacturer`, e.events[i].Attribute.DeviceManufacturer).
			Set(`attribute.device_type`, e.events[i].Attribute.DeviceType).
			Set(`attribute.device_is_foldable`, e.events[i].Attribute.DeviceIsFoldable).
			Set(`attribute.device_is_physical`, e.events[i].Attribute.DeviceIsPhysical).
			Set(`attribute.device_density_dpi`, e.events[i].Attribute.DeviceDensityDPI).
			Set(`attribute.device_width_px`, e.events[i].Attribute.DeviceWidthPX).
			Set(`attribute.device_height_px`, e.events[i].Attribute.DeviceHeightPX).
			Set(`attribute.device_density`, e.events[i].Attribute.DeviceDensity).
			Set(`attribute.device_locale`, e.events[i].Attribute.DeviceLocale).
			Set(`attribute.device_low_power_mode`, e.events[i].Attribute.DeviceLowPowerMode).
			Set(`attribute.device_thermal_throttling_enabled`, e.events[i].Attribute.DeviceThermalThrottlingEnabled).
			Set(`attribute.device_cpu_arch`, e.events[i].Attribute.DeviceCPUArch).
			Set(`attribute.os_name`, e.events[i].Attribute.OSName).
			Set(`attribute.os_version`, e.events[i].Attribute.OSVersion).
			Set(`attribute.os_page_size`, e.events[i].Attribute.OSPageSize).
			Set(`attribute.network_type`, e.events[i].Attribute.NetworkType).
			Set(`attribute.network_generation`, e.events[i].Attribute.NetworkGeneration).
			Set(`attribute.network_provider`, e.events[i].Attribute.NetworkProvider).

			// user defined attribute
			Set(`user_defined_attribute`, e.events[i].UserDefinedAttribute.Parameterize()).

			// attachments
			Set(`attachments`, attachments)

		// anr
		if e.events[i].IsANR() {
			row.
				Set(`anr.handled`, e.events[i].ANR.Handled).
				Set(`anr.fingerprint`, e.events[i].ANR.Fingerprint).
				Set(`anr.exceptions`, anrExceptions).
				Set(`anr.threads`, anrThreads).
				Set(`anr.foreground`, e.events[i].ANR.Foreground)
		} else {
			row.
				Set(`anr.handled`, nil).
				Set(`anr.fingerprint`, nil).
				Set(`anr.exceptions`, nil).
				Set(`anr.threads`, nil).
				Set(`anr.foreground`, nil)
		}

		// exception
		if e.events[i].IsException() {
			row.
				Set(`exception.handled`, e.events[i].Exception.Handled).
				Set(`exception.fingerprint`, e.events[i].Exception.Fingerprint).
				Set(`exception.exceptions`, exceptionExceptions).
				Set(`exception.threads`, exceptionThreads).
				Set(`exception.foreground`, e.events[i].Exception.Foreground).
				Set(`exception.binary_images`, binaryImages).
				Set(`exception.framework`, e.events[i].Exception.GetFramework()).
				Set(`exception.error`, error)
		} else {
			row.
				Set(`exception.handled`, nil).
				Set(`exception.fingerprint`, nil).
				Set(`exception.exceptions`, nil).
				Set(`exception.threads`, nil).
				Set(`exception.foreground`, nil).
				Set(`exception.binary_images`, nil).
				Set(`exception.framework`, nil).
				Set(`exception.error`, nil)
		}

		// app exit
		if e.events[i].IsAppExit() {
			row.
				Set(`app_exit.reason`, e.events[i].AppExit.Reason).
				Set(`app_exit.importance`, e.events[i].AppExit.Importance).
				Set(`app_exit.trace`, e.events[i].AppExit.Trace).
				Set(`app_exit.process_name`, e.events[i].AppExit.ProcessName).
				Set(`app_exit.pid`, e.events[i].AppExit.PID)
		} else {
			row.
				Set(`app_exit.reason`, nil).
				Set(`app_exit.importance`, nil).
				Set(`app_exit.trace`, nil).
				Set(`app_exit.process_name`, nil).
				Set(`app_exit.pid`, nil)
		}

		// string
		if e.events[i].IsString() {
			row.
				Set(`string.severity_text`, e.events[i].LogString.SeverityText).
				Set(`string.string`, e.events[i].LogString.String)
		} else {
			row.
				Set(`string.severity_text`, nil).
				Set(`string.string`, nil)
		}

		// gesture long click
		if e.events[i].IsGestureLongClick() {
			row.
				Set(`gesture_long_click.target`, e.events[i].GestureLongClick.Target).
				Set(`gesture_long_click.target_id`, e.events[i].GestureLongClick.TargetID).
				Set(`gesture_long_click.touch_down_time`, e.events[i].GestureLongClick.TouchDownTime).
				Set(`gesture_long_click.touch_up_time`, e.events[i].GestureLongClick.TouchUpTime).
				Set(`gesture_long_click.width`, e.events[i].GestureLongClick.Width).
				Set(`gesture_long_click.height`, e.events[i].GestureLongClick.Height).
				Set(`gesture_long_click.x`, e.events[i].GestureLongClick.X).
				Set(`gesture_long_click.y`, e.events[i].GestureLongClick.Y)
		} else {
			row.
				Set(`gesture_long_click.target`, nil).
				Set(`gesture_long_click.target_id`, nil).
				Set(`gesture_long_click.touch_down_time`, nil).
				Set(`gesture_long_click.touch_up_time`, nil).
				Set(`gesture_long_click.width`, nil).
				Set(`gesture_long_click.height`, nil).
				Set(`gesture_long_click.x`, nil).
				Set(`gesture_long_click.y`, nil)
		}

		// gesture click
		if e.events[i].IsGestureClick() {
			row.
				Set(`gesture_click.target`, e.events[i].GestureClick.Target).
				Set(`gesture_click.target_id`, e.events[i].GestureClick.TargetID).
				Set(`gesture_click.touch_down_time`, e.events[i].GestureClick.TouchDownTime).
				Set(`gesture_click.touch_up_time`, e.events[i].GestureClick.TouchUpTime).
				Set(`gesture_click.width`, e.events[i].GestureClick.Width).
				Set(`gesture_click.height`, e.events[i].GestureClick.Height).
				Set(`gesture_click.x`, e.events[i].GestureClick.X).
				Set(`gesture_click.y`, e.events[i].GestureClick.Y)
		} else {
			row.
				Set(`gesture_click.target`, nil).
				Set(`gesture_click.target_id`, nil).
				Set(`gesture_click.touch_down_time`, nil).
				Set(`gesture_click.touch_up_time`, nil).
				Set(`gesture_click.width`, nil).
				Set(`gesture_click.height`, nil).
				Set(`gesture_click.x`, nil).
				Set(`gesture_click.y`, nil)
		}

		// gesture scroll
		if e.events[i].IsGestureScroll() {
			row.
				Set(`gesture_scroll.target`, e.events[i].GestureScroll.Target).
				Set(`gesture_scroll.target_id`, e.events[i].GestureScroll.TargetID).
				Set(`gesture_scroll.touch_down_time`, e.events[i].GestureScroll.TouchDownTime).
				Set(`gesture_scroll.touch_up_time`, e.events[i].GestureScroll.TouchUpTime).
				Set(`gesture_scroll.x`, e.events[i].GestureScroll.X).
				Set(`gesture_scroll.y`, e.events[i].GestureScroll.Y).
				Set(`gesture_scroll.end_x`, e.events[i].GestureScroll.EndX).
				Set(`gesture_scroll.end_y`, e.events[i].GestureScroll.EndY).
				Set(`gesture_scroll.direction`, e.events[i].GestureScroll.Direction)
		} else {
			row.
				Set(`gesture_scroll.target`, nil).
				Set(`gesture_scroll.target_id`, nil).
				Set(`gesture_scroll.touch_down_time`, nil).
				Set(`gesture_scroll.touch_up_time`, nil).
				Set(`gesture_scroll.x`, nil).
				Set(`gesture_scroll.y`, nil).
				Set(`gesture_scroll.end_x`, nil).
				Set(`gesture_scroll.end_y`, nil).
				Set(`gesture_scroll.direction`, nil)
		}

		// lifecycle activity
		if e.events[i].IsLifecycleActivity() {
			row.
				Set(`lifecycle_activity.type`, e.events[i].LifecycleActivity.Type).
				Set(`lifecycle_activity.class_name`, e.events[i].LifecycleActivity.ClassName).
				Set(`lifecycle_activity.intent`, e.events[i].LifecycleActivity.Intent).
				Set(`lifecycle_activity.saved_instance_state`, e.events[i].LifecycleActivity.SavedInstanceState)
		} else {
			row.
				Set(`lifecycle_activity.type`, nil).
				Set(`lifecycle_activity.class_name`, nil).
				Set(`lifecycle_activity.intent`, nil).
				Set(`lifecycle_activity.saved_instance_state`, nil)
		}

		// lifecycle fragment
		if e.events[i].IsLifecycleFragment() {
			row.
				Set(`lifecycle_fragment.type`, e.events[i].LifecycleFragment.Type).
				Set(`lifecycle_fragment.class_name`, e.events[i].LifecycleFragment.ClassName).
				Set(`lifecycle_fragment.parent_activity`, e.events[i].LifecycleFragment.ParentActivity).
				Set(`lifecycle_fragment.parent_fragment`, e.events[i].LifecycleFragment.ParentFragment).
				Set(`lifecycle_fragment.tag`, e.events[i].LifecycleFragment.Tag)
		} else {
			row.
				Set(`lifecycle_fragment.type`, nil).
				Set(`lifecycle_fragment.class_name`, nil).
				Set(`lifecycle_fragment.parent_activity`, nil).
				Set(`lifecycle_fragment.parent_fragment`, nil).
				Set(`lifecycle_fragment.tag`, nil)
		}

		// lifecycle view controller
		if e.events[i].IsLifecycleViewController() {
			row.
				Set(`lifecycle_view_controller.type`, e.events[i].LifecycleViewController.Type).
				Set(`lifecycle_view_controller.class_name`, e.events[i].LifecycleViewController.ClassName)
		} else {
			row.
				Set(`lifecycle_view_controller.type`, nil).
				Set(`lifecycle_view_controller.class_name`, nil)
		}

		// lifecycle swift ui
		if e.events[i].IsLifecycleSwiftUI() {
			row.
				Set(`lifecycle_swift_ui.type`, e.events[i].LifecycleSwiftUI.Type).
				Set(`lifecycle_swift_ui.class_name`, e.events[i].LifecycleSwiftUI.ClassName)
		} else {
			row.
				Set(`lifecycle_swift_ui.type`, nil).
				Set(`lifecycle_swift_ui.class_name`, nil)
		}

		// lifecycle app
		if e.events[i].IsLifecycleApp() {
			row.
				Set(`lifecycle_app.type`, e.events[i].LifecycleApp.Type)
		} else {
			row.
				Set(`lifecycle_app.type`, nil)
		}

		// cold launch
		if e.events[i].IsColdLaunch() {
			row.
				Set(`cold_launch.process_start_uptime`, e.events[i].ColdLaunch.ProcessStartUptime).
				Set(`cold_launch.process_start_requested_uptime`, e.events[i].ColdLaunch.ProcessStartRequestedUptime).
				Set(`cold_launch.content_provider_attach_uptime`, e.events[i].ColdLaunch.ContentProviderAttachUptime).
				Set(`cold_launch.on_next_draw_uptime`, e.events[i].ColdLaunch.OnNextDrawUptime).
				Set(`cold_launch.launched_activity`, e.events[i].ColdLaunch.LaunchedActivity).
				Set(`cold_launch.has_saved_state`, e.events[i].ColdLaunch.HasSavedState).
				Set(`cold_launch.intent_data`, e.events[i].ColdLaunch.IntentData).
				Set(`cold_launch.duration`, e.events[i].ColdLaunch.Duration.Milliseconds())
		} else {
			row.
				Set(`cold_launch.process_start_uptime`, nil).
				Set(`cold_launch.process_start_requested_uptime`, nil).
				Set(`cold_launch.content_provider_attach_uptime`, nil).
				Set(`cold_launch.on_next_draw_uptime`, nil).
				Set(`cold_launch.launched_activity`, nil).
				Set(`cold_launch.has_saved_state`, nil).
				Set(`cold_launch.intent_data`, nil).
				Set(`cold_launch.duration`, nil)

		}

		// warm launch
		if e.events[i].IsWarmLaunch() {
			row.
				Set(`warm_launch.app_visible_uptime`, e.events[i].WarmLaunch.AppVisibleUptime).
				Set(`warm_launch.process_start_uptime`, e.events[i].WarmLaunch.ProcessStartUptime).
				Set(`warm_launch.process_start_requested_uptime`, e.events[i].WarmLaunch.ProcessStartRequestedUptime).
				Set(`warm_launch.content_provider_attach_uptime`, e.events[i].WarmLaunch.ContentProviderAttachUptime).
				Set(`warm_launch.on_next_draw_uptime`, e.events[i].WarmLaunch.OnNextDrawUptime).
				Set(`warm_launch.launched_activity`, e.events[i].WarmLaunch.LaunchedActivity).
				Set(`warm_launch.has_saved_state`, e.events[i].WarmLaunch.HasSavedState).
				Set(`warm_launch.intent_data`, e.events[i].WarmLaunch.IntentData).
				Set(`warm_launch.duration`, e.events[i].WarmLaunch.Duration.Milliseconds()).
				Set(`warm_launch.is_lukewarm`, e.events[i].WarmLaunch.IsLukewarm)
		} else {
			row.
				Set(`warm_launch.app_visible_uptime`, nil).
				Set(`warm_launch.process_start_uptime`, nil).
				Set(`warm_launch.process_start_requested_uptime`, nil).
				Set(`warm_launch.content_provider_attach_uptime`, nil).
				Set(`warm_launch.on_next_draw_uptime`, nil).
				Set(`warm_launch.launched_activity`, nil).
				Set(`warm_launch.has_saved_state`, nil).
				Set(`warm_launch.intent_data`, nil).
				Set(`warm_launch.duration`, nil).
				Set(`warm_launch.is_lukewarm`, nil)
		}

		// hot launch
		if e.events[i].IsHotLaunch() {
			row.
				Set(`hot_launch.app_visible_uptime`, e.events[i].HotLaunch.AppVisibleUptime).
				Set(`hot_launch.on_next_draw_uptime`, e.events[i].HotLaunch.OnNextDrawUptime).
				Set(`hot_launch.launched_activity`, e.events[i].HotLaunch.LaunchedActivity).
				Set(`hot_launch.has_saved_state`, e.events[i].HotLaunch.HasSavedState).
				Set(`hot_launch.intent_data`, e.events[i].HotLaunch.IntentData).
				Set(`hot_launch.duration`, e.events[i].HotLaunch.Duration.Milliseconds())
		} else {
			row.
				Set(`hot_launch.app_visible_uptime`, nil).
				Set(`hot_launch.on_next_draw_uptime`, nil).
				Set(`hot_launch.launched_activity`, nil).
				Set(`hot_launch.has_saved_state`, nil).
				Set(`hot_launch.intent_data`, nil).
				Set(`hot_launch.duration`, nil)
		}

		// network change
		if e.events[i].IsNetworkChange() {
			row.
				Set(`network_change.network_type`, e.events[i].NetworkChange.NetworkType).
				Set(`network_change.previous_network_type`, e.events[i].NetworkChange.PreviousNetworkType).
				Set(`network_change.network_generation`, e.events[i].NetworkChange.NetworkGeneration).
				Set(`network_change.previous_network_generation`, e.events[i].NetworkChange.PreviousNetworkGeneration)
		} else {
			row.
				Set(`network_change.network_type`, nil).
				Set(`network_change.previous_network_type`, nil).
				Set(`network_change.network_generation`, nil).
				Set(`network_change.previous_network_generation`, nil)
		}

		// http
		if e.events[i].IsHttp() {
			row.
				Set(`http.url`, e.events[i].Http.URL).
				Set(`http.method`, e.events[i].Http.Method).
				Set(`http.status_code`, e.events[i].Http.StatusCode).
				Set(`http.start_time`, e.events[i].Http.StartTime).
				Set(`http.end_time`, e.events[i].Http.EndTime).
				Set(`http_request_headers`, e.events[i].Http.RequestHeaders).
				Set(`http_response_headers`, e.events[i].Http.ResponseHeaders).
				Set(`http.request_body`, e.events[i].Http.RequestBody).
				Set(`http.response_body`, e.events[i].Http.ResponseBody).
				Set(`http.failure_reason`, e.events[i].Http.FailureReason).
				Set(`http.failure_description`, e.events[i].Http.FailureDescription).
				Set(`http.client`, e.events[i].Http.Client)
		} else {
			row.
				Set(`http.url`, nil).
				Set(`http.method`, nil).
				Set(`http.status_code`, nil).
				Set(`http.start_time`, nil).
				Set(`http.end_time`, nil).
				Set(`http_request_headers`, nil).
				Set(`http_response_headers`, nil).
				Set(`http.request_body`, nil).
				Set(`http.response_body`, nil).
				Set(`http.failure_reason`, nil).
				Set(`http.failure_description`, nil).
				Set(`http.client`, nil)

		}

		// memory usage
		if e.events[i].IsMemoryUsage() {
			row.
				Set(`memory_usage.java_max_heap`, e.events[i].MemoryUsage.JavaMaxHeap).
				Set(`memory_usage.java_total_heap`, e.events[i].MemoryUsage.JavaTotalHeap).
				Set(`memory_usage.java_free_heap`, e.events[i].MemoryUsage.JavaFreeHeap).
				Set(`memory_usage.total_pss`, e.events[i].MemoryUsage.TotalPSS).
				Set(`memory_usage.rss`, e.events[i].MemoryUsage.RSS).
				Set(`memory_usage.native_total_heap`, e.events[i].MemoryUsage.NativeTotalHeap).
				Set(`memory_usage.native_free_heap`, e.events[i].MemoryUsage.NativeFreeHeap).
				Set(`memory_usage.interval`, e.events[i].MemoryUsage.Interval)
		} else {
			row.
				Set(`memory_usage.java_max_heap`, nil).
				Set(`memory_usage.java_total_heap`, nil).
				Set(`memory_usage.java_free_heap`, nil).
				Set(`memory_usage.total_pss`, nil).
				Set(`memory_usage.rss`, nil).
				Set(`memory_usage.native_total_heap`, nil).
				Set(`memory_usage.native_free_heap`, nil).
				Set(`memory_usage.interval`, nil)
		}

		// memory usage absolute
		if e.events[i].IsMemoryUsageAbs() {
			row.
				Set(`memory_usage_absolute.max_memory`, e.events[i].MemoryUsageAbs.MaxMemory).
				Set(`memory_usage_absolute.used_memory`, e.events[i].MemoryUsageAbs.UsedMemory).
				Set(`memory_usage_absolute.interval`, e.events[i].MemoryUsageAbs.Interval)
		} else {
			row.
				Set(`memory_usage_absolute.max_memory`, nil).
				Set(`memory_usage_absolute.used_memory`, nil).
				Set(`memory_usage_absolute.interval`, nil)
		}

		// low memory
		if e.events[i].IsLowMemory() {
			row.
				Set(`low_memory.java_max_heap`, e.events[i].LowMemory.JavaMaxHeap).
				Set(`low_memory.java_total_heap`, e.events[i].LowMemory.JavaTotalHeap).
				Set(`low_memory.java_free_heap`, e.events[i].LowMemory.JavaFreeHeap).
				Set(`low_memory.total_pss`, e.events[i].LowMemory.TotalPSS).
				Set(`low_memory.rss`, e.events[i].LowMemory.RSS).
				Set(`low_memory.native_total_heap`, e.events[i].LowMemory.NativeTotalHeap).
				Set(`low_memory.native_free_heap`, e.events[i].LowMemory.NativeFreeHeap)
		} else {
			row.
				Set(`low_memory.java_max_heap`, nil).
				Set(`low_memory.java_total_heap`, nil).
				Set(`low_memory.java_free_heap`, nil).
				Set(`low_memory.total_pss`, nil).
				Set(`low_memory.rss`, nil).
				Set(`low_memory.native_total_heap`, nil).
				Set(`low_memory.native_free_heap`, nil)
		}

		// trim memory
		if e.events[i].IsTrimMemory() {
			row.
				Set(`trim_memory.level`, e.events[i].TrimMemory.Level)
		} else {
			row.
				Set(`trim_memory.level`, nil)
		}

		// cpu usage
		if e.events[i].IsCPUUsage() {
			row.
				Set(`cpu_usage.num_cores`, e.events[i].CPUUsage.NumCores).
				Set(`cpu_usage.clock_speed`, e.events[i].CPUUsage.ClockSpeed).
				Set(`cpu_usage.uptime`, e.events[i].CPUUsage.Uptime).
				Set(`cpu_usage.utime`, e.events[i].CPUUsage.UTime).
				Set(`cpu_usage.cutime`, e.events[i].CPUUsage.CUTime).
				Set(`cpu_usage.stime`, e.events[i].CPUUsage.STime).
				Set(`cpu_usage.cstime`, e.events[i].CPUUsage.CSTime).
				Set(`cpu_usage.interval`, e.events[i].CPUUsage.Interval).
				Set(`cpu_usage.percentage_usage`, e.events[i].CPUUsage.PercentageUsage)
		} else {
			row.
				Set(`cpu_usage.num_cores`, nil).
				Set(`cpu_usage.clock_speed`, nil).
				Set(`cpu_usage.uptime`, nil).
				Set(`cpu_usage.utime`, nil).
				Set(`cpu_usage.cutime`, nil).
				Set(`cpu_usage.stime`, nil).
				Set(`cpu_usage.cstime`, nil).
				Set(`cpu_usage.interval`, nil).
				Set(`cpu_usage.percentage_usage`, nil)

		}

		// navigation
		if e.events[i].IsNavigation() {
			row.
				Set(`navigation.to`, e.events[i].Navigation.To).
				Set(`navigation.from`, e.events[i].Navigation.From).
				Set(`navigation.source`, e.events[i].Navigation.Source)
		} else {
			row.
				Set(`navigation.to`, nil).
				Set(`navigation.from`, nil).
				Set(`navigation.source`, nil)
		}

		// screen view
		if e.events[i].IsScreenView() {
			row.
				Set(`screen_view.name`, e.events[i].ScreenView.Name)
		} else {
			row.
				Set(`screen_view.name`, nil)
		}

		// bug report
		if e.events[i].IsBugReport() {
			row.
				Set(`bug_report.description`, e.events[i].BugReport.Description)
		} else {
			row.
				Set(`bug_report.description`, nil)
		}

		// custom
		if e.events[i].IsCustom() {
			row.
				Set(`custom.name`, e.events[i].Custom.Name)
		} else {
			row.
				Set(`custom.name`, nil)
		}
	}

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
}

// ingestSpans writes the spans to database.
func (e eventreq) ingestSpans(ctx context.Context) error {
	if len(e.spans) == 0 {
		return nil
	}

	stmt := sqlf.InsertInto(`spans`)
	defer stmt.Close()

	for i := range e.spans {
		appVersionTuple := fmt.Sprintf("('%s', '%s')", e.spans[i].Attributes.AppVersion, e.spans[i].Attributes.AppBuild)
		osVersionTuple := fmt.Sprintf("('%s', '%s')", e.spans[i].Attributes.OSName, e.spans[i].Attributes.OSVersion)

		var b strings.Builder
		var checkpoints []string
		b.WriteString("[")
		for _, cp := range e.spans[i].CheckPoints {
			checkpoints = append(checkpoints, fmt.Sprintf("('%s','%s')", cp.Name, cp.Timestamp.Format(chrono.MSTimeFormat)))
		}
		b.WriteString(strings.Join(checkpoints, ","))
		b.WriteString("]")
		formattedCheckpoints := b.String()

		stmt.NewRow().
			Set(`team_id`, e.teamId).
			Set(`app_id`, e.spans[i].AppID).
			Set(`span_name`, e.spans[i].SpanName).
			Set(`span_id`, e.spans[i].SpanID).
			Set(`parent_id`, e.spans[i].ParentID).
			Set(`trace_id`, e.spans[i].TraceID).
			Set(`session_id`, e.spans[i].SessionID).
			Set(`status`, e.spans[i].Status).
			Set(`start_time`, e.spans[i].StartTime.Format(chrono.MSTimeFormat)).
			Set(`end_time`, e.spans[i].EndTime.Format(chrono.MSTimeFormat)).
			Set(`checkpoints`, formattedCheckpoints).
			Set(`attribute.app_unique_id`, e.spans[i].Attributes.AppUniqueID).
			Set(`attribute.installation_id`, e.spans[i].Attributes.InstallationID).
			Set(`attribute.user_id`, e.spans[i].Attributes.UserID).
			Set(`attribute.measure_sdk_version`, e.spans[i].Attributes.MeasureSDKVersion).
			Set(`attribute.app_version`, appVersionTuple).
			Set(`attribute.os_version`, osVersionTuple).
			Set(`attribute.platform`, e.spans[i].Attributes.Platform).
			Set(`attribute.thread_name`, e.spans[i].Attributes.ThreadName).
			Set(`attribute.country_code`, e.spans[i].Attributes.CountryCode).
			Set(`attribute.network_provider`, e.spans[i].Attributes.NetworkProvider).
			Set(`attribute.network_type`, e.spans[i].Attributes.NetworkType).
			Set(`attribute.network_generation`, e.spans[i].Attributes.NetworkGeneration).
			Set(`attribute.device_name`, e.spans[i].Attributes.DeviceName).
			Set(`attribute.device_model`, e.spans[i].Attributes.DeviceModel).
			Set(`attribute.device_manufacturer`, e.spans[i].Attributes.DeviceManufacturer).
			Set(`attribute.device_locale`, e.spans[i].Attributes.DeviceLocale).
			Set(`attribute.device_low_power_mode`, e.spans[i].Attributes.LowPowerModeEnabled).
			Set(`attribute.device_thermal_throttling_enabled`, e.spans[i].Attributes.ThermalThrottlingEnabled).
			// user defined attribute
			Set(`user_defined_attribute`, e.spans[i].UserDefinedAttribute.Parameterize())
	}

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
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
		id:                reqId,
		appId:             appId,
		teamId:            app.TeamId,
		json:              strings.HasPrefix(c.ContentType(), "application/json"),
		osName:            app.OSName,
		symbolicateEvents: make(map[uuid.UUID]int),
		symbolicateSpans:  make(map[string]int),
		attachments:       make(map[uuid.UUID]*blob),
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
		msg := "failed to check for duplicate event requst batch"
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

	ingestCtx := ambient.WithTeamId(context.Background(), app.TeamId)

	ingestTracer := otel.Tracer("ingest-tracer")
	ingestCtx, ingestSpan := ingestTracer.Start(ingestCtx, "ingest")
	defer ingestSpan.End()

	concur.GlobalWg.Add(1)

	go func() {
		defer concur.GlobalWg.Done()
		var infuseInetGroup errgroup.Group
		infuseInetGroup.Go(func() error {
			_, infuseInetSpan := ingestTracer.Start(ingestCtx, "infuse-inet")
			defer infuseInetSpan.End()

			if err := eventReq.infuseInet(c.ClientIP()); err != nil {
				msg := fmt.Sprintf(`failed to lookup country info for IP: %q`, c.ClientIP())
				fmt.Println(msg, err)
				return err
			}
			infuseInetSpan.End()
			return nil
		})

		var symbolicationGroup errgroup.Group

		symbolicationGroup.Go(func() error {
			if eventReq.needsSymbolication() {
				config := server.Server.Config
				origin := config.SymbolicatorOrigin
				osName := eventReq.osName
				sources := []symbolicator.Source{}

				// configure correct sources as per
				// OS
				switch opsys.ToFamily(osName) {
				case opsys.Android:
					if config.IsCloud() {
						privateKey := os.Getenv("SYMBOLS_READER_SA_KEY")
						clientEmail := os.Getenv("SYMBOLS_READER_SA_EMAIL")
						sources = append(sources, symbolicator.NewGCSSourceAndroid("msr-symbols", config.SymbolsBucket, privateKey, clientEmail))
					} else {
						sources = append(sources, symbolicator.NewS3SourceAndroid("msr-symbols", config.SymbolsBucket, config.SymbolsBucketRegion, config.AWSEndpoint, config.SymbolsAccessKey, config.SymbolsSecretAccessKey))
					}
				case opsys.AppleFamily:
					// by default only symbolicate app's own symbols. to symbolicate iOS
					// system framework symbols, append a GCSSourceApple source containing
					// all iOS system framework symbol debug information files.
					if config.IsCloud() {
						privateKey := os.Getenv("SYMBOLS_READER_SA_KEY")
						clientEmail := os.Getenv("SYMBOLS_READER_SA_EMAIL")
						sources = append(sources, symbolicator.NewGCSSourceApple("msr-symbols", config.SymbolsBucket, privateKey, clientEmail))
					} else {
						sources = append(sources, symbolicator.NewS3SourceApple("msr-symbols", config.SymbolsBucket, config.SymbolsBucketRegion, config.AWSEndpoint, config.SymbolsAccessKey, config.SymbolsSecretAccessKey))
					}
				}

				symblctr := symbolicator.New(origin, osName, sources)

				// start span to trace symbolication
				_, symbolicationSpan := ingestTracer.Start(ingestCtx, "symbolicate-events")
				defer symbolicationSpan.End()

				if err := symblctr.Symbolicate(ingestCtx, server.Server.PgPool, eventReq.appId, eventReq.events, eventReq.spans); err != nil {
					// in case there was symbolication failure, we don't fail
					// ingestion. ignore the error, log it and continue.
					fmt.Printf("failed to symbolicate batch %q containing %d events & %d spans: %v\n", eventReq.id, len(eventReq.events), len(eventReq.spans), err.Error())
					return err
				}

				symbolicationSpan.End()
			}
			return nil
		})

		if err := infuseInetGroup.Wait(); err != nil {
			fmt.Println("failed to lookup IP info")
		}

		if err := symbolicationGroup.Wait(); err != nil {
			fmt.Println("failed to symbolicate", err)
		}

		var ingestGroup errgroup.Group

		ingestGroup.Go(func() error {
			_, ingestEventsSpan := ingestTracer.Start(ingestCtx, "ingest-events")
			defer ingestEventsSpan.End()
			if err := eventReq.ingestEvents(ingestCtx); err != nil {
				fmt.Println(`failed to ingest events`, err)
				return err
			}

			return nil
		})

		ingestGroup.Go(func() error {
			_, ingestSpansSpan := ingestTracer.Start(ingestCtx, "ingest-spans")
			defer ingestSpansSpan.End()
			if err := eventReq.ingestSpans(ingestCtx); err != nil {
				fmt.Println(`failed to ingest spans`, err)
				return err
			}

			return nil
		})

		if err := ingestGroup.Wait(); err != nil {
			fmt.Println("failed to ingest", err)
			return
		}

		var bucketGroup errgroup.Group
		bucketGroup.Go(func() error {
			// start span to trace bucketing unhandled exceptions
			_, bucketUnhandledExceptionsSpan := ingestTracer.Start(ingestCtx, "bucket-unhandled-exceptions")

			defer bucketUnhandledExceptionsSpan.End()

			if err := eventReq.bucketUnhandledExceptions(ingestCtx); err != nil {
				fmt.Println(`failed to bucket unhandled exceptions`, err)
				return err
			}

			return nil
		})

		bucketGroup.Go(func() error {
			// start span to trace bucketing ANRs
			_, bucketAnrsSpan := ingestTracer.Start(ingestCtx, "bucket-anrs")
			defer bucketAnrsSpan.End()

			if err := eventReq.bucketANRs(ingestCtx); err != nil {
				fmt.Println(`failed to bucket anrs`, err)
				return err
			}

			return nil
		})

		if err := bucketGroup.Wait(); err != nil {
			fmt.Println("failed to bucket issues", err)
			return
		}

		var metricsGroup errgroup.Group

		metricsGroup.Go(func() error {
			_, ingestMetricsSpan := ingestTracer.Start(ingestCtx, "ingest-metrics")
			defer ingestMetricsSpan.End()

			sessions, events, spans, attachments := eventReq.countMetrics()

			// insert metrics into clickhouse table
			insertMetricsIngestionSelectStmt := sqlf.
				Select("? AS team_id", eventReq.teamId).
				Select("? AS app_id", app.ID).
				Select("? AS timestamp", time.Now()).
				Select("sumState(CAST(? AS UInt32)) AS sessions", sessions).
				Select("sumState(CAST(? AS UInt32)) AS events", events).
				Select("sumState(CAST(? AS UInt32)) AS spans", spans).
				Select("sumState(CAST(? AS UInt32)) AS attachments", attachments).
				Select("sumState(CAST(? AS UInt32)) AS metrics", 0)
			selectSQL := insertMetricsIngestionSelectStmt.String()
			args := insertMetricsIngestionSelectStmt.Args()
			defer insertMetricsIngestionSelectStmt.Close()
			insertMetricsIngestionFullStmt := "INSERT INTO ingestion_metrics " + selectSQL

			asyncCtx := clickhouse.Context(ingestCtx, clickhouse.WithAsync(true))

			if err := server.Server.ChPool.Exec(asyncCtx, insertMetricsIngestionFullStmt, args...); err != nil {
				fmt.Println(`failed to insert ingestion metrics`, err)
				return err
			}
			return nil
		})

		if err := metricsGroup.Wait(); err != nil {
			fmt.Println(`failed to count ingestion metrics`, err)
			return
		}

		_, rememberIngestSpan := ingestTracer.Start(ingestCtx, "remember-ingest")
		defer rememberIngestSpan.End()

		// Remember that this batch was ingested, so if same
		// batch is seen again, we can skip ingesting it.
		if err := eventReq.remember(ingestCtx); err != nil {
			fmt.Println(`failed to remember event request`, err)
			return
		}
	}()

	if eventReq.onboardable() && !app.Onboarded {
		_, onboardAppSpan := ingestTracer.Start(ingestCtx, "onboard-app")
		defer onboardAppSpan.End()

		tx, err := server.Server.PgPool.BeginTx(ingestCtx, pgx.TxOptions{
			IsoLevel: pgx.ReadCommitted,
		})
		defer tx.Rollback(ingestCtx)

		if err != nil {
			msg := "failed to acquire transaction while onboarding app"
			fmt.Println(msg, err)
			onboardAppSpan.End()
			return
		}

		uniqueID := eventReq.getAppUniqueID()
		osName := eventReq.getOSName()
		version := eventReq.getOSVersion()

		if err := app.Onboard(ingestCtx, &tx, uniqueID, osName, version); err != nil {
			fmt.Println(`failed to onboard app`, err)
			onboardAppSpan.End()
			return
		}

		if err := tx.Commit(ingestCtx); err != nil {
			fmt.Println(`failed to commit app onboard transaction`, err)
			onboardAppSpan.End()
			return
		}

	}
}
