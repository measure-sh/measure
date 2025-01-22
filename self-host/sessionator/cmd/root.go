package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "sessionator",
	Short: "measure development cli",
	Long:  "administer measure backend",
}

func init() {
	rootCmd.AddCommand(ingestCmd)
	rootCmd.AddCommand(recordCmd)
	rootCmd.AddCommand(removeCmd)

	rootCmd.CompletionOptions.HiddenDefaultCmd = true
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
