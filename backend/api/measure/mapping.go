package measure

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"backend/api/chrono"
	"backend/api/cipher"
	"backend/api/codec"
	"backend/api/platform"
	"backend/api/server"
	"backend/api/symbol"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
)

type BuildMapping struct {
	ID           uuid.UUID
	AppID        uuid.UUID
	VersionName  string `form:"version_name" binding:"required"`
	VersionCode  string `form:"version_code" binding:"required"`
	Platform     string `form:"platform" binding:"required_with=File"`
	MappingType  string `form:"mapping_type" binding:"required_with=File"`
	Key          string
	Location     string
	ContentHash  string
	File         *multipart.FileHeader `form:"mapping_file" binding:"required_with=MappingType"`
	Difs         []*symbol.Dif
	UploadStatus string
	Timestamp    time.Time
}

// hasMapping checks if necessary details are
// valid for mapping build info.
func (bm BuildMapping) hasMapping() bool {
	if bm.MappingType != "" && bm.File != nil {
		return true
	}
	return false
}

// validate validates build mapping details.
func (bm BuildMapping) validate(app *App) (code int, err error) {
	code = http.StatusBadRequest

	if bm.File == nil {
		code = 0
		return
	}

	if bm.File.Size < 1 {
		err = errors.New(`no data in field "mapping_file"`)
	}

	if bm.File.Size > int64(server.Server.Config.MappingFileMaxSize) {
		code = http.StatusRequestEntityTooLarge
		err = fmt.Errorf(`%q file size exceeding %d bytes`, bm.File.Filename, server.Server.Config.MappingFileMaxSize)
	}

	pltfrm := app.Platform

	// deduce platform from app or
	// from payload. ensure we have
	// a platform or fail fast.
	if pltfrm == "" && bm.Platform != "" {
		pltfrm = bm.Platform
	}

	if pltfrm == "" {
		err = errors.New("failed to determine app's platform")
		return
	}

	platformMappingErr := fmt.Errorf("%q mapping type is not valid for %q platform", bm.MappingType, pltfrm)

	switch bm.MappingType {
	case symbol.TypeProguard.String():
		if pltfrm != platform.Android {
			err = platformMappingErr
		}
		break
	case symbol.TypeDsym.String():
		if pltfrm != platform.IOS {
			err = platformMappingErr
			break
		}
		f, err := bm.File.Open()
		defer f.Close()
		if err != nil {
			return http.StatusInternalServerError, err
		}
		if err := codec.IsTarGz(f); err != nil {
			return http.StatusBadRequest, err
		}
	default:
		err = fmt.Errorf("unknown mapping type %q", bm.MappingType)
		return
	}

	return
}

// shouldUpsert checks if build mapping needs
// upsertion.
func (bm BuildMapping) shouldUpsert(ctx context.Context, tx *pgx.Tx) (upload bool, existingId *uuid.UUID, err error) {
	var existingHash string

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("fnv1_hash").
		From("build_mappings").
		Where("app_id = ?", bm.AppID).
		Where("version_name = ?", bm.VersionName).
		Where("version_code = ?", bm.VersionCode).
		Where("mapping_type = ?", bm.MappingType)

	defer stmt.Close()

	if err = (*tx).QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&existingId, &existingHash); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			upload = true
			err = nil
		}
		return
	}

	if err = bm.checksum(); err != nil {
		return
	}

	// the content has changed
	if bm.ContentHash != existingHash {
		upload = true
		return
	}

	return
}

// insert inserts a new build mapping entry
// to database.
func (bm BuildMapping) insert(ctx context.Context, tx *pgx.Tx) (err error) {
	// compute checksum if not
	// already computed
	if bm.ContentHash == "" {
		if err = bm.checksum(); err != nil {
			return
		}
	}

	stmt := sqlf.PostgreSQL.
		InsertInto(`public.build_mappings`).
		Set(`id`, bm.ID).
		Set(`app_id`, bm.AppID).
		Set(`version_name`, bm.VersionName).
		Set(`version_code`, bm.VersionCode).
		Set(`mapping_type`, bm.MappingType).
		Set(`key`, bm.Key).
		Set(`location`, bm.Location).
		Set(`fnv1_hash`, bm.ContentHash).
		Set(`file_size`, bm.File.Size).
		Set(`last_updated`, time.Now())

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// upsert updates the build mapping
// entry in database.
func (bm BuildMapping) upsert(ctx context.Context, tx *pgx.Tx) (err error) {
	// compute checksum if not
	// already computed
	if bm.ContentHash == "" {
		if err = bm.checksum(); err != nil {
			return
		}
	}
	stmt := sqlf.PostgreSQL.
		Update(`build_mappings`)

	if bm.Key != "" {
		stmt.Set(`key`, bm.Key)
	}

	if bm.Location != "" {
		stmt.Set(`location`, bm.Location)
	}

	stmt.
		Set(`fnv1_hash`, bm.ContentHash).
		Set(`file_size`, bm.File.Size).
		Set(`last_updated`, time.Now()).
		Where(`id = ?`, bm.ID)

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// extractDif extracts the debug information
// file(s) from build mapping respecting the
// mapping type.
func (bm *BuildMapping) extractDif() (difs []*symbol.Dif, err error) {
	switch bm.MappingType {
	case symbol.TypeProguard.String():
		f, err := bm.File.Open()
		if err != nil {
			return nil, err
		}

		defer func() {
			if err := f.Close(); err != nil {
				fmt.Println("failed to close build mapping file")
			}
		}()

		bytes, err := io.ReadAll(f)
		if err != nil {
			return nil, err
		}

		ns := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("guardsquare.com"))
		debugId := uuid.NewSHA1(ns, bytes)
		difs = append(difs, &symbol.Dif{
			Data: bytes,
			Key:  symbol.BuildUnifiedLayout(debugId.String()) + "/proguard",
		})
	case symbol.TypeDsym.String():
		f, err := bm.File.Open()
		if err != nil {
			return nil, err
		}

		defer func() {
			if err := f.Close(); err != nil {
				fmt.Println("failed to close build mapping file")
			}
		}()

		entities, err := symbol.ExtractDsymEntities(f, func(name string) (symbol.DsymType, bool) {
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

		for k, v := range entities {
			if k == symbol.TypeDsymDebug {
				difs = append(difs, v...)
			}
		}
	default:
		err = fmt.Errorf("failed to recognize mapping type %q", bm.MappingType)
	}

	return
}

// checksum computes the checksum of the
// mapping file.
func (bm *BuildMapping) checksum() (err error) {
	file, err := bm.File.Open()
	if err != nil {
		return
	}
	hash, err := cipher.ChecksumFnv1(file)
	if err != nil {
		return
	}

	// seek the file offset to the beginning as
	// the checksum calculation must have moved
	// the offset towards end of the file
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return err
	}

	bm.ContentHash = hash
	return
}

// upload prepares and uploads build mapping
// files to S3-like object storage.
func (bm *BuildMapping) upload(ctx context.Context) (location *string, err error) {
	config := server.Server.Config
	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     config.SymbolsAccessKey,
			SecretAccessKey: config.SymbolsSecretAccessKey,
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      config.SymbolsBucketRegion,
		Credentials: credentialsProvider,
	}

	client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := config.AWSEndpoint
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

	metadata := map[string]string{
		"original_file_name": bm.File.Filename,
		"app_id":             bm.AppID.String(),
		"version_name":       bm.VersionName,
		"version_code":       bm.VersionCode,
		"mapping_type":       bm.MappingType,
	}

	switch bm.MappingType {
	case symbol.TypeProguard.String():
		for _, dif := range bm.Difs {
			putObjectInput := &s3.PutObjectInput{
				Bucket:   aws.String(config.SymbolsBucket),
				Key:      aws.String(dif.Key),
				Body:     bytes.NewReader(dif.Data),
				Metadata: metadata,
			}
			_, err = client.PutObject(ctx, putObjectInput)
			if err != nil {
				return
			}
			bm.Key = dif.Key
		}
	case symbol.TypeDsym.String():
		for _, dif := range bm.Difs {
			if !dif.Meta {
				putObjectInput := &s3.PutObjectInput{
					Bucket:   aws.String(config.SymbolsBucket),
					Key:      aws.String(dif.Key),
					Body:     bytes.NewReader(dif.Data),
					Metadata: metadata,
				}
				_, err = client.PutObject(ctx, putObjectInput)
				if err != nil {
					return
				}
				bm.Key = dif.Key
			}

			if dif.Meta {
				putObjectInput := &s3.PutObjectInput{
					Bucket:   aws.String(config.SymbolsBucket),
					Key:      aws.String(dif.Key),
					Body:     bytes.NewReader(dif.Data),
					Metadata: metadata,
				}
				_, err = client.PutObject(ctx, putObjectInput)
				if err != nil {
					return
				}
			}
		}
	}

	loc := ""

	// for now, we construct the location manually
	// implement a better solution later using
	// EndpointResolverV2 with custom resolvers
	// for non-AWS clouds like GCS
	if config.AWSEndpoint != "" {
		loc = fmt.Sprintf("%s/%s/%s", config.AWSEndpoint, config.SymbolsBucket, bm.Key)
	} else {
		loc = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", config.SymbolsBucket, config.SymbolsBucketRegion, bm.Key)
	}

	location = &loc

	return
}

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
		InsertInto(`public.build_sizes`).
		Set(`app_id`, bs.AppID).
		Set(`version_name`, bs.VersionName).
		Set(`version_code`, bs.VersionCode).
		Set(`build_size`, bs.BuildSize).
		Set(`build_type`, bs.BuildType).
		Clause(`on conflict (app_id, version_name, version_code, build_type) do update set build_size = excluded.build_size, updated_at = excluded.updated_at`, nil)

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return nil
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
		ID:    uuid.New(),
		AppID: appId,
	}

	if err := c.ShouldBindWith(&bm, binding.FormMultipart); err != nil {
		msg := `build info validation failed. make sure both "mapping_file" and "mapping_type" have valid values`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
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

	difs, err := bm.extractDif()
	if err != nil {
		msg := "failed to extract debug id from mapping file"
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	bm.Difs = difs

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

	// no mapping, just process build size
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

	shouldUpload, existingId, err := bm.shouldUpsert(ctx, &tx)
	if err != nil {
		fmt.Println("failed to detect mapping file upsertion", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.File.Filename),
		})
		return
	}

	if shouldUpload {
		// start span to trace mapping file upload
		mappingFileUploadTracer := otel.Tracer("mapping-file-upload-tracer")
		_, mappingFileUploadSpan := mappingFileUploadTracer.Start(ctx, "mapping-file-upload")
		location, err := bm.upload(ctx)
		if err != nil || location == nil {
			fmt.Printf("failed to upload mapping file, key: %s with error, %v\n", bm.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.File.Filename),
			})
			mappingFileUploadSpan.End()
			return
		}
		mappingFileUploadSpan.End()

		bm.Location = *location
	}

	if existingId != nil {
		bm.ID = *existingId
		if err := bm.upsert(ctx, &tx); err != nil {
			fmt.Printf("failed to upsert mapping file, key: %s with error, %v\n", bm.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to upload build info: "%s"`, bm.File.Filename),
			})
			return
		}
		if err := tx.Commit(ctx); err != nil {
			msg := "failed to commit builds upsert db transaction"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
		msg := `existing build info is already up to date`
		if shouldUpload {
			msg = `uploaded build info`
		}
		c.JSON(http.StatusOK, gin.H{"ok": msg})
		return
	}

	if err := bm.insert(ctx, &tx); err != nil {
		fmt.Printf("failed to insert mapping file, key: %s with error, %v\n", bm.Key, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.File.Filename),
		})
		return
	}

	if err := bs.upsert(ctx, &tx); err != nil {
		msg := `failed to register app build size`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
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
