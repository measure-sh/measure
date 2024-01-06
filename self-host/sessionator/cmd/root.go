package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "measure",
	Short: "measure dev client",
	Long:  "use the development client to administer measure backend",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("measure dev client")
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
