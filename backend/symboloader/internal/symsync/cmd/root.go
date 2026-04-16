package cmd

import (
	"fmt"
	"os"

	"symboloader/internal/symsync/config"

	"github.com/spf13/cobra"
)

var (
	cfgFile string
	cfg     *config.Config
)

var rootCmd = &cobra.Command{
	Use:   "symboloader",
	Short: "sync iOS system symbols to object storage",
	Long: `symboloader enumerates, downloads, and uploads Apple iOS system framework
symbols to an S3-compatible or GCS bucket for use in symbolication.`,
	SilenceUsage: true,
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "symboloader.toml", "path to config file")

	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(cleanCmd)

	rootCmd.CompletionOptions.HiddenDefaultCmd = true
}

// loadConfig loads and validates the config file. Commands that need
// config should call this in their PreRunE.
func loadConfig() error {
	var err error
	cfg, err = config.Load(cfgFile)
	if err != nil {
		return fmt.Errorf("failed to load config %q: %w", cfgFile, err)
	}
	return cfg.Validate()
}

// loadConfigOrDefault loads the config file if it exists, otherwise
// uses defaults. Does not validate auth/storage fields.
func loadConfigOrDefault() {
	cfg = config.LoadOrDefault(cfgFile)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
