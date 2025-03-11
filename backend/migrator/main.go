package main

import (
	"context"
	"errors"
	"fmt"
	"migrator/migrate"
	"os"

	"github.com/spf13/cobra"
)

const migrationLog = "/data/migration.log"

var migrations = []*migrate.ObjMigration{}

var journal *migrate.Journal

var rootCmd = &cobra.Command{
	Use:   "migrator",
	Short: "migrator manages custom object migrations",
	Long:  "migrator can list, migrate or rollback custom object file migrations",
}

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List all known migrations and its status",
	Run: func(cmd *cobra.Command, args []string) {
		migrate.PrintMigrations(migrations, journal)
	},
}

var migrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Runs all pending migrations",
	Run: func(cmd *cobra.Command, args []string) {
		pendingMigrations := migrate.GetPendingMigrations(migrations, journal)

		if len(pendingMigrations) == 0 {
			fmt.Println("No pending migrations")
			return
		}

		for _, migration := range pendingMigrations {
			fmt.Printf("Running %q migration\n", migration.ID)
			if err := migration.Migrate(cmd.Context()); err != nil {
				panic(err)
			}

			if err := journal.Push(migration.ID); err != nil {
				panic(err)
			}
		}
	},
}

var rollbackCmd = &cobra.Command{
	Use:   "rollback",
	Short: "Rolls back the last migration",
	Run: func(cmd *cobra.Command, args []string) {
		lastMigration := migrate.GetLastAppliedMigration(migrations, journal)
		if lastMigration == nil {
			fmt.Println("No migration to rollback")
			return
		}

		fmt.Printf("Rolling back %q\n", lastMigration.ID)

		if err := lastMigration.Rollback(cmd.Context()); err != nil {
			panic(err)
		}

		if err := journal.Pop(lastMigration.ID); err != nil {
			panic(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(migrateCmd)
	rootCmd.AddCommand(rollbackCmd)
}

func loadMigrations() {
	var migrateFn = func(ctx context.Context) (err error) {
		endpointUrl := os.Getenv("AWS_ENDPOINT_URL")
		symbolsBucket := os.Getenv("SYMBOLS_S3_BUCKET")
		symbolsBucketRegion := os.Getenv("SYMBOLS_S3_BUCKET_REGION")
		symbolsAccessKey := os.Getenv("SYMBOLS_ACCESS_KEY")
		symbolsSecretAccessKey := os.Getenv("SYMBOLS_SECRET_ACCESS_KEY")

		symbolsConfig := migrate.SymbolsConfig{
			EndpointUrl:     endpointUrl,
			Bucket:          symbolsBucket,
			Region:          symbolsBucketRegion,
			AccessKey:       symbolsAccessKey,
			SecretAccessKey: symbolsSecretAccessKey,
		}

		result, err := migrate.MigrateSymbolsToUnifiedLayout(ctx, symbolsConfig)
		if err != nil {
			return
		}

		fmt.Printf("Migrated %d mapping.txt proguard to dif\n", len(result))
		return
	}

	var rollbackFn = func(ctx context.Context) error {
		endpointUrl := os.Getenv("AWS_ENDPOINT_URL")
		symbolsBucket := os.Getenv("SYMBOLS_S3_BUCKET")
		symbolsBucketRegion := os.Getenv("SYMBOLS_S3_BUCKET_REGION")
		symbolsAccessKey := os.Getenv("SYMBOLS_ACCESS_KEY")
		symbolsSecretAccessKey := os.Getenv("SYMBOLS_SECRET_ACCESS_KEY")

		symbolsConfig := migrate.SymbolsConfig{
			EndpointUrl:     endpointUrl,
			Bucket:          symbolsBucket,
			Region:          symbolsBucketRegion,
			AccessKey:       symbolsAccessKey,
			SecretAccessKey: symbolsSecretAccessKey,
		}

		return migrate.RollbackSymbolsToLegacyLayout(ctx, symbolsConfig)
	}

	objMigrator := migrate.NewObjMigrator("migration-01", "move proguard mapping.txt files to unified directory layout", migrateFn, rollbackFn)

	migrations = append(migrations, objMigrator)
}

func main() {
	_, err := os.Open(migrationLog)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			fmt.Printf("Creating migration file: %s\n", migrationLog)
			if err := os.WriteFile(migrationLog, []byte{}, 0644); err != nil {
				panic(err)
			}
		} else {
			panic(err)
		}
	}

	journal, err = migrate.NewJournal(migrationLog)
	if err != nil {
		panic(err)
	}

	loadMigrations()

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
