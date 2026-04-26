package pipeline

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"symboloader/symbol"
)

// DeleteResult records the outcome of removing one archive's DIFs.
type DeleteResult struct {
	Entry         ArchiveEntry
	DIFsDeleted   int // debug IDs whose objects were actually removed
	DIFsRetained  int // debug IDs skipped because they are still referenced by an active archive
	Err           error
}

// StoreJanitor removes DIFs whose archives are no longer in the planner's
// keep set and soft-deletes the corresponding manifest archive entries.
type StoreJanitor struct {
	store       ObjectStore
	manifest    *Manifest
	concurrency int
	onStart     func(count int)
}

// NewStoreJanitor builds a janitor that operates on the given store and
// in-memory manifest. concurrency controls parallelism across delete actions.
func NewStoreJanitor(store ObjectStore, manifest *Manifest, concurrency int) *StoreJanitor {
	if concurrency < 1 {
		concurrency = 1
	}
	return &StoreJanitor{store: store, manifest: manifest, concurrency: concurrency}
}

// SetStartCallback registers a function called with the number of delete
// actions before any work begins.
func (j *StoreJanitor) SetStartCallback(fn func(int)) { j.onStart = fn }

// Delete executes plan.Deletes: removes DIF objects from the bucket (skipping
// debug IDs still claimed by an active retained archive) and writes back
// updated archive index files with DeletedAt set. Returns the list of archives
// that were soft-deleted.
func (j *StoreJanitor) Delete(ctx context.Context, plan *Plan, results chan<- DeleteResult) (deleted []ArchiveRef, err error) {
	if len(plan.Deletes) == 0 {
		if j.onStart != nil {
			j.onStart(0)
		}
		return nil, nil
	}
	if j.onStart != nil {
		j.onStart(len(plan.Deletes))
	}

	retained := j.retainedDebugIDs(plan)
	guard := &upsertGuard{m: j.manifest}

	workCh := make(chan DeleteAction, len(plan.Deletes))
	for _, d := range plan.Deletes {
		workCh <- d
	}
	close(workCh)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 1)
	var deletedMu sync.Mutex
	var wg sync.WaitGroup

	for range j.concurrency {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for action := range workCh {
				if ctx.Err() != nil {
					return
				}

				result := j.deleteEntry(ctx, action.Entry, retained)
				if result.Err != nil {
					select {
					case errCh <- result.Err:
					default:
					}
					cancel()
					results <- result
					return
				}
				guard.upsert(result.Entry)

				deletedMu.Lock()
				deleted = append(deleted, result.Entry.Ref())
				deletedMu.Unlock()

				results <- result
			}
		}()
	}

	wg.Wait()

	select {
	case janitorErr := <-errCh:
		return deleted, janitorErr
	default:
	}
	return deleted, nil
}

// retainedDebugIDs collects debug IDs claimed by active manifest entries that
// are NOT scheduled for deletion. These must be preserved even when another
// archive lists the same UUID (rare but possible across iOS versions).
func (j *StoreJanitor) retainedDebugIDs(plan *Plan) map[string]bool {
	doomed := make(map[string]bool, len(plan.Deletes))
	for _, d := range plan.Deletes {
		doomed[d.Entry.VBAC()] = true
	}

	keep := make(map[string]bool)
	for _, e := range j.manifest.Archives {
		if !e.Active() {
			continue
		}
		if doomed[e.VBAC()] {
			continue
		}
		for _, id := range e.DebugIDs {
			keep[id] = true
		}
	}
	return keep
}

// deleteEntry removes DIF objects for one archive (subject to the retained
// safety net) and writes the soft-delete marker back to its index file.
func (j *StoreJanitor) deleteEntry(ctx context.Context, entry ArchiveEntry, retained map[string]bool) DeleteResult {
	var difsDeleted, difsRetained int
	for _, id := range entry.DebugIDs {
		if retained[id] {
			difsRetained++
			continue
		}
		base := symbol.BuildUnifiedLayout(id)
		for _, key := range []string{base + "/debuginfo", base + "/meta"} {
			if err := j.store.Delete(ctx, key); err != nil {
				return DeleteResult{
					Entry: entry,
					Err:   fmt.Errorf("delete %s: %w", key, err),
				}
			}
		}
		difsDeleted++
	}

	entry.DeletedAt = time.Now().UTC()
	if err := SaveArchiveEntry(ctx, j.store, entry); err != nil {
		return DeleteResult{
			Entry: entry,
			Err:   fmt.Errorf("update entry: %w", err),
		}
	}

	slog.Info("janitor: archive removed",
		"vbac", entry.VBAC(),
		"difs_deleted", difsDeleted,
		"difs_retained", difsRetained,
	)

	return DeleteResult{
		Entry:        entry,
		DIFsDeleted:  difsDeleted,
		DIFsRetained: difsRetained,
	}
}
