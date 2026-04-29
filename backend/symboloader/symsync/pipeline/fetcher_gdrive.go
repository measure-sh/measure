package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/bodgit/sevenzip"
	"golang.org/x/sync/errgroup"
	"google.golang.org/api/drive/v3"

	"symboloader/symbol"
)

const (
	// uploadRetries bounds how many attempts are made to upload one DIF
	// before giving up. Because the payload is already in memory, retries
	// are cheap (no re-decompression).
	uploadRetries = 3

	// uploadRetryBackoff is the first inter-attempt sleep on upload retry.
	uploadRetryBackoff = 500 * time.Millisecond
)

// GoogleDriveFetcher streams .7z archives from Google Drive (random-access
// via the driveReaderAt) and uploads the contained DIFs to the configured
// object store without ever materializing either the archive or the
// individual files in memory.
type GoogleDriveFetcher struct {
	client      *drive.Service
	store       ObjectStore
	concurrency int // archives processed in parallel
	workers     int // upload workers per in-flight archive
	force       bool
	isPublic    bool
	onStart     func(count int)
	onProgress  func(FetchProgressUpdate)

	// cloner, if set, owns the destination Drive folder. Successful fetches
	// invoke cloner.DeleteCopy(target.FileID) so the SA-owned copy is freed
	// as soon as the manifest entry is persisted, capping in-flight Drive
	// storage at concurrency × archive size.
	cloner *DriveCloner

	// manifest is the in-memory manifest mutated by Fetch as archives complete.
	// Set via SetManifest before Fetch.
	manifest *Manifest
}

// SetManifest registers the in-memory manifest the fetcher will mutate as
// archives complete. Must be called before Fetch.
func (f *GoogleDriveFetcher) SetManifest(m *Manifest) { f.manifest = m }

// SetStartCallback registers a function called with the actual number of archives
// to process, after manifest filtering, before any work begins.
func (f *GoogleDriveFetcher) SetStartCallback(fn func(int)) {
	f.onStart = fn
}

// PendingCount returns how many actions in plan would actually be processed
// (i.e. are not yet recorded in the manifest). Used to show accurate counts
// before the fetch stage begins.
func (f *GoogleDriveFetcher) PendingCount(plan *Plan) (pending, total int) {
	total = plan.DownloadCount()
	if f.force || f.manifest == nil {
		return total, total
	}
	for _, a := range plan.Actions {
		info, ok := ParseArchiveFilename(a.Target.FileName)
		if ok && f.manifest.IsCompleted(info.Version, info.Build, info.Arch, a.Target.Checksum) {
			continue
		}
		pending++
	}
	return pending, total
}

// SetProgressCallback registers a function called at each phase change for in-flight archives.
func (f *GoogleDriveFetcher) SetProgressCallback(fn func(FetchProgressUpdate)) {
	f.onProgress = fn
}

// NewGoogleDriveFetcher creates a fetcher around a pre-built Drive service.
// The caller chooses the credential strategy (API key for the no-flags
// path, ADC + Drive scope for the cloned-mirror path). concurrency controls
// how many archives are processed in parallel; workers controls how many
// upload goroutines run within each archive. force=true reprocesses
// archives already recorded in the manifest. cloner is optional — when
// non-nil, the fetcher deletes each target's copy after persisting the
// manifest entry.
func NewGoogleDriveFetcher(svc *drive.Service, concurrency, workers int, force bool, store ObjectStore, cloner *DriveCloner, isPublic bool) *GoogleDriveFetcher {
	if concurrency < 1 {
		concurrency = 1
	}
	if workers < 1 {
		workers = 1
	}
	return &GoogleDriveFetcher{
		client:      svc,
		store:       store,
		concurrency: concurrency,
		workers:     workers,
		force:       force,
		cloner:      cloner,
		isPublic:    isPublic,
	}
}

// Fetch streams every pending archive from Drive, uploads its DIFs, and
// writes one manifest archive index file per completed archive. The
// in-memory manifest set via SetManifest is mutated to reflect persisted
// state. Returns the list of archives that were actually added in this call.
func (f *GoogleDriveFetcher) Fetch(ctx context.Context, plan *Plan, progress chan<- FetchResult) (added []ArchiveRef, err error) {
	if f.manifest == nil {
		return nil, errors.New("fetcher: SetManifest must be called before Fetch")
	}

	guard := &upsertGuard{m: f.manifest}

	var toProcess []Action
	for _, a := range plan.Actions {
		if !f.force {
			info, ok := ParseArchiveFilename(a.Target.FileName)
			if ok && f.manifest.IsCompleted(info.Version, info.Build, info.Arch, a.Target.Checksum) {
				slog.Info("fetcher: skipping completed archive",
					"filename", a.Target.FileName,
					"file_id", a.Target.FileID,
				)
				continue
			}
		}
		toProcess = append(toProcess, a)
	}

	slog.Info("fetcher: starting",
		"total", len(plan.Actions),
		"skipped", len(plan.Actions)-len(toProcess),
		"to_fetch", len(toProcess),
	)

	if len(toProcess) == 0 {
		slog.Info("fetcher: nothing to do, all archives already completed")
		if f.onStart != nil {
			f.onStart(0)
		}
		return nil, nil
	}
	if f.onStart != nil {
		f.onStart(len(toProcess))
	}

	workCh := make(chan Action, len(toProcess))
	for _, a := range toProcess {
		workCh <- a
	}
	close(workCh)

	var addedMu sync.Mutex
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 1)
	var wg sync.WaitGroup

	for range f.concurrency {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for action := range workCh {
				if ctx.Err() != nil {
					return
				}

				result := f.processAction(ctx, action)

				if result.Err != nil {
					select {
					case errCh <- result.Err:
					default:
					}
					cancel()
					progress <- result
					return
				}

				info, _ := ParseArchiveFilename(action.Target.FileName)
				entry := ArchiveEntry{
					FileID:       action.Target.FileID,
					Filename:     action.Target.FileName,
					Version:      info.Version,
					Build:        info.Build,
					Arch:         info.Arch,
					Checksum:     action.Target.Checksum,
					DebugIDs:     result.DebugIDs,
					DIFsUploaded: result.DIFsUploaded,
					CompletedAt:  time.Now().UTC(),
				}
				if saveErr := SaveArchiveEntry(ctx, f.store, entry); saveErr != nil {
					select {
					case errCh <- fmt.Errorf("save entry %s: %w", entry.VBAC(), saveErr):
					default:
					}
					cancel()
					result.Err = saveErr
					progress <- result
					return
				}
				guard.upsert(entry)

				addedMu.Lock()
				added = append(added, entry.Ref())
				addedMu.Unlock()

				// Delete the SA-owned copy now that the manifest entry
				// is durable. Failures here are logged but non-fatal —
				// the next --clone run will wipe leftover copies.
				if f.cloner != nil {
					if delErr := f.cloner.DeleteCopy(ctx, action.Target.FileID); delErr != nil {
						slog.Warn("fetcher: failed to delete drive copy",
							"file_id", action.Target.FileID,
							"filename", action.Target.FileName,
							"error", delErr,
						)
					}
				}

				progress <- result
			}
		}()
	}

	wg.Wait()

	select {
	case fetchErr := <-errCh:
		return added, fetchErr
	default:
	}

	return added, nil
}

// processAction streams one .7z archive directly from Drive and uploads its
// DIFs without ever materializing the archive on a local filesystem.
func (f *GoogleDriveFetcher) processAction(ctx context.Context, action Action) FetchResult {
	target := action.Target
	slog.Info("fetcher: streaming archive",
		"filename", target.FileName,
		"file_id", target.FileID,
		"size_bytes", target.Size,
	)

	if f.onProgress != nil {
		f.onProgress(FetchProgressUpdate{FileName: target.FileName, Phase: "fetching"})
	}

	readerAt, err := newDriveReaderAt(ctx, f.client, target.FileID, f.isPublic)
	if err != nil {
		return FetchResult{Target: target, Err: fmt.Errorf("open drive reader %s: %w", target.FileName, err)}
	}
	defer readerAt.Close()

	szReader, err := sevenzip.NewReader(readerAt, readerAt.Size())
	if err != nil {
		return FetchResult{Target: target, Err: fmt.Errorf("open 7z %s: %w", target.FileName, err)}
	}

	if f.onProgress != nil {
		f.onProgress(FetchProgressUpdate{FileName: target.FileName, Phase: "processing"})
	}

	arch := "arm64"
	if len(target.Symbol.Arch) > 0 {
		arch = target.Symbol.Arch[0]
	}

	var difCb func(int, int64)
	if f.onProgress != nil {
		difCb = func(n int, b int64) {
			f.onProgress(FetchProgressUpdate{FileName: target.FileName, Phase: "processing", DIFsUploaded: n, BytesUploaded: b})
		}
	}

	debugIDs, bytesUploaded, err := processArchive(ctx, szReader, arch, f.store, f.workers, difCb)
	if err != nil {
		return FetchResult{Target: target, Err: fmt.Errorf("process %s: %w", target.FileName, err)}
	}

	slog.Info("fetcher: archive complete",
		"filename", target.FileName,
		"difs_uploaded", len(debugIDs),
	)

	return FetchResult{
		Target:        target,
		DIFsUploaded:  len(debugIDs),
		DebugIDs:      debugIDs,
		BytesFetched:  readerAt.Size(),
		BytesUploaded: bytesUploaded,
	}
}

// entryJob is what the producer hands to upload workers. The producer
// has already done the (single-threaded) sevenzip decompression and
// materialized the entry's bytes — workers only run network uploads.
type entryJob struct {
	name string
	arch string
	data []byte
}

// processArchive decompresses 7z entries sequentially in the producer
// goroutine (sevenzip's folder-reader pool is not safe for concurrent
// f.Open()) and dispatches each materialized entry to one of `workers`
// upload goroutines. The job channel is unbuffered, so at most
// `workers + 1` entry buffers are alive at any moment — a hard cap on
// per-archive memory.
//
// Memory profile per archive:
//   - sevenzip decompression dictionary (~64-256 MiB, library-internal)
//   - drive page cache (drivePageSize × drivePageCacheCount, default 64 MiB)
//   - up to (workers + 1) × max-Mach-O-size buffers in flight
//
// On a 4-CPU runtime with workers=4 and a 200 MiB UIKit-class binary,
// peak ≈ 1 GiB per archive. With --concurrency=4 that's ~4 GiB total —
// orders of magnitude below the pre-streaming design.
func processArchive(ctx context.Context, szReader *sevenzip.Reader, arch string, store ObjectStore, workers int, onDif func(count int, bytesUploaded int64)) (debugIDs []string, bytesUploaded int64, err error) {
	if workers < 1 {
		workers = 1
	}

	jobCh := make(chan entryJob)

	g, gctx := errgroup.WithContext(ctx)
	var uploadCount atomic.Int64
	var uploadBytes atomic.Int64

	var idsMu sync.Mutex

	for range workers {
		g.Go(func() error {
			for job := range jobCh {
				if gctx.Err() != nil {
					return gctx.Err()
				}
				debugID, bytesUp, err := uploadEntry(gctx, job, store)
				if err != nil {
					return err
				}
				if debugID == "" {
					continue
				}
				idsMu.Lock()
				debugIDs = append(debugIDs, debugID)
				idsMu.Unlock()
				n := int(uploadCount.Add(1))
				b := uploadBytes.Add(bytesUp)
				if onDif != nil {
					onDif(n, b)
				}
			}
			return nil
		})
	}

	g.Go(func() error {
		defer close(jobCh)
		for _, f := range szReader.File {
			if f.FileInfo().IsDir() {
				continue
			}
			if strings.HasPrefix(filepath.Base(f.Name), ".") {
				continue
			}
			data, err := readEntry(f)
			if err != nil {
				return fmt.Errorf("read %s: %w", f.Name, err)
			}
			job := entryJob{name: f.Name, arch: arch, data: data}
			select {
			case jobCh <- job:
			case <-gctx.Done():
				return gctx.Err()
			}
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, 0, err
	}
	return debugIDs, uploadBytes.Load(), nil
}

// readEntry decompresses one 7z entry into a fresh byte slice. Called
// only from the single producer goroutine — sevenzip's folder pool is
// not safe for concurrent f.Open().
func readEntry(f *sevenzip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

// uploadEntry verifies a buffered entry as Mach-O, extracts its UUID,
// and uploads the debuginfo + meta objects. Returns the debug ID — empty
// for non-Mach-O entries or entries without a UUID.
func uploadEntry(ctx context.Context, job entryJob, store ObjectStore) (debugID string, bytesUploaded int64, err error) {
	if err := symbol.VerifyMachO(bytes.NewReader(job.data)); err != nil {
		// Not a Mach-O; nothing to upload.
		return "", 0, nil
	}

	debugID, err = symbol.GetMachOUUID(bytes.NewReader(job.data))
	if err != nil {
		return "", 0, fmt.Errorf("get UUID from %s: %w", job.name, err)
	}
	if debugID == "" {
		slog.Warn("fetcher: skipping file with no UUID", "file", job.name)
		return "", 0, nil
	}

	baseName := filepath.Base(job.name)
	type fileMeta struct {
		Name       string `json:"name"`
		Arch       string `json:"arch"`
		FileFormat string `json:"file_format"`
	}
	metaJSON, err := json.Marshal(fileMeta{Name: baseName, Arch: job.arch, FileFormat: "macho"})
	if err != nil {
		return "", 0, fmt.Errorf("marshal meta for %s: %w", job.name, err)
	}

	base := symbol.BuildUnifiedLayout(debugID)

	if err := putWithRetry(ctx, store, base+"/debuginfo", job.data); err != nil {
		return "", 0, fmt.Errorf("upload debuginfo for %s: %w", job.name, err)
	}
	if err := store.Put(ctx, base+"/meta", bytes.NewReader(metaJSON), int64(len(metaJSON)), ""); err != nil {
		return "", 0, fmt.Errorf("upload meta for %s: %w", job.name, err)
	}

	return debugID, int64(len(job.data)) + int64(len(metaJSON)), nil
}

// putWithRetry uploads a buffered payload, retrying on transient errors.
// Because the source is already in memory we can re-create the reader
// cheaply on each attempt.
func putWithRetry(ctx context.Context, store ObjectStore, key string, data []byte) error {
	backoff := uploadRetryBackoff
	var err error
	for attempt := 0; attempt < uploadRetries; attempt++ {
		err = store.Put(ctx, key, bytes.NewReader(data), int64(len(data)), "")
		if err == nil {
			return nil
		}
		if attempt < uploadRetries-1 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
		}
	}
	return err
}
