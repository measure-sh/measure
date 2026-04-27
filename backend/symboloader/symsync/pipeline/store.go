package pipeline

import (
	"context"
	"errors"
	"io"
)

// ErrNotFound is returned by ObjectStore.Get when the requested key does not exist.
var ErrNotFound = errors.New("object not found")

// ObjectStore abstracts the object storage backend used to persist the
// manifest and uploaded DIFs. Implementations exist for S3-compatible
// stores (self-host / MinIO) and GCS (Cloud Run).
type ObjectStore interface {
	// Put streams the body to the given key. size is the exact byte length
	// of body and is required so backends can set Content-Length up front
	// (avoiding chunked transfer / multipart fallbacks for large objects).
	// contentType may be empty.
	//
	// Note: SDK-level retries on 5xx responses do not work for non-seekable
	// bodies. Callers that need retry resilience must do so themselves by
	// re-creating the reader and calling Put again.
	Put(ctx context.Context, key string, body io.Reader, size int64, contentType string) error
	// Get reads the object at key. Returns ErrNotFound if absent.
	Get(ctx context.Context, key string) ([]byte, error)
	// Delete removes the object at key. Missing keys are not an error.
	Delete(ctx context.Context, key string) error
	// List returns all keys under prefix. Order is not guaranteed.
	List(ctx context.Context, prefix string) ([]string, error)
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
