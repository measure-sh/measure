package testinfra

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"path/filepath"
	"runtime"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/amacneil/dbmate/v2/pkg/dbmate"
	_ "github.com/amacneil/dbmate/v2/pkg/driver/clickhouse" // blank import: triggers init() to register clickhouse driver with dbmate
	_ "github.com/amacneil/dbmate/v2/pkg/driver/postgres"   // blank import: triggers init() to register postgres driver with dbmate
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	chmodule "github.com/testcontainers/testcontainers-go/modules/clickhouse" // aliased to avoid conflict with clickhouse-go/v2
	pgmodule "github.com/testcontainers/testcontainers-go/modules/postgres"   // aliased for consistency with chmodule
	vkmodule "github.com/testcontainers/testcontainers-go/modules/valkey"
	"github.com/valkey-io/valkey-go"
)

const (
	// Test database credentials.
	postgresImage   = "postgres:16.3-alpine"
	clickhouseImage = "clickhouse/clickhouse-server:25.8-alpine"
	valkeyImage     = "valkey/valkey:8-alpine"
	testDBUser      = "test"
	testDBPassword  = "test"
	testDBName      = "measure"
)

// repoRoot returns the absolute path to the repository root.
// This file lives at backend/testinfra/testinfra.go, so the
// repo root is two directories up.
func repoRoot() string {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("unable to determine repo root via runtime.Caller")
	}
	return filepath.Join(filepath.Dir(filename), "..", "..")
}

// runMigrations runs all dbmate migrations from the given directory
// against the database at the given URL.
func runMigrations(rawURL string, migDir string) {
	u, err := url.Parse(rawURL)
	if err != nil {
		log.Fatalf("failed to parse migration URL: %v", err)
	}

	db := dbmate.New(u)
	db.AutoDumpSchema = false
	db.MigrationsDir = []string{migDir}

	if err := db.Migrate(); err != nil {
		log.Fatalf("failed to run migrations from %s: %v", migDir, err)
	}
}

// SetupPostgres starts a Postgres container, creates the measure schema,
// runs all migrations from self-host/postgres/, and returns a *pgxpool.Pool
// plus a cleanup function.
func SetupPostgres(ctx context.Context) (*pgxpool.Pool, func()) {
	container, err := pgmodule.Run(ctx,
		postgresImage,
		pgmodule.WithDatabase(testDBName),
		pgmodule.WithUsername(testDBUser),
		pgmodule.WithPassword(testDBPassword),
		pgmodule.WithSQLDriver("pgx"),
		pgmodule.BasicWaitStrategies(),
	)
	if err != nil {
		log.Fatalf("failed to start postgres container: %v", err)
	}

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("failed to get postgres connection string: %v", err)
	}

	poolConfig, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		log.Fatalf("failed to parse postgres config: %v", err)
	}
	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	poolConfig.ConnConfig.RuntimeParams["search_path"] = "measure"

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("failed to create postgres pool: %v", err)
	}

	// Create the measure schema used by all tables.
	if _, err := pool.Exec(ctx, "CREATE SCHEMA IF NOT EXISTS measure"); err != nil {
		log.Fatalf("failed to create measure schema: %v", err)
	}

	// Run all Postgres migrations using dbmate.
	// search_path includes both dbmate (for schema_migrations) and measure.
	migDir := filepath.Join(repoRoot(), "self-host", "postgres")
	pgURL, err := url.Parse(connStr)
	if err != nil {
		log.Fatalf("failed to parse postgres URL for migrations: %v", err)
	}
	q := pgURL.Query()
	q.Set("search_path", "dbmate,measure")
	q.Set("sslmode", "disable")
	pgURL.RawQuery = q.Encode()
	runMigrations(pgURL.String(), migDir)

	sqlf.SetDialect(sqlf.PostgreSQL)

	cleanup := func() {
		pool.Close()
		container.Terminate(context.Background())
	}

	return pool, cleanup
}

// SetupClickHouse starts a ClickHouse container, creates the measure
// database, runs all migrations from self-host/clickhouse/, and returns
// a driver.Conn plus a cleanup function.
func SetupClickHouse(ctx context.Context) (driver.Conn, func()) {
	container, err := chmodule.Run(ctx,
		clickhouseImage,
		chmodule.WithDatabase(testDBName),
		chmodule.WithUsername(testDBUser),
		chmodule.WithPassword(testDBPassword),
	)
	if err != nil {
		log.Fatalf("failed to start clickhouse container: %v", err)
	}

	connStr, err := container.ConnectionString(ctx)
	if err != nil {
		log.Fatalf("failed to get clickhouse connection string: %v", err)
	}

	// Run all ClickHouse migrations using dbmate.
	migDir := filepath.Join(repoRoot(), "self-host", "clickhouse")
	runMigrations(connStr, migDir)

	opts, err := clickhouse.ParseDSN(connStr)
	if err != nil {
		log.Fatalf("failed to parse clickhouse DSN: %v", err)
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		log.Fatalf("failed to open clickhouse connection: %v", err)
	}

	if err := conn.Ping(ctx); err != nil {
		log.Fatalf("failed to ping clickhouse: %v", err)
	}

	cleanup := func() {
		conn.Close()
		container.Terminate(context.Background())
	}

	return conn, cleanup
}

// SetupValkey starts a Valkey container and returns a valkey.Client
// plus a cleanup function.
func SetupValkey(ctx context.Context) (valkey.Client, func()) {
	container, err := vkmodule.Run(ctx, valkeyImage)
	if err != nil {
		log.Fatalf("failed to start valkey container: %v", err)
	}

	connStr, err := container.ConnectionString(ctx)
	if err != nil {
		log.Fatalf("failed to get valkey connection string: %v", err)
	}

	// ConnectionString returns a URI like "redis://host:port".
	// valkey-go expects "host:port".
	u, err := url.Parse(connStr)
	if err != nil {
		log.Fatalf("failed to parse valkey connection string: %v", err)
	}
	addr := fmt.Sprintf("%s:%s", u.Hostname(), u.Port())

	client, err := valkey.NewClient(valkey.ClientOption{
		InitAddress: []string{addr},
	})
	if err != nil {
		log.Fatalf("failed to create valkey client: %v", err)
	}

	cleanup := func() {
		client.Close()
		container.Terminate(context.Background())
	}

	return client, cleanup
}
