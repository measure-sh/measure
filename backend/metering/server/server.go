package server

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

var Server *server

type server struct {
	PgPool  *pgxpool.Pool
	ChPool  driver.Conn
	RchPool driver.Conn
	Config  *ServerConfig
}

type PostgresConfig struct {
	/* connection string of the postgres instance */
	DSN string
}

type ClickhouseConfig struct {
	/* connection string of the clickhouse instance */
	DSN       string
	ReaderDSN string
}

type ServerConfig struct {
	PG              PostgresConfig
	CH              ClickhouseConfig
	OtelServiceName string
	CloudEnv        bool
}

// IsCloud is true if the service is assumed
// running on a cloud environment.
func (sc *ServerConfig) IsCloud() bool {
	if sc.CloudEnv {
		return true
	}

	return false
}

func NewConfig() *ServerConfig {
	cloudEnv := false
	if os.Getenv("K_SERVICE") != "" && os.Getenv("K_REVISION") != "" {
		cloudEnv = true
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		log.Fatal("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")
	if clickhouseDSN == "" {
		log.Fatal("CLICKHOUSE_DSN env var is not set, cannot start server")
	}

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	return &ServerConfig{
		PG: PostgresConfig{
			DSN: postgresDSN,
		},
		CH: ClickhouseConfig{
			DSN: clickhouseDSN,
		},
		OtelServiceName: otelServiceName,
		CloudEnv:        cloudEnv,
	}
}

func Init(config *ServerConfig) {
	ctx := context.Background()
	var pgPool *pgxpool.Pool

	// read/write pool
	oConfig, err := pgxpool.ParseConfig(config.PG.DSN)
	if err != nil {
		log.Fatalf("Unable to parse postgres connection string: %v\n", err)
	}

	if config.IsCloud() {
		d, err := cloudsqlconn.NewDialer(ctx,
			// Always use IAM authentication.
			cloudsqlconn.WithIAMAuthN(),
			// In Cloud Run CPU is throttled outside of a request
			// context causing the backend refresh to fail, hence
			// the need for `WithLazyRefresh()` option.
			cloudsqlconn.WithLazyRefresh(),
		)
		if err != nil {
			fmt.Println("Failed to dial postgres connection.")
		}

		csqlConnName := os.Getenv("CSQL_CONN_NAME")
		if csqlConnName == "" {
			fmt.Println("CSQL_CONN_NAME environment variable is not set.")
		}

		oConfig.ConnConfig.DialFunc = func(ctx context.Context, network string, address string) (net.Conn, error) {
			fmt.Printf("Dialing network: %s, address: %s\n", network, address)
			return d.Dial(ctx, csqlConnName, cloudsqlconn.WithPrivateIP())
		}
	}

	pool, err := pgxpool.NewWithConfig(ctx, oConfig)
	if err != nil {
		log.Fatalf("Unable to create PG connection pool: %v\n", err)
	}
	pgPool = pool

	chOpts, err := clickhouse.ParseDSN(config.CH.DSN)
	if err != nil {
		// log.Fatalf("Unable to parse CH connection string: %v\n", err)
		log.Printf("Unable to parse CH connection string: %v\n", err)
	}

	rChOpts, err := clickhouse.ParseDSN(config.CH.ReaderDSN)
	if err != nil {
		log.Printf("unable to parse reader CH connection string %v\n", err)
	}

	chPool, err := clickhouse.Open(chOpts)
	if err != nil {
		// log.Fatalf("Unable to create CH connection pool: %v", err)
		log.Printf("Unable to create CH connection pool: %v\n", err)
	}

	rChPool, err := clickhouse.Open(rChOpts)
	if err != nil {
		log.Printf("Unable to create reader CH connection pool: %v\n", err)
	}

	sqlf.SetDialect(sqlf.PostgreSQL)

	Server = &server{
		PgPool:  pgPool,
		ChPool:  chPool,
		RchPool: rChPool,
		Config:  config,
	}
}
