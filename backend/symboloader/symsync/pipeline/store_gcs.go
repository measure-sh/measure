package pipeline

import (
	"context"
	"errors"
	"fmt"
	"io"

	"cloud.google.com/go/storage"
	"google.golang.org/api/iterator"
)

// gcsStore is an ObjectStore backed by a Google Cloud Storage bucket.
// Credentials are resolved via Application Default Credentials, so on
// remote environments the attached service account is used automatically.
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

func (g *gcsStore) Put(ctx context.Context, key string, body io.Reader, size int64, contentType string) (err error) {
	w := g.client.Bucket(g.bucket).Object(key).NewWriter(ctx)
	if contentType != "" {
		w.ContentType = contentType
	}
	// GCS chunks the upload internally (default 16 MB). Size is informational
	// here but lets us short-circuit if the caller advertised an empty payload.
	_ = size
	if _, err = io.Copy(w, body); err != nil {
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

func (g *gcsStore) Delete(ctx context.Context, key string) error {
	if err := g.client.Bucket(g.bucket).Object(key).Delete(ctx); err != nil {
		if errors.Is(err, storage.ErrObjectNotExist) {
			return nil
		}
		return fmt.Errorf("gcs delete %s: %w", key, err)
	}
	return nil
}

func (g *gcsStore) List(ctx context.Context, prefix string) (keys []string, err error) {
	it := g.client.Bucket(g.bucket).Objects(ctx, &storage.Query{Prefix: prefix})
	for {
		attrs, err := it.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("gcs list %s: %w", prefix, err)
		}
		keys = append(keys, attrs.Name)
	}
	return keys, nil
}
