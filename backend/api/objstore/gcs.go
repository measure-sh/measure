package objstore

import (
	"context"

	"cloud.google.com/go/storage"
)

// CreateGCSClient creates a new Google Cloud Storage client.
func CreateGCSClient(ctx context.Context) (client *storage.Client, err error) {
	return storage.NewClient(ctx)
}

// CreateGCSPUTPreSignedURL creates a pre-signed URL for uploading an object to Google Cloud Storage.
func CreateGCSPUTPreSignedURL(client *storage.Client, bucket, object string, opts *storage.SignedURLOptions) (url string, err error) {
	url, err = storage.SignedURL(bucket, object, opts)
	if err != nil {
		return
	}

	return
}
