package cmd

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"symboloader/symsync/config"
	"symboloader/symsync/enumerate"
	"symboloader/symsync/pipeline"
	"symboloader/symsync/reporter"
	"symboloader/symsync/spot"

	"github.com/spf13/cobra"
)

// getAPIKey reads the Drive API key from environment variable or file.
// Priority: GOOGLE_DRIVE_API_KEY (env var) > DRIVE_API_KEY_FILE (file path)
func getAPIKey() (string, error) {
	if apiKey := strings.TrimSpace(os.Getenv("GOOGLE_DRIVE_API_KEY")); apiKey != "" {
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
	syncDryRun        bool
	syncForce         bool
	syncList          bool
	syncDriveFolder   string
	syncDriveFolderID string
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "run the full symbol sync pipeline",
	Long: `Enumerates available iOS system symbol versions, resolves targets,
plans downloads, fetches archives, processes symbols, and uploads to storage.

Use --list to enumerate available versions without syncing.
Use --dry-run to see the download plan without executing it.`,
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
	syncCmd.Flags().StringVar(&syncDriveFolder, "drive-folder", "symboloader", "Google Drive destination folder name (created if missing)")
	syncCmd.Flags().StringVar(&syncDriveFolderID, "drive-folder-id", "", "Google Drive destination folder ID (takes priority over --drive-folder)")
	syncCmd.Flags().BoolVar(&syncDryRun, "dry-run", false, "show download plan without executing")
	syncCmd.Flags().BoolVar(&syncForce, "force", false, "reprocess archives already recorded in the manifest")
	syncCmd.Flags().BoolVar(&syncList, "list", false, "enumerate and list available versions, then exit")
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
		if _, err := pipeline.StorageEnvFromEnv(); err != nil {
			if errors.Is(err, pipeline.ErrMissingBucket) || errors.Is(err, pipeline.ErrMissingRegion) {
				validationErrs = append(validationErrs, err.Error())
			}
		}
		creds, err := config.DriveCredentials(ctx)
		if err != nil {
			validationErrs = append(validationErrs, err.Error())
		}
		apiKey, err := getAPIKey()
		if err != nil {
			validationErrs = append(validationErrs, err.Error())
		}
		if len(validationErrs) > 0 {
			combined := errors.New(strings.Join(validationErrs, "; "))
			r.StageFailed("validate", combined)
			return combined
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
		spotter, err := spot.NewSpotterImpl(creds, apiKey)
		if err != nil {
			r.StageFailed("spot", err)
			return fmt.Errorf("spotter: %w", err)
		}
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

		// Clone
		r.StageStarted("clone")
		cloner, err := pipeline.NewGoogleDriveCloner(creds, apiKey, syncDriveFolder, syncDriveFolderID)
		if err != nil {
			r.StageFailed("clone", err)
			return fmt.Errorf("cloner: %w", err)
		}
		if cb := r.CloneProgressCallback(); cb != nil {
			cloner.SetProgressCallback(cb)
		}
		clonedFolders, err := cloner.Clone(ctx, targets)
		if err != nil {
			r.StageFailed("clone", err)
			return fmt.Errorf("clone: %w", err)
		}
		dest := syncDriveFolder
		if syncDriveFolderID != "" {
			dest = syncDriveFolderID
		}
		r.StageFinished("clone", fmt.Sprintf("%d folder(s) → %s", len(clonedFolders), dest))

		// Fetcher created early so PendingCount can annotate the plan result.
		fetcher, err := pipeline.NewGoogleDriveFetcher(creds, syncConcurrency, syncForce)
		if err != nil {
			return fmt.Errorf("fetcher: %w", err)
		}

		// Plan
		r.StageStarted("plan")
		planner, err := pipeline.NewGoogleDrivePlanner(creds)
		if err != nil {
			r.StageFailed("plan", err)
			return fmt.Errorf("planner: %w", err)
		}
		plan, err := planner.Plan(ctx, targets, clonedFolders)
		if err != nil {
			r.StageFailed("plan", err)
			return fmt.Errorf("plan: %w", err)
		}
		pending, total, err := fetcher.PendingCount(ctx, plan)
		if err != nil {
			r.StageFailed("plan", err)
			return fmt.Errorf("pending count: %w", err)
		}
		if pending < total {
			r.StageFinished("plan", fmt.Sprintf("%d to fetch  ·  %d already done", pending, total-pending))
		} else {
			r.StageFinished("plan", fmt.Sprintf("%d to fetch", pending))
		}

		if syncDryRun {
			return nil
		}

		fetcher.SetStartCallback(r.FetchStartCallback())
		if cb := r.FetchProgressCallback(); cb != nil {
			fetcher.SetProgressCallback(cb)
		}

		results := make(chan pipeline.FetchResult)
		var fetchErr error
		go func() {
			fetchErr = fetcher.Fetch(ctx, plan, results)
			close(results)
		}()
		r.DrainFetch(results)

		return fetchErr
	})
}
