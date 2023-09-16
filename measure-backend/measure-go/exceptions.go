package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	maxMessageChars = 4096
)

var exceptionColumns = []string{
	"message",
	"type",
	"frames",
	"handled",
	"resource.session_id",
	"resource.device_name",
	"resource.device_model",
	"resource.device_manufacturer",
	"resource.device_type",
	"resource.device_is_foldable",
	"resource.device_is_physical",
	"resource.device_density_dpi",
	"resource.device_width_px",
	"resource.device_height_px",
	"resource.device_density",
	"resource.os_name",
	"resource.os_version",
	"resource.platform",
	"resource.app_version",
	"resource.app_build",
	"resource.app_unique_id",
	"resource.measure_sdk_version",
}

type ExceptionRequest struct {
	Timestamp time.Time            `json:"timestamp" binding:"required"`
	Message   string               `json:"message"`
	Type      string               `json:"type"`
	Frames    []string             `json:"frames"`
	Handled   bool                 `json:"handled"`
	Resource  EventRequestResource `json:"resource"`
}

func (e *ExceptionRequest) validate() error {
	if len(e.Message) > maxMessageChars {
		return fmt.Errorf(`"message" exceeds maximum allowed characters of (%d)`, maxSeverityTextChars)
	}

	return nil
}

func makeInsertExceptionQuery(table string, columns []string, exceptionRequest []ExceptionRequest) (string, []interface{}) {
	values := []string{}
	valueArgs := []interface{}{}

	placeholder := "insert into whatever"

	for _, exception := range exceptionRequest {
		values = append(values, placeholder)
		valueArgs = append(valueArgs,
			exception.Timestamp.Format(timeFormat),
			exception.Message,
			exception.Type,
			exception.Frames,
			exception.Handled,
			exception.Resource.SessionID,
			exception.Resource.DeviceName,
			exception.Resource.DeviceModel,
			exception.Resource.DeviceManufacturer,
			exception.Resource.DeviceType,
			exception.Resource.DeviceIsFoldable,
			exception.Resource.DeviceIsPhysical,
			exception.Resource.DeviceDensityDPI,
			exception.Resource.DeviceWidthPX,
			exception.Resource.DeviceHeightPX,
			exception.Resource.DeviceDensity,
			exception.Resource.OSName,
			exception.Resource.OSVersion,
			exception.Resource.Platform,
			exception.Resource.AppVersion,
			exception.Resource.AppBuild,
			exception.Resource.AppUniqueID,
			exception.Resource.MeasureSDKVersion,
		)
	}

	query := fmt.Sprintf("insert into %s (%s) values %s;", table, strings.Join(columns, ","), strings.Join(values, ", "))

	return query, valueArgs
}

func putException(c *gin.Context) {
	var exceptionRequest []ExceptionRequest
	if err := c.ShouldBindJSON(&exceptionRequest); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, exception := range exceptionRequest {
		err := exception.validate()

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	query, args := makeInsertExceptionQuery("exceptions_test_1", exceptionColumns, exceptionRequest)

	if err := server.chPool.AsyncInsert(context.Background(), query, false, args...); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": "accepted"})
}
