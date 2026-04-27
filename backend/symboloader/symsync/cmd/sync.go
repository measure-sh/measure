package cmd

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"strings"
	"time"

	"symboloader/symsync/enumerate"
	"symboloader/symsync/pipeline"
	"symboloader/symsync/reporter"
	"symboloader/symsync/spot"

	"github.com/spf13/cobra"
)

// ErrMissingDriveAPIKey is reported during validation when the user has not
// configured a Drive API key via either env var.
var ErrMissingDriveAPIKey = errors.New("Drive API key is required: set DRIVE_API_KEY or DRIVE_API_KEY_FILE (see backend/symboloader/README.md)")

// getAPIKey reads the Drive API key from environment variable or file.
// Priority: DRIVE_API_KEY (env var) > DRIVE_API_KEY_FILE (file path).
// Returns an empty string with no error when neither is configured;
// the validate stage surfaces a clear ErrMissingDriveAPIKey.
func getAPIKey() (string, error) {
	if apiKey := strings.TrimSpace(os.Getenv("DRIVE_API_KEY")); apiKey != "" {
		return apiKey, nil
	}
	if keyFile := os.Getenv("DRIVE_API_KEY_FILE"); keyFile != "" {
		data, err := os.ReadFile(keyFile)
		if err != nil {
			return "", fmt.Errorf("read DRIVE_API_KEY_FILE: %w", err)
		}
		return strings.TrimSpace(string(data)), nil
	}
	return "", nil
}

var (
	syncVersions    []string
	syncConcurrency int
	syncWorkers     int
	syncDryRun      bool
	syncForce       bool
	syncList        bool
	syncNoRemoval   bool
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "run the full symbol sync pipeline",
	Long: `Enumerates available iOS system symbol versions, resolves targets,
plans downloads, fetches archives, processes symbols, uploads to storage,
and removes DIFs that are no longer in the target set.

Use --list to enumerate available versions without syncing.
Use --dry-run to see the plan (fetches + removals) without executing it.
Use --no-removal to keep previously-synced symbols even when they are no
longer in the target set.`,
	// The reporter is the source of truth for user-facing errors — let it
	// render the failure once and suppress cobra's automatic "Error:" line
	// and usage spam.
	SilenceErrors: true,
	SilenceUsage:  true,
	RunE: func(cmd *cobra.Command, args []string) error {
		if syncList {
			return runList(cmd)
		}
		return runSync(cmd)
	},
}

func init() {
	syncCmd.Flags().StringSliceVar(&syncVersions, "versions", nil, "target versions (e.g. \"26.0,18.x\"); default: last 5 versions")
	syncCmd.Flags().IntVar(&syncConcurrency, "concurrency", 4, "number of archives to process in parallel")
	syncCmd.Flags().IntVar(&syncWorkers, "workers", runtime.NumCPU(), "number of parallel uploads per archive")
	syncCmd.Flags().BoolVar(&syncDryRun, "dry-run", false, "show plan without executing")
	syncCmd.Flags().BoolVar(&syncForce, "force", false, "reprocess archives already recorded in the manifest")
	syncCmd.Flags().BoolVar(&syncList, "list", false, "enumerate and list available versions, then exit")
	syncCmd.Flags().BoolVar(&syncNoRemoval, "no-removal", false, "keep previously-synced symbols even if they are no longer in the target set")
}

func runList(cmd *cobra.Command) error {
	e := &enumerate.ReadmeEnumerator{ReadmeURL: enumerate.DefaultReadmeURL}
	catalog, err := e.Enumerate(cmd.Context())
	if err != nil {
		return fmt.Errorf("enumerate: %w", err)
	}

	for _, folder := range catalog.Folders {
		if len(folder.Versions) == 1 {
			fmt.Printf("  %s  →  %s\n", folder.Versions[0], folder.URL)
		} else {
			fmt.Printf("  %s – %s  →  %s\n", folder.Versions[0], folder.Versions[1], folder.URL)
		}
	}
	fmt.Println()

	for _, group := range catalog.Groups {
		fmt.Printf("  %s (%d symbols)\n", group.Name, len(group.Symbols))
		for _, sym := range group.Symbols {
			arch := strings.Join(sym.Arch, ", ")
			if sym.Description != "" {
				fmt.Printf("    %-25s %-15s %s\n", sym.OSVersion, arch, sym.Description)
			} else {
				fmt.Printf("    %-25s %s\n", sym.OSVersion, arch)
			}
		}
		fmt.Println()
	}

	return nil
}

func runSync(cmd *cobra.Command) error {
	r := reporter.New(os.Stdout)
	return r.Run(func() error {
		ctx := cmd.Context()

		versions := syncVersions
		if len(versions) == 0 {
			versions = []string{"last 5 versions"}
		}

		// Validate — all local checks before any network call
		r.StageStarted("validate")
		var validationErrs []string
		if err := spot.ValidateVersions(versions); err != nil {
			validationErrs = append(validationErrs, err.Error())
		}
		storageEnv, err := pipeline.StorageEnvFromEnv()
		if err != nil {
			if errors.Is(err, pipeline.ErrMissingBucket) || errors.Is(err, pipeline.ErrMissingRegion) {
				validationErrs = append(validationErrs, err.Error())
			}
		}
		apiKey, err := getAPIKey()
		if err != nil {
			validationErrs = append(validationErrs, err.Error())
		}
		if apiKey == "" {
			validationErrs = append(validationErrs, ErrMissingDriveAPIKey.Error())
		}

		var spotter *spot.DriveSpotter
		if apiKey != "" {
			s, err := spot.NewDriveSpotter(apiKey)
			if err != nil {
				validationErrs = append(validationErrs, err.Error())
			} else if err := s.ValidateAPIKey(ctx); err != nil {
				validationErrs = append(validationErrs, err.Error())
			} else {
				spotter = s
			}
		}

		if len(validationErrs) > 0 {
			combined := errors.New(strings.Join(validationErrs, "; "))
			r.StageFailed("validate", combined)
			return combined
		}
		store, err := pipeline.NewObjectStore(ctx, storageEnv)
		if err != nil {
			r.StageFailed("validate", err)
			return fmt.Errorf("object store: %w", err)
		}
		r.StageFinished("validate", "ok")

		// Enumerate
		r.StageStarted("enumerate")
		e := &enumerate.ReadmeEnumerator{ReadmeURL: enumerate.DefaultReadmeURL}
		catalog, err := e.Enumerate(ctx)
		if err != nil {
			r.StageFailed("enumerate", err)
			return fmt.Errorf("enumerate: %w", err)
		}
		r.StageFinished("enumerate", fmt.Sprintf("%d folder(s), %d group(s)", len(catalog.Folders), len(catalog.Groups)))

		// Spot
		r.StageStarted("spot")
		targets, err := spotter.Spot(ctx, catalog, versions)
		if err != nil {
			r.StageFailed("spot", err)
			return fmt.Errorf("spot: %w", err)
		}
		if len(targets) == 0 {
			r.StageFinished("spot", "no matching versions found")
			return nil
		}
		r.StageFinished("spot", fmt.Sprintf("%d target(s) for %v", len(targets), versions))

		// Plan — needs the manifest to compute deletions
		r.StageStarted("plan")
		manifest, err := pipeline.LoadManifest(ctx, store)
		if err != nil {
			r.StageFailed("plan", err)
			return fmt.Errorf("load manifest: %w", err)
		}
		plan := pipeline.NewPlan(targets, manifest)

		fetcher, err := pipeline.NewGoogleDriveFetcher(apiKey, syncConcurrency, syncWorkers, syncForce, store)
		if err != nil {
			r.StageFailed("plan", err)
			return fmt.Errorf("fetcher: %w", err)
		}
		fetcher.SetManifest(manifest)
		pending, total := fetcher.PendingCount(plan)

		removals := plan.DeleteCount()
		if syncNoRemoval {
			removals = 0
		}
		planDetail := fmt.Sprintf("%d to fetch", pending)
		if pending < total {
			planDetail += fmt.Sprintf("  ·  %d already done", total-pending)
		}
		planDetail += fmt.Sprintf("  ·  %d to remove", removals)
		r.StageFinished("plan", planDetail)

		if syncDryRun {
			return nil
		}

		// Fetch
		runRec := pipeline.RunRecord{
			RunID:     pipeline.NewRunID(time.Now()),
			StartedAt: time.Now().UTC(),
		}

		fetcher.SetStartCallback(r.FetchStartCallback())
		if cb := r.FetchProgressCallback(); cb != nil {
			fetcher.SetProgressCallback(cb)
		}

		results := make(chan pipeline.FetchResult)
		var fetchErr error
		var addedRefs []pipeline.ArchiveRef
		go func() {
			addedRefs, fetchErr = fetcher.Fetch(ctx, plan, results)
			close(results)
		}()
		r.DrainFetch(results)

		runRec.ArchivesAdded = addedRefs
		if fetchErr != nil {
			return fetchErr
		}

		// Janitor
		var deletedRefs []pipeline.ArchiveRef
		if !syncNoRemoval && len(plan.Deletes) > 0 {
			r.StageStarted("janitor")
			janitor := pipeline.NewStoreJanitor(store, manifest, syncConcurrency)
			janitor.SetStartCallback(r.JanitorStartCallback())

			delResults := make(chan pipeline.DeleteResult)
			var janErr error
			go func() {
				deletedRefs, janErr = janitor.Delete(ctx, plan, delResults)
				close(delResults)
			}()
			r.DrainJanitor(delResults)

			if janErr != nil {
				r.StageFailed("janitor", janErr)
				return janErr
			}
			runRec.ArchivesDeleted = deletedRefs
			r.StageFinished("janitor", fmt.Sprintf("%d removed", len(deletedRefs)))
		}

		// Audit log
		runRec.FinishedAt = time.Now().UTC()
		if err := pipeline.SaveRunRecord(ctx, store, runRec); err != nil {
			slog.Warn("failed to save run record", "error", err)
		}

		// Manifest summary
		r.ManifestSummary(buildSummary(manifest, addedRefs, deletedRefs))
		return nil
	})
}

// buildSummary partitions the in-memory manifest into Added/Kept/Deleted
// based on the just-completed run's added and deleted archive refs.
func buildSummary(m *pipeline.Manifest, added, deleted []pipeline.ArchiveRef) reporter.ManifestCategorized {
	addedSet := make(map[string]bool, len(added))
	for _, a := range added {
		addedSet[a.VBAC()] = true
	}
	deletedSet := make(map[string]bool, len(deleted))
	for _, d := range deleted {
		deletedSet[d.VBAC()] = true
	}

	var c reporter.ManifestCategorized
	for _, e := range m.Archives {
		key := e.VBAC()
		switch {
		case deletedSet[key]:
			c.Deleted = append(c.Deleted, e)
		case addedSet[key]:
			c.Added = append(c.Added, e)
		case e.Active():
			c.Kept = append(c.Kept, e)
		}
	}
	return c
}
