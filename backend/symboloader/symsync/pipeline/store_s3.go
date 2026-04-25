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
	return &s3Store{client: env.NewS3Client(), bucket: env.Bucket}
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
