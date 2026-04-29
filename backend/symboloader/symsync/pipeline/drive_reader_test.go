package pipeline

import (
	"bytes"
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// fakeDriveServer returns an httptest server that responds to Drive's
// `Files.Get` and `Files.Get?alt=media` for a single hard-coded fileID
// holding payload. statusOverrides[n] = HTTP status to return on the
// nth media request (index from 0); a value of 0 means "serve normally".
type fakeDriveServer struct {
	srv             *httptest.Server
	fileID          string
	payload         []byte
	mediaCallCount  atomic.Int64
	statusOverrides []int
}

func newFakeDriveServer(t *testing.T, payload []byte) *fakeDriveServer {
	t.Helper()
	f := &fakeDriveServer{fileID: "test-file-id", payload: payload}
	mux := http.NewServeMux()
	mux.HandleFunc(fmt.Sprintf("/files/%s", f.fileID), f.handle)
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeDriveServer) handle(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("alt") != "media" {
		fmt.Fprintf(w, `{"id":%q,"size":"%d"}`, f.fileID, len(f.payload))
		return
	}

	idx := int(f.mediaCallCount.Add(1)) - 1
	if idx < len(f.statusOverrides) && f.statusOverrides[idx] != 0 {
		http.Error(w, "transient", f.statusOverrides[idx])
		return
	}

	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		w.Write(f.payload)
		return
	}

	var start, end int64
	if _, err := fmt.Sscanf(rangeHeader, "bytes=%d-%d", &start, &end); err != nil {
		http.Error(w, "bad range", http.StatusBadRequest)
		return
	}
	if end >= int64(len(f.payload)) {
		end = int64(len(f.payload)) - 1
	}
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, len(f.payload)))
	w.WriteHeader(http.StatusPartialContent)
	w.Write(f.payload[start : end+1])
}

func (f *fakeDriveServer) client(t *testing.T) *drive.Service {
	t.Helper()
	ctx := context.Background()
	svc, err := drive.NewService(ctx,
		option.WithEndpoint(f.srv.URL),
		option.WithHTTPClient(http.DefaultClient),
	)
	if err != nil {
		t.Fatalf("drive client: %v", err)
	}
	return svc
}

func randomBytes(n int) []byte {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	return buf
}

// shrinkTailSize swaps in a small driveTailSize for the duration of a
// test so the body/tail boundary can be exercised cheaply.
func shrinkTailSize(t *testing.T, size int64) {
	t.Helper()
	prev := driveTailSize
	driveTailSize = size
	t.Cleanup(func() { driveTailSize = prev })
}

func TestDriveReaderAtSequentialRead(t *testing.T) {
	shrinkTailSize(t, 1024)
	payload := randomBytes(50_000) // body region is most of it
	srv := newFakeDriveServer(t, payload)
	r, err := newDriveReaderAt(context.Background(), srv.client(t), srv.fileID, false)
	if err != nil {
		t.Fatalf("newDriveReaderAt: %v", err)
	}
	defer r.Close()

	got := make([]byte, len(payload))
	if _, err := io.ReadFull(io.NewSectionReader(r, 0, r.Size()), got); err != nil {
		t.Fatalf("ReadFull: %v", err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatalf("payload mismatch")
	}
}

func TestDriveReaderAtTailServedFromBuffer(t *testing.T) {
	shrinkTailSize(t, 1024)
	payload := randomBytes(10_000)
	srv := newFakeDriveServer(t, payload)
	r, err := newDriveReaderAt(context.Background(), srv.client(t), srv.fileID, false)
	if err != nil {
		t.Fatalf("newDriveReaderAt: %v", err)
	}
	defer r.Close()

	// At this point one media call has happened (tail fetch). Reading
	// purely from the tail must NOT issue any further HTTP requests.
	mediaAfterTail := srv.mediaCallCount.Load()

	tailStart := int64(len(payload)) - 1024
	buf := make([]byte, 256)
	if _, err := r.ReadAt(buf, tailStart+100); err != nil {
		t.Fatalf("ReadAt in tail: %v", err)
	}
	if !bytes.Equal(buf, payload[tailStart+100:tailStart+100+256]) {
		t.Errorf("tail payload mismatch")
	}
	if got := srv.mediaCallCount.Load(); got != mediaAfterTail {
		t.Errorf("expected no extra media calls for tail-only read, got %d new",
			got-mediaAfterTail)
	}
}

func TestDriveReaderAtBodyToTailStraddle(t *testing.T) {
	shrinkTailSize(t, 1024)
	payload := randomBytes(10_000)
	srv := newFakeDriveServer(t, payload)
	r, err := newDriveReaderAt(context.Background(), srv.client(t), srv.fileID, false)
	if err != nil {
		t.Fatalf("newDriveReaderAt: %v", err)
	}
	defer r.Close()

	tailOff := int64(len(payload)) - 1024
	// Read 200 bytes straddling the boundary: 100 from body + 100 from tail.
	buf := make([]byte, 200)
	if _, err := r.ReadAt(buf, tailOff-100); err != nil {
		t.Fatalf("ReadAt straddle: %v", err)
	}
	if !bytes.Equal(buf, payload[tailOff-100:tailOff+100]) {
		t.Errorf("straddle payload mismatch")
	}
}

func TestDriveReaderAtBackwardSeekReopens(t *testing.T) {
	shrinkTailSize(t, 1024)
	payload := randomBytes(10_000)
	srv := newFakeDriveServer(t, payload)
	r, err := newDriveReaderAt(context.Background(), srv.client(t), srv.fileID, false)
	if err != nil {
		t.Fatalf("newDriveReaderAt: %v", err)
	}
	defer r.Close()

	mediaAfterTail := srv.mediaCallCount.Load()

	// First body read at offset 5000 — opens body stream.
	buf := make([]byte, 100)
	if _, err := r.ReadAt(buf, 5000); err != nil {
		t.Fatalf("first body read: %v", err)
	}

	// Backward seek to offset 1000 — should re-open body stream.
	if _, err := r.ReadAt(buf, 1000); err != nil {
		t.Fatalf("backward body read: %v", err)
	}
	if !bytes.Equal(buf, payload[1000:1100]) {
		t.Errorf("backward read payload mismatch")
	}

	// Expect at least 2 body opens after the initial tail fetch.
	if got := srv.mediaCallCount.Load() - mediaAfterTail; got < 2 {
		t.Errorf("expected ≥2 body opens after tail, got %d", got)
	}
}

func TestDriveReaderAtRetriesOn5xx(t *testing.T) {
	shrinkTailSize(t, 1024)
	payload := randomBytes(10_000)
	srv := newFakeDriveServer(t, payload)
	srv.statusOverrides = []int{http.StatusBadGateway, http.StatusServiceUnavailable}

	r, err := newDriveReaderAt(context.Background(), srv.client(t), srv.fileID, false)
	if err != nil {
		t.Fatalf("newDriveReaderAt: %v", err)
	}
	defer r.Close()

	// Tail was retried twice and succeeded on the third attempt.
	tailOff := int64(len(payload)) - 1024
	buf := make([]byte, 100)
	if _, err := r.ReadAt(buf, tailOff); err != nil {
		t.Fatalf("ReadAt: %v", err)
	}
	if !bytes.Equal(buf, payload[tailOff:tailOff+100]) {
		t.Errorf("payload mismatch after retry")
	}
}

func TestDriveReaderAtFailsOn4xx(t *testing.T) {
	shrinkTailSize(t, 1024)
	srv := newFakeDriveServer(t, randomBytes(10_000))
	srv.statusOverrides = []int{http.StatusForbidden}

	_, err := newDriveReaderAt(context.Background(), srv.client(t), srv.fileID, false)
	if err == nil || !strings.Contains(err.Error(), "403") {
		t.Errorf("expected 403 propagated, got %v", err)
	}
}

func TestDriveReaderAtSmallFileAllInTail(t *testing.T) {
	shrinkTailSize(t, 1024)
	payload := []byte("hello world")
	srv := newFakeDriveServer(t, payload)
	r, err := newDriveReaderAt(context.Background(), srv.client(t), srv.fileID, false)
	if err != nil {
		t.Fatalf("newDriveReaderAt: %v", err)
	}
	defer r.Close()

	buf := make([]byte, len(payload))
	n, err := r.ReadAt(buf, 0)
	if err != nil && err != io.EOF {
		t.Fatalf("ReadAt: %v", err)
	}
	if n != len(payload) {
		t.Errorf("expected n=%d, got %d", len(payload), n)
	}
	if !bytes.Equal(buf[:n], payload) {
		t.Errorf("payload mismatch for small file")
	}
}
