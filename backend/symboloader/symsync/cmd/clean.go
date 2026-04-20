package cmd

import (
	"github.com/spf13/cobra"
)

var cleanCmd = &cobra.Command{
	Use:   "clean",
	Short: "remove temporary and cloned resources",
	Long: `Cleans up any temporary files, cloned Google Drive folders, or
incomplete downloads left by a previous sync run.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.Println("clean: not yet implemented")
		return nil
	},
}
