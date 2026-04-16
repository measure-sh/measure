package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"symboloader/internal/symsync/enumerate"
	"symboloader/internal/symsync/pipeline"
	"symboloader/internal/symsync/spot"

	"github.com/spf13/cobra"
)

// getAPIKey reads the Drive API key from environment variable or file.
// Priority: GOOGLE_DRIVE_API_KEY (env var) > DRIVE_API_KEY_FILE (file path)
func getAPIKey() (string, error) {
	// First, try environment variable (highest priority)
	if apiKey := strings.TrimSpace(os.Getenv("GOOGLE_DRIVE_API_KEY")); apiKey != "" {
		return apiKey, nil
	}

	// Fall back to reading from file (for Docker secrets)
	if keyFile := os.Getenv("DRIVE_API_KEY_FILE"); keyFile != "" {
		data, err := os.ReadFile(keyFile)
		if err != nil {
			return "", fmt.Errorf("read DRIVE_API_KEY_FILE: %w", err)
		}
		return strings.TrimSpace(string(data)), nil
	}

	// Neither set
	return "", nil
}

var (
	syncVersions  []string
	syncBucket    string
	syncDryRun    bool
	syncList      bool
	syncDriveFolder string
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "run the full symbol sync pipeline",
	Long: `Enumerates available iOS system symbol versions, resolves targets,
plans downloads, fetches archives, processes symbols, uploads to
storage, and cleans up.

Use --list to enumerate available versions without syncing.
Use --dry-run to see the download plan without executing it.`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if syncList {
			loadConfigOrDefault()
			return nil
		}
		return loadConfig()
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		if syncList {
			return runList(cmd)
		}
		return runSync(cmd)
	},
}

func init() {
	syncCmd.Flags().StringSliceVar(&syncVersions, "versions", nil, "override target versions (e.g. \"26.0,18.x\")")
	syncCmd.Flags().StringVar(&syncBucket, "bucket", "", "override bucket name for storage")
	syncCmd.Flags().StringVar(&syncDriveFolder, "drive-folder", "", "override Google Drive destination folder name (created if missing)")
	syncCmd.Flags().BoolVar(&syncDryRun, "dry-run", false, "show download plan without executing")
	syncCmd.Flags().BoolVar(&syncList, "list", false, "enumerate and list available versions, then exit")
}

func runList(cmd *cobra.Command) (err error) {
	e := &enumerate.ReadmeEnumerator{ReadmeURL: cfg.Source.ReadmeURL}
	catalog, err := e.Enumerate(cmd.Context())
	if err != nil {
		return fmt.Errorf("enumerate: %w", err)
	}

	// TODO: temporary debug dump — remove later
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err = enc.Encode(catalog); err != nil {
		return fmt.Errorf("debug dump: %w", err)
	}
	fmt.Println()

	for _, folder := range catalog.Folders {
		if len(folder.Versions) == 1 {
			fmt.Printf("Drive: %s → %s\n", folder.Versions[0], folder.URL)
		} else {
			fmt.Printf("Drive: %s-%s → %s\n", folder.Versions[0], folder.Versions[1], folder.URL)
		}
	}
	fmt.Println()

	for _, group := range catalog.Groups {
		fmt.Printf("### %s (%d symbols)\n", group.Name, len(group.Symbols))
		for _, sym := range group.Symbols {
			arch := strings.Join(sym.Arch, ", ")
			if sym.Description != "" {
				fmt.Printf("  %-25s %-15s %s\n", sym.OSVersion, arch, sym.Description)
			} else {
				fmt.Printf("  %-25s %s\n", sym.OSVersion, arch)
			}
		}
		fmt.Println()
	}

	return
}

func runSync(cmd *cobra.Command) (err error) {
	// Determine target versions
	versions := syncVersions
	if len(versions) == 0 {
		versions = cfg.Sync.Versions
	}

	// Enumerate catalog from README
	e := &enumerate.ReadmeEnumerator{ReadmeURL: cfg.Source.ReadmeURL}
	catalog, err := e.Enumerate(cmd.Context())
	if err != nil {
		return fmt.Errorf("enumerate: %w", err)
	}

	// Validate and resolve versions to folders
	spotter := &spot.SpotterImpl{}
	targets, err := spotter.Spot(cmd.Context(), catalog, versions)
	if err != nil {
		return fmt.Errorf("spot: %w", err)
	}

	if len(targets) == 0 {
		cmd.Println("no matching versions found")
		return nil
	}

	cmd.Printf("Resolved %d target(s) from versions: %v\n", len(targets), versions)
	fmt.Println()

	// Determine destination folder name
	destFolder := syncDriveFolder
	if destFolder == "" {
		destFolder = cfg.Cloning.DestinationFolder
	}

	// Determine authentication method for reading source folders
	apiKey, err := getAPIKey()
	if err != nil {
		return fmt.Errorf("api key: %w", err)
	}

	if apiKey != "" {
		cmd.Println("Using Google Drive API key for reading public source folders")
	} else {
		cmd.Println("No API key available; service account will be used for all operations")
	}

	// Create cloner and clone folders
	// The Cloner uses API key (if available) to read public source folders
	// and service account credentials to write to destination folder
	// If destination_folder_id is set in config, it uses that shared folder
	// Otherwise, it creates a folder named destFolder in the service account's Drive
	cloner, err := pipeline.NewGoogleDriveCloner(destFolder, cfg.Cloning.DestinationFolderID)
	if err != nil {
		return fmt.Errorf("cloner: %w", err)
	}

	cmd.Printf("Cloning %d folder(s) to Drive folder '%s'...\n", len(targets), destFolder)
	clonedFolders, err := cloner.Clone(cmd.Context(), targets)
	if err != nil {
		return fmt.Errorf("clone: %w", err)
	}

	fmt.Println()
	cmd.Printf("Successfully cloned %d folder(s):\n", len(clonedFolders))
	for _, cf := range clonedFolders {
		cmd.Printf("  Original: %s → Cloned: %s (%d target(s))\n", cf.OriginalID, cf.ClonedID, len(cf.Targets))
	}
	fmt.Println()

	if syncDryRun {
		cmd.Println("dry-run: stopping after clone phase")
		return nil
	}

	cmd.Println("pipeline: planner, fetcher, reporter, janitor — not yet implemented")
	return nil
}
