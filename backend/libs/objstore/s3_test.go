package objstore

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func TestCreateS3PUTPreSignedURLMetadataHeader(t *testing.T) {
	client := CreateS3Client(context.Background(), "key", "secret", "us-east-1", "http://minio:9000")
	u, err := CreateS3PUTPreSignedURL(context.Background(), client, &s3.PutObjectInput{
		Bucket:   aws.String("bucket"),
		Key:      aws.String("k"),
		Metadata: map[string]string{"original-file-name": "a.png"},
	})
	if err != nil {
		t.Fatalf("presign failed: %v", err)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatalf("bad url: %v", err)
	}
	signed := parsed.Query().Get("X-Amz-SignedHeaders")
	if !strings.Contains(";"+signed+";", ";x-amz-meta-original-file-name;") {
		t.Fatalf("signed headers %q missing meta header", signed)
	}
	if strings.Contains(signed, "_") {
		t.Fatalf("signed headers %q contain underscore", signed)
	}
}
