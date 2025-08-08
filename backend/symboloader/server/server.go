package server

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"strings"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	"google.golang.org/grpc/credentials"
)

var Server *server

type server struct {
	PgPool  *pgxpool.Pool
	RpgPool *pgxpool.Pool
	Config  *ServerConfig
}

type PostgresConfig struct {
	/* connection string of the postgres instance */
	DSN string
}

type ServerConfig struct {
	PG                     PostgresConfig
	SymbolsBucket          string
	SymbolsBucketRegion    string
	SymbolsAccessKey       string
	SymbolsSecretAccessKey string
	AWSEndpoint            string
	APIOrigin              string
	OtelServiceName        string
	CloudEnv               bool
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

	apiOrigin := os.Getenv("API_ORIGIN")
	if apiOrigin == "" {
		// log.Fatal("API_ORIGIN env var not set. Need for proxying session attachments.")
		log.Println("API_ORIGIN env var not set. Need for proxying session attachments.")
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		// log.Fatal("POSTGRES_DSN env var is not set, cannot start server")
		log.Println("POSTGRES_DSN env var is not set, cannot start server")
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
		SymbolsBucket:          symbolsBucket,
		SymbolsBucketRegion:    symbolsBucketRegion,
		SymbolsAccessKey:       symbolsAccessKey,
		SymbolsSecretAccessKey: symbolsSecretAccessKey,
		AWSEndpoint:            endpoint,
		APIOrigin:              apiOrigin,
		OtelServiceName:        otelServiceName,
		CloudEnv:               cloudEnv,
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

		oConfig.ConnConfig.DialFunc = func(ctx context.Context, network string, address string) (net.Conn, error) {
			fmt.Printf(">>> Entering custom DialFunc: network: %s, address: %s\n", network, address)
			return d.Dial(ctx, "modified-media-423607-u5:us-central1:s-csql-01", cloudsqlconn.WithPrivateIP())
		}

		rConfig.ConnConfig.DialFunc = func(ctx context.Context, network string, address string) (net.Conn, error) {
			fmt.Printf(">>> Entering custom DialFunc: network: %s, address: %s\n", network, address)
			return d.Dial(ctx, "modified-media-423607-u5:us-central1:s-csql-01", cloudsqlconn.WithPrivateIP())
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

	Server = &server{
		PgPool:  pgPool,
		RpgPool: rPgPool,
		Config:  config,
	}
}

func (sc ServerConfig) InitTracer() func(context.Context) error {
	otelCollectorURL := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	otelInsecureMode := os.Getenv("OTEL_INSECURE_MODE")
	otelServiceName := sc.OtelServiceName

	var secureOption otlptracegrpc.Option

	if strings.ToLower(otelInsecureMode) == "false" || otelInsecureMode == "0" || strings.ToLower(otelInsecureMode) == "f" {
		secureOption = otlptracegrpc.WithTLSCredentials(credentials.NewClientTLSFromCert(nil, ""))
	} else {
		secureOption = otlptracegrpc.WithInsecure()
	}

	exporter, err := otlptrace.New(
		context.Background(),
		otlptracegrpc.NewClient(
			secureOption,
			otlptracegrpc.WithEndpoint(otelCollectorURL),
		),
	)

	if err != nil {
		log.Fatalf("Failed to create exporter: %v", err)
	}
	resources, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			attribute.String("service.name", otelServiceName),
			attribute.String("library.language", "go"),
		),
	)
	if err != nil {
		log.Fatalf("Could not set resources: %v", err)
	}

	otel.SetTracerProvider(
		trace.NewTracerProvider(
			trace.WithSampler(trace.AlwaysSample()),
			trace.WithBatcher(exporter),
			trace.WithResource(resources),
		),
	)

	return exporter.Shutdown
}
