package measure

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/cipher"
	"measure-backend/measure-go/server"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type BuildMapping struct {
	ID           uuid.UUID
	AppID        uuid.UUID
	VersionName  string `form:"version_name" binding:"required"`
	VersionCode  string `form:"version_code" binding:"required"`
	MappingType  string `form:"mapping_type" binding:"required_with=File"`
	Key          string
	Location     string
	ContentHash  string
	File         *multipart.FileHeader `form:"mapping_file" binding:"required_with=MappingType"`
	UploadStatus string
	Timestamp    time.Time
}

// GetKey constructs a new key with extension for
// the soon to be uploaded mapping file.
func (bm BuildMapping) GetKey() string {
	return fmt.Sprintf(`%s.txt`, bm.ID)
}

// HasMapping checks if necessary details are
// valid for mapping build info.
func (bm BuildMapping) HasMapping() bool {
	if bm.MappingType != "" && bm.File != nil {
		return true
	}
	return false
}

// Validate validates build mapping details.
func (bm BuildMapping) Validate() (code int, err error) {
	code = http.StatusBadRequest

	if bm.File.Size < 1 {
		err = errors.New(`no data in field "mapping_file"`)
	}

	if bm.File.Size > int64(server.Server.Config.MappingFileMaxSize) {
		code = http.StatusRequestEntityTooLarge
		err = fmt.Errorf(`%q file size exceeding %d bytes`, bm.File.Filename, server.Server.Config.MappingFileMaxSize)
	}

	return
}

func (bm BuildMapping) shouldUpsert(ctx context.Context, tx pgx.Tx) (bool, *uuid.UUID, error) {
	var id uuid.UUID
	var key string
	var existingHash string

	stmt := sqlf.PostgreSQL.
		Select("id, key, fnv1_hash").
		From("public.build_mappings").
		Where("app_id = ?", nil).
		Where("version_name = ?", nil).
		Where("version_code = ?", nil).
		Where("mapping_type = ?", nil)

	defer stmt.Close()

	if err := tx.QueryRow(ctx, stmt.String(), bm.AppID, bm.VersionName, bm.VersionCode, bm.MappingType).Scan(&id, &key, &existingHash); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return true, nil, nil
		} else {
			return false, nil, err
		}
	}

	if err := bm.checksum(); err != nil {
		return false, nil, err
	}

	// the content has changed
	if bm.ContentHash != existingHash {
		return true, &id, nil
	}

	return false, &id, nil
}

func (bm BuildMapping) insert(ctx context.Context, tx pgx.Tx) error {
	stmt := sqlf.PostgreSQL.
		InsertInto(`public.build_mappings`).
		Set(`id`, nil).
		Set(`app_id`, nil).
		Set(`version_name`, nil).
		Set(`version_code`, nil).
		Set(`mapping_type`, nil).
		Set(`key`, nil).
		Set(`location`, nil).
		Set(`fnv1_hash`, nil).
		Set(`file_size`, nil).
		Set(`last_updated`, nil)

	defer stmt.Close()

	if _, err := tx.Exec(ctx, stmt.String(), bm.ID, bm.AppID, bm.VersionName, bm.VersionCode, bm.MappingType, bm.Key, bm.Location, bm.ContentHash, bm.File.Size, time.Now()); err != nil {
		return err
	}

	return nil
}

func (bm BuildMapping) upsert(ctx context.Context, tx pgx.Tx) error {
	stmt := sqlf.PostgreSQL.
		Update(`public.build_mappings`).
		Set(`fnv1_hash`, nil).
		Set(`file_size`, nil).
		Set(`last_updated`, nil).
		Where(`id = ?`, nil)

	defer stmt.Close()

	if _, err := tx.Exec(ctx, stmt.String(), bm.ContentHash, bm.File.Size, time.Now(), bm.ID); err != nil {
		return err
	}

	return nil
}

func (bm *BuildMapping) checksum() error {
	file, err := bm.File.Open()
	if err != nil {
		return err
	}
	hash, err := cipher.ChecksumFnv1(file)
	if err != nil {
		return err
	}

	// seek the file offset to the beginning as the checksum calculation
	// must have moved the offset towards end of the file
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return err
	}

	bm.ContentHash = hash
	return nil
}

func (bm *BuildMapping) upload() (*s3manager.UploadOutput, error) {
	file, err := bm.File.Open()
	if err != nil {
		return nil, err
	}

	config := server.Server.Config
	awsConfig := &aws.Config{
		Region:      aws.String(config.SymbolsBucketRegion),
		Credentials: credentials.NewStaticCredentials(config.SymbolsAccessKey, config.SymbolsSecretAccessKey, ""),
	}

	// if a custom endpoint was set, then most likely,
	// we are in local development mode and should force
	// path style instead of S3 virual path styles.
	if config.AWSEndpoint != "" {
		awsConfig.S3ForcePathStyle = aws.Bool(true)
		awsConfig.Endpoint = aws.String(config.AWSEndpoint)
	}

	if bm.Key == "" {
		bm.Key = bm.GetKey()
	}

	metadata := map[string]*string{
		"original_file_name": aws.String(bm.File.Filename),
		"app_id":             aws.String(bm.AppID.String()),
		"version_name":       aws.String(bm.VersionName),
		"version_code":       aws.String(bm.VersionCode),
		"mapping_type":       aws.String(bm.MappingType),
	}

	return uploadToStorage(awsConfig, config.SymbolsBucket, bm.Key, file, metadata)
}

type BuildSize struct {
	ID          uuid.UUID
	AppID       uuid.UUID
	VersionName string `form:"version_name" binding:"required"`
	VersionCode string `form:"version_code" binding:"required"`
	BuildSize   int    `form:"build_size" binding:"required_with=BuildType,gt=100"`
	BuildType   string `form:"build_type" binding:"required_with=BuildSize,oneof=aab apk"`
	CreatedAt   chrono.ISOTime
}

func (bs BuildSize) Upsert(ctx context.Context, tx pgx.Tx) error {
	stmt := sqlf.PostgreSQL.
		InsertInto(`public.build_sizes`).
		Set(`app_id`, nil).
		Set(`version_name`, nil).
		Set(`version_code`, nil).
		Set(`build_size`, nil).
		Set(`build_type`, nil).
		Clause(`on conflict (app_id, version_name, version_code, build_type) do update set build_size = excluded.build_size, updated_at = excluded.updated_at`, nil)

	defer stmt.Close()

	if _, err := tx.Exec(ctx, stmt.String(), bs.AppID, bs.VersionName, bs.VersionCode, bs.BuildSize, bs.BuildType); err != nil {
		return err
	}

	return nil
}

func PutBuild(c *gin.Context) {
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `failed to parse app id`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
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

	if code, err := bm.Validate(); err != nil {
		c.JSON(code, gin.H{"error": err.Error()})
	}

	ctx := context.Background()
	tx, err := server.Server.PgPool.Begin(ctx)
	if err != nil {
		msg := `failed to begin db transaction`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	defer tx.Rollback(ctx)

	// no mapping, just process build size
	// and return early
	if !bm.HasMapping() {
		if err := bs.Upsert(ctx, tx); err != nil {
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

	shouldUpload, existingId, err := bm.shouldUpsert(ctx, tx)
	if err != nil {
		fmt.Println("failed to detect mapping file upsertion", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.File.Filename),
		})
		return
	}

	if shouldUpload {
		result, err := bm.upload()
		if err != nil {
			fmt.Printf("failed to upload mapping file, key: %s with error, %v\n", bm.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.File.Filename),
			})
			return
		}

		bm.Location = result.Location
	}

	if existingId != nil {
		bm.ID = *existingId
		if err := bm.upsert(ctx, tx); err != nil {
			fmt.Printf("failed to upsert mapping file, key: %s with error, %v\n", bm.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to upload build info: "%s"`, bm.File.Filename)})
			return
		}
		msg := `existing build info is already up to date`
		if shouldUpload {
			msg = `uploaded build info`
		}
		c.JSON(http.StatusOK, gin.H{"ok": msg})
		return
	}

	if err := bm.insert(ctx, tx); err != nil {
		fmt.Printf("failed to insert mapping file, key: %s with error, %v\n", bm.Key, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.File.Filename),
		})
		return
	}

	if err := bs.Upsert(ctx, tx); err != nil {
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

func uploadToStorage(awsConfig *aws.Config, bucket, key string, file io.Reader, metadata map[string]*string) (*s3manager.UploadOutput, error) {
	awsSession := session.Must(session.NewSession(awsConfig))
	uploader := s3manager.NewUploader(awsSession)

	return uploader.Upload(&s3manager.UploadInput{
		Bucket:   aws.String(bucket),
		Key:      aws.String(key),
		Body:     file,
		Metadata: metadata,
	})
}
