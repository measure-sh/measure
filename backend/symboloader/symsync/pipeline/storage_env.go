package pipeline

import (
	"context"
	"errors"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	ErrMissingBucket = errors.New("SYSTEM_SYMBOLS_S3_BUCKET is not set")
	ErrMissingRegion = errors.New("SYMBOLS_S3_BUCKET_REGION is not set")
)

// StorageEnv holds storage configuration read from environment variables.
type StorageEnv struct {
	Bucket    string
	Region    string
	AccessKey string
	SecretKey string
	Endpoint  string // empty for real AWS S3; set for MinIO or other S3-compatible stores
	IsCloud   bool   // true when running inside a Cloud Run Job
}

// StorageEnvFromEnv reads storage configuration from environment variables.
// Returns an error if required variables are absent.
func StorageEnvFromEnv() (StorageEnv, error) {
	env := StorageEnv{
		Bucket:    os.Getenv("SYSTEM_SYMBOLS_S3_BUCKET"),
		Region:    os.Getenv("SYMBOLS_S3_BUCKET_REGION"),
		AccessKey: os.Getenv("SYMBOLS_ACCESS_KEY"),
		SecretKey: os.Getenv("SYMBOLS_SECRET_ACCESS_KEY"),
		Endpoint:  os.Getenv("AWS_ENDPOINT_URL"),
		IsCloud:   os.Getenv("CLOUD_RUN_JOB") != "" && os.Getenv("CLOUD_RUN_EXECUTION") != "",
	}
	if env.Bucket == "" {
		return StorageEnv{}, ErrMissingBucket
	}
	if !env.IsCloud && env.Region == "" {
		return StorageEnv{}, ErrMissingRegion
	}
	return env, nil
}

// NewS3Client creates an S3 client configured for this environment.
// When Endpoint is set (self-host / MinIO), path-style addressing is used.
func (e StorageEnv) NewS3Client() *s3.Client {
	var creds aws.CredentialsProviderFunc = func(_ context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     e.AccessKey,
			SecretAccessKey: e.SecretKey,
		}, nil
	}
	cfg := aws.Config{
		Region:      e.Region,
		Credentials: creds,
	}
	return s3.NewFromConfig(cfg, func(o *s3.Options) {
		if e.Endpoint != "" {
			o.BaseEndpoint = aws.String(e.Endpoint)
			o.UsePathStyle = true
		}
	})
}
