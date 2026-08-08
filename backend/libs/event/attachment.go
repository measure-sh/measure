package event

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"slices"
	"time"

	"backend/libs/objstore"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"google.golang.org/api/googleapi"
)

type LocationConfig struct {
	IsCloud                 bool
	AWSEndpoint             string
	AttachmentsBucket       string
	AttachmentsBucketRegion string
}

type UploadConfig struct {
	IsCloud                    bool
	AWSEndpoint                string
	AttachmentsBucket          string
	AttachmentsBucketRegion    string
	AttachmentsAccessKey       string
	AttachmentsSecretAccessKey string
}

// PreSignConfig is the storage configuration PreSignURL needs to build a
// presigned (or proxied) attachment URL.
type PreSignConfig struct {
	IsCloud                    bool
	AWSEndpoint                string
	AttachmentsBucket          string
	AttachmentsBucketRegion    string
	AttachmentsAccessKey       string
	AttachmentsSecretAccessKey string
	AttachmentOrigin           string
	Origin                     string
}

// attachment types the SDKs send.
const (
	// attachmentTypeScreenshot is a raster image of the screen as the user
	// saw it, encoded as webp, jpeg or png.
	attachmentTypeScreenshot = "screenshot"

	// attachmentTypeAndroidMethodTrace is a binary trace of every Java/Kotlin
	// method entry & exit.
	//
	// Deprecated: No SDK produces this, kept for older clients.
	attachmentTypeAndroidMethodTrace = "android_method_trace"

	// attachmentTypeLayoutSnapshot is a wireframe of the view hierarchy,
	// drawn as an SVG on some SDKs & a raster on others.
	attachmentTypeLayoutSnapshot = "layout_snapshot"

	// attachmentTypeLayoutSnapshotJSON is the view hierarchy as gzipped JSON,
	// replayed as a wireframe in the dashboard.
	attachmentTypeLayoutSnapshotJSON = "layout_snapshot_json"

	// attachmentTypePerfettoTrace is a protobuf trace of system & app
	// activity, written by the OS profiler.
	attachmentTypePerfettoTrace = "perfetto_trace"

	// attachmentTypeHeapDump is a snapshot of every live object on the Java
	// heap, in HPROF binary format.
	attachmentTypeHeapDump = "heap_dump"

	// attachmentTypeHeapProfile is a sample of native & Java allocations,
	// carried in a protobuf trace.
	attachmentTypeHeapProfile = "heap_profile"
)

// contentTypeBinary is the fallback for opaque or unrecognized bytes.
const contentTypeBinary = "application/octet-stream"

// attachmentTypes is a list of all valid attachment types.
var attachmentTypes = []string{
	attachmentTypeScreenshot,
	attachmentTypeAndroidMethodTrace,
	attachmentTypeLayoutSnapshot,
	attachmentTypeLayoutSnapshotJSON,
	attachmentTypePerfettoTrace,
	attachmentTypeHeapDump,
	attachmentTypeHeapProfile,
}

// isNotFound checks if error is a googleapi
// not found error.
func isNotFound(err error) bool {
	var gerr *googleapi.Error
	return errors.As(err, &gerr) && gerr.Code == http.StatusNotFound
}

// BuildAttachmentLocation builds the location of the attachment
// object based on runtime environment.
func BuildAttachmentLocation(key string, config LocationConfig) (location string) {
	if config.IsCloud {
		location = fmt.Sprintf("https://storage.googleapis.com/%s/%s", config.AttachmentsBucket, key)
		return
	}

	if config.AWSEndpoint != "" {
		location = fmt.Sprintf("%s/%s/%s", config.AWSEndpoint, config.AttachmentsBucket, key)
	} else {
		location = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", config.AttachmentsBucket, config.AttachmentsBucketRegion, key)
	}

	return
}

type Attachment struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name" binding:"required"`
	Type     string    `json:"type" binding:"required"`
	Size     uint64    `json:"size"`
	Reader   io.Reader `json:"-"`
	Key      string    `json:"key"`
	Location string    `json:"location"`
}

// Validate validates the attachment
func (a Attachment) Validate() error {
	if a.Name == "" {
		return errors.New(`one of the attachment's "name" is empty`)
	}

	if a.Type == "" {
		return errors.New(`one of the attachment's "type" is empty`)
	}

	if !slices.Contains(attachmentTypes, a.Type) {
		return errors.New(`one of the attachment's "type" is invalid`)
	}

	return nil
}

// gzipMagic prefixes every gzip stream.
var gzipMagic = []byte{0x1f, 0x8b}

// sniffLen is the window http.DetectContentType reads.
const sniffLen = 512

// sniffBody reads the leading bytes for content detection, then rewinds.
//
// Both the encoding & the mime type are read off the bytes because filenames
// are unreliable. SDKs have shipped bare UUIDs, fixed literals & double
// extensions, & released SDKs keep sending all of them.
//
// The reader is rewound rather than wrapped because the S3 client seeks the
// body to compute its payload hash. Wrapping it fails every upload.
//
// ponytail: non-seekable bodies skip the sniff, the only upload path opens a
// seekable multipart file
func sniffBody(r io.Reader) (head []byte, encoding string, err error) {
	seeker, ok := r.(io.Seeker)
	if !ok {
		return
	}

	// a read failure leaves n short, so nothing gets claimed & the upload
	// surfaces the error itself
	buf := make([]byte, sniffLen)
	n, _ := io.ReadFull(r, buf)

	if _, err = seeker.Seek(0, io.SeekStart); err != nil {
		return
	}

	head = buf[:n]
	if bytes.HasPrefix(head, gzipMagic) {
		encoding = "gzip"
	}

	return
}

// fixedContentTypes maps attachment types whose mime type the bytes can't
// reveal. Compressed payloads report their wrapper & traces are opaque.
var fixedContentTypes = map[string]string{
	attachmentTypeLayoutSnapshotJSON: "application/json",
	attachmentTypePerfettoTrace:      contentTypeBinary,
	attachmentTypeHeapDump:           contentTypeBinary,
	attachmentTypeHeapProfile:        contentTypeBinary,
	attachmentTypeAndroidMethodTrace: contentTypeBinary,
}

// contentTypeFor resolves the mime type from the attachment type, falling back
// to the filename then the bytes for the types the type alone can't settle.
// layout_snapshot is an SVG wireframe on some SDKs & a raster on others.
//
// name is only a hint, it may be a bare UUID or a fixed literal.
func contentTypeFor(attachmentType, name string, head []byte) (contentType string) {
	// type first, a compressed payload's extension resolves to the wrapper,
	// so ".gz" would win over the json it holds
	if fixed, ok := fixedContentTypes[attachmentType]; ok {
		return fixed
	}

	// extension first, sniffing reports svg as plain text
	if contentType = mime.TypeByExtension(filepath.Ext(name)); contentType != "" {
		return
	}

	if len(head) > 0 {
		return http.DetectContentType(head)
	}

	return contentTypeBinary
}

// Upload uploads raw file bytes to an S3 compatible storage system.
func (a *Attachment) Upload(ctx context.Context, config UploadConfig) (err error) {
	head, contentEncoding, errSniff := sniffBody(a.Reader)
	if errSniff != nil {
		err = errSniff
		return
	}

	contentType := contentTypeFor(a.Type, a.Name, head)

	metadata := map[string]string{
		"original_file_name": a.Name,
	}

	if config.IsCloud {
		client, errStorage := storage.NewClient(ctx)
		if errStorage != nil {
			err = errStorage
			return
		}

		defer func() {
			if err := client.Close(); err != nil {
				fmt.Printf("failed to close storage client: %v\n", err)
			}
		}()

		obj := client.Bucket(config.AttachmentsBucket).Object(a.Key)
		attrs, errAttrs := obj.Attrs(ctx)
		if errAttrs != nil && !isNotFound(errAttrs) {
			err = errAttrs
			return
		}

		// for typical workloads, attachment objects will not exist
		// while load testing, the same object maybe repeated multiple
		// times. for such workloads, there's not much point in
		// uploading the attachment again and hitting and dealing
		// with conflicts (429s) and retries.
		//
		// so, exit early.
		if attrs != nil {
			// Object exists
			// exit early
			return
		}

		writer := obj.NewWriter(ctx)
		writer.ContentType = contentType
		writer.ContentEncoding = contentEncoding
		writer.Metadata = metadata

		if _, err = io.Copy(writer, a.Reader); err != nil {
			fmt.Printf("failed to upload attachment key: %s bucket: %s: %v\n", a.Key, config.AttachmentsBucket, err)
			return
		}

		if err = writer.Close(); err != nil {
			fmt.Printf("failed to close storage writer, key: %s bucket: %s: %v\n", a.Key, config.AttachmentsBucket, err)
			return
		}

		return
	}

	s3Client := objstore.CreateS3Client(ctx, config.AttachmentsAccessKey, config.AttachmentsSecretAccessKey, config.AttachmentsBucketRegion, config.AWSEndpoint)

	putObjectInput := &s3.PutObjectInput{
		Bucket:      aws.String(config.AttachmentsBucket),
		Key:         aws.String(a.Key),
		Body:        a.Reader,
		Metadata:    metadata,
		ContentType: aws.String(contentType),
	}

	// leave unset for uncompressed bytes, an empty header would mislabel them
	if contentEncoding != "" {
		putObjectInput.ContentEncoding = aws.String(contentEncoding)
	}

	// ignore the putObjectOutput, don't need
	// it for now
	_, err = s3Client.PutObject(ctx, putObjectInput)
	if err != nil {
		return
	}

	return
}

// PreSignURL generates a S3-compatible
// pre-signed URL for the attachment.
func (a *Attachment) PreSignURL(ctx context.Context, config PreSignConfig) (err error) {
	shouldProxy := true
	expires := 48 * time.Hour

	if config.IsCloud {
		client, errStorage := storage.NewClient(ctx)
		if errStorage != nil {
			err = errStorage
			return
		}

		defer client.Close()

		url, errStorage := client.Bucket(config.AttachmentsBucket).SignedURL(a.Key, &storage.SignedURLOptions{
			Scheme:  storage.SigningSchemeV4,
			Method:  "GET",
			Expires: time.Now().Add(expires),
		})

		if errStorage != nil {
			err = errStorage
			return
		}

		a.Location = url
		return
	}

	if config.AttachmentOrigin != "" {
		shouldProxy = false
	}

	client := objstore.CreateS3Client(ctx, config.AttachmentsAccessKey, config.AttachmentsSecretAccessKey, config.AttachmentsBucketRegion, config.AWSEndpoint)

	presignClient := s3.NewPresignClient(client, func(o *s3.PresignOptions) {
		o.Expires = expires
	})

	getObjectInput := &s3.GetObjectInput{
		Bucket: aws.String(config.AttachmentsBucket),
		Key:    aws.String(a.Key),
	}

	req, err := presignClient.PresignGetObject(ctx, getObjectInput)
	if err != nil {
		return
	}

	urlStr := req.URL

	if shouldProxy {
		endpoint, err := url.JoinPath(config.Origin, "proxy", "attachments")
		if err != nil {
			return err
		}

		proxyUrl, err := url.Parse(endpoint)
		if err != nil {
			return err
		}

		parsed, err := url.Parse(urlStr)
		if err != nil {
			return err
		}

		// clear the scheme and host of
		// presigned URL, because we take interest
		// in capturing the presigned URL's path
		// and query string only.
		parsed.Scheme = ""
		parsed.Host = ""

		query := proxyUrl.Query()

		query.Set("payload", parsed.String())
		proxyUrl.RawQuery = query.Encode()

		urlStr = proxyUrl.String()
	}

	a.Location = urlStr

	return
}
