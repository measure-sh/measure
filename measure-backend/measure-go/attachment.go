package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/google/uuid"
)

var attachmentTypes = []string{"screenshot"}

type Attachment struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name" binding:"required"`
	Type      string    `json:"type" binding:"required"`
	Extension string    `json:"extension"`
	Blob      string    `json:"blob" binding:"required"`
	Key       string    `json:"key"`
	Timestamp time.Time `json:"timestamp" binding:"required"`
}

func (a *Attachment) validate() error {
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

func (a *Attachment) upload() (*s3manager.UploadOutput, error) {
	id := uuid.New()
	ext := a.Extension
	if ext == "" {
		ext = "txt"
	}
	key := fmt.Sprintf(`attachments/%s.%s`, id, ext)
	b64Decoder := base64.NewDecoder(base64.StdEncoding, strings.NewReader(a.Blob))
	awsConfig := &aws.Config{
		Region:      aws.String(server.config.attachmentsBucketRegion),
		Credentials: credentials.NewStaticCredentials(server.config.attachmentsAccessKey, server.config.attachmentsSecretAccessKey, ""),
	}
	awsSession := session.Must(session.NewSession(awsConfig))
	uploader := s3manager.NewUploader(awsSession)
	result, err := uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(server.config.attachmentsBucket),
		Key:    aws.String(key),
		Body:   b64Decoder,
		Metadata: map[string]*string{
			"original_file_name": aws.String(a.Name),
			"attachment_type":    aws.String(a.Type),
		},
	})

	if err != nil {
		return nil, err
	}

	a.ID = id
	a.Key = key
	a.Extension = ext

	return result, nil
}
