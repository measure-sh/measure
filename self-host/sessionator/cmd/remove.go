package cmd

import (
	"fmt"
	"log"
	"sessionator/config"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/spf13/cobra"
)

func init() {
	removeCmd.AddCommand(newRemoveAppsCmd())
}

var removeCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove resources",
	Long:  "Remove apps, sessions and so on",
}

func newRemoveAppsCmd() *cobra.Command {
	var appId string

	var removeAppsCmd = &cobra.Command{
		Use:   "apps",
		Short: "Remove apps",
		Long:  "Remove apps and all its associated resources",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("Reading config at %q\n", configLocation)

			appIds := []uuid.UUID{
				uuid.MustParse(appId),
			}

			j := janitor{
				appIds: appIds,
			}

			configData, err := config.Init(configLocation)
			if err != nil {
				log.Fatal(err)
			}

			fmt.Println("Validating config")
			if err = configData.ValidateStorage(); err != nil {
				log.Fatal(err)
			}

			ctx := cmd.Context()
			conn, err := pgx.Connect(ctx, configData.Storage["postgres_dsn"])
			if err != nil {
				return
			}

			defer func() {
				if err := conn.Close(ctx); err != nil {
					return
				}
			}()

			tx, err := conn.Begin(ctx)
			if err != nil {
				return
			}

			defer func() {
				if err := tx.Rollback(ctx); err != nil {
					return
				}
			}()

			if err = j.rmSessions(ctx); err != nil {
				return
			}

			if err = j.rmEventFilters(ctx); err != nil {
				return
			}

			if err = j.rmEventMetrics(ctx); err != nil {
				return
			}

			if err = j.rmEvents(ctx); err != nil {
				return
			}

			if err = j.rmSpanFilters(ctx); err != nil {
				return
			}

			if err = j.rmSpanMetrics(ctx); err != nil {
				return
			}

			if err = j.rmSpans(ctx); err != nil {
				return
			}

			if err = j.rmApps(ctx, &tx); err != nil {
				return
			}

			if err = tx.Commit(ctx); err != nil {
				return
			}
		},
	}

	removeAppsCmd.
		Flags().
		StringVarP(&configLocation, "config", "c", "../session-data/config.toml", "location to config.toml")

	removeAppsCmd.
		Flags().
		StringVar(&appId, "id", "", "id of the app")

	removeAppsCmd.Flags().SortFlags = false

	return removeAppsCmd
}
