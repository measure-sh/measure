package measure

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"backend/api/chrono"
	"backend/api/cipher"
	"backend/api/codec"
	"backend/api/objstore"
	"backend/api/opsys"
	"backend/api/server"
	"backend/api/symbol"

	credentials "cloud.google.com/go/iam/credentials/apiv1"
	"cloud.google.com/go/iam/credentials/apiv1/credentialspb"
	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"slices"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
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

// MappingFile represents a bundle file
// used in symbolication of stacktraces
// that is uploaded to an S3-like remote
// object store.
type MappingFile struct {
	ID             uuid.UUID
	Header         *multipart.FileHeader
	Checksum       string
	Key            string
	Location       string
	Size           int64
	Difs           []*symbol.Dif
	ShouldUpload   bool
	UploadComplete bool
}

// BuildMapping represents the set of parameters
// for handling or storing mapping files.
type BuildMapping struct {
	AppID        uuid.UUID
	VersionName  string `form:"version_name" binding:"required"`
	VersionCode  string `form:"version_code" binding:"required"`
	Platform     string `form:"platform"`
	OSName       string `form:"os_name"`
	Type         string
	MappingTypes []string                `form:"mapping_type" binding:"required_with=File"`
	Files        []*multipart.FileHeader `form:"mapping_file" binding:"required_with=MappingType"`
	MappingFiles []*MappingFile
	Timestamp    time.Time
}

// hasMapping checks if necessary details are
// valid for mapping build info.
func (bm BuildMapping) hasMapping() bool {
	if len(bm.MappingTypes) > 0 && len(bm.MappingFiles) > 0 {
		return true
	}
	return false
}

// hasProguard checks if the build mapping
// contains proguard mapping type.
func (bm BuildMapping) hasProguard() bool {
	return slices.Contains(bm.MappingTypes, symbol.TypeProguard.String())
}

// hasDSYM checks if the build mapping
// contains dsym mapping type.
func (bm BuildMapping) hasDSYM() bool {
	return slices.Contains(bm.MappingTypes, symbol.TypeDsym.String())
}

// validate validates build mapping details.
func (bm *BuildMapping) validate(app *App) (code int, err error) {
	code = http.StatusBadRequest

	osName := app.OSName

	// Deduce OS name from app or
	// from payload. ensure we have
	// a value or fail fast.
	// The OS name in apps table
	// is set after the first event
	// is received, until which the
	// OS name is empty.
	if osName == "" && bm.OSName != "" {
		osName = bm.OSName
	}

	// Deduce OS name from platform.
	// This is critical for maintaining
	// backwards compatibility.
	// Older Android (<=android-gradle-plugn@0.8.0)
	// do not send os_name, but send platform instead.
	if osName == "" && bm.Platform != "" {
		osName = bm.Platform
	}

	if osName == "" {
		// Since, older Android (<=android-gradle-plugn@0.7.0) and
		// iOS (<=0.1.0) SDKs were not sending `platform`
		// or `os_name` parameter, we set the OS Name based
		// on the mapping types received.
		//
		// This is critical for maintaining backwards
		// compatibility.
		if bm.hasProguard() {
			osName = opsys.Android
		} else if bm.hasDSYM() {
			osName = opsys.AppleFamily
		} else {
			err = errors.New("failed to determine app's platform")
			return
		}
	}

	if opsys.ToFamily(osName) == opsys.AppleFamily {
		// Since older iOS upload scripts(<=0.1.0) send a single mapping
		// type `dsym` with one or more mapping files, we set the mapping type
		// to `dsym` for all mapping files.
		//
		// This is critical for maintaining backwards
		// compatibility.
		missingTypesCount := len(bm.MappingFiles) - len(bm.MappingTypes)
		if missingTypesCount > 0 {
			for range missingTypesCount {
				bm.MappingTypes = append(bm.MappingTypes, symbol.TypeDsym.String())
			}
		}
	}

	// mapping types and mapping files must same length
	if len(bm.MappingTypes) != len(bm.MappingFiles) {
		err = fmt.Errorf("mismatch: %d mapping types found for %d files", len(bm.MappingTypes), len(bm.MappingFiles))
		return
	}

	for i := range bm.MappingTypes {
		mf := bm.MappingFiles[i]
		// none of the mapping files
		// should be non-existent
		if mf.Header == nil {
			err = fmt.Errorf("%q at %d index has nil header", "mapping_file", i)
			return
		}

		if mf.Header.Size < 1 {
			err = fmt.Errorf("%q at %d index has zero or invalid size", "mapping_file", i)
			return
		}
	}

	// ensure mapping types are supported for the OS
	osMappingError := fmt.Errorf("%q mapping type is not valid for %q OS", bm.MappingTypes, osName)
	for index, mappingType := range bm.MappingTypes {
		switch mappingType {
		case symbol.TypeProguard.String():
			if osName != opsys.Android {
				err = osMappingError
				return
			}
		case symbol.TypeDsym.String():
			if opsys.ToFamily(osName) != opsys.AppleFamily {
				err = osMappingError
				break
			}
			mf := bm.MappingFiles[index]
			f, err := mf.Header.Open()
			if err != nil {
				return http.StatusInternalServerError, err
			}
			defer f.Close()
			if err := codec.IsTarGz(f); err != nil {
				return http.StatusBadRequest, err
			}
		case symbol.TypeElfDebug.String():
			if osName != opsys.Android {
				err = osMappingError
				return
			}
		default:
			err = fmt.Errorf("unknown mapping type %q", mappingType)
			return
		}
	}

	return
}

// prepareMappings computes the checksum and
// prepares each mapping file.
func (bm *BuildMapping) prepareMappings() (err error) {
	for _, header := range bm.Files {
		f, errFile := header.Open()
		if errFile != nil {
			err = errFile
			return
		}

		hash, errChecksum := cipher.ChecksumFnv1(f)
		if errChecksum != nil {
			err = errChecksum
			return
		}

		// seek the file offset to the beginning as
		// the checksum calculation must have moved
		// the offset towards end of the file
		if _, err := f.Seek(0, io.SeekStart); err != nil {
			return err
		}

		bm.MappingFiles = append(bm.MappingFiles, &MappingFile{
			Header:   header,
			Checksum: hash,
		})
	}

	return
}

// mark reads existing mapping files from
// database and marks each mapping file
// for upload while assigning ids smartly.
func (bm *BuildMapping) mark(ctx context.Context, tx *pgx.Tx) (err error) {
	type entry struct {
		id   uuid.UUID
		hash string
	}

	entries := []entry{}

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("fnv1_hash").
		From("build_mappings").
		Where("app_id = ?", bm.AppID).
		Where("version_name = ?", bm.VersionName).
		Where("version_code = ?", bm.VersionCode)

	defer stmt.Close()

	rows, _ := (*tx).Query(ctx, stmt.String(), stmt.Args()...)

	for rows.Next() {
		var entry entry
		if err = rows.Scan(&entry.id, &entry.hash); err != nil {
			return
		}

		entries = append(entries, entry)
	}

	if err = rows.Err(); err != nil {
		return
	}

	// if no match found, mark all for
	// upload.
	if len(entries) == 0 {
		for i := range bm.MappingTypes {
			bm.MappingFiles[i].ShouldUpload = true
		}
		return
	}

	// there can be many actions that needs
	// to be taken while handling mapping files.
	//
	// 1. an older mapping file replaced with a
	//    a new one.
	// 2. new mapping files are added to an older
	//    build mapping containing less mapping
	//    files.
	// 3. new mapping files are added to an older
	//    build mapping containing more mapping
	//    files.
	mlen := len(bm.MappingFiles)
	elen := len(entries)
	for i, entry := range entries {
		if elen <= mlen {
			// more newer, than older
			bm.MappingFiles[i].ID = entry.id
			if entry.hash != bm.MappingFiles[i].Checksum {
				bm.MappingFiles[i].ShouldUpload = true
			}
			if i == elen-1 {
				for j := i + 1; j < mlen; j++ {
					if entry.hash != bm.MappingFiles[i].Checksum {
						bm.MappingFiles[j].ShouldUpload = true
					}
				}
			}
		} else if elen > mlen {
			// more older, than newer
			if i == mlen-1 {
				for j := i; j < mlen; j++ {
					bm.MappingFiles[i].ID = entry.id
					if entry.hash != bm.MappingFiles[i].Checksum {
						bm.MappingFiles[i].ShouldUpload = true
					}
				}
				break
			}
			bm.MappingFiles[i].ID = entry.id
			if entry.hash != bm.MappingFiles[i].Checksum {
				bm.MappingFiles[i].ShouldUpload = true
			}
		}
	}

	return
}

// shouldUpload returns true if any of the mapping
// files has changed and hence should be uploaded.
func (bm BuildMapping) shouldUpload() (should bool) {
	for i := range bm.MappingTypes {
		mf := bm.MappingFiles[i]
		if mf.ShouldUpload {
			return true
		}
	}
	return
}

// shouldUpsert returns true if any of the mapping
// files was updated on object store and hence needs
// to be updated in the database.
func (bm BuildMapping) shouldUpsert() (should bool) {
	for i := range bm.MappingTypes {
		mf := bm.MappingFiles[i]
		if mf.ID != uuid.Nil && mf.Key != "" && mf.Location != "" {
			return true
		}
	}
	return
}

// insert inserts a new build mapping entry
// to database.
func (bm BuildMapping) insert(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.InsertInto(`build_mappings`)
	defer stmt.Close()

	for index, mappingType := range bm.MappingTypes {
		mf := bm.MappingFiles[index]
		// ignore old mapping files
		if mf.ID != uuid.Nil {
			continue
		}

		mf.ID = uuid.New()

		stmt.
			NewRow().
			Set(`id`, mf.ID).
			Set(`app_id`, bm.AppID).
			Set(`version_name`, bm.VersionName).
			Set(`version_code`, bm.VersionCode).
			Set(`mapping_type`, mappingType).
			Set(`key`, mf.Key).
			Set(`location`, mf.Location).
			Set(`fnv1_hash`, mf.Checksum).
			Set(`file_size`, mf.Header.Size).
			Set(`last_updated`, time.Now())
	}

	// stop here and don't run
	// query because it may happen
	// that there is nothing to insert
	if len(stmt.Args()) < 1 {
		return
	}

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// upsert updates build mapping
// entries in database.
// func (bm BuildMapping) upsert(ctx context.Context, tx *pgx.Tx) (err error) {
// 	now := time.Now()

// 	for index := range bm.MappingTypes {
// 		mf := bm.MappingFiles[index]
// 		if mf.ID == uuid.Nil {
// 			continue
// 		}
// 		stmt := sqlf.PostgreSQL.Update(`build_mappings`)

// 		if mf.Key != "" {
// 			stmt.Set(`key`, mf.Key)
// 		}

// 		if mf.Location != "" {
// 			stmt.Set(`location`, mf.Location)
// 		}

// 		stmt.
// 			Set(`fnv1_hash`, mf.Checksum).
// 			Set(`file_size`, mf.Header.Size).
// 			Set(`last_updated`, now).
// 			Where(`id = ?`, mf.ID)

// 		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
// 		if err != nil {
// 			return
// 		}

// 		stmt.Close()
// 	}

//		return
//	}

func (bm BuildMapping) upsert(ctx context.Context, tx *pgx.Tx) (ids []uuid.UUID, err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto(`build_mappings`).
		Returning(`id`)

	defer stmt.Close()

	for _, mf := range bm.MappingFiles {
		stmt.NewRow().
			Set(`app_id`, bm.AppID).
			Set(`version_name`, bm.VersionName).
			Set(`version_code`, bm.VersionCode).
			Set(`mapping_type`, bm.Type).
			Set(`key`, mf.Key).
			Set(`location`, mf.Location).
			Set(`fnv1_hash`, mf.Checksum).
			Set(`filesize`, mf.Size).
			Clause(`on conflict (app_id, version_name, version_code, mapping_type) do update set key = excluded.key, location = excluded.location, fnv1_hash = excluded.fnv1_hash, file_size = excluded.file_size, updated_at = excluded.updated_at`)

		// _, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		// if err != nil {
		// 	return
		// }
	}

	fmt.Println("stmt:", stmt.String())

	return
}

// extractDif extracts the debug information
// file(s) from build mapping respecting the
// mapping type.
func (bm *BuildMapping) extractDif() (err error) {
	for index, mappingType := range bm.MappingTypes {
		switch mappingType {
		case symbol.TypeProguard.String():
			mf := bm.MappingFiles[index]
			f, errHeader := mf.Header.Open()
			if errHeader != nil {
				return errHeader
			}

			defer func() {
				if err := f.Close(); err != nil {
					fmt.Println("failed to close proguard mapping file")
				}
			}()

			bytes, errRead := io.ReadAll(f)
			if errRead != nil {
				return errRead
			}

			// compress bytes using zstd, if not
			// already compressed
			if !codec.IsZstdCompressed(bytes) {
				bytes, err = codec.CompressZstd(bytes)
				if err != nil {
					return
				}
			}

			ns := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("guardsquare.com"))
			debugId := uuid.NewSHA1(ns, bytes)

			mf.Difs = append(mf.Difs, &symbol.Dif{
				Data: bytes,
				Key:  symbol.BuildUnifiedLayout(debugId.String()) + "/proguard",
			})
		case symbol.TypeDsym.String():
			f, errHeader := bm.MappingFiles[index].Header.Open()
			if errHeader != nil {
				return errHeader
			}

			defer func() {
				if err := f.Close(); err != nil {
					fmt.Printf("failed to close dSYM mapping file with index %d\n", index)
				}
			}()

			entities, errExtract := symbol.ExtractDsymEntities(f, func(name string) (symbol.DsymType, bool) {
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
				bm.MappingFiles[index].Difs = append(bm.MappingFiles[index].Difs, entity...)
			}
		case symbol.TypeElfDebug.String():
			mf := bm.MappingFiles[index]
			f, errHeader := mf.Header.Open()
			if errHeader != nil {
				return errHeader
			}

			defer func() {
				if err := f.Close(); err != nil {
					fmt.Println("failed to close ELF mapping file")
				}
			}()

			bytes, errRead := io.ReadAll(f)
			if errRead != nil {
				return errRead
			}

			debugID, errBuildID := symbol.GetBuildIDFromELF(bytes)
			if errBuildID != nil {
				return errBuildID
			}

			arch, errArch := symbol.GetArchFromELF(bytes)
			if errArch != nil {
				return errArch
			}

			type meta struct {
				Name       string `json:"name"`
				Arch       string `json:"arch"`
				FileFormat string `json:"file_format"`
			}

			m := meta{
				Name:       mf.Header.Filename,
				Arch:       arch,
				FileFormat: "elf",
			}

			metaJson, jsonErr := json.Marshal(m)
			if jsonErr != nil {
				err = jsonErr
				return
			}

			mf.Difs = append(mf.Difs, &symbol.Dif{
				Data: metaJson,
				Key:  symbol.BuildUnifiedLayout(debugID) + "/meta",
				Meta: true,
			})

			mf.Difs = append(mf.Difs, &symbol.Dif{
				Data: bytes,
				Key:  symbol.BuildUnifiedLayout(debugID) + "/debuginfo",
				Meta: false,
			})

		default:
			err = fmt.Errorf("failed to recognize mapping type %q", mappingType)
		}
	}

	return
}

// upload prepares and uploads build mapping
// files to S3-like object storage.
func (bm *BuildMapping) upload(ctx context.Context) (err error) {
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

	// var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
	// 	return aws.Credentials{
	// 		AccessKeyID:     config.SymbolsAccessKey,
	// 		SecretAccessKey: config.SymbolsSecretAccessKey,
	// 	}, nil
	// }

	// awsConfig := &aws.Config{
	// 	Region:      config.SymbolsBucketRegion,
	// 	Credentials: credentialsProvider,
	// }

	// client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
	// 	endpoint := config.AWSEndpoint
	// 	if endpoint != "" {
	// 		o.BaseEndpoint = aws.String(endpoint)
	// 		o.UsePathStyle = *aws.Bool(true)
	// 	}
	// })

	metadata := map[string]string{
		"app_id":       bm.AppID.String(),
		"version_name": bm.VersionName,
		"version_code": bm.VersionCode,
	}

	for index, mappingType := range bm.MappingTypes {
		switch mappingType {
		case symbol.TypeProguard.String():
			mf := bm.MappingFiles[index]
			if !mf.ShouldUpload {
				continue
			}
			metadata["mapping_type"] = symbol.TypeProguard.String()
			metadata["original_file_name"] = mf.Header.Filename

			for _, dif := range mf.Difs {
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

				bm.MappingFiles[index].Key = dif.Key
				bm.MappingFiles[index].Location = buildLocation(dif.Key)
				bm.MappingFiles[index].UploadComplete = true
			}
		case symbol.TypeDsym.String():
			mf := bm.MappingFiles[index]
			if !mf.ShouldUpload {
				continue
			}
			metadata["mapping_type"] = symbol.TypeDsym.String()
			metadata["original_file_name"] = mf.Header.Filename

			for _, dif := range mf.Difs {
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

					bm.MappingFiles[index].Key = dif.Key
					bm.MappingFiles[index].Location = buildLocation(dif.Key)
					bm.MappingFiles[index].UploadComplete = true
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
			mf := bm.MappingFiles[index]
			if !mf.ShouldUpload {
				continue
			}
			metadata["mapping_type"] = symbol.TypeElfDebug.String()
			metadata["original_file_name"] = mf.Header.Filename

			for _, dif := range mf.Difs {
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

					bm.MappingFiles[index].Key = dif.Key
					bm.MappingFiles[index].Location = buildLocation(dif.Key)
					bm.MappingFiles[index].UploadComplete = true
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

// BuildSize represents an app build's
// size entry. This is the raw material
// for computing app size trends over time.
type BuildSize struct {
	ID          uuid.UUID
	AppID       uuid.UUID
	VersionName string `form:"version_name" binding:"required"`
	VersionCode string `form:"version_code" binding:"required"`
	BuildSize   int    `form:"build_size" binding:"required_with=BuildType,gt=100"`
	BuildType   string `form:"build_type" binding:"required_with=BuildSize,oneof=aab apk ipa"`
	CreatedAt   chrono.ISOTime
}

// upsert updates build size info to
// database.
func (bs BuildSize) upsert(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto(`build_sizes`).
		Set(`app_id`, bs.AppID).
		Set(`version_name`, bs.VersionName).
		Set(`version_code`, bs.VersionCode).
		Set(`build_size`, bs.BuildSize).
		Set(`build_type`, bs.BuildType).
		Clause(`on conflict (app_id, version_name, version_code, build_type) do update set build_size = excluded.build_size, updated_at = excluded.updated_at`)

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
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

func PutBuild(c *gin.Context) {
	ctx := c.Request.Context()
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `failed to parse app id`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	app, err := SelectApp(ctx, appId)
	if err != nil {
		msg := "failed to read app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	bs := BuildSize{
		AppID: appId,
	}

	if err := c.ShouldBindWith(&bs, binding.FormMultipart); err != nil {
		msg := `build info validation failed. make sure both "build_size" and "build_type" have valid values`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	bm := BuildMapping{
		AppID: appId,
	}

	if err := c.ShouldBindWith(&bm, binding.FormMultipart); err != nil {
		msg := `build info validation failed. make sure both "mapping_file" and "mapping_type" have valid values`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// prepare mapping files by opening and reading
	// them and populating bm.MappingFiles
	if err := bm.prepareMappings(); err != nil {
		msg := "failed to compute checksums of files"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	tx, err := server.Server.PgPool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		msg := `failed to acquire db transaction while putting builds`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	defer tx.Rollback(ctx)

	// no mapping? just process build size
	// and return early
	if !bm.hasMapping() {
		if err := bs.upsert(ctx, &tx); err != nil {
			msg := `failed to register app build size`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}
		if err := tx.Commit(ctx); err != nil {
			msg := `failed to upload build size`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": `updated build size info`,
		})

		return
	}

	if code, err := bm.validate(app); err != nil {
		msg := "failed to validate build mapping"
		fmt.Println(msg, err)
		c.JSON(code, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := bm.extractDif(); err != nil {
		msg := "failed to extract debug id from mapping file"
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := bm.mark(ctx, &tx); err != nil {
		fmt.Println("failed to detect mapping file upsertion:", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to upload mapping file(s)",
			"details": err.Error(),
		})
		return
	}

	// nothing to upload? just process build size
	// and return early
	if !bm.shouldUpload() {
		if err := bs.upsert(ctx, &tx); err != nil {
			msg := `failed to register app build size`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
		if err := tx.Commit(ctx); err != nil {
			msg := `failed to upload build info`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": `uploaded build size info`,
		})

		return
	}

	if bm.shouldUpload() {
		// start span to trace mapping file upload
		mappingFileUploadTracer := otel.Tracer("mapping-file-upload-tracer")
		_, mappingFileUploadSpan := mappingFileUploadTracer.Start(ctx, "mapping-file-upload")
		if err := bm.upload(ctx); err != nil {
			fmt.Println("failed to upload mapping file(s): ", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.Files[0].Filename),
			})
			mappingFileUploadSpan.End()
			return
		}
		mappingFileUploadSpan.End()
	}

	if bm.shouldUpsert() {
		// if err := bm.upsert(ctx, &tx); err != nil {
		// 	msg := "failed to upsert mapping file(s)"
		// 	c.JSON(http.StatusInternalServerError, gin.H{
		// 		"error":   msg,
		// 		"details": err.Error(),
		// 	})
		// 	return
		// }

		if err := tx.Commit(ctx); err != nil {
			msg := "failed to commit builds upsert transaction"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
		}

		msg := "existing build mapping info is already up to date"
		if bm.shouldUpload() {
			msg = "uploaded build info"
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": msg,
		})
		return
	}

	if err := bm.insert(ctx, &tx); err != nil {
		msg := "failed to insert mapping file(s)"
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := bs.upsert(ctx, &tx); err != nil {
		msg := `failed to register app build size`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		msg := `failed to upload build info`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": `uploaded build info`,
	})
}

type Mapping struct {
	ID             uuid.UUID     `json:"id"`
	Type           string        `json:"type" binding:"required,oneof=proguard dsym elf_debug"`
	Key            string        `json:"key,omitempty"`
	Location       string        `json:"location,omitempty"`
	Checksum       string        `json:"checksum,omitempty"`
	Size           int64         `json:"size,omitempty"`
	Filename       string        `json:"filename" binding:"required"`
	UploadURL      string        `json:"upload_url,omitempty"`
	ExpiresAt      time.Time     `json:"expires_at"`
	File           []byte        `json:"file,omitempty"`
	Difs           []*symbol.Dif `json:"difs,omitempty"`
	ShouldUpload   bool          `json:"should_upload,omitempty"`
	UploadComplete bool          `json:"upload_complete,omitempty"`
}

func (m Mapping) isEmpty() bool {
	return m.Key == "" && m.Location == "" && m.Checksum == ""
}

func (m Mapping) hasChecksum() bool {
	return m.Checksum != ""
}

func (m *Mapping) extractDif() (err error) {
	switch m.Type {
	case symbol.TypeProguard.String():
		contents := m.File

		// compress bytes using zstd, if not
		// already compressed
		if !codec.IsZstdCompressed(contents) {
			contents, err = codec.CompressZstd(contents)
			if err != nil {
				return
			}
		}

		ns := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("guardsquare.com"))
		debugId := uuid.NewSHA1(ns, contents)

		fmt.Println("proguard debug id", debugId)

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
		debugID, errBuildID := symbol.GetBuildIDFromELF(m.File)
		if errBuildID != nil {
			return errBuildID
		}

		fmt.Println("elf debug id", debugID)

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
			// mf := bm.MappingFiles[index]
			// if !mf.ShouldUpload {
			// 	continue
			// }
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
			// if !mf.ShouldUpload {
			// 	continue
			// }
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
			// if !mf.ShouldUpload {
			// 	continue
			// }
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

func (b Build) hasMapping() bool {
	return len(b.Mappings) > 0
}

func (b Build) validate() (err error) {
	return
}

func (b Build) upsertSize(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto(`build_sizes`).
		Set(`app_id`, b.AppID).
		Set(`version_name`, b.VersionName).
		Set(`version_code`, b.VersionCode).
		Set(`build_size`, b.Size).
		Set(`build_type`, b.Type).
		Clause(`on conflict (app_id, version_name, version_code, build_type) do update set build_size = excluded.build_size, updated_at = excluded.updated_at`)

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// func (b *Build) upsertMappings(ctx context.Context, tx *pgx.Tx) (err error) {
// 		now := time.Now()

// 	for index := range b.Mappings {
// 		m := b.Mappings[index]
// 		if m.ID == uuid.Nil {
// 			continue
// 		}
// 		stmt := sqlf.PostgreSQL.Update(`build_mappings`)

// 		if m.Key != "" {
// 			stmt.Set(`key`, m.Key)
// 		}

// 		if m.Location != "" {
// 			stmt.Set(`location`, m.Location)
// 		}

// 		stmt.
// 			Set(`fnv1_hash`, m.Checksum).
// 			Set(`last_updated`, now).
// 			Where(`id = ?`, m.ID)

// 		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
// 		if err != nil {
// 			return
// 		}

// 		stmt.Close()
// 	}

// 	return
// }

func (b Build) getMappingTypes() (types []string) {
	typeMap := make(map[string]struct{})
	for _, m := range b.Mappings {
		typeMap[m.Type] = struct{}{}
	}
	for t := range typeMap {
		types = append(types, t)
	}
	return
}

func (b Build) insertNewMappings(ctx context.Context, tx *pgx.Tx) (err error) {
	if len(b.Mappings) == 0 {
		return
	}

	stmt := sqlf.PostgreSQL.
		InsertInto(`build_mappings`)

	defer stmt.Close()

	now := time.Now()

	for _, m := range b.Mappings {
		stmt.
			NewRow().
			Set(`id`, m.ID).
			Set(`app_id`, b.AppID).
			Set(`version_name`, b.VersionName).
			Set(`version_code`, b.VersionCode).
			Set(`mapping_type`, m.Type).
			Set(`key`, m.Key).
			Set(`location`, m.Location).
			Set(`fnv1_hash`, m.Checksum).
			Set(`last_updated`, now)
	}

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

func (b *Build) upsert(ctx context.Context, tx *pgx.Tx) (err error) {
	if err = b.upsertSize(ctx, tx); err != nil {
		return
	}

	// return early if there are no
	// mapping files
	if !b.hasMapping() {
		return
	}

	existingMappings, err := b.getMappings(ctx)
	if err != nil {
		return
	}

	lenExisting := len(existingMappings)
	lenRequested := len(b.Mappings)

	fmt.Println("len existing", lenExisting)
	fmt.Println("len requested", lenRequested)

	// if lenExisting <= lenRequested {
	for _, em := range existingMappings {
		for _, rm := range b.Mappings {
			if em.Type == rm.Type && rm.ID == uuid.Nil {
				rm.ID = em.ID
				break
			}
		}
	}
	// }

	newBuild := Build{
		AppID:       b.AppID,
		VersionName: b.VersionName,
		VersionCode: b.VersionCode,
		Mappings:    []*Mapping{},
	}

	// ensure each new mapping gets
	// a new id
	for _, m := range b.Mappings {
		if m.ID != uuid.Nil {
			continue
		}
		m.ID = uuid.New()
		newBuild.Mappings = append(newBuild.Mappings, m)
	}

	// insert initial set of
	// mapping file entries
	err = newBuild.insertNewMappings(ctx, tx)

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

	if err := server.Server.RpgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&b.AppID, &b.VersionName, &b.VersionCode, &mappingType); err != nil {
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

	rows, _ := server.Server.RpgPool.Query(ctx, stmtMappings.String(), stmtMappings.Args()...)

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

func (b *Build) getMappings(ctx context.Context) (mappings []*Mapping, err error) {
	types := b.getMappingTypes()
	typeArgs := make([]any, len(types))
	for i, t := range types {
		typeArgs[i] = t
	}

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("mapping_type").
		Select("key").
		Select("location").
		Select("fnv1_hash").
		Select("file_size").
		From("build_mappings").
		Where("app_id = ?", b.AppID).
		Where("version_name = ?", b.VersionName).
		Where("version_code = ?", b.VersionCode)

	if len(typeArgs) > 0 {
		placeholders := make([]string, len(typeArgs))
		for i := range typeArgs {
			placeholders[i] = "?"
		}
		inClause := "mapping_type in (" + strings.Join(placeholders, ", ") + ")"
		stmt = stmt.Where(inClause, typeArgs...)
	}

	defer stmt.Close()

	rows, _ := server.Server.RpgPool.Query(ctx, stmt.String(), stmt.Args()...)

	for rows.Next() {
		var mapping Mapping

		if errScan := rows.Scan(&mapping.ID, &mapping.Type, &mapping.Key, &mapping.Location, &mapping.Checksum, &mapping.Size); errScan != nil {
			return
		}

		mappings = append(mappings, &mapping)
	}

	err = rows.Err()

	return
}

func PutBuildNext(c *gin.Context) {
	ctx := c.Request.Context()
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `failed to parse app id`
		fmt.Println(msg, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})

		return
	}

	// app, err := SelectApp(ctx, appId)
	// if err != nil {
	// 	msg := "failed to read app"
	// 	fmt.Println(msg, err)
	// 	c.JSON(http.StatusInternalServerError, gin.H{
	// 		"error": msg,
	// 	})
	// 	return
	// }

	var build Build
	if err := c.ShouldBindJSON(&build); err != nil {
		msg := `failed to parse build info`
		fmt.Println(msg, err)

		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})

		return
	}

	fmt.Println("build id", build.ID)

	build.AppID = appId

	tx, err := server.Server.PgPool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		msg := fmt.Sprintf("failed to acquire db transaction while putting builds: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	defer tx.Rollback(ctx)

	if err = build.upsert(ctx, &tx); err != nil {
		msg := fmt.Sprintf("failed to upsert build: %v", err)

		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	if err = tx.Commit(ctx); err != nil {
		msg := fmt.Sprintf("failed to commit transaction while upserting builds: %v", err)

		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	config := server.Server.Config

	if config.IsCloud() {
		client, err := objstore.CreateGCSClient(ctx)
		if err != nil {
			msg := fmt.Sprintf("failed to create GCS client: %v", err)

			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		// for creating signed URLs, we need to tie the service account
		// identity along with the credentials. otherwise, the signed
		// URLs can't be generated and won't work as expected.
		iamClient, err := credentials.NewIamCredentialsClient(ctx)
		if err != nil {
			msg := fmt.Sprintf("failed to create IAM client: %v", err)

			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}
		defer iamClient.Close()

		signBytes := func(b []byte) ([]byte, error) {
			resp, err := iamClient.SignBlob(ctx, &credentialspb.SignBlobRequest{
				Name:    "projects/-/serviceAccounts/" + config.ServiceAccountEmail,
				Payload: b,
			})
			if err != nil {
				return nil, err
			}
			return resp.SignedBlob, nil
		}

		for _, mapping := range build.Mappings {
			ext := filepath.Ext(mapping.Filename)
			key := fmt.Sprintf("incoming/%s%s", mapping.ID.String(), ext)
			expiry := time.Now().Add(time.Hour)
			metadata := []string{
				fmt.Sprintf("x-goog-meta-mapping_id: %s", mapping.ID.String()),
				fmt.Sprintf("x-goog-meta-original_file_name: %s", mapping.Filename),
			}

			signOptions := &storage.SignedURLOptions{
				GoogleAccessID: config.ServiceAccountEmail,
				SignBytes:      signBytes,
				Scheme:         storage.SigningSchemeV4,
				Method:         "PUT",
				Expires:        expiry,
				Headers:        metadata,
			}

			url, err := objstore.CreateGCSPUTPreSignedURL(client, config.SymbolsBucket, key, signOptions)
			if err != nil {
				msg := fmt.Sprintf("failed to create PUT pre-signed URL for %v: %v", mapping.Filename, err)

				fmt.Println(msg)

				c.JSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})

				return
			}

			mapping.UploadURL = url
			mapping.ExpiresAt = expiry
		}

		if !build.hasMapping() {
			c.JSON(http.StatusOK, gin.H{
				"ok": "build info updated",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"mappings": build.Mappings,
		})

		return
	}

	client := objstore.CreateS3Client(ctx, config.SymbolsAccessKey, config.SymbolsSecretAccessKey, config.SymbolsBucketRegion, "http://localhost:9119")

	// process build mappings
	for _, mapping := range build.Mappings {
		ext := filepath.Ext(mapping.Filename)
		key := fmt.Sprintf("incoming/%s%s", mapping.ID.String(), ext)
		url, err := objstore.CreateS3PUTPreSignedURL(ctx, client, &s3.PutObjectInput{
			Bucket: aws.String(config.SymbolsBucket),
			Key:    aws.String(key),
			Metadata: map[string]string{
				"mapping_id":         mapping.ID.String(),
				"original_file_name": mapping.Filename,
			},
		}, s3.WithPresignExpires(time.Duration(time.Hour)))

		if err != nil {
			msg := fmt.Sprintf("failed to create PUT pre-signed URL for %v: %v", mapping.Filename, err)

			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		mapping.UploadURL = url
		mapping.ExpiresAt = time.Now().Add(time.Hour)
	}

	if !build.hasMapping() {
		c.JSON(http.StatusOK, gin.H{
			"ok": "build info updated",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mappings": build.Mappings,
	})
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

	for _, record := range symbolNotif.Records {
		key, err := url.QueryUnescape(record.S3.Object.Key)
		if err != nil {
			msg := fmt.Sprintf("error unescaping key %q: %v", record.S3.Object.Key, err)
			fmt.Println(msg)
			continue
		}

		fmt.Println("record:", record)
		fmt.Println("key:", key)
		fmt.Println("size:", record.S3.Object.Size)
		fmt.Println("etag:", record.S3.Object.Etag)
		fmt.Println("content type:", record.S3.Object.ContentType)
		fmt.Println("user metadata:", record.S3.Object.UserMetadata)

		// don't process if record is not of "incoming" prefix
		if !strings.HasPrefix(record.S3.Object.Key, "incoming%2F") {
			continue
		}

		if err := record.validate(); err != nil {
			msg := fmt.Sprintf("error validating record for key %q: %v", record.S3.Object.Key, err)
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

			if err := mapping.extractDif(); err != nil {
				msg := fmt.Sprintf("error extracting diff for mapping id %q: %v", mappingId, err)
				fmt.Println(msg)

				c.JSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})

				return
			}

			fmt.Println("checksum:", mapping.Checksum)
			fmt.Println("filename", mapping.Filename)
			fmt.Println("size", mapping.Size)
		}

		if err := build.upload(ctx); err != nil {
			msg := fmt.Sprintf("error uploading build for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		if err := build.update(ctx); err != nil {
			msg := fmt.Sprintf("error updating build for mapping id %q: %v", mappingId, err)
			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

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
