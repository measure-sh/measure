package event

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/url"
	"path/filepath"
	"slices"
	"time"

	"backend/api/objstore"
	"backend/api/server"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// attachmentTypes is a list of all valid attachment types.
var attachmentTypes = []string{"screenshot", "android_method_trace", "layout_snapshot"}

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

// Upload uploads raw file bytes to an S3 compatible storage system
// and returns the uploaded file's remote location.
func (a *Attachment) Upload(ctx context.Context) (location string, err error) {
	config := server.Server.Config

	// set mime type from extension
	ext := filepath.Ext(a.Key)
	contentType := "application/octet-stream"
	if ext != "" {
		contentType = mime.TypeByExtension(ext)
	}

	metadata := map[string]string{
		"original_file_name": a.Name,
	}

	if config.IsCloud() {
		client, errStorage := storage.NewClient(ctx)
		if errStorage != nil {
			err = errStorage
			return
		}

		defer client.Close()
		obj := client.Bucket(config.AttachmentsBucket).Object(a.Key)
		writer := obj.NewWriter(ctx)
		writer.ContentType = contentType
		// writer.ObjectAttrs = storage.ObjectAttrs{
		// 	Metadata: metadata,
		// }

		if _, err = io.Copy(writer, a.Reader); err != nil {
			fmt.Printf("failed to upload attachment key: %s bucket: %s: %v\n", a.Key, config.AttachmentsBucket, err)
			return
		}

		if err = writer.Close(); err != nil {
			fmt.Printf("failed to close storage writer key: %s bucket: %s: %v\n", a.Key, config.AttachmentsBucket, err)
			return
		}

		location = fmt.Sprintf("https://storage.googleapis.com/%s/%s", config.AttachmentsBucket, obj.ObjectName())

		fmt.Printf("attachment %s uploaded. location: %s\n", a.Key, location)
		return
	}

	// var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
	// 	return aws.Credentials{
	// 		AccessKeyID:     config.AttachmentsAccessKey,
	// 		SecretAccessKey: config.AttachmentsSecretAccessKey,
	// 	}, nil
	// }

	// awsConfig := &aws.Config{
	// 	Region:      config.AttachmentsBucketRegion,
	// 	Credentials: credentialsProvider,
	// }

	// client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
	// 	endpoint := config.AWSEndpoint
	// 	if endpoint != "" {
	// 		o.BaseEndpoint = aws.String(endpoint)
	// 		o.UsePathStyle = *aws.Bool(true)
	// 	}
	// })

	s3Client := objstore.CreateS3Client(ctx, config.AttachmentsAccessKey, config.AttachmentsSecretAccessKey, config.AttachmentsBucketRegion, config.AWSEndpoint)

	putObjectInput := &s3.PutObjectInput{
		Bucket:      aws.String(config.AttachmentsBucket),
		Key:         aws.String(a.Key),
		Body:        a.Reader,
		Metadata:    metadata,
		ContentType: aws.String(contentType),
	}

	// for now, we construct the location manually
	// implement a better solution later using
	// EndpointResolverV2 with custom resolvers
	// for non-AWS clouds like GCS
	if config.AWSEndpoint != "" {
		location = fmt.Sprintf("%s/%s/%s", config.AWSEndpoint, config.AttachmentsBucket, a.Key)
	} else {
		location = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", config.AttachmentsBucket, config.AttachmentsBucketRegion, a.Key)
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
func (a *Attachment) PreSignURL(ctx context.Context) (err error) {
	config := server.Server.Config
	shouldProxy := true
	expires := 48 * time.Hour

	if config.IsCloud() {
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

		fmt.Printf("Pre-signed URL: %s\n", url)

		a.Location = url
		return
	}

	if config.AttachmentOrigin != "" {
		shouldProxy = false
	}

	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     config.AttachmentsAccessKey,
			SecretAccessKey: config.AttachmentsSecretAccessKey,
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      config.AttachmentsBucketRegion,
		Credentials: credentialsProvider,
	}

	client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := config.AWSEndpoint
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

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
