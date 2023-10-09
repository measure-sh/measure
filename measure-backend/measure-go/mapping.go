package main

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	mappingUploadDone = "done"
	mappingUploadWip  = "wip"
)

func mappingFileKey(appId, versionName, versionCode string, mappingFileId uuid.UUID) string {
	return fmt.Sprintf(`%s-%s-%s-%s.txt`, appId, versionName, versionCode, mappingFileId)
}

func putMapping(c *gin.Context) {
	mappingFile, err := c.FormFile("mapping_file")
	if err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": `missing field "mapping_file"`})
		return
	}

	if mappingFile.Size > int64(server.config.mappingFileMaxSize) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf(`"%s" file size exceeding %d bytes`, mappingFile.Filename, server.config.mappingFileMaxSize)})
		return
	}

	versionCode := c.PostForm("version_code")
	if versionCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `missing field "version_code"`})
		return
	}

	appId := c.PostForm("app_id")
	if appId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `missing field "app_id"`})
		return
	}

	versionName := c.PostForm("version_name")
	if versionName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `missing field "version_name"`})
		return
	}

	mappingType := c.PostForm("type")
	if mappingType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": `missing field "type"`})
		return
	}

	// check for existing mapping file
	var existingHash string
	var uploadStatus string
	if err := server.pgPool.QueryRow(context.Background(), `select fnv1_hash, upload_status from mapping_files where app_id = $1 and version_name = $2 and version_code = $3 and upload_status in ($4, $5);`, appId, versionName, versionCode, mappingUploadDone, mappingUploadWip).Scan(&existingHash, &uploadStatus); err != nil {
		if err.Error() != "no rows in result set" {
			fmt.Println(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	file, err := mappingFile.Open()
	if err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// calculate checksum of incoming mapping file
	hash, err := checksum(file)
	if err != nil {
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Checksum calculation failed"})
		return
	}
	// seek the file offset to the beginning as the checksum calculation
	// must have moved the offset towards end of the file
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		fmt.Println("failed to seek read offset to beginning of the file", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to uplod mapping file"})
		return
	}

	if hash == existingHash {
		msg := fmt.Sprintf(`mapping file already present for "%s" with version code "%s"`, appId, versionCode)
		if uploadStatus == mappingUploadWip {
			msg = fmt.Sprintf(`mapping file upload is in progress for "%s" with version code "%s"`, appId, versionCode)
		}
		c.JSON(http.StatusOK, gin.H{"ok": msg})
		return
	}

	mappingFileId := uuid.New()
	key := mappingFileKey(appId, versionName, versionCode, mappingFileId)
	metadata := map[string]*string{
		"original_file_name": &mappingFile.Filename,
		"app_id":             &appId,
		"version_name":       &versionName,
		"version_code":       &versionCode,
		"type":               &mappingType,
	}
	result, err := uploadToStorage(&file, key, metadata)

	if err != nil {
		fmt.Printf("failed to upload mapping file, key: %s with error, %v", key, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, mappingFile.Filename)})
		return
	}

	fmt.Printf("uploaded to s3 with location: %s, uploadId: %s, etag: %s\n", result.Location, result.UploadID, *result.ETag)

	// FIXME: convert mapping file insert operation into a transaction
	if _, err := server.pgPool.Exec(context.Background(), `insert into mapping_files (id, app_id, version_name, version_code, type, key, location, fnv1_hash, file_size, upload_status, timestamp) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`, mappingFileId, appId, versionName, versionCode, mappingType, key, result.Location, hash, mappingFile.Size, mappingUploadDone, time.Now()); err != nil {
		fmt.Println(`failed to insert mapping file entry to db`, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf(`failed to save mapping file: "%s"`, mappingFile.Filename)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": fmt.Sprintf(`uploaded mapping file: "%s"`, mappingFile.Filename)})
}

func uploadToStorage(f *multipart.File, k string, m map[string]*string) (*s3manager.UploadOutput, error) {
	awsConfig := &aws.Config{
		Region:      aws.String(server.config.symbolsBucketRegion),
		Credentials: credentials.NewStaticCredentials(server.config.symbolsAccessKey, server.config.symbolsSecretAccessKey, ""),
	}
	awsSession := session.Must(session.NewSession(awsConfig))
	uploader := s3manager.NewUploader(awsSession)
	result, err := uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(server.config.symbolsBucket),
		Key:    aws.String(k),
		Body:   *f,
		Metadata: map[string]*string{
			"original_file_name": aws.String(*m["original_file_name"]),
			"app_id":             aws.String(*m["app_id"]),
			"version_name":       aws.String(*m["version_name"]),
			"version_code":       aws.String(*m["version_code"]),
			"mapping_type":       aws.String(*m["type"]),
		},
	})

	if err != nil {
		fmt.Printf("failed to upload symbol file, key: %s with error, %v", k, err)
		return nil, err
	}

	return result, nil
}
