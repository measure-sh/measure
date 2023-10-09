package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const retraceRegex = `(?:.*?%c\\.%m\\(%s(?::%l)?\\).*?)|(?:(?:.*?[:\"] +)?%c(?::.*)?)|(?:.*?\"type\":.*?%c.*?)`

type SymbolicateReq struct {
	Id           uuid.UUID        `json:"id" binding:"required"`
	SessionID    uuid.UUID        `json:"session_id" binding:"required"`
	MappingType  string           `json:"mapping_type" binding:"required"`
	Key          string           `json:"key" binding:"required"`
	SymbolEvents *json.RawMessage `json:"events" binding:"required"`
}

func downloadMapping(s *SymbolicateReq, f *os.File) error {
	awsConfig := &aws.Config{
		Region:      aws.String(os.Getenv("SYMBOLS_S3_BUCKET_REGION")),
		Credentials: credentials.NewStaticCredentials(os.Getenv("SYMBOLS_ACCESS_KEY"), os.Getenv("SYMBOLS_SECRET_ACCESS_KEY"), ""),
	}
	awsSession := session.Must(session.NewSession(awsConfig))
	downloader := s3manager.NewDownloader(awsSession)
	numBytes, err := downloader.Download(f, &s3.GetObjectInput{
		Bucket: aws.String(os.Getenv("SYMBOLS_S3_BUCKET")),
		Key:    aws.String(s.Key),
	})
	if err != nil {
		fmt.Println("error downloading file", s.Key)
		return err
	}

	fmt.Println("Downloaded file", f.Name(), "with", numBytes, "bytes")
	return nil
}

func symbolicate(c *gin.Context) {
	req := new(SymbolicateReq)
	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// fmt.Println("symbolication request", req)
	mappingFilePath := filepath.Join("/data", "mappings", req.Key)
	_, err := os.Stat(mappingFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			mappingFile, err := os.Create(mappingFilePath)
			if err != nil {
				msg := fmt.Sprintf(`could not create mapping file handle, path: %s`, mappingFilePath)
				c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
				return
			}
			defer mappingFile.Close()
			err = downloadMapping(req, mappingFile)
			if err != nil {
				msg := fmt.Sprintf(`failed to download mapping file: %s`, mappingFilePath)
				c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
				return
			}
		} else {
			msg := fmt.Sprintf(`stat-ing mapping file failed for path: %s`, mappingFilePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
			return
		}
	}

	// 1. download the symbol file from object store

	exceptionFilePath := filepath.Join("/data", "exceptions", fmt.Sprintf(`%s.json`, req.SessionID))
	indented, err := json.MarshalIndent(*req.SymbolEvents, "", "  ")
	if err != nil {
		msg := `failed to marshal & indent exception events`
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
		return
	}
	if err := os.WriteFile(exceptionFilePath, indented, 0644); err != nil {
		fmt.Println("failed to create exception file")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create excpetion file", "details": err.Error()})
		return
	}

	cmd := exec.Command("retrace", mappingFilePath, exceptionFilePath, "--regex", fmt.Sprintf(`"%s"`, retraceRegex))
	fmt.Println("retrace command:", cmd.String())
	bytes, err := cmd.Output()

	output := string(bytes)

	fmt.Println("retrace output", output)

	if err != nil {
		log.Println("retrace exec failed", err, output)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "retrace exec failed", "details": err.Error(), "stdout": output})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           req.Id,
		"session_id":   req.SessionID,
		"mapping_type": req.MappingType,
		"key":          req.Key,
		"events":       output,
	})
}
