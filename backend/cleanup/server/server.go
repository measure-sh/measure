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
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

var Server *server

type server struct {
	PgPool  *pgxpool.Pool
	RpgPool *pgxpool.Pool
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
	PG                         PostgresConfig
	CH                         ClickhouseConfig
	AttachmentsBucket          string
	AttachmentsBucketRegion    string
	AttachmentsAccessKey       string
	AttachmentsSecretAccessKey string
	AWSEndpoint                string
	AttachmentOrigin           string
	OtelServiceName            string
	CloudEnv                   bool
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

	attachmentsBucket := os.Getenv("ATTACHMENTS_S3_BUCKET")
	if attachmentsBucket == "" {
		log.Println("ATTACHMENTS_S3_BUCKET env var not set, event attachment removal won't work")
	}

	var attachmentsBucketRegion string
	var attachmentsAccessKey string
	var attachmentsSecretAccessKey string
	var attachmentOrigin string

	if !cloudEnv {
		attachmentsBucketRegion = os.Getenv("ATTACHMENTS_S3_BUCKET_REGION")
		if attachmentsBucketRegion == "" {
			log.Println("ATTACHMENTS_S3_BUCKET_REGION env var not set, event attachment removal won't work")
		}

		attachmentsAccessKey = os.Getenv("ATTACHMENTS_ACCESS_KEY")
		if attachmentsAccessKey == "" {
			log.Println("ATTACHMENTS_ACCESS_KEY env var not set, event attachment removal won't work")
		}

		attachmentsSecretAccessKey = os.Getenv("ATTACHMENTS_SECRET_ACCESS_KEY")
		if attachmentsSecretAccessKey == "" {
			log.Println("ATTACHMENTS_SECRET_ACCESS_KEY env var not set, event attachment removal won't work")
		}

		attachmentOrigin = os.Getenv("ATTACHMENTS_S3_ORIGIN")
		if attachmentOrigin == "" {
			log.Println("ATTACHMENTS_S3_ORIGIN env var not set, event attachment removal won't work")
		}
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		log.Println("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")
	if clickhouseDSN == "" {
		log.Println("CLICKHOUSE_DSN env var is not set, cannot start server")
	}

	clickhouseReaderDSN := os.Getenv("CLICKHOUSE_READER_DSN")
	if clickhouseReaderDSN == "" {
		// log.Fatal("CLICKHOUSE_READER_DSN env var is not set, cannot start server")
		log.Println("CLICKHOUSE_READER_DSN env var is not set, cannot start server")
	}

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	endpoint := os.Getenv("AWS_ENDPOINT_URL")

	return &ServerConfig{
		PG: PostgresConfig{
			DSN: postgresDSN,
		},
		CH: ClickhouseConfig{
			DSN:       clickhouseDSN,
			ReaderDSN: clickhouseReaderDSN,
		},
		AttachmentsBucket:          attachmentsBucket,
		AttachmentsBucketRegion:    attachmentsBucketRegion,
		AttachmentsAccessKey:       attachmentsAccessKey,
		AttachmentsSecretAccessKey: attachmentsSecretAccessKey,
		AWSEndpoint:                endpoint,
		AttachmentOrigin:           attachmentOrigin,
		OtelServiceName:            otelServiceName,
		CloudEnv:                   cloudEnv,
	}
}

func Init(config *ServerConfig) {
	ctx := context.Background()
	var pgPool *pgxpool.Pool
	var rPgPool *pgxpool.Pool

	// read/write pool
	oConfig, err := pgxpool.ParseConfig(config.PG.DSN)
	if err != nil {
		log.Fatalf("Unable to parse postgres connection string: %v\n", err)
	}
	oConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET role operator")
		return err
	}

	// reader pool
	rConfig, err := pgxpool.ParseConfig(config.PG.DSN)
	if err != nil {
		log.Fatalf("Unable to parse reader postgres connection string: %v\n", err)
	}
	rConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET role reader")
		return err
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
			fmt.Println("Failed to dial postgress connection.")
		}

		csqlConnName := os.Getenv("CSQL_CONN_NAME")
		if csqlConnName == "" {
			fmt.Println("CSQL_CONN_NAME environment variable is not set.")
		}

		oConfig.ConnConfig.DialFunc = func(ctx context.Context, network string, address string) (net.Conn, error) {
			fmt.Printf("Dialing network: %s, address: %s\n", network, address)
			return d.Dial(ctx, csqlConnName, cloudsqlconn.WithPrivateIP())
		}

		rConfig.ConnConfig.DialFunc = func(ctx context.Context, network string, address string) (net.Conn, error) {
			fmt.Printf("Dialing reader network: %s, address: %s\n", network, address)
			return d.Dial(ctx, csqlConnName, cloudsqlconn.WithPrivateIP())
		}
	}

	pool, err := pgxpool.NewWithConfig(ctx, oConfig)
	if err != nil {
		log.Fatalf("Unable to create PG connection pool: %v\n", err)
	}
	pgPool = pool

	rPool, err := pgxpool.NewWithConfig(ctx, rConfig)
	if err != nil {
		log.Fatalf("Unable to create reader PG connection pool: %v\n", err)
	}
	rPgPool = rPool

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
		RpgPool: rPgPool,
		ChPool:  chPool,
		RchPool: rChPool,
		Config:  config,
	}
}
