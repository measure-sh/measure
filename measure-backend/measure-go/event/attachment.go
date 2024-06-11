package event

import (
	"errors"
	"io"
	"mime"
	"path/filepath"
	"slices"
	"time"

	"measure-backend/measure-go/server"

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
	// path style instead of S3 virual path styles.
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

	// if a custom endpoint was set, then most likely,
	// we are in local development mode and should force
	// path style instead of S3 virual path styles.
	if config.AWSEndpoint != "" {
		awsConfig.S3ForcePathStyle = aws.Bool(true)
		awsConfig.Endpoint = aws.String(config.AttachmentOrigin)
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

	a.Location = urlStr

	return
}
