package main

import (
	"context"
	"fmt"
	"migrator/migrate"
	"os"
)

func main() {
	var migrateFn = func() (err error) {
		fmt.Println("migrate fn")

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

		ctx := context.Background()

		result, err := migrate.MigrateSymbolsToUnifiedLayout(ctx, symbolsConfig)
		if err != nil {
			return
		}

		fmt.Println(result)
		return
	}

	var rollbackFn = func() error {
		fmt.Println("rollback fn")

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

		ctx := context.Background()

		return migrate.RollbackSymbolsToLegacyLayout(ctx, symbolsConfig)
	}

	objMigrator := migrate.NewObjMigrator("move symbol files to unified directory layout", migrateFn, rollbackFn)

	objMigrator.Migrate()
	objMigrator.Rollback()
}
