package event

import (
	"errors"
	"io"
	"slices"
	"time"

	"measure-backend/measure-go/server"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/google/uuid"
)

// attachmentTypes is a list of all valid attachment types.
var attachmentTypes = []string{"screenshot", "android_method_trace"}

type Attachment struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name" binding:"required"`
	Type      string    `json:"type" binding:"required"`
	Reader    io.Reader `json:"-"`
	Extension string    `json:"extension"`
	Key       string    `json:"key"`
	Location  string    `json:"location"`
	Timestamp time.Time `json:"timestamp" binding:"required"`
}

// Validate validates the attachment
func (a Attachment) Validate() error {
	if a.Timestamp.IsZero() {
		return errors.New(`one of the attachment's "timestamp" is invalid`)
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

	awsSession := session.Must(session.NewSession(awsConfig))
	uploader := s3manager.NewUploader(awsSession)
	output, err = uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(config.AttachmentsBucket),
		Key:    aws.String(a.Key),
		Body:   a.Reader,
		Metadata: map[string]*string{
			"original_file_name": aws.String(a.Name),
		},
	})

	return
}
