package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"symboloader/objstore"
	"symboloader/server"
	"symboloader/symbol"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
)

// sentryFile represents a file entry in the Sentry source
// protocol list response.
type sentryFile struct {
	ID         string `json:"id"`
	SymbolType string `json:"symbolType"`
}

// HandleSymbolsRequest serves the Sentry source protocol for
// symbolicator. It handles two query modes:
//
//   - ?debug_id=X: lists files matching the debug ID
//   - ?id=X: downloads a file by its key
func HandleSymbolsRequest(c *gin.Context) {
	debugID := c.Query("debug_id")
	fileID := c.Query("id")

	config := server.Server.Config

	if debugID != "" {
		handleListFiles(c, config, debugID)
	} else if fileID != "" {
		handleDownloadFile(c, config, fileID)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing debug_id or id query parameter"})
	}
}

// handleListFiles checks if a proguard file exists in the bucket
// for the given debug ID and returns a JSON array of matching files.
func handleListFiles(c *gin.Context, config *server.ServerConfig, debugID string) {
	key := symbol.BuildUnifiedLayout(debugID) + "/proguard"
	ctx := c.Request.Context()

	var exists bool
	if config.IsCloud() {
		gcsClient, err := objstore.CreateGCSClient(ctx)
		if err != nil {
			fmt.Printf("failed to create GCS client: %v\n", err)
			c.Data(http.StatusOK, "application/json", []byte("[]"))
			return
		}
		defer gcsClient.Close()
		_, err = gcsClient.Bucket(config.SymbolsBucket).Object(key).Attrs(ctx)
		exists = err == nil
	} else {
		s3Client := objstore.CreateS3Client(
			ctx,
			config.SymbolsAccessKey,
			config.SymbolsSecretAccessKey,
			config.SymbolsBucketRegion,
			config.AWSEndpoint,
		)
		_, err := s3Client.HeadObject(ctx, &s3.HeadObjectInput{
			Bucket: aws.String(config.SymbolsBucket),
			Key:    aws.String(key),
		})
		exists = err == nil
	}

	if !exists {
		c.Data(http.StatusOK, "application/json", []byte("[]"))
		return
	}

	files := []sentryFile{{ID: key, SymbolType: "proguard"}}
	data, err := json.Marshal(files)
	if err != nil {
		fmt.Printf("failed to marshal symbols list: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.Data(http.StatusOK, "application/json", data)
}

// handleDownloadFile downloads a file by key and streams
// the raw bytes back to the caller.
func handleDownloadFile(c *gin.Context, config *server.ServerConfig, fileID string) {
	ctx := c.Request.Context()

	var body io.ReadCloser
	if config.IsCloud() {
		gcsClient, err := objstore.CreateGCSClient(ctx)
		if err != nil {
			fmt.Printf("failed to create GCS client: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
		defer gcsClient.Close()
		reader, err := objstore.DownloadGCSObject(ctx, gcsClient, config.SymbolsBucket, fileID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		body = reader
	} else {
		s3Client := objstore.CreateS3Client(
			ctx,
			config.SymbolsAccessKey,
			config.SymbolsSecretAccessKey,
			config.SymbolsBucketRegion,
			config.AWSEndpoint,
		)
		s3Body, err := objstore.DownloadS3Object(ctx, s3Client, &s3.GetObjectInput{
			Bucket: aws.String(config.SymbolsBucket),
			Key:    aws.String(fileID),
		})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		body = s3Body
	}
	defer body.Close()

	c.Status(http.StatusOK)
	c.Header("Content-Type", "application/octet-stream")
	if _, err := io.Copy(c.Writer, body); err != nil {
		fmt.Printf("failed to stream symbol file: %v\n", err)
	}
}
