package pipeline

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"

	"cloud.google.com/go/storage"
)

// gcsStore is an ObjectStore backed by a Google Cloud Storage bucket.
// Credentials are resolved via Application Default Credentials, so on
// Cloud Run the attached service account is used automatically.
type gcsStore struct {
	client *storage.Client
	bucket string
}

func newGCSStore(ctx context.Context, bucket string) (*gcsStore, error) {
	c, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("gcs client: %w", err)
	}
	return &gcsStore{client: c, bucket: bucket}, nil
}

func (g *gcsStore) Put(ctx context.Context, key string, data []byte, contentType string) (err error) {
	w := g.client.Bucket(g.bucket).Object(key).NewWriter(ctx)
	if contentType != "" {
		w.ContentType = contentType
	}
	if _, err = io.Copy(w, bytes.NewReader(data)); err != nil {
		_ = w.Close()
		return fmt.Errorf("gcs write %s: %w", key, err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("gcs close %s: %w", key, err)
	}
	return nil
}

func (g *gcsStore) Get(ctx context.Context, key string) (data []byte, err error) {
	r, err := g.client.Bucket(g.bucket).Object(key).NewReader(ctx)
	if err != nil {
		if errors.Is(err, storage.ErrObjectNotExist) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gcs get %s: %w", key, err)
	}
	defer r.Close()
	return io.ReadAll(r)
}
