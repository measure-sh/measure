package migrate

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"migrator/codec"
	"regexp"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

var uuidLayoutRegex = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.txt$`)
var unifiedLayoutRegex = regexp.MustCompile(`^[a-f0-9]{2}/[a-f0-9]{30}/proguard$`)

type SymbolsConfig struct {
	EndpointUrl     string
	Bucket          string
	Region          string
	AccessKey       string
	SecretAccessKey string
}

type SymbolsClient struct {
	client *s3.Client
	bucket string
}

type SymbolsMigrationResult struct {
	OriginalKey string
	NewKey      string
}

func NewSymbolsClient(sc SymbolsConfig) (symbolsClient *SymbolsClient) {
	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     sc.AccessKey,
			SecretAccessKey: sc.SecretAccessKey,
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      sc.Region,
		Credentials: credentialsProvider,
	}

	client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		if sc.EndpointUrl != "" {
			o.BaseEndpoint = aws.String(sc.EndpointUrl)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

	return &SymbolsClient{
		client: client,
		bucket: sc.Bucket,
	}
}

func (c SymbolsClient) ListObjectsByPattern(ctx context.Context, pattern *regexp.Regexp) (objects []types.Object, err error) {
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(c.bucket),
		Prefix: aws.String(""), // bucket root
	}

	// iterate through the objects
	paginator := s3.NewListObjectsV2Paginator(c.client, input)
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch page of S3 objects: %v", err)
		}

		// filter objects by matching the pattern
		for _, obj := range page.Contents {
			if pattern.MatchString(*obj.Key) {
				objects = append(objects, obj)
			}
		}
	}

	return
}

func (c SymbolsClient) DownloadObject(ctx context.Context, key string) (data []byte, err error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}

	resp, err := c.client.GetObject(ctx, input)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	buf := new(bytes.Buffer)
	_, err = io.Copy(buf, resp.Body)
	if err != nil {
		return
	}

	data = buf.Bytes()

	return
}

func (c SymbolsClient) UploadObject(ctx context.Context, key string, data []byte) (err error) {
	input := &s3.PutObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(data),
	}

	_, err = c.client.PutObject(ctx, input)
	return
}

func (c SymbolsClient) DeleteObject(ctx context.Context, key string) (err error) {
	input := &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}

	// we ignore the delete object output
	// for now
	_, err = c.client.DeleteObject(ctx, input)

	return
}

func MigrateSymbolsToUnifiedLayout(ctx context.Context, sc SymbolsConfig) (result []SymbolsMigrationResult, err error) {
	symbolsClient := NewSymbolsClient(sc)

	objects, err := symbolsClient.ListObjectsByPattern(ctx, uuidLayoutRegex)
	if err != nil {
		return
	}

	if len(objects) == 0 {
		return
	}

	// process each object
	for _, obj := range objects {
		data, err := symbolsClient.DownloadObject(ctx, *obj.Key)
		if err != nil {
			return nil, err
		}

		// generate debug id
		// since, all mapping files right now are proguard
		// files, we only care about proguard
		newid := debugid(data, []byte("guardsquare.com"))

		// build new unified directory layout path
		newkey := buildUnifiedPath(newid.String(), "proguard")

		// compress object using zstd
		compressed, err := codec.CompressZstd(data)
		if err != nil {
			return nil, err
		}

		err = symbolsClient.UploadObject(ctx, newkey, compressed)
		if err != nil {
			return nil, err
		}

		err = symbolsClient.DeleteObject(ctx, *obj.Key)
		if err != nil {
			return nil, err
		}

		result = append(result, SymbolsMigrationResult{
			OriginalKey: *obj.Key,
			NewKey:      newkey,
		})

		fmt.Printf("migrated s3 object %q -> %q\n", *obj.Key, newkey)
	}

	return
}

// RollbackSymbolsToLegacyLayout is a no-op for proguard
// legacy symbols object migration.
func RollbackSymbolsToLegacyLayout(ctx context.Context, sc SymbolsConfig) (err error) {
	// rollback is a no-op in this case, because
	// the old object keys were in the <uuid.txt>
	// format.
	// we'll have to store the old -> new key names
	// and then use that map to effectively perform
	// the rollback.
	// not sure if the effort needed is worth it.
	return
}
