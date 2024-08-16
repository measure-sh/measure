package event

import (
	"errors"
	"io"
	"mime"
	"net/url"
	"path/filepath"
	"slices"
	"time"

	"backend/api/server"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/google/uuid"
)

// attachmentTypes is a list of all valid attachment types.
var attachmentTypes = []string{"screenshot", "android_method_trace"}

type Attachment struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name" binding:"required"`
	Type     string    `json:"type" binding:"required"`
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

// Upload uploads raw file bytes to an S3 compatible storage system.
func (a *Attachment) Upload() (output *s3manager.UploadOutput, err error) {
	config := server.Server.Config
	awsConfig := &aws.Config{
		Region:      aws.String(config.AttachmentsBucketRegion),
		Credentials: credentials.NewStaticCredentials(config.AttachmentsAccessKey, config.AttachmentsSecretAccessKey, ""),
	}

	// if a custom endpoint was set, then most likely,
	// we are in local development mode and should force
	// path style instead of S3 virtual path styles.
	if config.AWSEndpoint != "" {
		awsConfig.S3ForcePathStyle = aws.Bool(true)
		awsConfig.Endpoint = aws.String(config.AWSEndpoint)
	}

	// set mime type from extension
	ext := filepath.Ext(a.Key)
	contentType := "application/octet-stream"
	if ext != "" {
		contentType = mime.TypeByExtension(ext)
	}

	awsSession := session.Must(session.NewSession(awsConfig))
	uploader := s3manager.NewUploader(awsSession)
	output, err = uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(config.AttachmentsBucket),
		Key:    aws.String(a.Key),
		Body:   a.Reader,
		Metadata: map[string]*string{
			"original_file_name": aws.String(a.Name),
		},
		ContentType: aws.String(contentType),
	})

	return
}

// PreSignURL generates a S3-compatible
// pre-signed URL for the attachment.
func (a *Attachment) PreSignURL() (err error) {
	config := server.Server.Config
	awsConfig := &aws.Config{
		Region:      aws.String(config.AttachmentsBucketRegion),
		Credentials: credentials.NewStaticCredentials(config.AttachmentsAccessKey, config.AttachmentsSecretAccessKey, ""),
	}

	shouldProxy := true

	if config.AttachmentOrigin != "" {
		shouldProxy = false
	}

	// if a custom endpoint was set, then most likely,
	// external object store is not native S3 like,
	// hence should force path style instead of S3 virtual
	// path styles.
	if config.AWSEndpoint != "" {
		awsConfig.S3ForcePathStyle = aws.Bool(true)

		if shouldProxy {
			awsConfig.Endpoint = aws.String(config.AWSEndpoint)
		} else {
			awsConfig.Endpoint = aws.String(config.AttachmentOrigin)
		}
	}

	awsSession := session.Must(session.NewSession(awsConfig))

	svc := s3.New(awsSession)
	req, _ := svc.GetObjectRequest(&s3.GetObjectInput{
		Bucket: aws.String(config.AttachmentsBucket),
		Key:    aws.String(a.Key),
	})

	urlStr, err := req.Presign(48 * time.Hour)
	if err != nil {
		return err
	}

	if shouldProxy {
		endpoint, err := url.JoinPath(config.APIOrigin, "attachments")
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
