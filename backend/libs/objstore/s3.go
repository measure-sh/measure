package objstore

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// CreateS3Client creates a new S3 client using AWS SDK Go v2
func CreateS3Client(ctx context.Context, accessKey, secretAccessKey, region, endpoint string) (client *s3.Client) {
	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     accessKey,
			SecretAccessKey: secretAccessKey,
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      region,
		Credentials: credentialsProvider,
	}

	client = s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

	return
}

// CreateS3PUTPreSignedURL creates a pre-signed URL for uploading an object to S3.
func CreateS3PUTPreSignedURL(ctx context.Context, client *s3.Client, params *s3.PutObjectInput, optFns ...func(*s3.PresignOptions)) (url string, err error) {
	presigner := s3.NewPresignClient(client)
	req, err := presigner.PresignPutObject(ctx, params, optFns...)

	if err != nil {
		return
	}

	url = req.URL
	return
}
