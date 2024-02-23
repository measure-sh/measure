package measure

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"slices"
	"strings"
	"time"

	"measure-backend/measure-go/cipher"
	"measure-backend/measure-go/server"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type MappingFile struct {
	ID           uuid.UUID
	AppUniqueID  string
	VersionName  string
	VersionCode  string
	Type         string
	Key          string
	Location     string
	ContentHash  string
	File         *multipart.FileHeader
	FileSize     int
	UploadStatus string
	Timestamp    time.Time
}

var validTypes = []string{"proguard"}

func (m *MappingFile) buildKey() string {
	return fmt.Sprintf(`%s.txt`, m.ID)
}

func (m *MappingFile) shouldUpsert() (bool, *uuid.UUID, error) {
	var id uuid.UUID
	var key string
	var existingHash string
	if err := server.Server.PgPool.QueryRow(context.Background(), "select id, key, fnv1_hash from mapping_files where app_unique_id = $1 and version_name = $2 and version_code = $3 and mapping_type = $4;", m.AppUniqueID, m.VersionName, m.VersionCode, m.Type).Scan(&id, &key, &existingHash); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return true, nil, nil
		} else {
			return false, nil, err
		}
	}

	// the content has changed
	if m.ContentHash != existingHash {
		return true, &id, nil
	}

	return false, &id, nil
}

func (m *MappingFile) upload() (*s3manager.UploadOutput, error) {
	file, err := m.File.Open()
	if err != nil {
		return nil, err
	}
	metadata := map[string]*string{
		"original_file_name": &m.File.Filename,
		"app_unique_id":      &m.AppUniqueID,
		"version_name":       &m.VersionName,
		"version_code":       &m.VersionCode,
		"type":               &m.Type,
	}

	if m.Key == "" {
		m.Key = m.buildKey()
	}
	result, err := uploadToStorage(&file, m.Key, metadata)

	if err != nil {
		return nil, err
	}

	return result, nil
}

func (m *MappingFile) insert() error {
	if _, err := server.Server.PgPool.Exec(context.Background(), "insert into mapping_files (id, app_unique_id, version_name, version_code, mapping_type, key, location, fnv1_hash, file_size, last_updated) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);", m.ID, m.AppUniqueID, m.VersionName, m.VersionCode, m.Type, m.Key, m.Location, m.ContentHash, m.File.Size, time.Now()); err != nil {
		return err
	}

	return nil
}

func (m *MappingFile) upsert() error {
	if _, err := server.Server.PgPool.Exec(context.Background(), `update mapping_files set fnv1_hash = $1, file_size = $2, last_updated = $3 where id = $4;`, m.ContentHash, m.File.Size, time.Now(), m.ID); err != nil {
		return err
	}

	return nil
}

func (m *MappingFile) checksum() error {
	file, err := m.File.Open()
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

	m.ContentHash = hash
	return nil
}

func (m *MappingFile) validate() (int, error) {
	if m.AppUniqueID == "" {
		return http.StatusBadRequest, errors.New(`missing field "app_unique_id"`)
	}

	if m.VersionName == "" {
		return http.StatusBadRequest, errors.New(`missing field "version_name"`)
	}

	if m.VersionCode == "" {
		return http.StatusBadRequest, errors.New(`missing field "version_code"`)
	}

	if m.Type == "" {
		return http.StatusBadRequest, errors.New(`missing field "type"`)
	}

	if !slices.Contains(validTypes, m.Type) {
		msg := fmt.Sprintf(`invalid type "%s". valid types are: %s`, m.Type, strings.Join(validTypes, ", "))
		return http.StatusBadRequest, errors.New(msg)
	}

	if m.File.Size < 1 {
		return http.StatusBadRequest, errors.New(`"mapping_file" does not any contain data`)
	}

	if m.File.Size > int64(server.Server.Config.MappingFileMaxSize) {
		return http.StatusRequestEntityTooLarge, fmt.Errorf(`"%s" file size exceeding %d bytes`, m.File.Filename, server.Server.Config.MappingFileMaxSize)
	}

	return 0, nil
}

func PutMapping(c *gin.Context) {
	file, err := c.FormFile("mapping_file")
	if err != nil {
		fmt.Println("error reading mapping_file field", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": `missing field "mapping_file"`})
		return
	}
	mappingFile := &MappingFile{
		ID:          uuid.New(),
		AppUniqueID: c.PostForm("app_unique_id"),
		VersionName: c.PostForm("version_name"),
		VersionCode: c.PostForm("version_code"),
		Type:        c.PostForm("type"),
		File:        file,
	}

	if statusCode, err := mappingFile.validate(); err != nil {
		fmt.Println(`put mapping file request validation error: `, err.Error())
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	if err := mappingFile.checksum(); err != nil {
		fmt.Println("failed to calculate mapping file checksum", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload mapping file"})
		return
	}

	shouldUpload, existingId, err := mappingFile.shouldUpsert()
	if err != nil {
		fmt.Println("failed to detect upsertion", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, mappingFile.File.Filename)})
		return
	}

	if existingId != nil {
		mappingFile.ID = *existingId
	}

	if shouldUpload {
		result, err := mappingFile.upload()
		if err != nil {
			fmt.Printf("failed to upload mapping file, key: %s with error, %v\n", mappingFile.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, mappingFile.File.Filename)})
			return
		}

		mappingFile.Location = result.Location
	}

	if existingId != nil {
		if err := mappingFile.upsert(); err != nil {
			fmt.Printf("failed to upsert mapping file, key: %s with error, %v\n", mappingFile.Key, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, mappingFile.File.Filename)})
			return
		}
		msg := fmt.Sprintf(`existing mapping file: "%s" is already up to date`, mappingFile.File.Filename)
		if shouldUpload {
			msg = fmt.Sprintf(`uploaded mapping file: "%s"`, mappingFile.File.Filename)
		}
		c.JSON(http.StatusOK, gin.H{"ok": msg})
		return
	}

	if err := mappingFile.insert(); err != nil {
		fmt.Printf("failed to insert mapping file, key: %s with error, %v\n", mappingFile.Key, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, mappingFile.File.Filename)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": fmt.Sprintf(`uploaded mapping file: "%s"`, mappingFile.File.Filename)})
}

func uploadToStorage(f *multipart.File, k string, m map[string]*string) (*s3manager.UploadOutput, error) {
	config := server.Server.Config
	awsConfig := &aws.Config{
		Region:      aws.String(config.SymbolsBucketRegion),
		Credentials: credentials.NewStaticCredentials(config.SymbolsAccessKey, config.SymbolsSecretAccessKey, ""),
	}
	if config.DebugMode {
		awsConfig.S3ForcePathStyle = aws.Bool(true)
		awsConfig.Endpoint = aws.String(config.AWSEndpoint)
	}
	awsSession := session.Must(session.NewSession(awsConfig))
	uploader := s3manager.NewUploader(awsSession)
	result, err := uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(config.SymbolsBucket),
		Key:    aws.String(k),
		Body:   *f,
		Metadata: map[string]*string{
			"original_file_name": aws.String(*m["original_file_name"]),
			"app_unique_id":      aws.String(*m["app_unique_id"]),
			"version_name":       aws.String(*m["version_name"]),
			"version_code":       aws.String(*m["version_code"]),
			"mapping_type":       aws.String(*m["type"]),
		},
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}
