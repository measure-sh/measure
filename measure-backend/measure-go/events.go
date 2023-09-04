package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// maxAttrCount is the count of the maximum allowed event attributes
const maxAttrCount = 10

// timeFormat is the format of datetime in nanoseconds when
// converting datetime values before inserting into database
const timeFormat = "2006-01-02 15:04:05.999999999"

// list of events table columns
var columns = []string{
	"id",
	"timestamp",
	"severity_text",
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
	"body.type",
	"body.string",
	"body.exception.exceptions",
	"body.exception.handled",
	"body.gesture_long_click.target",
	"body.gesture_long_click.target_user_readable_name",
	"body.gesture_long_click.target_id",
	"body.gesture_long_click.touch_down_time",
	"body.gesture_long_click.touch_up_time",
	"body.gesture_long_click.width",
	"body.gesture_long_click.height",
	"body.gesture_long_click.x",
	"body.gesture_long_click.y",
	"body.gesture_click.target",
	"body.gesture_click.target_user_readable_name",
	"body.gesture_click.target_id",
	"body.gesture_click.touch_down_time",
	"body.gesture_click.touch_up_time",
	"body.gesture_click.width",
	"body.gesture_click.height",
	"body.gesture_click.x",
	"body.gesture_click.y",
	"body.gesture_scroll.target",
	"body.gesture_scroll.target_user_readable_name",
	"body.gesture_scroll.target_id",
	"body.gesture_scroll.touch_down_time",
	"body.gesture_scroll.touch_up_time",
	"body.gesture_scroll.x",
	"body.gesture_scroll.y",
	"body.gesture_scroll.end_x",
	"body.gesture_scroll.end_y",
	"body.gesture_scroll.velocity_px",
	"body.gesture_scroll.direction",
	"body.http_request.request_id",
	"body.http_request.request_url",
	"body.http_request.method",
	"body.http_request.http_protocol_version",
	"body.http_request.request_body_size",
	"body.http_request.request_body",
	"body.http_request.request_headers",
	"body.http_response.request_id",
	"body.http_response.request_url",
	"body.http_response.method",
	"body.http_response.latency_ms",
	"body.http_response.status_code",
	"body.http_response.response_body",
	"body.http_response.response_headers",
	"attributes",
}

type EventRequestBody struct {
	Type             string                           `json:"type"`
	Exception        EventRequestBodyException        `json:"exception"`
	String           string                           `json:"string"`
	GestureLongClick EventRequestBodyGestureLongClick `json:"gesture_long_click"`
	GestureScroll    EventRequestBodyGestureScroll    `json:"gesture_scroll"`
	GestureClick     EventRequestBodyGestureClick     `json:"gesture_click"`
	HTTPRequest      EventRequestBodyHTTPRequest      `json:"http_request"`
	HTTPResponse     EventRequestBodyHTTPResponse     `json:"http_response"`
}

type EventRequestResource struct {
	SessionID          uuid.UUID `json:"session_id" binding:"required"`
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
	OSVersion          string    `json:"os_version"`
	Platform           string    `json:"platform"`
	AppVersion         string    `json:"app_version"`
	AppBuild           string    `json:"app_build"`
	AppUniqueID        string    `json:"app_unique_id"`
	MeasureSDKVersion  string    `json:"measure_sdk_version"`
}

// StackFrame and ExcpetionUnit types are not being used
// right now. We store exceptions are string for now.
// FIXME: need to optimize this later
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
	Exceptions string `json:"exceptions"`
	Handled    bool   `json:"handled"`
}

type EventRequestBodyGestureLongClick struct {
	Target                 string    `json:"target"`
	TargetUserReadableName string    `json:"target_user_readable_name"`
	TargetID               string    `json:"target_id"`
	TouchDownTime          time.Time `json:"touch_down_time"`
	TouchUpTime            time.Time `json:"touch_up_time"`
	Width                  uint16    `json:"width"`
	Height                 uint16    `json:"height"`
	X                      uint16    `json:"x"`
	Y                      uint16    `json:"y"`
}

type EventRequestBodyGestureClick struct {
	Target                 string    `json:"target"`
	TargetUserReadableName string    `json:"target_user_readable_name"`
	TargetID               string    `json:"target_id"`
	TouchDownTime          time.Time `json:"touch_down_time"`
	TouchUpTime            time.Time `json:"touch_up_time"`
	Width                  uint16    `json:"width"`
	Height                 uint16    `json:"height"`
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
	Direction              uint16    `json:"direction"`
}

type EventRequestBodyHTTPRequest struct {
	RequestID           string            `json:"request_id"`
	RequestURL          string            `json:"request_url"`
	Method              string            `json:"method"`
	HTTPProtocolVersion string            `json:"http_protocol_version"`
	RequestBodySize     uint32            `json:"request_body_size"`
	RequestBody         string            `json:"request_body"`
	RequestHeaders      map[string]string `json:"request_headers"`
}

type EventRequestBodyHTTPResponse struct {
	RequestID       string            `json:"request_id"`
	RequestURL      string            `json:"request_url"`
	Method          string            `json:"method"`
	LatencyMS       uint16            `json:"latency_ms"`
	StatusCode      uint16            `json:"status_code"`
	ResponseBody    string            `json:"response_body"`
	ResponseHeaders map[string]string `json:"response_headers"`
}

type EventRequest struct {
	ID           uuid.UUID            `json:"id"`
	Timestamp    time.Time            `json:"timestamp" binding:"required"`
	SeverityText string               `json:"severity_text"`
	Body         EventRequestBody     `json:"body" binding:"required"`
	Resource     EventRequestResource `json:"resource" binding:"required"`
	Attributes   map[string]string    `json:"attributes"`
}

func postEvent(c *gin.Context) {
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

func validateEvent(event *EventRequest) error {
	// should not exceed beyond allowed
	// length of event attrs.
	if len(event.Attributes) > maxAttrCount {
		err := fmt.Errorf("exceeded maximum count of (%d) attributes", maxAttrCount)
		return err
	}

	return nil
}

func makeInsertQuery(table string, eventRequest []EventRequest) string {
	valueArgs := make([]string, 0, len(columns))
	for _, event := range eventRequest {
		valueArgs = append(valueArgs, fmt.Sprintf(`(toUUID('%v'),'%s','%s',toUUID('%v'),'%s','%s','%s','%s',%t,%t,%d,%d,%d,%d,'%s','%s','%s','%s','%s','%s','%s','%s','%s','%s',%t,'%s','%s','%s','%s','%s',%d,%d,%d,%d,'%s','%s','%s','%s','%s',%d,%d,%d,%d,'%s','%s','%s','%s','%s',%d,%d,%d,%d,%d,%d,toUUID('%v'),'%s','%s','%s',%d,'%s',%v,toUUID('%v'),'%s','%s',%d,%d,'%s',%v,%v)`,
			uuid.New(),
			event.Timestamp.Format(timeFormat),
			event.SeverityText,
			event.Resource.SessionID,
			event.Resource.DeviceName,
			event.Resource.DeviceModel,
			event.Resource.DeviceManufacturer,
			event.Resource.DeviceType,
			event.Resource.DeviceIsFoldable,
			event.Resource.DeviceIsPhysical,
			event.Resource.DeviceDensityDPI,
			event.Resource.DeviceWidthPX,
			event.Resource.DeviceHeightPX,
			event.Resource.DeviceDensity,
			event.Resource.OSName,
			event.Resource.OSVersion,
			event.Resource.Platform,
			event.Resource.AppVersion,
			event.Resource.AppBuild,
			event.Resource.AppUniqueID,
			event.Resource.MeasureSDKVersion,
			event.Body.Type,
			event.Body.String,
			event.Body.Exception.Exceptions,
			event.Body.Exception.Handled,
			event.Body.GestureLongClick.Target,
			event.Body.GestureLongClick.TargetUserReadableName,
			event.Body.GestureLongClick.TargetID,
			event.Body.GestureLongClick.TouchDownTime.Format(timeFormat),
			event.Body.GestureLongClick.TouchUpTime.Format(timeFormat),
			event.Body.GestureLongClick.Width,
			event.Body.GestureLongClick.Height,
			event.Body.GestureLongClick.X,
			event.Body.GestureLongClick.Y,
			event.Body.GestureClick.Target,
			event.Body.GestureClick.TargetUserReadableName,
			event.Body.GestureClick.TargetID,
			event.Body.GestureClick.TouchDownTime.Format(timeFormat),
			event.Body.GestureClick.TouchUpTime.Format(timeFormat),
			event.Body.GestureClick.Width,
			event.Body.GestureClick.Height,
			event.Body.GestureClick.X,
			event.Body.GestureClick.Y,
			event.Body.GestureScroll.Target,
			event.Body.GestureScroll.TargetUserReadableName,
			event.Body.GestureScroll.TargetID,
			event.Body.GestureScroll.TouchDownTime.Format(timeFormat),
			event.Body.GestureScroll.TouchUpTime.Format(timeFormat),
			event.Body.GestureScroll.X,
			event.Body.GestureScroll.Y,
			event.Body.GestureScroll.EndX,
			event.Body.GestureScroll.EndY,
			event.Body.GestureScroll.VelocityPX,
			event.Body.GestureScroll.Direction,
			event.Body.HTTPRequest.RequestID,
			event.Body.HTTPRequest.RequestURL,
			event.Body.HTTPRequest.Method,
			event.Body.HTTPRequest.HTTPProtocolVersion,
			event.Body.HTTPRequest.RequestBodySize,
			event.Body.HTTPRequest.RequestBody,
			mapToString(event.Body.HTTPRequest.RequestHeaders),
			event.Body.HTTPResponse.RequestID,
			event.Body.HTTPResponse.RequestURL,
			event.Body.HTTPResponse.Method,
			event.Body.HTTPResponse.LatencyMS,
			event.Body.HTTPResponse.StatusCode,
			event.Body.HTTPResponse.ResponseBody,
			mapToString(event.Body.HTTPResponse.ResponseHeaders),
			mapToString(event.Attributes),
		))
	}
	stmt := fmt.Sprintf(`insert into %s (%s) values %s;`, table, strings.Join(columns, ","), strings.Join(valueArgs, ","))
	return stmt
}

func putEvent(c *gin.Context) {
	var eventRequest []EventRequest
	if err := c.ShouldBindJSON(&eventRequest); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, event := range eventRequest {
		err := validateEvent(&event)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	stmt := makeInsertQuery("events_test_1", eventRequest)

	if err := server.chPool.AsyncInsert(context.Background(), stmt, false); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
}
