package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"symboloader/symsync/enumerate"
	"symboloader/symsync/pipeline"
	"symboloader/symsync/reporter"
	"symboloader/symsync/spot"

	"github.com/spf13/cobra"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
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
	syncVersions      []string
	syncConcurrency   int
	syncWorkers       int
	syncDryRun        bool
	syncForce         bool
	syncList          bool
	syncNoRemoval     bool
	syncClone         bool
	syncDriveFolderID string
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
			err := runList(cmd)
			if err != nil {
				fmt.Fprintf(cmd.ErrOrStderr(), "  ✗  %s\n", err)
			}
			return err
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
	syncCmd.Flags().BoolVar(&syncClone, "clone", false, "wipe and Files.copy() catalog archives into --drive-folder-id before fetching (Cloud Run only)")
	syncCmd.Flags().StringVar(&syncDriveFolderID, "drive-folder-id", "", "destination Drive folder ID for SA-owned copies; treats this folder as the source of truth (Cloud Run only)")
}

// newSADriveService builds a Drive service authenticated via Application
// Default Credentials (the Cloud Run SA on Cloud Run, gcloud ADC locally)
// with the full Drive scope. Used for the cloned-mirror code path.
func newSADriveService(ctx context.Context) (*drive.Service, error) {
	creds, err := google.FindDefaultCredentials(ctx, drive.DriveScope)
	if err != nil {
		return nil, fmt.Errorf("application default credentials with drive scope: %w", err)
	}
	svc, err := drive.NewService(ctx, option.WithCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("drive service: %w", err)
	}
	return svc, nil
}

// newAPIKeyDriveService builds a Drive service authenticated via API key.
// Used for the no-flags / public-catalog code path.
func newAPIKeyDriveService(ctx context.Context, apiKey string) (*drive.Service, error) {
	return drive.NewService(ctx, option.WithAPIKey(apiKey))
}

// verifyFolderReadable confirms the SA can read the given folder ID.
// Used when --drive-folder-id is set without --clone (we don't need
// write access in that case).
func verifyFolderReadable(ctx context.Context, svc *drive.Service, folderID string) error {
	f, err := svc.Files.Get(folderID).Context(ctx).
		Fields("id, mimeType").
		SupportsAllDrives(true).
		Do()
	if err != nil {
		return fmt.Errorf("get folder %s: %w", folderID, err)
	}
	if f.MimeType != "application/vnd.google-apps.folder" {
		return fmt.Errorf("ID %s is not a Drive folder (mime %s)", folderID, f.MimeType)
	}
	return nil
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

		useDriveFolder := syncDriveFolderID != ""

		// Validate — all checks (local + auth probe) before any real work
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
		if syncClone && !useDriveFolder {
			validationErrs = append(validationErrs, "--clone requires --drive-folder-id")
		}
		if (syncClone || useDriveFolder) && !storageEnv.IsCloud {
			validationErrs = append(validationErrs, "--clone and --drive-folder-id are supported in Cloud Run only for now")
		}

		var (
			spotter  *spot.DriveSpotter
			driveSvc *drive.Service
			cloner   *pipeline.DriveCloner
		)

		// Skip auth wiring if any prior validation already failed — running
		// network probes after a config error wastes time and clutters the
		// validate-stage error with consequential failures.
		if len(validationErrs) == 0 {
			if useDriveFolder {
				svc, err := newSADriveService(ctx)
				if err != nil {
					validationErrs = append(validationErrs, err.Error())
				} else {
					driveSvc = svc
					if syncClone {
						c, err := pipeline.NewDriveCloner(ctx, svc, syncDriveFolderID)
						if err != nil {
							validationErrs = append(validationErrs, err.Error())
						} else {
							cloner = c
						}
					} else {
						if err := verifyFolderReadable(ctx, svc, syncDriveFolderID); err != nil {
							validationErrs = append(validationErrs, err.Error())
						}
					}
					if len(validationErrs) == 0 {
						spotter = spot.NewDriveSpotterWithService(svc)
					}
				}
			} else {
				k, err := getAPIKey()
				if err != nil {
					validationErrs = append(validationErrs, err.Error())
				}
				if k == "" {
					validationErrs = append(validationErrs, ErrMissingDriveAPIKey.Error())
				}
				if k != "" {
					svc, err := newAPIKeyDriveService(ctx, k)
					if err != nil {
						validationErrs = append(validationErrs, err.Error())
					} else {
						driveSvc = svc
						s := spot.NewDriveSpotterWithService(svc)
						if err := s.ValidateAPIKey(ctx); err != nil {
							validationErrs = append(validationErrs, err.Error())
						} else {
							spotter = s
						}
					}
				}
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

		// Enumerate (always — needed by --clone, informational otherwise)
		r.StageStarted("enumerate")
		e := &enumerate.ReadmeEnumerator{ReadmeURL: enumerate.DefaultReadmeURL}
		catalog, err := e.Enumerate(ctx)
		if err != nil {
			r.StageFailed("enumerate", err)
			return fmt.Errorf("enumerate: %w", err)
		}
		r.StageFinished("enumerate", fmt.Sprintf("%d folder(s), %d group(s)", len(catalog.Folders), len(catalog.Groups)))

		// Clone (optional) — wipe destination and re-copy catalog archives.
		if syncClone {
			r.StageStarted("clone")
			copied, wiped, err := cloner.WipeAndCopy(ctx, catalog)
			if err != nil {
				r.StageFailed("clone", err)
				return fmt.Errorf("clone: %w", err)
			}
			r.StageFinished("clone", fmt.Sprintf("copied %d · wiped %d", copied, wiped))
		}

		// Spot
		r.StageStarted("spot")
		var targets []pipeline.Target
		if useDriveFolder {
			targets, err = spotter.SpotFromFolder(ctx, syncDriveFolderID, versions)
		} else {
			targets, err = spotter.Spot(ctx, catalog, versions)
		}
		if err != nil {
			r.StageFailed("spot", err)
			return fmt.Errorf("spot: %w", err)
		}
		if len(targets) == 0 {
			r.StageFinished("spot", "no matching versions found")
			return nil
		}
		spotDetail := fmt.Sprintf("%d target(s) for %v", len(targets), versions)
		if useDriveFolder && !syncClone {
			if missing := missingMajorsCount(catalog, targets); missing > 0 {
				spotDetail += fmt.Sprintf("  ·  %d catalog folder(s) not in destination (use --clone to refresh)", missing)
			}
		}
		r.StageFinished("spot", spotDetail)

		// Plan — needs the manifest to compute deletions
		r.StageStarted("plan")
		manifest, err := pipeline.LoadManifest(ctx, store)
		if err != nil {
			r.StageFailed("plan", err)
			return fmt.Errorf("load manifest: %w", err)
		}
		plan := pipeline.NewPlan(targets, manifest)

		fetcher := pipeline.NewGoogleDriveFetcher(driveSvc, syncConcurrency, syncWorkers, syncForce, store, cloner)
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

// missingMajorsCount reports how many major iOS versions appear in the
// README catalog but are not represented by any archive in the targets
// slice. Surfaced as a non-fatal hint when the user runs --drive-folder-id
// without --clone, prompting them to re-clone if the upstream README has
// new releases since the last clone run.
func missingMajorsCount(catalog *pipeline.Catalog, targets []pipeline.Target) int {
	if catalog == nil {
		return 0
	}
	catMajors := make(map[int]bool)
	for _, folder := range catalog.Folders {
		for _, v := range folder.Versions {
			if m := leadingInt(v); m > 0 {
				catMajors[m] = true
			}
		}
	}
	destMajors := make(map[int]bool)
	for _, t := range targets {
		info, ok := pipeline.ParseArchiveFilename(t.FileName)
		if !ok {
			continue
		}
		if m := leadingInt(info.Version); m > 0 {
			destMajors[m] = true
		}
	}
	missing := 0
	for m := range catMajors {
		if !destMajors[m] {
			missing++
		}
	}
	return missing
}

// leadingInt returns the integer prefix of v (the major version), or 0
// if v has no leading digits. Mirrors spot.majorOf's behavior.
func leadingInt(v string) int {
	v = strings.TrimSpace(v)
	end := 0
	for end < len(v) && v[end] >= '0' && v[end] <= '9' {
		end++
	}
	if end == 0 {
		return 0
	}
	n, _ := strconv.Atoi(v[:end])
	return n
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
