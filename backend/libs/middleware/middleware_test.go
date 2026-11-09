package middleware

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// newBodyWriter wraps a test recorder in a bodyWriter
// backed by the given gin context.
func newBodyWriter(c *gin.Context) *bodyWriter {
	return &bodyWriter{
		body:           bytes.NewBufferString(""),
		ResponseWriter: c.Writer,
	}
}

// a 2xx response must not be captured
func TestBodyWriterSkipsSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	bw := newBodyWriter(c)
	c.Writer.WriteHeader(http.StatusOK)

	// stream body across multiple writes
	bw.Write([]byte("chunk-one"))
	bw.Write([]byte("chunk-two"))

	if bw.body.Len() != 0 {
		t.Fatalf("expected empty buffer for 2xx, got %d bytes", bw.body.Len())
	}
}

// a 5xx JSON body must be captured in full
func TestBodyWriterCapturesError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	bw := newBodyWriter(c)
	c.Writer.WriteHeader(http.StatusInternalServerError)

	body := `{"error":"boom"}`
	bw.Write([]byte(body))

	if got := bw.body.String(); got != body {
		t.Fatalf("expected captured body %q, got %q", body, got)
	}
}

// an oversized 5xx body must be truncated to maxErrBodyBytes
// while the client still receives every byte
func TestBodyWriterTruncatesLargeError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	bw := newBodyWriter(c)
	c.Writer.WriteHeader(http.StatusInternalServerError)

	body := strings.Repeat("x", maxErrBodyBytes+4096)
	bw.Write([]byte(body))

	if bw.body.Len() != maxErrBodyBytes {
		t.Fatalf("expected captured buffer truncated to %d, got %d", maxErrBodyBytes, bw.body.Len())
	}
	if rec.Body.Len() != len(body) {
		t.Fatalf("expected client to receive %d bytes, got %d", len(body), rec.Body.Len())
	}
}

// CaptureErrorBody must serve traffic end to end
func TestCaptureErrorBodyRouter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CaptureErrorBody())
	r.GET("/ok", func(c *gin.Context) {
		c.String(http.StatusOK, "fine")
	})
	r.GET("/fail", func(c *gin.Context) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "boom"})
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/fail", nil)
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "boom") {
		t.Fatalf("expected client body to contain error, got %q", rec.Body.String())
	}
}

// decompressRouter echoes the request body after DecompressGzip.
func decompressRouter(maxSize int64) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.PUT("/events", DecompressGzip(maxSize), func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.String(http.StatusBadRequest, err.Error())
			return
		}
		c.String(http.StatusOK, string(body))
	})
	return r
}

func gzipped(t *testing.T, s string) *bytes.Buffer {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write([]byte(s)); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return &buf
}

func TestDecompressGzipDecodesBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/events", gzipped(t, `{"events":[]}`))
	req.Header.Set("Content-Encoding", "gzip")
	w := httptest.NewRecorder()
	decompressRouter(1<<20).ServeHTTP(w, req)

	if w.Code != http.StatusOK || w.Body.String() != `{"events":[]}` {
		t.Fatalf("got %d %q", w.Code, w.Body.String())
	}
}

func TestDecompressGzipPassesUncompressedBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/events", strings.NewReader(`{"events":[]}`))
	w := httptest.NewRecorder()
	decompressRouter(1<<20).ServeHTTP(w, req)

	if w.Code != http.StatusOK || w.Body.String() != `{"events":[]}` {
		t.Fatalf("got %d %q", w.Code, w.Body.String())
	}
}

func TestDecompressGzipStopsAtMaxSize(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/events", gzipped(t, strings.Repeat("a", 1024)))
	req.Header.Set("Content-Encoding", "gzip")
	w := httptest.NewRecorder()
	decompressRouter(100).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "request body too large") {
		t.Fatalf("got %d %q", w.Code, w.Body.String())
	}
}

func TestDecompressGzipReadsOnlyFirstMember(t *testing.T) {
	body := gzipped(t, `{"events":[]}`)
	body.Write(gzipped(t, `{"extra":true}`).Bytes())
	req := httptest.NewRequest(http.MethodPut, "/events", body)
	req.Header.Set("Content-Encoding", "gzip")
	w := httptest.NewRecorder()
	decompressRouter(1<<20).ServeHTTP(w, req)

	if w.Code != http.StatusOK || w.Body.String() != `{"events":[]}` {
		t.Fatalf("got %d %q", w.Code, w.Body.String())
	}
}
