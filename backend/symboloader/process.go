package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"symboloader/cipher"
	"symboloader/codec"
	"symboloader/objstore"
	"symboloader/server"
	"symboloader/symbol"
	"time"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
)

// MetaMappingIDKey is the name of the metadata
// header for representing the id of the mapping
// file.
const MetaMappingIDKey = "X-Amz-Meta-Mapping_id"

// MetaMappingOriginalFilenameKey is the name of the
// metadata header for representing the original file
// name of the mapping file.
const MetaMappingOriginalFilenameKey = "X-Amz-Meta-Original_file_name"

// processTracer is the tracer to trace the symbol
// process operation.
var processTracer = otel.Tracer("symboloader-process")

type Mapping struct {
	ID             uuid.UUID     `json:"id"`
	Type           string        `json:"type" binding:"required,oneof=proguard dsym elf_debug"`
	Key            string        `json:"key,omitempty"`
	Location       string        `json:"location,omitempty"`
	Checksum       string        `json:"checksum,omitempty"`
	Size           int64         `json:"size,omitempty"`
	Filename       string        `json:"filename" binding:"required"`
	File           []byte        `json:"file,omitempty"`
	Difs           []*symbol.Dif `json:"difs,omitempty"`
	ShouldUpload   bool          `json:"should_upload,omitempty"`
	UploadComplete bool          `json:"upload_complete,omitempty"`
}

func (m Mapping) hasChecksum() bool {
	return m.Checksum != ""
}

func (m *Mapping) extractDif() (err error) {
	switch m.Type {
	case symbol.TypeProguard.String():
		contents := m.File
		var compressedBytes []byte

		// compress bytes using zstd, if not
		// already compressed
		if !codec.IsZstdCompressed(contents) {
			compressedBytes, err = codec.CompressZstd(contents)
			if err != nil {
				return
			}
		}

		ns := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("guardsquare.com"))
		debugId := uuid.NewSHA1(ns, contents)

		// if already compressed, just use contents
		if len(compressedBytes) == 0 {
			compressedBytes = contents
		}

		m.Difs = append(m.Difs, &symbol.Dif{
			Data: compressedBytes,
			Key:  symbol.BuildUnifiedLayout(debugId.String()) + "/proguard",
		})
	case symbol.TypeDsym.String():
		reader := bytes.NewReader(m.File)

		entities, errExtract := symbol.ExtractDsymEntities(reader, func(name string) (symbol.DsymType, bool) {
			parts := strings.Split(name, "/")
			last := ""
			if len(parts) > 0 {
				last = parts[len(parts)-1]
			}
			symbolCondition := strings.Count(name, "Contents/Resources/") == 1 && !strings.HasSuffix(name, ".dSYM") && len(parts) == 5 && !strings.HasPrefix(last, "._")

			if symbolCondition {
				return symbol.TypeDsymDebug, true
			}

			return symbol.TypeDsymUnknown, false
		})

		if errExtract != nil {
			return errExtract
		}

		for _, entity := range entities {
			m.Difs = append(m.Difs, entity...)
		}
	case symbol.TypeElfDebug.String():
		debugID, errBuildID := symbol.GetBuildIDFromELF(m.File)
		if errBuildID != nil {
			return errBuildID
		}

		arch, errArch := symbol.GetArchFromELF(m.File)
		if errArch != nil {
			return errArch
		}

		type meta struct {
			Name       string `json:"name"`
			Arch       string `json:"arch"`
			FileFormat string `json:"file_format"`
		}

		metadata := meta{
			Name:       m.Filename,
			Arch:       arch,
			FileFormat: "elf",
		}

		metaJson, jsonErr := json.Marshal(metadata)
		if jsonErr != nil {
			err = jsonErr
			return
		}

		m.Difs = append(m.Difs, &symbol.Dif{
			Data: metaJson,
			Key:  symbol.BuildUnifiedLayout(debugID) + "/meta",
			Meta: true,
		})

		m.Difs = append(m.Difs, &symbol.Dif{
			Data: m.File,
			Key:  symbol.BuildUnifiedLayout(debugID) + "/debuginfo",
			Meta: false,
		})

	default:
		err = fmt.Errorf("failed to recognize mapping type %q", m.Type)
	}

	return
}

func (b *Build) upload(ctx context.Context) (err error) {
	config := server.Server.Config
	var gcsClient *storage.Client
	var s3Client *s3.Client

	// initialize object storage client
	if config.IsCloud() {
		gcsClient, err = storage.NewClient(ctx)
		if err != nil {
			return
		}

		defer gcsClient.Close()
	} else {
		s3Client = objstore.CreateS3Client(ctx, config.SymbolsAccessKey, config.SymbolsSecretAccessKey, config.SymbolsBucketRegion, config.AWSEndpoint)
	}

	metadata := map[string]string{
		"app_id":       b.AppID.String(),
		"version_name": b.VersionName,
		"version_code": b.VersionCode,
	}

	for index, mapping := range b.Mappings {
		switch mapping.Type {
		case symbol.TypeProguard.String():
			if !mapping.ShouldUpload {
				continue
			}

			metadata["mapping_type"] = symbol.TypeProguard.String()
			metadata["original_file_name"] = mapping.Filename

			for _, dif := range mapping.Difs {
				if config.IsCloud() {
					obj := gcsClient.Bucket(config.SymbolsBucket).Object(dif.Key)
					writer := obj.NewWriter(ctx)
					writer.Metadata = metadata

					if _, err = io.Copy(writer, bytes.NewReader(dif.Data)); err != nil {
						fmt.Printf("failed to upload build mapping key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
						return
					}

					if err = writer.Close(); err != nil {
						fmt.Printf("failed to close storage writer key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
						return
					}
				} else {
					putObjectInput := &s3.PutObjectInput{
						Bucket:   aws.String(config.SymbolsBucket),
						Key:      aws.String(dif.Key),
						Body:     bytes.NewReader(dif.Data),
						Metadata: metadata,
					}
					_, err = s3Client.PutObject(ctx, putObjectInput)
					if err != nil {
						return
					}
				}

				b.Mappings[index].Key = dif.Key
				b.Mappings[index].Location = buildLocation(dif.Key)
				b.Mappings[index].UploadComplete = true
			}
		case symbol.TypeDsym.String():
			mapping := b.Mappings[index]
			if !mapping.ShouldUpload {
				continue
			}

			metadata["mapping_type"] = symbol.TypeDsym.String()
			metadata["original_file_name"] = mapping.Filename

			for _, dif := range mapping.Difs {
				if !dif.Meta {
					if config.IsCloud() {
						obj := gcsClient.Bucket(config.SymbolsBucket).Object(dif.Key)
						writer := obj.NewWriter(ctx)
						writer.Metadata = metadata

						if _, err = io.Copy(writer, bytes.NewReader(dif.Data)); err != nil {
							fmt.Printf("failed to upload build mapping key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}

						if err = writer.Close(); err != nil {
							fmt.Printf("failed to close storage writer key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}
					} else {
						putObjectInput := &s3.PutObjectInput{
							Bucket:   aws.String(config.SymbolsBucket),
							Key:      aws.String(dif.Key),
							Body:     bytes.NewReader(dif.Data),
							Metadata: metadata,
						}
						_, err = s3Client.PutObject(ctx, putObjectInput)
						if err != nil {
							return
						}
					}

					b.Mappings[index].Key = dif.Key
					b.Mappings[index].Location = buildLocation(dif.Key)
					b.Mappings[index].UploadComplete = true
				}

				if dif.Meta {
					if config.IsCloud() {
						obj := gcsClient.Bucket(config.SymbolsBucket).Object(dif.Key)
						writer := obj.NewWriter(ctx)
						writer.Metadata = metadata

						if _, err = io.Copy(writer, bytes.NewReader(dif.Data)); err != nil {
							fmt.Printf("failed to upload build mapping key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}

						if err = writer.Close(); err != nil {
							fmt.Printf("failed to close storage writer key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}
					} else {
						putObjectInput := &s3.PutObjectInput{
							Bucket:   aws.String(config.SymbolsBucket),
							Key:      aws.String(dif.Key),
							Body:     bytes.NewReader(dif.Data),
							Metadata: metadata,
						}
						_, err = s3Client.PutObject(ctx, putObjectInput)
						if err != nil {
							return
						}
					}
				}
			}
		case symbol.TypeElfDebug.String():
			mapping := b.Mappings[index]
			if !mapping.ShouldUpload {
				continue
			}

			metadata["mapping_type"] = symbol.TypeElfDebug.String()
			metadata["original_file_name"] = mapping.Filename

			for _, dif := range mapping.Difs {
				if !dif.Meta {
					if config.IsCloud() {
						obj := gcsClient.Bucket(config.SymbolsBucket).Object(dif.Key)
						writer := obj.NewWriter(ctx)
						writer.Metadata = metadata

						if _, err = io.Copy(writer, bytes.NewReader(dif.Data)); err != nil {
							fmt.Printf("failed to upload build mapping key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}

						if err = writer.Close(); err != nil {
							fmt.Printf("failed to close storage writer key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}
					} else {
						putObjectInput := &s3.PutObjectInput{
							Bucket:   aws.String(config.SymbolsBucket),
							Key:      aws.String(dif.Key),
							Body:     bytes.NewReader(dif.Data),
							Metadata: metadata,
						}
						_, err = s3Client.PutObject(ctx, putObjectInput)
						if err != nil {
							return
						}
					}

					b.Mappings[index].Key = dif.Key
					b.Mappings[index].Location = buildLocation(dif.Key)
					b.Mappings[index].UploadComplete = true
				}

				if dif.Meta {
					if config.IsCloud() {
						obj := gcsClient.Bucket(config.SymbolsBucket).Object(dif.Key)
						writer := obj.NewWriter(ctx)
						writer.Metadata = metadata

						if _, err = io.Copy(writer, bytes.NewReader(dif.Data)); err != nil {
							fmt.Printf("failed to upload build mapping key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}

						if err = writer.Close(); err != nil {
							fmt.Printf("failed to close storage writer key: %s bucket: %s: %v\n", dif.Key, config.SymbolsBucket, err)
							return
						}
					} else {
						putObjectInput := &s3.PutObjectInput{
							Bucket:   aws.String(config.SymbolsBucket),
							Key:      aws.String(dif.Key),
							Body:     bytes.NewReader(dif.Data),
							Metadata: metadata,
						}
						_, err = s3Client.PutObject(ctx, putObjectInput)
						if err != nil {
							return
						}
					}
				}
			}
		}
	}

	return
}

// load reads existing build mappings from database.
func (b *Build) load(ctx context.Context, id uuid.UUID) (err error) {
	stmt := sqlf.PostgreSQL.
		Select("app_id").
		Select("version_name").
		Select("version_code").
		Select("mapping_type").
		From("build_mappings").
		Where("id = ?", id)

	defer stmt.Close()

	var mappingType string

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&b.AppID, &b.VersionName, &b.VersionCode, &mappingType); err != nil {
		return err
	}

	stmtMappings := sqlf.PostgreSQL.
		Select("id").
		Select("mapping_type").
		Select("key").
		Select("location").
		Select("fnv1_hash").
		Select("file_size").
		From("build_mappings").
		Where("app_id = ?", b.AppID).
		Where("version_name = ?", b.VersionName).
		Where("version_code = ?", b.VersionCode).
		Where("mapping_type = ?", mappingType)

	defer stmtMappings.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmtMappings.String(), stmtMappings.Args()...)

	for rows.Next() {
		var mapping Mapping

		if err := rows.Scan(&mapping.ID, &mapping.Type, &mapping.Key, &mapping.Location, &mapping.Checksum, &mapping.Size); err != nil {
			return err
		}

		b.Mappings = append(b.Mappings, &mapping)
	}

	err = rows.Err()

	return
}

func (b *Build) update(ctx context.Context) (err error) {
	now := time.Now()

	for _, mapping := range b.Mappings {
		if !mapping.UploadComplete {
			continue
		}

		stmt := sqlf.PostgreSQL.
			Update("build_mappings").
			Set("key", mapping.Key).
			Set("location", mapping.Location).
			Set("fnv1_hash", mapping.Checksum).
			Set("file_size", mapping.Size).
			Set("last_updated", now).
			Where("id = ?", mapping.ID)

		defer stmt.Close()

		_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	}

	return
}

type Build struct {
	ID          uuid.UUID
	AppID       uuid.UUID
	VersionName string     `json:"version_name" binding:"required"`
	VersionCode string     `json:"version_code" binding:"required"`
	Type        string     `json:"build_type" binding:"required,oneof=aab apk ipa"`
	Size        int        `json:"build_size" binding:"required,gt=0"`
	Mappings    []*Mapping `json:"mappings" binding:"dive,required"`
	AppUniqueID string     `json:"app_unique_id"`
}

type BuildResponse struct {
	Mappings []*Mapping `json:"mappings"`
}

// buildLocation constructs the location of the
// mapping file object stored or to be stored
// on the remote S3-like object store.
func buildLocation(key string) (location string) {
	config := server.Server.Config

	if config.IsCloud() {
		location = fmt.Sprintf("https://storage.googleapis.com/%s/%s", config.SymbolsBucket, key)
		return
	}

	// for now, we construct the location manually
	// implement a better solution later using
	// EndpointResolverV2 with custom resolvers
	// for non-AWS clouds like GCS
	if config.AWSEndpoint != "" {
		location = fmt.Sprintf("%s/%s/%s", config.AWSEndpoint, config.SymbolsBucket, key)
	} else {
		location = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", config.SymbolsBucket, config.SymbolsBucketRegion, key)
	}
	return
}

// S3EventNotificationRecord represents each record of
// S3 event notification record.
type S3EventNotificationRecord struct {
	S3 struct {
		Bucket struct {
			Name          string `json:"name"`
			OwnerIdentity struct {
				PrincipalID string `json:"principalId"`
			}
			ARN string `json:"arn"`
		}
		Object struct {
			Key          string            `json:"key"`
			Size         int64             `json:"size"`
			Etag         string            `json:"eTag"`
			ContentType  string            `json:"contentType"`
			UserMetadata map[string]string `json:"userMetadata"`
		}
	}
	Source struct {
		Host      string `json:"host"`
		Port      string `json:"port"`
		UserAgent string `json:"userAgent"`
	}
}

// SymbolNotification represents the symbol notification
// S3 event container payload.
type SymbolNotification struct {
	EventName string                      `json:"event_name"`
	Key       string                      `json:"key"`
	Records   []S3EventNotificationRecord `json:"records"`
}

type GCSSymbolNotification struct {
	Name     string            `json:"name"`
	Metadata map[string]string `json:"metadata"`
}

func (g GCSSymbolNotification) validate() (err error) {
	if g.Name == "" {
		err = errors.New("name is empty")
	}

	if len(g.Metadata) == 0 {
		err = errors.New("metadata is empty")
	}

	if _, ok := g.Metadata["mapping_id"]; !ok {
		err = errors.New("mapping id is missing in metadata")
	}

	if _, ok := g.Metadata["mapping_id"]; !ok {
		err = errors.New("mapping_id is missing in metadata")
	}

	if _, ok := g.Metadata["original_file_name"]; !ok {
		err = errors.New("original_file_name is missing in metadata")
	}

	return
}

func (nr S3EventNotificationRecord) validate() (err error) {
	if nr.S3.Bucket.Name == "" {
		err = errors.New("bucket name is empty")
	}

	// validate presence of mapping id
	if _, ok := nr.S3.Object.UserMetadata[MetaMappingIDKey]; !ok {
		err = errors.New("mapping id is missing in user metadata")
	}

	// validate presence of original file name
	if _, ok := nr.S3.Object.UserMetadata[MetaMappingOriginalFilenameKey]; !ok {
		err = errors.New("mapping original filename is missing in user metadata")
	}

	// validate presence of invalid characters
	if strings.ContainsAny(nr.S3.Object.Key, "\\/") {
		err = errors.New("key contains invalid characters")
	}

	// validate size
	if nr.S3.Object.Size == 0 {
		err = errors.New("file size is zero")
	}

	return
}

func ProcessGCSSymbolNotification(c *gin.Context) {
	ctx := c.Request.Context()
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		msg := fmt.Sprintf("Unable to read symbol notification request body: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	// Schema of event container payload
	//
	// ```typescript
	// {
	//   "kind": string,
	//   "id": string,
	//   "selfLink": string,
	//   "name": string,
	//   "bucket": string,
	//   "generation": string,
	//   "metageneration": string,
	//   "contentType": string,
	//   "timeCreated": string,
	//   "updated": string,
	//   "storageClass": string,
	//   "timeStorageClassUpdated": string,
	//   "size": string,
	//   "md5Hash": string,
	//   "mediaLink": string,
	//   "metadata": {},
	//   "crc32c": string,
	//   "etag": string,
	// }
	// ```

	var symbolNotif GCSSymbolNotification
	err = json.Unmarshal(bodyBytes, &symbolNotif)
	if err != nil {
		msg := fmt.Sprintf("error unmarshaling symbol notification: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	// if the notification is not from "incoming/*",
	// just ignore.
	if !strings.HasPrefix(symbolNotif.Name, "incoming/") {
		c.JSON(http.StatusOK, gin.H{
			"ok": true,
		})

		return
	}

	if err := symbolNotif.validate(); err != nil {
		msg := fmt.Sprintf("invalid symbol notification: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})

		return
	}

	id := symbolNotif.Metadata["mapping_id"]
	originalFileName := symbolNotif.Metadata["original_file_name"]

	mappingId, err := uuid.Parse(id)
	if err != nil {
		msg := fmt.Sprintf("error parsing uuid %q: %v", id, err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	traceCtx, span := processTracer.Start(ctx, "process-gcs-symbol-records")
	defer span.End()

	var build Build
	if err := build.load(ctx, mappingId); err != nil {
		msg := fmt.Sprintf("error loading build for mapping id %q: %v", mappingId, err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	config := server.Server.Config

	gcsClient, err := objstore.CreateGCSClient(ctx)
	if err != nil {
		msg := fmt.Sprintf("error creating GCS client: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	_, downloadSpan := processTracer.Start(traceCtx, "download-symbol")
	defer downloadSpan.End()

	body, err := objstore.DownloadGCSObject(ctx, gcsClient, config.SymbolsBucket, symbolNotif.Name)
	if err != nil {
		msg := fmt.Sprintf("error downloading mapping file for mapping id %q: %v", mappingId, err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		downloadSpan.End()

		return
	}

	downloadSpan.End()

	defer body.Close()

	// cleanup to remove the incoming file always
	defer func() {
		if err := objstore.DeleteGCSObject(ctx, gcsClient, config.SymbolsBucket, symbolNotif.Name); err != nil {
			fmt.Println("error deleting symbol object:", err)
		}
	}()

	content, err := io.ReadAll(body)
	if err != nil {
		msg := fmt.Sprintf("error reading build bytes for mapping id %q: %v", mappingId, err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	// compute checksum of the freshly
	// downloaded mapping object
	reader := bytes.NewReader(content)
	checksum, err := cipher.ChecksumFnv1(reader)
	if err != nil {
		msg := fmt.Sprintf("failed to compute checksum for mapping id %q: %v", mappingId, err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	for _, mapping := range build.Mappings {
		if mapping.ID != mappingId {
			continue
		}

		// if the checksums match, no need to do anything
		if mapping.hasChecksum() && mapping.Checksum == checksum {
			continue
		}

		// at this point, we know this mapping
		// is a new one
		mapping.ShouldUpload = true
		mapping.Checksum = checksum
		mapping.Filename = originalFileName
		mapping.File = content
		mapping.Size = int64(len(content))

		_, difSpan := processTracer.Start(traceCtx, "extract-diff")
		defer difSpan.End()

		if err := mapping.extractDif(); err != nil {
			msg := fmt.Sprintf("error extracting diff for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			difSpan.End()

			return
		}

		difSpan.End()
	}

	_, uploadSpan := processTracer.Start(traceCtx, "upload-symbol")
	defer uploadSpan.End()

	if err := build.upload(ctx); err != nil {
		msg := fmt.Sprintf("error uploading build for mapping id %q: %v", mappingId, err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		uploadSpan.End()

		return
	}

	uploadSpan.End()

	_, updateSpan := processTracer.Start(traceCtx, "update-build")
	defer updateSpan.End()

	if err := build.update(ctx); err != nil {
		msg := fmt.Sprintf("error updating build for mapping id %q: %v", mappingId, err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		updateSpan.End()

		return
	}

	updateSpan.End()

	c.JSON(http.StatusOK, gin.H{
		"message": "symbol notification processed successfully",
	})
}

func ProcessSymbolNotification(c *gin.Context) {
	ctx := c.Request.Context()
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		msg := fmt.Sprintf("Unable to read symbol notification request body: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	// Schema of event container payload.
	//
	// Some of the outer elements may vary depending on
	// which S3-compatible storage system generated
	// these events.
	//
	// "s3" is the main object of interest for most of
	// our purposes.
	//
	// ```typescript
	// {
	//   "event_name": string,
	// 	 "key": string,
	// 	 "records": [
	//     {
	// 	     "eventVersion": string,
	// 	     "eventSource": string,
	// 	     "awsRegion": string,
	// 	     "eventTime": string,
	// 	     "eventName": s3:ObjectCreated:Put | s3:ObjectCreated:Head,
	// 	     "userIdentity": {
	//			"principalId": string,
	// 	     },
	// 	     "requestParameters": {
	//          "principalId": string,
	//          "region": string,
	//          "sourceIPAddress": string,
	// 	     },
	// 	     "responseElements": {
	//          "x-amz-id-2": string,
	//          "x-amz-request-id": string,
	//          "x-minio-deployment-id": string,
	//          "x-minio-origin-endpoint": string,
	// 	     },
	// 	     "s3": {
	//          "s3SchemaVersion": string,
	//          "configurationId": string,
	//          "bucket": {
	//            "name": string,
	//            "ownerIdentity": {
	//              "principalId": string,
	//            },
	//            "arn": string,
	//          },
	//          "object": {
	//            "key": string,
	//            "size": number,
	//            "eTag": string,
	//            "contentType": string,
	//            "userMetadata": {
	//              "content-type": string,
	//            },
	//            "sequencer": string,
	//          },
	// 	     },
	// 	     "source": {
	//         "host": string,
	//         "port": string,
	//         "userAgent": string,
	//       },
	//     },
	//   ]
	// }
	// ```

	var symbolNotif SymbolNotification
	err = json.Unmarshal(bodyBytes, &symbolNotif)
	if err != nil {
		msg := fmt.Sprintf("error unmarshaling symbol notification: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	traceCtx, span := processTracer.Start(ctx, "process-s3-symbol-records")
	defer span.End()

	for _, record := range symbolNotif.Records {
		key, err := url.QueryUnescape(record.S3.Object.Key)
		if err != nil {
			msg := fmt.Sprintf("error unescaping key %q: %v", record.S3.Object.Key, err)
			fmt.Println(msg)
			continue
		}

		// don't process if record is not of "incoming" prefix
		if !strings.HasPrefix(record.S3.Object.Key, "incoming%2F") {
			continue
		}

		if err := record.validate(); err != nil {
			msg := fmt.Sprintf("failed to validate record for key %q: %v", record.S3.Object.Key, err)
			fmt.Println(msg)
			continue
		}

		id, ok := record.S3.Object.UserMetadata[MetaMappingIDKey]
		if !ok {
			msg := fmt.Sprintf("missing %q in user metadata", MetaMappingIDKey)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		originalFileName, ok := record.S3.Object.UserMetadata[MetaMappingOriginalFilenameKey]
		if !ok {
			msg := fmt.Sprintf("missing %q in user metadata", MetaMappingOriginalFilenameKey)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		mappingId, err := uuid.Parse(id)
		if err != nil {
			msg := fmt.Sprintf("error parsing uuid %q: %v", id, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		var build Build

		if err := build.load(ctx, mappingId); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}

			msg := fmt.Sprintf("error loading build for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		config := server.Server.Config

		s3Client := objstore.CreateS3Client(ctx, config.SymbolsAccessKey, config.SymbolsSecretAccessKey, config.SymbolsBucketRegion, config.AWSEndpoint)

		body, err := objstore.DownloadS3Object(ctx, s3Client, &s3.GetObjectInput{
			Bucket: aws.String(config.SymbolsBucket),
			Key:    aws.String(key),
		})
		if err != nil {
			msg := fmt.Sprintf("error downloading mapping file for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		defer body.Close()

		content, err := io.ReadAll(body)
		if err != nil {
			msg := fmt.Sprintf("error reading build bytes for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		// compute checksum of the freshly
		// downloaded mapping object
		reader := bytes.NewReader(content)
		checksum, err := cipher.ChecksumFnv1(reader)
		if err != nil {
			msg := fmt.Sprintf("failed to compute checksum for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		for _, mapping := range build.Mappings {
			if mapping.ID != mappingId {
				continue
			}

			// if the checksums match, no need to do anything
			if mapping.hasChecksum() && mapping.Checksum == checksum {
				continue
			}

			// at this point, we know this mapping
			// is a new one
			mapping.ShouldUpload = true
			mapping.Checksum = checksum
			mapping.Filename = originalFileName
			mapping.File = content
			mapping.Size = int64(len(content))

			_, span := processTracer.Start(traceCtx, "extract-dif")
			defer span.End()

			if err := mapping.extractDif(); err != nil {
				msg := fmt.Sprintf("error extracting diff for mapping id %q: %v", mappingId, err)
				fmt.Println(msg)

				c.JSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})

				span.End()

				return
			}

			span.End()
		}

		_, uploadSpan := processTracer.Start(traceCtx, "upload-symbol")
		defer uploadSpan.End()

		if err := build.upload(ctx); err != nil {
			msg := fmt.Sprintf("error uploading build for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			uploadSpan.End()

			return
		}

		_, updateSpan := processTracer.Start(traceCtx, "update-build")
		defer updateSpan.End()

		if err := build.update(ctx); err != nil {
			msg := fmt.Sprintf("error updating build for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			updateSpan.End()

			return
		}

		// cleanup to remove the incoming file always
		defer func() {
			_, err = objstore.DeleteS3Object(ctx, s3Client, &s3.DeleteObjectInput{
				Bucket: aws.String(config.SymbolsBucket),
				Key:    aws.String(key),
			})
			if err != nil {
				msg := fmt.Sprintf("error deleting mapping object %q: %v", key, err)
				fmt.Println(msg)

				return
			}
		}()
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
	})
}
