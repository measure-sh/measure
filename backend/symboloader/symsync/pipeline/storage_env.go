package pipeline

import (
	"errors"
	"os"
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
