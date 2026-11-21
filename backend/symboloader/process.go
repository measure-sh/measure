package main

import (
	"backend/libs/objstore"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"runtime/debug"
	"strings"
	"symboloader/cipher"
	"symboloader/server"
	"time"

	"backend/libs/symbol"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
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

// ErrPermanentFailure marks a failure that retrying cannot fix.
var ErrPermanentFailure = errors.New("permanent mapping failure")

// ErrIncomingNotFound marks an incoming object that no longer exists.
var ErrIncomingNotFound = errors.New("incoming object not found")

// processTracer is the tracer to trace the symbol
// process operation.
var processTracer = otel.Tracer("symboloader-process")

type Mapping struct {
	ID             uuid.UUID     `json:"id"`
	Type           string        `json:"type" binding:"required,oneof=proguard dsym elf_debug jsbundle"`
	Key            string        `json:"key,omitempty"`
	Location       string        `json:"location,omitempty"`
	Checksum       string        `json:"checksum,omitempty"`
	Size           int64         `json:"size,omitempty"`
	Filename       string        `json:"filename" binding:"required"`
	File           []byte        `json:"file,omitempty"`
	Difs           []*symbol.Dif `json:"difs,omitempty"`
	ShouldUpload   bool          `json:"should_upload,omitempty"`
	UploadComplete bool          `json:"upload_complete,omitempty"`
	// PatchID scopes the dedup gate to a single OTA patch. Loaded
	// per row so identical (zero-byte) bundle content from a
	// different patch does not falsely dedup. Internal only.
	PatchID uuid.UUID `json:"-"`
}

// extractDif prepares & extracts debug information
// files for symbol files for all supported platforms.
func (m *Mapping) extractDif() (err error) {
	switch m.Type {
	case symbol.TypeProguard.String():
		contents := m.File
		// var compressedBytes []byte

		// compress bytes using zstd, if not
		// already compressed
		// if !codec.IsZstdCompressed(contents) {
		// 	compressedBytes, err = codec.CompressZstd(contents)
		// 	if err != nil {
		// 		return
		// 	}
		// }

		ns := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("guardsquare.com"))
		debugId := uuid.NewSHA1(ns, contents)

		// if already compressed, just use contents
		// if len(compressedBytes) == 0 {
		// 	compressedBytes = contents
		// }

		m.Difs = append(m.Difs, &symbol.Dif{
			Data: contents,
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
		elfData, errGunzip := symbol.GunzipIfCompressed(m.File)
		if errGunzip != nil {
			return errGunzip
		}
		m.File = elfData

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

	case symbol.TypeJsBundle.String():
		reader := bytes.NewReader(m.File)
		difs, errExtract := symbol.ExtractJsBundle(reader)
		if errExtract != nil {
			return errExtract
		}
		m.Difs = append(m.Difs, difs...)

	default:
		err = fmt.Errorf("failed to recognize mapping type %q", m.Type)
	}

	return
}

// upload uploads the debug information files to S3 like
// remote object storage.
func (b *Build) upload(ctx context.Context) (err error) {
	config := server.Server.Config
	var gcsClient *storage.Client
	var s3Client *s3.Client

	// initialize object storage client
	if config.IsCloud() {
		gcsClient, err = objstore.CreateGCSClient(ctx)
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
				var checksum string
				checksum, err = cipher.ChecksumFnv1(bytes.NewReader(dif.Data))
				if err != nil {
					return
				}

				if b.artifactExists(dif.Key, checksum, b.PatchID) {
					continue
				}

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

				if err = b.recordArtifact(index, dif, checksum); err != nil {
					return
				}
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
					var checksum string
					checksum, err = cipher.ChecksumFnv1(bytes.NewReader(dif.Data))
					if err != nil {
						return
					}

					if b.artifactExists(dif.Key, checksum, b.PatchID) {
						continue
					}

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

					if err = b.recordArtifact(index, dif, checksum); err != nil {
						return
					}
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
					var checksum string
					checksum, err = cipher.ChecksumFnv1(bytes.NewReader(dif.Data))
					if err != nil {
						return
					}

					if b.artifactExists(dif.Key, checksum, b.PatchID) {
						continue
					}

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

					if err = b.recordArtifact(index, dif, checksum); err != nil {
						return
					}
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
		case symbol.TypeJsBundle.String():
			mapping := b.Mappings[index]
			if !mapping.ShouldUpload {
				continue
			}

			metadata["mapping_type"] = symbol.TypeJsBundle.String()
			metadata["original_file_name"] = mapping.Filename

			for _, dif := range mapping.Difs {
				var checksum string
				checksum, err = cipher.ChecksumFnv1(bytes.NewReader(dif.Data))
				if err != nil {
					return
				}

				if b.artifactExists(dif.Key, checksum, b.PatchID) {
					continue
				}

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

				if err = b.recordArtifact(index, dif, checksum); err != nil {
					return
				}
			}
		}
	}

	return
}

// artifactExists reports whether a loaded sibling row already
// holds this exact object, matched by key, per-object checksum &
// patch id. It is the dedup gate: a redelivered notification
// reloads the rows written by the first delivery, so every dif
// matches here & is skipped, keeping processing idempotent. The
// patch id scoping stops a different patch's identical (zero-byte)
// bundle content from colliding, since bundle keys are content
// addressed & every empty bundle hashes alike.
func (b *Build) artifactExists(key, checksum string, patchID uuid.UUID) bool {
	for _, m := range b.Mappings {
		if m.Key == key && m.Checksum == checksum && m.PatchID == patchID {
			return true
		}
	}

	return false
}

// recordArtifact ties an uploaded dif to a build_mappings row.
// The first non-meta dif of a mapping fills the existing row,
// every later one becomes a new extra row to insert. This is how
// a single archive that extracts to many objects gets one row
// per object instead of the last object overwriting the rest.
// checksum is the per-object fnv1 hash stored on the row.
func (b *Build) recordArtifact(index int, dif *symbol.Dif, checksum string) (err error) {
	location := buildLocation(dif.Key)

	if !b.Mappings[index].UploadComplete {
		b.Mappings[index].Key = dif.Key
		b.Mappings[index].Location = location
		b.Mappings[index].Checksum = checksum
		b.Mappings[index].Size = int64(len(dif.Data))
		b.Mappings[index].UploadComplete = true
		return
	}

	b.Extras = append(b.Extras, &Mapping{
		ID:             uuid.New(),
		Type:           b.Mappings[index].Type,
		Key:            dif.Key,
		Location:       location,
		Checksum:       checksum,
		Size:           int64(len(dif.Data)),
		UploadComplete: true,
	})

	return
}

// load reads existing build mappings from database.
func (b *Build) load(ctx context.Context, id uuid.UUID) (err error) {
	stmt := sqlf.PostgreSQL.
		Select("app_id").
		Select("version_name").
		Select("version_code").
		Select("mapping_type").
		Select("patch_id").
		Select("patch_version").
		From("build_mappings").
		Where("id = ?", id)

	defer stmt.Close()

	var mappingType string

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&b.AppID, &b.VersionName, &b.VersionCode, &mappingType, &b.PatchID, &b.PatchVersion); err != nil {
		return err
	}

	stmtMappings := sqlf.PostgreSQL.
		Select("id").
		Select("mapping_type").
		Select("key").
		Select("location").
		Select("fnv1_hash").
		Select("file_size").
		Select("patch_id").
		From("build_mappings").
		Where("app_id = ?", b.AppID).
		Where("version_name = ?", b.VersionName).
		Where("version_code = ?", b.VersionCode).
		Where("mapping_type = ?", mappingType)

	defer stmtMappings.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmtMappings.String(), stmtMappings.Args()...)
	defer rows.Close()

	for rows.Next() {
		var mapping Mapping

		if err := rows.Scan(&mapping.ID, &mapping.Type, &mapping.Key, &mapping.Location, &mapping.Checksum, &mapping.Size, &mapping.PatchID); err != nil {
			return err
		}

		b.Mappings = append(b.Mappings, &mapping)
	}

	err = rows.Err()

	return
}

// update writes the completed mapping rows & the extra rows in one
// transaction.
func (b *Build) update(ctx context.Context) (err error) {
	tx, err := server.Server.PgPool.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	for _, mapping := range b.Mappings {
		if !mapping.UploadComplete {
			continue
		}

		if err = updateMappingRow(ctx, tx, mapping, now); err != nil {
			return
		}
	}

	if err = b.insertExtras(ctx, tx, now); err != nil {
		return
	}

	return tx.Commit(ctx)
}

// updateMappingRow writes the artifact fields of one mapping row.
func updateMappingRow(ctx context.Context, tx pgx.Tx, mapping *Mapping, now time.Time) error {
	stmt := sqlf.PostgreSQL.
		Update("build_mappings").
		Set("key", mapping.Key).
		Set("location", mapping.Location).
		Set("fnv1_hash", mapping.Checksum).
		Set("file_size", mapping.Size).
		Set("last_updated", now).
		Where("id = ?", mapping.ID)

	defer stmt.Close()

	_, err := tx.Exec(ctx, stmt.String(), stmt.Args()...)

	return err
}

// insertExtras inserts the additional artifact rows produced when
// one mapping extracts to more than one object.
func (b *Build) insertExtras(ctx context.Context, tx pgx.Tx, now time.Time) (err error) {
	if len(b.Extras) == 0 {
		return
	}

	stmt := sqlf.PostgreSQL.
		InsertInto("build_mappings")

	defer stmt.Close()

	for _, m := range b.Extras {
		// ponytail: stale extra rows linger on changed re-upload, same as
		// orphaned objects; add reaping if it grows.
		stmt.
			NewRow().
			Set("id", m.ID).
			Set("app_id", b.AppID).
			Set("version_name", b.VersionName).
			Set("version_code", b.VersionCode).
			Set("mapping_type", m.Type).
			Set("key", m.Key).
			Set("location", m.Location).
			Set("fnv1_hash", m.Checksum).
			Set("file_size", m.Size).
			Set("patch_id", b.PatchID).
			Set("patch_version", b.PatchVersion).
			Set("last_updated", now)
	}

	_, err = tx.Exec(ctx, stmt.String(), stmt.Args()...)

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
	// PatchID is the OTA patch id shared by every row of this
	// build, loaded from the existing row so extra artifact
	// rows carry it too.
	PatchID uuid.UUID
	// PatchVersion is the human-facing OTA patch version shared
	// by every row of this build, loaded like PatchID.
	PatchVersion string
	// Extras holds additional artifact rows to insert when one
	// mapping extracts to more than one object.
	Extras []*Mapping
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

// validate validates the GCS event notification record. It
// reports the first failing check.
func (g GCSSymbolNotification) validate() error {
	if g.Name == "" {
		return errors.New("name is empty")
	}

	if len(g.Metadata) == 0 {
		return errors.New("metadata is empty")
	}

	if _, ok := g.Metadata["mapping_id"]; !ok {
		return errors.New("mapping_id is missing in metadata")
	}

	if _, ok := g.Metadata["original_file_name"]; !ok {
		return errors.New("original_file_name is missing in metadata")
	}

	return nil
}

// validate validates the S3 event notification record.
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

// isTransient reports whether a failure should keep the incoming
// object & fail the response.
func isTransient(err error) bool {
	return err != nil && !errors.Is(err, ErrPermanentFailure)
}

// permanent marks err as a permanent mapping failure.
func permanent(err error) error {
	return fmt.Errorf("%w: %w", ErrPermanentFailure, err)
}

// parseMappingID parses a mapping id, failing permanently on bad input.
func parseMappingID(id string) (uuid.UUID, error) {
	mappingID, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, permanent(fmt.Errorf("error parsing uuid %q: %w", id, err))
	}

	return mappingID, nil
}

// classifyS3ReadError marks a missing S3 object as permanent
// & already handled. Other errors pass through unchanged.
func classifyS3ReadError(err error) error {
	var nsk *types.NoSuchKey
	if errors.As(err, &nsk) {
		return fmt.Errorf("%w: %w: %w", ErrPermanentFailure, ErrIncomingNotFound, err)
	}

	return err
}

// classifyGCSReadError marks a missing GCS object as permanent
// & already handled. Other errors pass through unchanged.
func classifyGCSReadError(err error) error {
	if errors.Is(err, storage.ErrObjectNotExist) {
		return fmt.Errorf("%w: %w: %w", ErrPermanentFailure, ErrIncomingNotFound, err)
	}

	return err
}

// readS3Incoming reads the incoming object from S3 like storage.
func readS3Incoming(ctx context.Context, client *s3.Client, bucket, key string) ([]byte, error) {
	out, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, classifyS3ReadError(err)
	}
	defer out.Body.Close()

	return io.ReadAll(out.Body)
}

// readGCSIncoming reads the incoming object from GCS.
func readGCSIncoming(ctx context.Context, client *storage.Client, bucket, name string) ([]byte, error) {
	reader, err := client.Bucket(bucket).Object(name).NewReader(ctx)
	if err != nil {
		return nil, classifyGCSReadError(err)
	}
	defer reader.Close()

	return io.ReadAll(reader)
}

// deleteS3Incoming deletes the incoming S3 object & only logs on
// error. It runs even if ctx is cancelled.
func deleteS3Incoming(ctx context.Context, client *s3.Client, bucket, key string) {
	_, err := client.DeleteObject(context.WithoutCancel(ctx), &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		fmt.Printf("error deleting mapping object %q: %v\n", key, err)
	}
}

// deleteGCSIncoming deletes the incoming GCS object & only logs on
// error. It runs even if ctx is cancelled.
func deleteGCSIncoming(ctx context.Context, client *storage.Client, bucket, name string) {
	err := client.Bucket(bucket).Object(name).Delete(context.WithoutCancel(ctx))
	if err != nil {
		fmt.Println("error deleting symbol object:", err)
	}
}

// settleIncoming logs the outcome of processing the incoming
// object. It calls del on success & on permanent failures, except
// when the object was not found. Transient failures keep the object.
func settleIncoming(name string, err error, del func()) {
	if isTransient(err) {
		fmt.Printf("transient failure for %q, keeping incoming object: %v\n", name, err)
		return
	}

	if err != nil {
		fmt.Printf("permanent failure for %q: %v\n", name, err)
	}

	if errors.Is(err, ErrIncomingNotFound) {
		return
	}

	del()
}

// recoverPermanent converts a panic into a permanent failure & logs
// its stack. It must be deferred directly.
func recoverPermanent(err *error) {
	r := recover()
	if r == nil {
		return
	}

	fmt.Printf("panic while extracting mapping: %v\n%s\n", r, debug.Stack())
	*err = permanent(fmt.Errorf("panic: %v", r))
}

// traced runs fn inside a span named name.
func traced(ctx context.Context, name string, fn func() error) error {
	_, span := processTracer.Start(ctx, name)
	defer span.End()

	return fn()
}

// extractMapping fills the mapping matching mappingID with the
// content & extracts its difs. A missing mapping, an extraction
// error or no difs are permanent failures.
func (b *Build) extractMapping(mappingID uuid.UUID, originalFileName string, content []byte) error {
	for _, mapping := range b.Mappings {
		if mapping.ID != mappingID {
			continue
		}

		mapping.ShouldUpload = true
		mapping.Filename = originalFileName
		mapping.File = content
		mapping.Size = int64(len(content))

		if err := mapping.extractDif(); err != nil {
			return permanent(fmt.Errorf("error extracting dif for mapping id %q: %w", mappingID, err))
		}

		if len(mapping.Difs) == 0 {
			return permanent(fmt.Errorf("no difs extracted for mapping id %q", mappingID))
		}

		return nil
	}

	return permanent(fmt.Errorf("mapping id %q not found in build", mappingID))
}

// processMapping loads the build, extracts the content, uploads
// the difs & updates the build rows. A panic during extraction is
// reported as a permanent failure. Other panics propagate.
func processMapping(ctx context.Context, mappingID uuid.UUID, originalFileName string, content []byte) (err error) {
	var build Build

	err = traced(ctx, "load-build", func() error {
		if err := build.load(ctx, mappingID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				err = permanent(err)
			}
			return fmt.Errorf("error loading build for mapping id %q: %w", mappingID, err)
		}
		return nil
	})
	if err != nil {
		return
	}

	err = traced(ctx, "extract-dif", func() (err error) {
		defer recoverPermanent(&err)
		return build.extractMapping(mappingID, originalFileName, content)
	})
	if err != nil {
		return
	}

	err = traced(ctx, "upload-symbol", func() error {
		if err := build.upload(ctx); err != nil {
			return fmt.Errorf("error uploading build for mapping id %q: %w", mappingID, err)
		}
		return nil
	})
	if err != nil {
		return
	}

	return traced(ctx, "update-build", func() error {
		if err := build.update(ctx); err != nil {
			return fmt.Errorf("error updating build for mapping id %q: %w", mappingID, err)
		}
		return nil
	})
}

// processGCSObject validates, reads & processes one incoming GCS object.
func processGCSObject(ctx context.Context, client *storage.Client, n GCSSymbolNotification) error {
	if err := n.validate(); err != nil {
		return permanent(fmt.Errorf("invalid symbol notification: %w", err))
	}

	mappingID, err := parseMappingID(n.Metadata["mapping_id"])
	if err != nil {
		return err
	}

	var content []byte
	err = traced(ctx, "download-symbol", func() (err error) {
		content, err = readGCSIncoming(ctx, client, server.Server.Config.SymbolsBucket, n.Name)
		return
	})
	if err != nil {
		return fmt.Errorf("error reading mapping file for mapping id %q: %w", mappingID, err)
	}

	return processMapping(ctx, mappingID, n.Metadata["original_file_name"], content)
}

// handleGCSObject processes one incoming GCS object & settles it.
func handleGCSObject(ctx context.Context, n GCSSymbolNotification) (err error) {
	client, err := objstore.CreateGCSClient(ctx)
	if err != nil {
		return fmt.Errorf("error creating GCS client: %w", err)
	}
	defer client.Close()

	bucket := server.Server.Config.SymbolsBucket
	err = processGCSObject(ctx, client, n)
	settleIncoming(n.Name, err, func() { deleteGCSIncoming(ctx, client, bucket, n.Name) })

	return
}

// ProcessGCSSymbolNotification handles a GCS event for one incoming
// mapping object. It responds 500 only on transient failures.
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

	traceCtx, span := processTracer.Start(ctx, "process-gcs-symbol-records")
	defer span.End()

	err = handleGCSObject(traceCtx, symbolNotif)
	if isTransient(err) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})

		return
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"error": err.Error(),
		})

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "symbol notification processed successfully",
	})
}

// processS3Record validates, reads & processes one incoming S3 record.
func processS3Record(ctx context.Context, client *s3.Client, record S3EventNotificationRecord, key string) error {
	if err := record.validate(); err != nil {
		return permanent(fmt.Errorf("failed to validate record for key %q: %w", record.S3.Object.Key, err))
	}

	mappingID, err := parseMappingID(record.S3.Object.UserMetadata[MetaMappingIDKey])
	if err != nil {
		return err
	}

	var content []byte
	err = traced(ctx, "download-symbol", func() (err error) {
		content, err = readS3Incoming(ctx, client, server.Server.Config.SymbolsBucket, key)
		return
	})
	if err != nil {
		return fmt.Errorf("error reading mapping file for mapping id %q: %w", mappingID, err)
	}

	return processMapping(ctx, mappingID, record.S3.Object.UserMetadata[MetaMappingOriginalFilenameKey], content)
}

// handleS3Record processes one incoming S3 record & settles it.
func handleS3Record(ctx context.Context, client *s3.Client, record S3EventNotificationRecord, key string) (err error) {
	bucket := server.Server.Config.SymbolsBucket
	err = processS3Record(ctx, client, record, key)
	settleIncoming(key, err, func() { deleteS3Incoming(ctx, client, bucket, key) })

	return
}

// ProcessSymbolNotification handles a S3 event with incoming mapping
// records. It processes every record & responds 500 if any failed
// transiently.
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

	config := server.Server.Config
	s3Client := objstore.CreateS3Client(traceCtx, config.SymbolsAccessKey, config.SymbolsSecretAccessKey, config.SymbolsBucketRegion, config.AWSEndpoint)

	var transient []error

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

		if err := handleS3Record(traceCtx, s3Client, record, key); isTransient(err) {
			transient = append(transient, err)
		}
	}

	if len(transient) > 0 {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": errors.Join(transient...).Error(),
		})

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
	})
}
