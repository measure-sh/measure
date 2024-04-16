package event

import (
	"encoding/base64"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"measure-backend/measure-go/server"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/google/uuid"
)

var attachmentTypes = []string{"screenshot", "android_method_trace"}

type Attachment struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name" binding:"required"`
	Type      string    `json:"type" binding:"required"`
	Extension string    `json:"extension"`
	Blob      string    `json:"blob" binding:"required"`
	Key       string    `json:"key"`
	Location  string    `json:"location"`
	Timestamp time.Time `json:"timestamp" binding:"required"`
}

func (a Attachment) Validate() error {
	if a.Timestamp.IsZero() {
		return errors.New(`one of the attachment's "timestamp" is invalid`)
	}

	if a.Blob == "" {
		return errors.New(`one of the attachment's "blob" is empty`)
	}

	if !slices.Contains(attachmentTypes, a.Type) {
		return errors.New(`one of the attachment's "type" is invalid`)
	}

	return nil
}

func (a *Attachment) Prepare() Attachment {
	a.ID = uuid.New()
	if a.Extension == "" {
		a.Extension = "txt"
	}
	a.Key = fmt.Sprintf(`%s/%s.%s`, a.Type, a.ID, a.Extension)
	return *a
}

func (a *Attachment) Upload(e *EventField) (*s3manager.UploadOutput, error) {
	config := server.Server.Config
	b64Decoder := base64.NewDecoder(base64.StdEncoding, strings.NewReader(a.Blob))
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
	result, err := uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(config.AttachmentsBucket),
		Key:    aws.String(a.Key),
		Body:   b64Decoder,
		Metadata: map[string]*string{
			"original_file_name": aws.String(a.Name),
			"attachment_type":    aws.String(a.Type),
			"session_id":         aws.String(e.SessionID.String()),
		},
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}
