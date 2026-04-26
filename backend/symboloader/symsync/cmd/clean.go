package cmd

import (
	"github.com/spf13/cobra"
)

var cleanCmd = &cobra.Command{
	Use:   "clean",
	Short: "remove leftover local files from a previous sync run",
	Long: `Cleans up any temporary files left on the local filesystem by a
previous sync run. Bucket-side cleanup of out-of-target symbols is handled
by the sync command's removal stage (see "sync --help").`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.Println("clean: not yet implemented")
		return nil
	},
}
