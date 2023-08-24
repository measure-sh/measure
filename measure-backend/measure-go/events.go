package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type EventRequestBody struct {
	Type string `json:"type"`
	*EventRequestBodyException
	*EventRequestBodyString
	*EventRequestBodyGestureLongClick
	*EventRequestBodyGestureScroll
	*EventRequestBodyGestureClick
	*EventRequestBodyHTTPRequest
	*EventRequestBodyHTTPResponse
}

type EventRequestResource struct {
	SessionID          uuid.UUID `json:"session_id"`
	DeviceName         string    `json:"device_name"`
	DeviceModel        string    `json:"device_model"`
	DeviceManufacturer string    `json:"device_manufacturer"`
	DeviceType         string    `json:"device_type"`
	DeviceIsFoldable   bool      `json:"device_is_foldable"`
	DeviceIsPhysical   bool      `json:"device_is_physical"`
	DeviceDensityDPI   uint16    `json:"device_density_dpi"`
	DeviceWidthPX      uint16    `json:"device_width_px"`
	DeviceHeightPX     uint16    `json:"device_height_px"`
	DeviceDensity      uint8     `json:"device_density"`
	OSName             string    `json:"os_name"`
	Platform           string    `json:"platform"`
	AppVersion         string    `json:"app_version"`
	AppBuild           string    `json:"app_build"`
	AppUniqueID        string    `json:"app_unique_id"`
	MeasureSDKVersion  string    `json:"measure_sdk_version"`
}

type StackFrame struct {
	Filename  string `json:"filename"`
	Method    string `json:"method"`
	LineNum   uint16 `json:"line_num"`
	ColumnNum uint16 `json:"column_num"`
	ClassName string `json:"class_name"`
	Module    string `json:"module"`
}

type ExceptionUnit struct {
	ThreadID    string       `json:"thread_id"`
	Type        string       `json:"type"`
	Message     string       `json:"message"`
	Stackframes []StackFrame `json:"stackframes"`
}

type EventRequestBodyString struct {
	String string `json:"string"`
}

type EventRequestBodyException struct {
	Type       string          `json:"type"`
	Exceptions []ExceptionUnit `json:"exceptions"`
	Handled    bool            `json:"handled"`
}

type EventRequestBodyGestureLongClick struct {
	Target                 string    `json:"target"`
	TargetUserReadableName string    `json:"target_user_readable_name"`
	TargetID               string    `json:"target_id"`
	TouchDownTime          time.Time `json:"touch_down_time"`
	TouchUpTime            time.Time `json:"touch_up_time"`
	Width                  string    `json:"width"`
	Height                 string    `json:"height"`
	X                      string    `json:"x"`
	Y                      string    `json:"y"`
}

type EventRequestBodyGestureClick struct {
	Target                 string    `json:"target"`
	TargetUserReadableName string    `json:"target_user_readable_name"`
	TargetID               string    `json:"target_id"`
	TouchDownTime          time.Time `json:"touch_down_time"`
	TouchUpTime            time.Time `json:"touch_up_time"`
	TargetWidth            uint16    `json:"target_width"`
	TargetHeight           uint16    `json:"target_height"`
	X                      uint16    `json:"x"`
	Y                      uint16    `json:"y"`
}

type EventRequestBodyGestureScroll struct {
	Target                 string    `json:"target"`
	TargetUserReadableName string    `json:"target_user_readable_name"`
	TargetID               string    `json:"target_id"`
	TouchDownTime          time.Time `json:"touch_down_time"`
	TouchUpTime            time.Time `json:"touch_up_time"`
	X                      uint16    `json:"x"`
	Y                      uint16    `json:"y"`
	EndX                   uint16    `json:"end_x"`
	EndY                   uint16    `json:"end_y"`
	VelocityPX             uint16    `json:"velocity_px"`
	Angle                  uint16    `json:"angle"`
}

type EventRequestBodyHTTPRequest struct {
	RequestID           uuid.UUID         `json:"request_id"`
	RequestURL          string            `json:"request_url"`
	Method              string            `json:"method"`
	HTTPProtocolVersion string            `json:"http_protocol_version"`
	RequestBodySize     uint32            `json:"request_body_size"`
	RequestBody         string            `json:"request_body"`
	RequestHeaders      map[string]string `json:"request_headers"`
}

type EventRequestBodyHTTPResponse struct {
	RequestID       uuid.UUID         `json:"request_id"`
	RequestURL      string            `json:"request_url"`
	Method          string            `json:"method"`
	LatencyMS       uint16            `json:"latency_ms"`
	StatusCode      uint16            `json:"status_code"`
	ResponseBody    string            `json:"response_body"`
	ResponseHeaders map[string]string `json:"response_headers"`
}

type EventRequest struct {
	ID           uuid.UUID            `json:"id"`
	Timestamp    time.Time            `json:"timestamp"`
	SeverityText string               `json:"severity_text"`
	Body         EventRequestBody     `json:"body"`
	Resource     EventRequestResource `json:"resource"`
}

func putEvent(c *gin.Context) {
	token, exists := c.Get("token")

	if !exists {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	log.Printf("token is %v\n", token)

	// insert event into postgres db

	// insert event into clickhouse

	rows, err := server.chPool.Query(context.Background(), "select trip_id from trips limit 10;")

	if err != nil {
		log.Printf("Unable to query ClickHouse: %v", err)
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	eventTypes := make([]uint32, 0)

	for rows.Next() {
		var eventType uint32
		err = rows.Scan(&eventType)
		if err != nil {
			fmt.Print(err)
			return
		}
		eventTypes = append(eventTypes, eventType)
	}

	fmt.Println(eventTypes)

	c.Status(http.StatusOK)
}

func postEvent(c *gin.Context) {
	var eventRequest EventRequest
	if err := c.ShouldBindJSON(&eventRequest); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("%+v\n", eventRequest)

	c.JSON(http.StatusOK, gin.H{"message": "Event accepted"})
}
