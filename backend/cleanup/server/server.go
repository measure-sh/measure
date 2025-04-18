package server

import (
	"context"
	"log"
	"os"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

var Server *server

type server struct {
	PgPool *pgxpool.Pool
	ChPool driver.Conn
	Config *ServerConfig
}

type PostgresConfig struct {
	/* connection string of the postgres instance */
	DSN string
}

type ClickhouseConfig struct {
	/* connection string of the clickhouse instance */
	DSN string
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
}

func NewConfig() *ServerConfig {

	attachmentsBucket := os.Getenv("ATTACHMENTS_S3_BUCKET")
	if attachmentsBucket == "" {
		log.Println("ATTACHMENTS_S3_BUCKET env var not set, event attachment uploads won't work")
	}

	attachmentsBucketRegion := os.Getenv("ATTACHMENTS_S3_BUCKET_REGION")
	if attachmentsBucketRegion == "" {
		log.Println("ATTACHMENTS_S3_BUCKET_REGION env var not set, event attachment uploads won't work")
	}

	attachmentsAccessKey := os.Getenv("ATTACHMENTS_ACCESS_KEY")
	if attachmentsAccessKey == "" {
		log.Println("ATTACHMENTS_ACCESS_KEY env var not set, event attachment uploads won't work")
	}

	attachmentsSecretAccessKey := os.Getenv("ATTACHMENTS_SECRET_ACCESS_KEY")
	if attachmentsSecretAccessKey == "" {
		log.Println("ATTACHMENTS_SECRET_ACCESS_KEY env var not set, event attachment uploads won't work")
	}

	attachmentOrigin := os.Getenv("ATTACHMENTS_S3_ORIGIN")
	if attachmentOrigin == "" {
		log.Println("ATTACHMENTS_S3_ORIGIN env var not set, event attachment downloads won't work")
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		log.Println("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")
	if clickhouseDSN == "" {
		log.Println("CLICKHOUSE_DSN env var is not set, cannot start server")
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
			DSN: clickhouseDSN,
		},
		AttachmentsBucket:          attachmentsBucket,
		AttachmentsBucketRegion:    attachmentsBucketRegion,
		AttachmentsAccessKey:       attachmentsAccessKey,
		AttachmentsSecretAccessKey: attachmentsSecretAccessKey,
		AWSEndpoint:                endpoint,
		AttachmentOrigin:           attachmentOrigin,
		OtelServiceName:            otelServiceName,
	}
}

func Init(config *ServerConfig) {
	pgPool, err := pgxpool.New(context.Background(), config.PG.DSN)
	if err != nil {
		log.Printf("Unable to create PG connection pool: %v\n", err)
	}

	chOpts, err := clickhouse.ParseDSN(config.CH.DSN)
	if err != nil {
		log.Printf("Unable to parse CH connection string: %v\n", err)
	}

	chPool, err := clickhouse.Open(chOpts)
	if err != nil {
		log.Printf("Unable to create CH connection pool: %v", err)
	}

	sqlf.SetDialect(sqlf.PostgreSQL)

	Server = &server{
		PgPool: pgPool,
		ChPool: chPool,
		Config: config,
	}
}
