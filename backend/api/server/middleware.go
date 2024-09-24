package server

import (
	"bytes"
	"log"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// buffer to write current req's response
// body.
type bodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// CaptureRequest is a middleware that captures
// request parameters like host and referer.
func CaptureRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		span := trace.SpanFromContext(c.Request.Context())

		if span.IsRecording() {
			span.SetAttributes(
				attribute.String("http.host", c.Request.Host),
				attribute.String("http.referer", c.Request.Referer()),
			)
		}

		c.Next()
	}
}

// CaptureErrorBody is a middleware that captures
// error response bodies and attaches to the OTel
// trace.
func CaptureErrorBody() gin.HandlerFunc {
	return func(c *gin.Context) {
		// create a buffer to hold response body
		bw := &bodyWriter{
			body:           bytes.NewBufferString(""),
			ResponseWriter: c.Writer,
		}
		c.Writer = bw

		// continue to process the request
		c.Next()

		statusCode := c.Writer.Status()
		if statusCode < 399 {
			return
		}

		// only capture error body for 4xx
		// and higher
		responseBody := bw.body.String()

		span := trace.SpanFromContext(c.Request.Context())
		if span != nil {
			span.SetAttributes(
				attribute.Int("http.status_code", statusCode),
				attribute.String("http.response.body", responseBody),
			)
		}

	}
}

// CapturePanic is a middlware that captures runtime
// errors like panic and stacktrace, recovers and
// attaches to the OTel trace.
func CapturePanic() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// log and capture stack trace
				stacktrace := string(debug.Stack())
				err := err.(error)

				log.Printf("Panic occurred: %v\nStack trace: %s", err, stacktrace)
				statusCode := http.StatusInternalServerError

				// retrieve current otel span
				// and populate details
				span := trace.SpanFromContext(c.Request.Context())
				if span != nil {
					span.SetAttributes(
						attribute.String("error", "true"),
						attribute.String("panic.error", err.Error()),
						attribute.String("panic.stacktrace", stacktrace),
						attribute.Int("http.status_code", statusCode),
					)

					span.SetStatus(codes.Error, err.Error())
				}

				c.JSON(statusCode, gin.H{
					"error": "Internal Server Error",
				})

				c.Abort()
			}
		}()

		c.Next()
	}
}
