package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Retrace's official default regex customized to fit our needs
//
// For more info, see: https://developer.android.com/tools/retrace
const retraceRegex = `(?:.*?%c\.%m\(%s(?::%l)?\).*?)|(?:(?:.*?[:"] +)?%c(?::.*)?)|(?:.*?"type":.*?%c.*?)`

type SymbolAppExitEvent struct {
	Trace string `json:"trace"`
}

type SymbolicateReq struct {
	Id                    uuid.UUID            `json:"id" binding:"required"`
	SessionID             uuid.UUID            `json:"session_id" binding:"required"`
	MappingType           string               `json:"mapping_type" binding:"required"`
	Key                   string               `json:"key" binding:"required"`
	SymbolANREvents       *json.RawMessage     `json:"anr_events"`
	SymbolExceptionEvents *json.RawMessage     `json:"exception_events"`
	SymbolAppExitEvents   []SymbolAppExitEvent `json:"app_exit_events"`
}

func (s *SymbolicateReq) validate() error {
	if s.SymbolExceptionEvents == nil && s.SymbolANREvents == nil && len(s.SymbolAppExitEvents) < 1 {
		return fmt.Errorf("symbolication request does not contain any symbolicatable events")
	}
	return nil
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

	if err := req.validate(); err != nil {
		msg := "symbolication request validation failed"
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

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

	var anrResults string
	if req.SymbolANREvents != nil {
		anrFilePath := filepath.Join("/data", "anrs", fmt.Sprintf(`%s.json`, req.SessionID))
		indented, err := json.MarshalIndent(*req.SymbolANREvents, "", "  ")
		if err != nil {
			msg := `failed to marshal & indent anr events`
			fmt.Println(msg, err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
			return
		}
		if err := os.WriteFile(anrFilePath, indented, 0644); err != nil {
			fmt.Println("failed to create anr file")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create anr file", "details": err.Error()})
			return
		}

		cmd := exec.Command("retrace", mappingFilePath, anrFilePath, "--regex", retraceRegex)
		bytes, err := cmd.Output()
		if err != nil {
			msg := "anr retrace exec failed"
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error(), "stdout": anrResults})
			return
		}
		anrResults = string(bytes)
	}

	var exceptionResults string
	if req.SymbolExceptionEvents != nil {
		exceptionFilePath := filepath.Join("/data", "exceptions", fmt.Sprintf(`%s.json`, req.SessionID))
		indented, err := json.MarshalIndent(*req.SymbolExceptionEvents, "", "  ")
		if err != nil {
			msg := `failed to marshal & indent exception events`
			fmt.Println(msg, err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
			return
		}
		if err := os.WriteFile(exceptionFilePath, indented, 0644); err != nil {
			fmt.Println("failed to create exception file")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create excpetion file", "details": err.Error()})
			return
		}

		cmd := exec.Command("retrace", mappingFilePath, exceptionFilePath, "--regex", retraceRegex)
		bytes, err := cmd.Output()
		if err != nil {
			msg := "exception retrace exec failed"
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error(), "stdout": exceptionResults})
			return
		}
		exceptionResults = string(bytes)
	}

	var appExitResults []SymbolAppExitEvent
	appExitCount := len(req.SymbolAppExitEvents)
	if appExitCount > 0 {
		appExitFilePath := filepath.Join("/data", "app_exit_traces", fmt.Sprintf(`%s.txt`, req.SessionID))
		for index, appExitEvent := range req.SymbolAppExitEvents {
			if err := os.WriteFile(appExitFilePath, []byte(appExitEvent.Trace), 0644); err != nil {
				fmt.Println("failed to create app exit trace file")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create app exit trace file", "details": err.Error()})
				return
			}

			cmd := exec.Command("retrace", mappingFilePath, appExitFilePath)
			bytes, err := cmd.Output()
			if err != nil {
				msg := "app_exit retrace exec failed"
				fmt.Println(msg, err.Error())
				c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err.Error()})
				return
			}

			// if not the last item, leave some breathing room
			if index != appExitCount-1 {
				time.Sleep(time.Millisecond * 300)
			}

			appExitResults = append(appExitResults, SymbolAppExitEvent{
				Trace: string(bytes),
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":               req.Id,
		"session_id":       req.SessionID,
		"mapping_type":     req.MappingType,
		"key":              req.Key,
		"anr_events":       anrResults,
		"exception_events": exceptionResults,
		"app_exit_events":  appExitResults,
	})
}
