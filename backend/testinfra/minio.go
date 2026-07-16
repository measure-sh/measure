package testinfra

import (
	"bytes"
	"context"
	"log"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	miniomodule "github.com/testcontainers/testcontainers-go/modules/minio"
)

const minioImage = "pgsty/minio:latest"

// MinioUser and MinioPassword are the root credentials of the MinIO
// container started by SetupMinio.
const (
	MinioUser     = "minioadmin"
	MinioPassword = "minioadmin"
)

// S3Object is one object seeded into a MinIO bucket by SeedS3Bucket.
type S3Object struct {
	Data     []byte
	Metadata map[string]string
}

// SetupMinio starts a MinIO container and returns its endpoint URL
// plus a cleanup function.
func SetupMinio(ctx context.Context) (endpoint string, cleanup func()) {
	container, err := miniomodule.Run(ctx, minioImage,
		miniomodule.WithUsername(MinioUser),
		miniomodule.WithPassword(MinioPassword),
	)
	if err != nil {
		log.Fatalf("failed to start minio container: %v", err)
	}

	hostPort, err := container.ConnectionString(ctx)
	if err != nil {
		log.Fatalf("failed to get minio connection string: %v", err)
	}

	cleanup = func() {
		container.Terminate(context.Background())
	}

	return "http://" + hostPort, cleanup
}

// SeedS3Bucket creates a bucket on the MinIO container and uploads
// the given objects into it. Seed a fresh bucket per test so object
// keys never collide across tests.
func SeedS3Bucket(ctx context.Context, t *testing.T, endpoint, bucket string, objects map[string]S3Object) {
	t.Helper()

	client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       "us-east-1",
		Credentials:  credentials.NewStaticCredentialsProvider(MinioUser, MinioPassword, ""),
		UsePathStyle: true,
	})

	if _, err := client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)}); err != nil {
		t.Fatalf("create bucket %q: %v", bucket, err)
	}

	for key, obj := range objects {
		if _, err := client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:   aws.String(bucket),
			Key:      aws.String(key),
			Body:     bytes.NewReader(obj.Data),
			Metadata: obj.Metadata,
		}); err != nil {
			t.Fatalf("put object %q: %v", key, err)
		}
	}
}
