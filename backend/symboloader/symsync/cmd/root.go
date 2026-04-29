package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "symboloader",
	Short: "sync iOS system symbols to object storage",
	Long: `symboloader enumerates, downloads, and uploads Apple iOS system framework
symbols to an S3-compatible or GCS bucket for use in symbolication.`,
	SilenceUsage: true,
}

func init() {
	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(cleanCmd)

	rootCmd.CompletionOptions.HiddenDefaultCmd = true
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
