package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/bodgit/sevenzip"
	"golang.org/x/oauth2/google"
	"golang.org/x/sync/errgroup"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"

	"symboloader/symbol"
)

// fetchProgress tracks the overall state of a Fetch call for the Reporter.
type fetchProgress struct {
	total      int
	completed  int
	inProgress int
	mu         sync.Mutex
}

func (p *fetchProgress) begin() {
	p.mu.Lock()
	p.inProgress++
	p.mu.Unlock()
}

func (p *fetchProgress) done() {
	p.mu.Lock()
	p.inProgress--
	p.completed++
	p.mu.Unlock()
}

// archiveFile holds the raw bytes of a single file extracted from a .7z archive.
type archiveFile struct {
	name string
	data []byte
	arch string
}

// GoogleDriveFetcher implements Fetcher by downloading .7z archives from
// Google Drive and uploading DIFs to the configured object store.
type GoogleDriveFetcher struct {
	client      *drive.Service
	store       ObjectStore
	concurrency int
	force       bool // when true, reprocess archives already in the manifest
	onStart     func(count int)
	onProgress  func(FetchProgressUpdate)
}

// SetStartCallback registers a function called with the actual number of archives
// to process, after manifest filtering, before any work begins.
func (f *GoogleDriveFetcher) SetStartCallback(fn func(int)) {
	f.onStart = fn
}

// PendingCount returns how many actions in plan would actually be processed
// (i.e. are not yet recorded in the manifest). Used to show accurate counts
// before the fetch stage begins.
func (f *GoogleDriveFetcher) PendingCount(ctx context.Context, plan *Plan) (pending, total int, err error) {
	total = plan.DownloadCount()
	if f.force {
		return total, total, nil
	}
	manifest, err := loadManifest(ctx, f.store)
	if err != nil {
		return 0, 0, fmt.Errorf("load manifest: %w", err)
	}
	completed := manifest.completedVBAs()
	for _, a := range plan.Actions {
		info, ok := ParseArchiveFilename(a.Target.FileName)
		if ok && completed[vbaKey(info.Version, info.Build, info.Arch)] {
			continue
		}
		pending++
	}
	return pending, total, nil
}

// SetProgressCallback registers a function called at each phase change for in-flight archives.
func (f *GoogleDriveFetcher) SetProgressCallback(fn func(FetchProgressUpdate)) {
	f.onProgress = fn
}

// NewGoogleDriveFetcher creates a Fetcher using service account credentials
// for Drive access. concurrency controls how many archives are processed in parallel.
// When force is true, already-completed archives are reprocessed instead of skipped.
func NewGoogleDriveFetcher(creds *google.Credentials, concurrency int, force bool, store ObjectStore) (*GoogleDriveFetcher, error) {
	svc, err := drive.NewService(context.Background(), option.WithCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("drive service: %w", err)
	}
	return &GoogleDriveFetcher{client: svc, store: store, concurrency: concurrency, force: force}, nil
}

// Fetch downloads, extracts, and uploads DIFs for all pending actions in the plan.
// Results are sent to progress as each archive completes or fails.
// On any upload or processing error the operation fails fast; re-running is safe
// because completed archives are recorded in the manifest and skipped on resume.
func (f *GoogleDriveFetcher) Fetch(ctx context.Context, plan *Plan, progress chan<- FetchResult) (err error) {
	manifest, err := loadManifest(ctx, f.store)
	if err != nil {
		return fmt.Errorf("load manifest: %w", err)
	}
	completed := manifest.completedVBAs()

	// Filter out already-completed actions (skipped when --force is set)
	var toProcess []Action
	for _, a := range plan.Actions {
		if !f.force {
			info, ok := ParseArchiveFilename(a.Target.FileName)
			if ok && completed[vbaKey(info.Version, info.Build, info.Arch)] {
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
		return nil
	}
	if f.onStart != nil {
		f.onStart(len(toProcess))
	}

	// Open a new run entry only when there is real work to do
	manifest.Runs = append(manifest.Runs, ManifestRun{StartedAt: time.Now().UTC()})
	runIdx := len(manifest.Runs) - 1

	prog := &fetchProgress{total: len(toProcess)}

	workCh := make(chan Action, len(toProcess))
	for _, a := range toProcess {
		workCh <- a
	}
	close(workCh)

	var manifestMu sync.Mutex
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

				prog.begin()
				result := f.processAction(ctx, action)
				prog.done()

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

				manifestMu.Lock()
				manifest.Runs[runIdx].Archives = append(manifest.Runs[runIdx].Archives, ManifestArchive{
					FileID:       action.Target.FileID,
					Filename:     action.Target.FileName,
					Version:      info.Version,
					Build:        info.Build,
					Arch:         info.Arch,
					DifsUploaded: result.DifsUploaded,
					CompletedAt:  time.Now().UTC(),
				})
				if saveErr := saveManifest(ctx, f.store, manifest); saveErr != nil {
					slog.Warn("fetcher: failed to save manifest after archive completion",
						"filename", action.Target.FileName,
						"error", saveErr,
					)
				}
				manifestMu.Unlock()

				progress <- result
			}
		}()
	}

	wg.Wait()

	select {
	case fetchErr := <-errCh:
		return fetchErr
	default:
	}

	manifestMu.Lock()
	manifest.Runs[runIdx].FinishedAt = time.Now().UTC()
	err = saveManifest(ctx, f.store, manifest)
	manifestMu.Unlock()
	return err
}

// processAction downloads one .7z archive, processes its contents, and returns the result.
func (f *GoogleDriveFetcher) processAction(ctx context.Context, action Action) FetchResult {
	target := action.Target
	slog.Info("fetcher: downloading archive",
		"filename", target.FileName,
		"file_id", target.FileID,
		"size_bytes", target.Size,
	)

	var bytesCb func(done, total int64)
	if f.onProgress != nil {
		f.onProgress(FetchProgressUpdate{FileName: target.FileName, Phase: "fetching", BytesTotal: target.Size})
		bytesCb = func(done, total int64) {
			f.onProgress(FetchProgressUpdate{FileName: target.FileName, Phase: "fetching", BytesDone: done, BytesTotal: total})
		}
	}
	tempPath, bytesDownloaded, err := f.downloadToTemp(ctx, target.FileID, target.Size, bytesCb)
	if err != nil {
		return FetchResult{Target: target, Err: fmt.Errorf("download %s: %w", target.FileName, err)}
	}
	defer os.Remove(tempPath)

	if f.onProgress != nil {
		f.onProgress(FetchProgressUpdate{FileName: target.FileName, Phase: "processing"})
	}
	slog.Info("fetcher: processing archive",
		"filename", target.FileName,
		"bytes_downloaded", bytesDownloaded,
	)

	arch := "arm64"
	if len(target.Symbol.Arch) > 0 {
		arch = target.Symbol.Arch[0]
	}

	var difCb func(int, int64)
	if f.onProgress != nil {
		difCb = func(n int, b int64) {
			f.onProgress(FetchProgressUpdate{FileName: target.FileName, Phase: "processing", DifsUploaded: n, BytesUploaded: b})
		}
	}
	difsUploaded, bytesUploaded, err := processArchive(ctx, tempPath, arch, f.store, difCb)
	if err != nil {
		return FetchResult{Target: target, Err: fmt.Errorf("process %s: %w", target.FileName, err)}
	}

	slog.Info("fetcher: archive complete",
		"filename", target.FileName,
		"difs_uploaded", difsUploaded,
	)

	return FetchResult{
		Target:        target,
		DifsUploaded:  difsUploaded,
		BytesFetched:  bytesDownloaded,
		BytesUploaded: bytesUploaded,
	}
}

// countingReader wraps an io.Reader and calls onProgress after each read,
// but only when the integer percentage changes to avoid flooding the caller.
type countingReader struct {
	r          io.Reader
	done       int64
	total      int64
	lastPct    int64
	onProgress func(done, total int64)
}

func (cr *countingReader) Read(p []byte) (n int, err error) {
	n, err = cr.r.Read(p)
	cr.done += int64(n)
	if cr.onProgress != nil && cr.total > 0 {
		pct := cr.done * 100 / cr.total
		if pct != cr.lastPct {
			cr.lastPct = pct
			cr.onProgress(cr.done, cr.total)
		}
	}
	return
}

// downloadToTemp streams a Drive file to a temp file, returning the temp path and byte count.
// onProgress is called each time the integer download percentage advances (may be nil).
func (f *GoogleDriveFetcher) downloadToTemp(ctx context.Context, fileID string, totalSize int64, onProgress func(done, total int64)) (path string, n int64, err error) {
	resp, err := f.client.Files.Get(fileID).Context(ctx).Download()
	if err != nil {
		return "", 0, fmt.Errorf("drive get: %w", err)
	}
	defer resp.Body.Close()

	tmp, err := os.CreateTemp("", "symboloader-*.7z")
	if err != nil {
		return "", 0, fmt.Errorf("create temp file: %w", err)
	}
	defer tmp.Close()

	cr := &countingReader{r: resp.Body, total: totalSize, onProgress: onProgress}
	n, err = io.Copy(tmp, cr)
	if err != nil {
		os.Remove(tmp.Name())
		return "", 0, fmt.Errorf("write temp file: %w", err)
	}

	return tmp.Name(), n, nil
}

// processArchive extracts files from the .7z at path and uploads DIFs to the object store.
// Extraction is sequential (safe for the sevenzip reader); Mach-O parsing and
// uploads run concurrently across runtime.NumCPU() workers.
// onDif is called after each DIF is uploaded with running (count, bytesUploaded); may be nil.
func processArchive(ctx context.Context, path, arch string, store ObjectStore, onDif func(count int, bytesUploaded int64)) (int, int64, error) {
	rc, err := sevenzip.OpenReader(path)
	if err != nil {
		return 0, 0, fmt.Errorf("open 7z: %w", err)
	}
	defer rc.Close()

	fileCh := make(chan archiveFile, runtime.NumCPU()*2)

	g, gctx := errgroup.WithContext(ctx)
	var uploadCount atomic.Int64
	var uploadBytes atomic.Int64

	// Workers: parse Mach-O and upload DIFs concurrently
	for range runtime.NumCPU() {
		g.Go(func() error {
			for af := range fileCh {
				if gctx.Err() != nil {
					return gctx.Err()
				}
				uploaded, bytesUp, err := uploadDifs(gctx, af, store)
				if err != nil {
					return err
				}
				if uploaded {
					n := int(uploadCount.Add(1))
					b := uploadBytes.Add(bytesUp)
					if onDif != nil {
						onDif(n, b)
					}
				}
			}
			return nil
		})
	}

	// Producer: extract files sequentially and feed the channel
	g.Go(func() error {
		defer close(fileCh)
		for _, f := range rc.File {
			if f.FileInfo().IsDir() {
				continue
			}
			if strings.HasPrefix(filepath.Base(f.Name), ".") {
				continue
			}
			fr, err := f.Open()
			if err != nil {
				return fmt.Errorf("open archive entry %s: %w", f.Name, err)
			}
			data, err := io.ReadAll(fr)
			fr.Close()
			if err != nil {
				return fmt.Errorf("read archive entry %s: %w", f.Name, err)
			}
			select {
			case fileCh <- archiveFile{name: f.Name, data: data, arch: arch}:
			case <-gctx.Done():
				return gctx.Err()
			}
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return 0, 0, err
	}
	return int(uploadCount.Load()), uploadBytes.Load(), nil
}

// uploadDifs verifies a file as Mach-O, extracts its UUID, and uploads
// the debuginfo and meta objects to the object store. Returns uploaded=false
// for non-Mach-O files.
func uploadDifs(ctx context.Context, af archiveFile, store ObjectStore) (uploaded bool, bytesUploaded int64, err error) {
	reader := bytes.NewReader(af.data)
	if err := symbol.VerifyMachO(reader); err != nil {
		// Not a Mach-O binary — skip silently
		return false, 0, nil
	}

	if _, err := reader.Seek(0, io.SeekStart); err != nil {
		return false, 0, fmt.Errorf("seek in %s: %w", af.name, err)
	}

	debugID, err := symbol.GetMachOUUID(reader)
	if err != nil {
		return false, 0, fmt.Errorf("get UUID from %s: %w", af.name, err)
	}
	if debugID == "" {
		slog.Warn("fetcher: skipping file with empty debug ID", "file", af.name)
		return false, 0, nil
	}

	baseName := filepath.Base(af.name)

	type fileMeta struct {
		Name       string `json:"name"`
		Arch       string `json:"arch"`
		FileFormat string `json:"file_format"`
	}
	metaJSON, err := json.Marshal(fileMeta{Name: baseName, Arch: af.arch, FileFormat: "macho"})
	if err != nil {
		return false, 0, fmt.Errorf("marshal meta for %s: %w", af.name, err)
	}

	base := symbol.BuildUnifiedLayout(debugID)

	uploads := []struct {
		key  string
		data []byte
	}{
		{base + "/debuginfo", af.data},
		{base + "/meta", metaJSON},
	}

	var totalBytes int64
	for _, u := range uploads {
		if err := store.Put(ctx, u.key, u.data, ""); err != nil {
			return false, 0, fmt.Errorf("upload %s: %w", u.key, err)
		}
		totalBytes += int64(len(u.data))
	}

	return true, totalBytes, nil
}
