package objstore

import (
	"context"

	"cloud.google.com/go/storage"
)

// CreateGCSClient creates a new Google Cloud Storage client.
func CreateGCSClient(ctx context.Context) (client *storage.Client, err error) {
	return storage.NewClient(ctx)
}

// DownloadGCSObject gets a handle to download the object from the bucket.
func DownloadGCSObject(ctx context.Context, client *storage.Client, bucket, key string) (body *storage.Reader, err error) {
	return client.Bucket(bucket).Object(key).NewReader(ctx)
}

// DeleteGCSObject deletes the object from the bucket.
func DeleteGCSObject(ctx context.Context, client *storage.Client, bucket, key string) error {
	return client.Bucket(bucket).Object(key).Delete(ctx)
}
