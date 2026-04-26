package pipeline

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// s3Store is an ObjectStore backed by an S3-compatible bucket
// (real AWS S3, MinIO, or any other S3-compatible service).
type s3Store struct {
	client *s3.Client
	bucket string
}

func newS3Store(env StorageEnv) *s3Store {
	return &s3Store{client: newS3Client(env), bucket: env.Bucket}
}

// newS3Client builds an S3 client from the environment. When Endpoint is set
// (self-host / MinIO) path-style addressing is used.
func newS3Client(env StorageEnv) *s3.Client {
	var creds aws.CredentialsProviderFunc = func(_ context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     env.AccessKey,
			SecretAccessKey: env.SecretKey,
		}, nil
	}
	cfg := aws.Config{
		Region:      env.Region,
		Credentials: creds,
	}
	return s3.NewFromConfig(cfg, func(o *s3.Options) {
		if env.Endpoint != "" {
			o.BaseEndpoint = aws.String(env.Endpoint)
			o.UsePathStyle = true
		}
	})
}

func (s *s3Store) Put(ctx context.Context, key string, data []byte, contentType string) error {
	in := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(data),
	}
	if contentType != "" {
		in.ContentType = aws.String(contentType)
	}
	if _, err := s.client.PutObject(ctx, in); err != nil {
		return fmt.Errorf("s3 put %s: %w", key, err)
	}
	return nil
}

func (s *s3Store) Get(ctx context.Context, key string) (data []byte, err error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var notFound *types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("s3 get %s: %w", key, err)
	}
	defer out.Body.Close()
	return io.ReadAll(out.Body)
}

func (s *s3Store) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var notFound *types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil
		}
		return fmt.Errorf("s3 delete %s: %w", key, err)
	}
	return nil
}

func (s *s3Store) List(ctx context.Context, prefix string) (keys []string, err error) {
	var token *string
	for {
		out, err := s.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:            aws.String(s.bucket),
			Prefix:            aws.String(prefix),
			ContinuationToken: token,
		})
		if err != nil {
			return nil, fmt.Errorf("s3 list %s: %w", prefix, err)
		}
		for _, obj := range out.Contents {
			if obj.Key != nil {
				keys = append(keys, *obj.Key)
			}
		}
		if out.NextContinuationToken == nil {
			break
		}
		token = out.NextContinuationToken
	}
	return keys, nil
}
