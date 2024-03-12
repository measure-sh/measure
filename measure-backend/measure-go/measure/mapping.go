package measure

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/cipher"
	"measure-backend/measure-go/server"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

var validMappingTypes = []string{"proguard"}
var validBuildTypes = []string{"apk", "aab"}
var MinBuildSize = 100

type BuildMapping struct {
	ID           uuid.UUID
	AppID        uuid.UUID
	VersionName  string
	VersionCode  string
	MappingType  string
	Key          string
	Location     string
	ContentHash  string
	File         *multipart.FileHeader
	UploadStatus string
	Timestamp    time.Time
}

func (m *BuildMapping) buildKey() string {
	return fmt.Sprintf(`%s.txt`, m.ID)
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

func (bm *BuildMapping) validate() (int, error) {
	if bm.VersionName == "" {
		return http.StatusBadRequest, errors.New(`missing field "version_name"`)
	}

	if bm.VersionCode == "" {
		return http.StatusBadRequest, errors.New(`missing field "version_code"`)
	}

	if bm.MappingType == "" {
		return http.StatusBadRequest, errors.New(`missing field "mapping_type"`)
	}

	if !slices.Contains(validMappingTypes, bm.MappingType) {
		msg := fmt.Sprintf(`invalid type %q. valid types are: %q`, bm.MappingType, strings.Join(validMappingTypes, ", "))
		return http.StatusBadRequest, errors.New(msg)
	}

	if bm.File.Size < 1 {
		return http.StatusBadRequest, errors.New(`"mapping_file" does not any contain data`)
	}

	if bm.File.Size > int64(server.Server.Config.MappingFileMaxSize) {
		return http.StatusRequestEntityTooLarge, fmt.Errorf(`"%s" file size exceeding %d bytes`, bm.File.Filename, server.Server.Config.MappingFileMaxSize)
	}

	return 0, nil
}

func (bm *BuildMapping) shouldUpsert(ctx context.Context, tx pgx.Tx) (bool, *uuid.UUID, error) {
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

	// the content has changed
	if bm.ContentHash != existingHash {
		return true, &id, nil
	}

	return false, &id, nil
}

func (bm *BuildMapping) insert(ctx context.Context, tx pgx.Tx) error {
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

func (bm *BuildMapping) upsert(ctx context.Context, tx pgx.Tx) error {
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
		bm.Key = bm.buildKey()
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
	VersionName string
	VersionCode string
	BuildSize   int
	BuildType   string
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

	file, err := c.FormFile("mapping_file")
	if err != nil {
		fmt.Println("error reading mapping_file field", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": `missing field "mapping_file"`})
		return
	}

	buildMapping := &BuildMapping{
		ID:          uuid.New(),
		AppID:       appId,
		VersionName: c.PostForm("version_name"),
		VersionCode: c.PostForm("version_code"),
		MappingType: c.PostForm("mapping_type"),
		File:        file,
	}

	if statusCode, err := buildMapping.validate(); err != nil {
		fmt.Println(`put mapping file request validation error: `, err.Error())
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	size, err := strconv.Atoi(c.PostForm("build_size"))
	if err != nil {
		msg := `failed to parse build size`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	buildSize := &BuildSize{
		AppID:       appId,
		VersionName: c.PostForm("version_name"),
		VersionCode: c.PostForm("version_code"),
		BuildSize:   size,
		BuildType:   c.PostForm("build_type"),
	}

	if buildSize.BuildSize < MinBuildSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("build size cannot be less than %d bytes", MinBuildSize)})
		return
	}

	if !slices.Contains(validBuildTypes, buildSize.BuildType) {
		msg := fmt.Sprintf(`invalid build type %q. valid types are: %q`, buildSize.BuildType, strings.Join(validBuildTypes, ", "))
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
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

	if err := buildMapping.checksum(); err != nil {
		fmt.Println("failed to calculate mapping file checksum", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload mapping file"})
		return
	}

	shouldUpload, existingId, err := buildMapping.shouldUpsert(ctx, tx)
	if err != nil {
		fmt.Println("failed to detect mapping file upsertion", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, buildMapping.File.Filename),
		})
		return
	}

	if existingId != nil {
		buildMapping.ID = *existingId
	}

	if shouldUpload {
		result, err := buildMapping.upload()
		if err != nil {
			fmt.Printf("failed to upload mapping file, key: %s with error, %v\n", buildMapping.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, buildMapping.File.Filename),
			})
			return
		}

		buildMapping.Location = result.Location
	}

	if err := buildSize.Upsert(ctx, tx); err != nil {
		msg := `failed to register app build size`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if existingId != nil {
		if err := buildMapping.upsert(ctx, tx); err != nil {
			fmt.Printf("failed to upsert mapping file, key: %s with error, %v\n", buildMapping.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to upload build info: "%s"`, buildMapping.File.Filename)})
			return
		}
		msg := `existing build info is already up to date`
		if shouldUpload {
			msg = `uploaded build info`
		}
		c.JSON(http.StatusOK, gin.H{"ok": msg})
		return
	}

	if err := buildMapping.insert(ctx, tx); err != nil {
		fmt.Printf("failed to insert mapping file, key: %s with error, %v\n", buildMapping.Key, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, buildMapping.File.Filename),
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
