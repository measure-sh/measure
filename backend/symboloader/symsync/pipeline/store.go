package pipeline

import (
	"context"
	"errors"
)

// ErrNotFound is returned by ObjectStore.Get when the requested key does not exist.
var ErrNotFound = errors.New("object not found")

// ObjectStore abstracts the object storage backend used to persist the
// manifest and uploaded DIFs. Implementations exist for S3-compatible
// stores (self-host / MinIO) and GCS (Cloud Run).
type ObjectStore interface {
	// Put writes data at the given key. contentType may be empty.
	Put(ctx context.Context, key string, data []byte, contentType string) error
	// Get reads the object at key. Returns ErrNotFound if absent.
	Get(ctx context.Context, key string) ([]byte, error)
}

// NewObjectStore constructs the appropriate ObjectStore for the given environment.
// In Cloud Run, GCS is used with ADC-resolved credentials. Otherwise an
// S3-compatible store (real AWS S3 or MinIO) is used.
func NewObjectStore(ctx context.Context, env StorageEnv) (ObjectStore, error) {
	if env.IsCloud {
		return newGCSStore(ctx, env.Bucket)
	}
	return newS3Store(env), nil
}
