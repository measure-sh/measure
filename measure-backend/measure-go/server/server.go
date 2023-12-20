package server

import (
	"context"
	"log"
	"measure-backend/measure-go/inet"
	"os"
	"strconv"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5/pgxpool"
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
	MappingFileMaxSize         uint64
	SymbolsBucket              string
	SymbolsBucketRegion        string
	SymbolsAccessKey           string
	SymbolsSecretAccessKey     string
	AttachmentsBucket          string
	AttachmentsBucketRegion    string
	AttachmentsAccessKey       string
	AttachmentsSecretAccessKey string
	AuthJWTSecret              string
}

func NewConfig() *ServerConfig {
	mappingFileMaxSize, err := strconv.ParseUint(os.Getenv("MAPPING_FILE_MAX_SIZE"), 10, 64)
	if err != nil {
		log.Println("using default value of MAPPING_FILE_MAX_SIZE")
		mappingFileMaxSize = 524_288_000
	}

	symbolsBucket := os.Getenv("SYMBOLS_S3_BUCKET")
	if symbolsBucket == "" {
		log.Println("SYMBOLS_S3_BUCKET env var not set, mapping file uploads won't work")
	}

	symbolsBucketRegion := os.Getenv("SYMBOLS_S3_BUCKET_REGION")
	if symbolsBucketRegion == "" {
		log.Println("SYMBOLS_S3_BUCKET_REGION env var not set, mapping file uploads won't work")
	}

	symbolsAccessKey := os.Getenv("SYMBOLS_ACCESS_KEY")
	if symbolsAccessKey == "" {
		log.Println("SYMBOLS_ACCESS_KEY env var not set, mapping file uploads won't work")
	}

	symbolsSecretAccessKey := os.Getenv("SYMBOLS_SECRET_ACCESS_KEY")
	if symbolsSecretAccessKey == "" {
		log.Println("SYMBOLS_SECRET_ACCESS_KEY env var not set, mapping file uploads won't work")
	}

	attachmentsBucket := os.Getenv("ATTACHMENTS_S3_BUCKET")
	if attachmentsBucket == "" {
		log.Println("ATTACHMENTS_S3_BUCKET env var not set, session attachment uploads won't work")
	}

	attachmentsBucketRegion := os.Getenv("ATTACHMENTS_S3_BUCKET_REGION")
	if attachmentsBucketRegion == "" {
		log.Println("ATTACHMENTS_S3_BUCKET_REGION env var not set, session attachment uploads won't work")
	}

	attachmentsAccessKey := os.Getenv("ATTACHMENTS_ACCESS_KEY")
	if attachmentsAccessKey == "" {
		log.Println("ATTACHMENTS_ACCESS_KEY env var not set, session attachment uploads won't work")
	}

	attachmentsSecretAccessKey := os.Getenv("ATTACHMENTS_SECRET_ACCESS_KEY")
	if attachmentsSecretAccessKey == "" {
		log.Println("ATTACHMENTS_SECRET_ACCESS_KEY env var not set, session attachment uploads won't work")
	}

	authJWTSecret := os.Getenv("SUPABASE_AUTH_JWT_SECRET")
	if authJWTSecret == "" {
		log.Println("SUPABASE_AUTH_JWT_SECRET env var not set, dashboard authn won't work")
	}

	return &ServerConfig{
		PG: PostgresConfig{
			DSN: "postgresql://postgres:postgres@localhost:5432/default",
		},
		CH: ClickhouseConfig{
			DSN: "clickhouse://default:@127.0.0.1:9000/default",
		},
		MappingFileMaxSize:         mappingFileMaxSize,
		SymbolsBucket:              symbolsBucket,
		SymbolsBucketRegion:        symbolsBucketRegion,
		SymbolsAccessKey:           symbolsAccessKey,
		SymbolsSecretAccessKey:     symbolsSecretAccessKey,
		AttachmentsBucket:          attachmentsBucket,
		AttachmentsBucketRegion:    attachmentsBucketRegion,
		AttachmentsAccessKey:       attachmentsAccessKey,
		AttachmentsSecretAccessKey: attachmentsSecretAccessKey,
		AuthJWTSecret:              authJWTSecret,
	}
}

func Init(config *ServerConfig) {
	pgPool, err := pgxpool.New(context.Background(), config.PG.DSN)
	if err != nil {
		log.Fatalf("Unable to create PG connection pool: %v\n", err)
	}

	chOpts, err := clickhouse.ParseDSN(config.CH.DSN)
	if err != nil {
		log.Fatalf("Unable to parse CH connection string: %v\n", err)
	}

	chPool, err := clickhouse.Open(chOpts)
	if err != nil {
		log.Fatalf("Unable to create CH connection pool: %v", err)
	}

	inet.Init()

	Server = &server{
		PgPool: pgPool,
		ChPool: chPool,
		Config: config,
	}
}
