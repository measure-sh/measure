package pipeline

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/googleapi"
)

// driveTailSize is how many bytes at the end of the archive we eagerly
// buffer in memory. Sevenzip reads the end-of-central-directory record
// from the tail and parses the central directory from there; once both
// fit in this buffer, all metadata reads are served from RAM with zero
// further HTTP requests.
//
// Declared as a var (not const) so tests can shrink it.
var driveTailSize int64 = 64 << 20 // 64 MiB

const (
	// driveOpenRetries bounds how many times we retry opening the body
	// stream or fetching the tail on transient network/5xx errors.
	driveOpenRetries = 3

	// driveOpenBackoff is the first inter-attempt sleep on retry.
	// Subsequent attempts quadruple it (200ms → 800ms → 3.2s).
	driveOpenBackoff = 200 * time.Millisecond
)

// driveReaderAt provides random-access reads against a Google Drive file
// using only TWO long-lived HTTP requests per archive — a tail fetch and
// a single streaming body GET — to avoid Google's Risk Engine flagging
// the IP for automated traffic. (Many small range requests against the
// same file ID get the IP served a "We're sorry... automated queries"
// HTML 403 within a few minutes, regardless of API quota usage.)
//
// Layout:
//
//   - bytes [0, tailOff) are served from the streaming body response,
//     advanced forward only. A backward seek re-opens the stream from
//     the new offset (rare in practice — sevenzip extracts entries in
//     archive offset order).
//   - bytes [tailOff, size) are served from the in-memory tail buffer.
//
// Concurrent ReadAt calls are serialized via the mutex; sevenzip
// extraction is single-threaded in our caller anyway.
type driveReaderAt struct {
	client *drive.Service
	fileID string
	size   int64

	tail    []byte
	tailOff int64 // size - len(tail)

	mu      sync.Mutex
	body    io.ReadCloser // streaming GET; nil after Close
	bodyPos int64         // next byte the body stream will yield
}

// fetchDriveFileSize retrieves the size of a Drive file via a single
// metadata request.
func fetchDriveFileSize(ctx context.Context, client *drive.Service, fileID string) (int64, error) {
	f, err := client.Files.Get(fileID).Context(ctx).Fields("size").SupportsAllDrives(true).Do()
	if err != nil {
		return 0, fmt.Errorf("drive get size: %w", err)
	}
	return f.Size, nil
}

// newDriveReaderAt constructs a reader ready to serve sevenzip:
// it eagerly fetches the tail (so CD parsing is RAM-only) and opens a
// single streaming body request positioned at offset 0.
func newDriveReaderAt(ctx context.Context, client *drive.Service, fileID string) (*driveReaderAt, error) {
	size, err := fetchDriveFileSize(ctx, client, fileID)
	if err != nil {
		return nil, err
	}
	if size <= 0 {
		return nil, fmt.Errorf("drive file %s has unknown or zero size", fileID)
	}

	tail, tailOff, err := fetchTail(ctx, client, fileID, size)
	if err != nil {
		return nil, fmt.Errorf("fetch tail: %w", err)
	}

	r := &driveReaderAt{
		client:  client,
		fileID:  fileID,
		size:    size,
		tail:    tail,
		tailOff: tailOff,
	}

	// Don't open the body stream up front — sevenzip will read the tail
	// (CD) first, and only then start touching body bytes. Lazy opening
	// avoids a wasted HTTP request when the archive is small enough to
	// be fully covered by the tail.
	return r, nil
}

// fetchTail downloads the trailing tailSize bytes (or the whole file if
// it's smaller). Returned tail covers offsets [tailOff, size).
func fetchTail(ctx context.Context, client *drive.Service, fileID string, size int64) (tail []byte, tailOff int64, err error) {
	wantSize := driveTailSize
	if wantSize > size {
		wantSize = size
	}
	tailOff = size - wantSize
	rangeHeader := fmt.Sprintf("bytes=%d-%d", tailOff, size-1)

	tail, err = withRetries(func() ([]byte, error) {
		resp, err := openDriveRange(ctx, client, fileID, rangeHeader)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		return io.ReadAll(resp.Body)
	})
	if err != nil {
		return nil, 0, err
	}
	if int64(len(tail)) != wantSize {
		return nil, 0, fmt.Errorf("drive returned %d bytes, expected %d", len(tail), wantSize)
	}
	return tail, tailOff, nil
}

// Size returns the total number of bytes in the underlying Drive file.
func (r *driveReaderAt) Size() int64 { return r.size }

// Close releases the streaming body response if open. Safe to call
// multiple times. Should be called when the caller is done with the
// reader (e.g. via defer in the fetcher).
func (r *driveReaderAt) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.closeBodyLocked()
}

func (r *driveReaderAt) closeBodyLocked() error {
	if r.body == nil {
		return nil
	}
	err := r.body.Close()
	r.body = nil
	return err
}

// ReadAt implements io.ReaderAt by stitching together bytes from the
// in-memory tail buffer and the streaming body. Reads that straddle the
// body/tail boundary work transparently.
func (r *driveReaderAt) ReadAt(p []byte, off int64) (n int, err error) {
	if off < 0 {
		return 0, fmt.Errorf("driveReaderAt: negative offset %d", off)
	}
	if off >= r.size {
		return 0, io.EOF
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	end := off + int64(len(p))
	if end > r.size {
		end = r.size
	}

	// Body region: [off, min(end, tailOff))
	if off < r.tailOff {
		bodyEnd := end
		if bodyEnd > r.tailOff {
			bodyEnd = r.tailOff
		}
		got, berr := r.readBodyLocked(p[:bodyEnd-off], off)
		n += got
		off += int64(got)
		if berr != nil {
			return n, berr
		}
	}

	// Tail region: [max(off, tailOff), end)
	if off >= r.tailOff && off < end {
		srcStart := off - r.tailOff
		got := copy(p[n:end-off+int64(n)], r.tail[srcStart:])
		n += got
		off += int64(got)
	}

	if off+int64(0) >= r.size && n < len(p) {
		return n, io.EOF
	}
	return n, nil
}

// readBodyLocked reads exactly len(p) bytes from the body region into p,
// advancing the body stream forward (re-opening on backward seek).
// Caller holds r.mu.
func (r *driveReaderAt) readBodyLocked(p []byte, off int64) (n int, err error) {
	if r.body == nil {
		if err := r.openBodyLocked(off); err != nil {
			return 0, err
		}
	}

	if off < r.bodyPos {
		// Backward seek — re-open the body stream from off.
		_ = r.closeBodyLocked()
		if err := r.openBodyLocked(off); err != nil {
			return 0, err
		}
	}

	if off > r.bodyPos {
		// Forward skip.
		skip := off - r.bodyPos
		if _, err := io.CopyN(io.Discard, r.body, skip); err != nil {
			return 0, fmt.Errorf("drive body skip: %w", err)
		}
		r.bodyPos = off
	}

	n, err = io.ReadFull(r.body, p)
	r.bodyPos += int64(n)
	if err == io.ErrUnexpectedEOF {
		err = io.EOF
	}
	return n, err
}

// openBodyLocked starts a fresh streaming body GET starting at offset
// `from`. Caller holds r.mu and has already closed any prior body stream.
func (r *driveReaderAt) openBodyLocked(from int64) error {
	rangeHeader := fmt.Sprintf("bytes=%d-%d", from, r.tailOff-1)
	resp, err := withRetries(func() (*http.Response, error) {
		return openDriveRange(context.Background(), r.client, r.fileID, rangeHeader)
	})
	if err != nil {
		return fmt.Errorf("open body stream from %d: %w", from, err)
	}
	r.body = resp.Body
	r.bodyPos = from
	return nil
}

// openDriveRange issues a single Drive media download for the given
// inclusive byte range. AcknowledgeAbuse(true) is required because iOS
// archives exceed Drive's "may be malicious" threshold and would
// otherwise be rejected with a 403 + HTML scan-warning page.
func openDriveRange(ctx context.Context, client *drive.Service, fileID, rangeHeader string) (*http.Response, error) {
	call := client.Files.Get(fileID).Context(ctx).AcknowledgeAbuse(true).SupportsAllDrives(true)
	call.Header().Set("Range", rangeHeader)
	resp, err := call.Download()
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusPartialContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	return resp, nil
}

// withRetries runs fn up to driveOpenRetries times, sleeping with
// exponential backoff between attempts on transient errors. Generic over
// the result type so callers don't need to box.
func withRetries[T any](fn func() (T, error)) (result T, err error) {
	backoff := driveOpenBackoff
	for attempt := 0; attempt < driveOpenRetries; attempt++ {
		result, err = fn()
		if err == nil {
			return result, nil
		}
		if !isTransientDriveError(err) {
			return result, err
		}
		if attempt < driveOpenRetries-1 {
			time.Sleep(backoff)
			backoff *= 4
		}
	}
	return result, fmt.Errorf("%w (after %d attempts)", err, driveOpenRetries)
}

// isTransientDriveError reports whether err is worth retrying. Network
// errors and 5xx HTTP responses qualify; 4xx errors (auth, bad ranges,
// Risk Engine 403s) do not.
func isTransientDriveError(err error) bool {
	if err == nil {
		return false
	}
	var gErr *googleapi.Error
	if errors.As(err, &gErr) {
		return gErr.Code >= 500 && gErr.Code <= 599
	}
	return true
}
