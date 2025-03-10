package cmd

import (
	"fmt"
	"sessionator/seed"

	"github.com/spf13/cobra"
)

func init() {
	seedCmd.AddCommand(newSeedSymbolsCmd())
}

var seedCmd = &cobra.Command{
	Use:   "seed",
	Short: "Seed resources",
	Long:  "Seed resources",
}

func newSeedSymbolsCmd() *cobra.Command {
	// driveAPIKey is an API Key authorized
	// to read Google Drive contents.
	var driveAPIKey string

	// versions is a list of Apple OS versions to
	// target and download its system symbols.
	var versions []string

	// bucketName is the name of the Google Cloud
	// Storage bucket.
	var bucketName string

	// credentials is the credentials JSON string
	// authorized to upload objects to the GCS
	// bucket.
	var credentials string

	var seedSymbolsCmd = &cobra.Command{
		Use:   "system-symbols",
		Short: "Seed Apple system framework symbols",
		Long:  "Prepare and upload Apple system framework symbols to a Google Cloud Storage bucket.\nUse with caution as it takes a really long time to complete.",
		Run: func(cmd *cobra.Command, args []string) {
			settings := seed.Settings{
				Versions: versions,
			}
			ctx := cmd.Context()

			ss := seed.NewAppleFramework(settings)
			links := ss.GetURLs()
			if err := ss.Init(ctx, driveAPIKey, bucketName, []byte(credentials)); err != nil {
				panic(err)
			}

			if err := ss.ReadLinks(links); err != nil {
				panic(err)
			}

			ss.PrintIntro()

			if err := ss.DownloadAndProcess(ctx); err != nil {
				fmt.Println("failed to download and process:", err.Error())
				panic(err)
			}

			ss.Finish()
			ss.PrintOutro()
		},
	}

	seedSymbolsCmd.
		Flags().
		StringVarP(&driveAPIKey, "key", "k", "", "Google Drive API Key")

	seedSymbolsCmd.
		Flags().
		StringVarP(&bucketName, "bucket", "b", "", "Name of the Google Cloud Storage bucket")

	seedSymbolsCmd.
		Flags().
		StringSliceVarP(&versions, "versions", "v", []string{"latest"}, "Comma separated list of iOS verisons to target.\nExample - \"latest,18.1,17,beta\" targets latest version, 18.1 and 18.1.1, all 17 verions and current beta version")

	seedSymbolsCmd.
		Flags().
		StringVarP(&credentials, "credentials", "C", "", "Valid Google Cloud Credentials JSON string")

	seedSymbolsCmd.Flags().SortFlags = false

	// mark necessary required
	// flags
	seedSymbolsCmd.
		MarkFlagRequired("key")
	seedSymbolsCmd.
		MarkFlagRequired("bucket")
	seedSymbolsCmd.
		MarkFlagRequired("credentials")

	return seedSymbolsCmd
}
