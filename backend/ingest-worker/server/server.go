package server

import (
	"backend/libs/bus"
	"backend/libs/inet"
	"backend/libs/ingest"
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	redis "github.com/valkey-io/valkey-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	"google.golang.org/grpc/credentials"
)

var Server *server

type server struct {
	PgPool      *pgxpool.Pool
	ChPool      driver.Conn
	Config      *ServerConfig
	VK          redis.Client
	BusConsumer bus.Consumer
}

type PostgresConfig struct {
	DSN string
}

type ClickhouseConfig struct {
	DSN string
}

type RedisConfig struct {
	Host string
	Port int
}

type IggyConfig struct {
	// Addr is the Iggy server address in "host:port" form.
	Addr string
	// Username and Password are used for credential-based login.
	Username string
	Password string
}

type ServerConfig struct {
	PG                         PostgresConfig
	CH                         ClickhouseConfig
	RD                         RedisConfig
	IG                         IggyConfig
	ServiceAccountEmail        string
	SymbolsBucket              string
	SymbolsBucketRegion        string
	SymbolsAccessKey           string
	SymbolsSecretAccessKey     string
	AttachmentsBucket          string
	AttachmentsBucketRegion    string
	AttachmentsAccessKey       string
	AttachmentsSecretAccessKey string
	AWSEndpoint                string
	APIOrigin                  string
	SymbolicatorOrigin         string
	OtelServiceName            string
	CloudEnv                   bool
	IngestEnforceTimeWindow    bool
}

// IsCloud is true if the service is
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

	var serviceAccountEmail string
	if cloudEnv {
		serviceAccountEmail = os.Getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL")
		if serviceAccountEmail == "" {
			log.Println("GOOGLE_SERVICE_ACCOUNT_EMAIL env var not set")
		}
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

	apiOrigin := os.Getenv("API_ORIGIN")
	if apiOrigin == "" {
		log.Println("API_ORIGIN env var not set. Need for proxying session attachments.")
	}

	symbolicatorOrigin := os.Getenv("SYMBOLICATOR_ORIGIN")
	if symbolicatorOrigin == "" {
		log.Println("SYMBOLICATOR_ORIGIN env var not set. Need for de-obfuscating events.")
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		log.Println("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")
	if clickhouseDSN == "" {
		log.Println("CLICKHOUSE_DSN env var is not set, cannot start server")
	}

	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		log.Println("REDIS_HOST env var is not set, caching will not work")
	}

	redisPortStr := os.Getenv("REDIS_PORT")
	if redisPortStr == "" {
		log.Println("REDIS_PORT env var is not set, caching will not work")
	}

	redisPort, err := strconv.Atoi(redisPortStr)
	if err != nil {
		log.Fatalf("Invalid REDIS_PORT value: %v", err)
	}

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	endpoint := os.Getenv("AWS_ENDPOINT_URL")
	enforceIngestTimeWindow := os.Getenv("INGEST_ENFORCE_TIME_WINDOW") != ""

	iggyAddr := os.Getenv("IGGY_ADDR")
	if iggyAddr == "" && !cloudEnv {
		log.Println("IGGY_ADDR env var is not set, Iggy message streaming will not work")
	}

	iggyUsername := os.Getenv("IGGY_USERNAME")
	if iggyUsername == "" {
		log.Println("IGGY_USERNAME env var is not set, Iggy message streaming will not work")
	}

	iggyPassword := os.Getenv("IGGY_PASSWORD")
	if iggyPassword == "" {
		log.Println("IGGY_PASSWORD env var is not set, Iggy message streaming will not work")
	}

	return &ServerConfig{
		PG: PostgresConfig{
			DSN: postgresDSN,
		},
		CH: ClickhouseConfig{
			DSN: clickhouseDSN,
		},
		RD: RedisConfig{
			Host: redisHost,
			Port: redisPort,
		},
		IG: IggyConfig{
			Addr:     iggyAddr,
			Username: iggyUsername,
			Password: iggyPassword,
		},
		ServiceAccountEmail:        serviceAccountEmail,
		SymbolsBucket:              symbolsBucket,
		SymbolsBucketRegion:        symbolsBucketRegion,
		SymbolsAccessKey:           symbolsAccessKey,
		SymbolsSecretAccessKey:     symbolsSecretAccessKey,
		AttachmentsBucket:          attachmentsBucket,
		AttachmentsBucketRegion:    attachmentsBucketRegion,
		AttachmentsAccessKey:       attachmentsAccessKey,
		AttachmentsSecretAccessKey: attachmentsSecretAccessKey,
		AWSEndpoint:                endpoint,
		APIOrigin:                  apiOrigin,
		SymbolicatorOrigin:         symbolicatorOrigin,
		OtelServiceName:            otelServiceName,
		CloudEnv:                   cloudEnv,
		IngestEnforceTimeWindow:    enforceIngestTimeWindow,
	}
}

func WaitForPg(ctx context.Context, pgPool *pgxpool.Pool, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		if err := pgPool.Ping(ctx); err == nil {
			return nil
		} else {
			fmt.Printf("PG ping failed: %v; Retrying...\n", err)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func Init(config *ServerConfig) {
	ctx := context.Background()
	var pgPool *pgxpool.Pool

	oConfig, err := pgxpool.ParseConfig(config.PG.DSN)
	if err != nil {
		log.Printf("Unable to parse postgres connection string: %v\n", err)
	}

	oConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, oConfig)
	if err != nil {
		log.Printf("Unable to create PG connection pool: %v\n", err)
	}
	pgPool = pool

	if err := WaitForPg(ctx, pgPool, 5*time.Second); err != nil {
		fmt.Printf("Postgres pool not ready: %v\n", err)
	}

	chOpts, err := clickhouse.ParseDSN(config.CH.DSN)
	if err != nil {
		log.Printf("Unable to parse CH connection string: %v\n", err)
	}

	if gin.Mode() == gin.ReleaseMode {
		chOpts.Settings = clickhouse.Settings{
			"wait_for_async_insert":         1,
			"wait_for_async_insert_timeout": 1000,
			"compatibility":                 "25.10",
		}

		chOpts.Compression = &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		}
	}

	chPool, err := clickhouse.Open(chOpts)
	if err != nil {
		log.Printf("Unable to create CH connection pool: %v\n", err)
	}

	if err := inet.Init(); err != nil {
		log.Printf("Unable to initialize geo ip lookup system: %v\n", err)
	}

	addr := fmt.Sprintf("%s:%d", config.RD.Host, config.RD.Port)
	options := redis.ClientOption{
		InitAddress: []string{addr},
	}

	options.ConnWriteTimeout = 30 * time.Second
	options.ClientName = "measure-ingest-worker"

	vkClient, err := redis.NewClient(options)
	if err != nil {
		log.Printf("failed to create redis client: %v\n", err)
	}

	sqlf.SetDialect(sqlf.PostgreSQL)

	Server = &server{
		PgPool: pgPool,
		ChPool: chPool,
		Config: config,
		VK:     vkClient,
	}

	var batchSize = 1000
	ingestBatchSize := os.Getenv("INGEST_BATCH_SIZE")
	if ingestBatchSize != "" {
		batchSize, err = strconv.Atoi(ingestBatchSize)
		if err != nil {
			log.Printf("failed to parse INGEST_BATCH_SIZE: %v\n", err)
		}
	}

	if config.CloudEnv {
		subscription := os.Getenv("INGEST_PUBSUB_SUBSCRIPTION")
		fmt.Println("Name of subscription:", subscription)
		if subscription != "" {
			consumer, err := bus.NewPubSubConsumer(
				context.Background(),
				subscription,
				bus.WithPubSubMaxOutstandingMessages(batchSize),
			)
			if err != nil {
				log.Printf("failed to create Pub/Sub consumer: %v\n", err)
			} else {
				Server.BusConsumer = consumer
			}
		}
	} else {
		var pollInterval = 30 * time.Second
		ingestPollInterval := os.Getenv("INGEST_POLL_INTERVAL")
		if ingestPollInterval != "" {
			pollInterval, err = time.ParseDuration(ingestPollInterval)
			if err != nil {
				log.Printf("failed to parse INGEST_POLL_INTERVAL: %v\n", err)
			}
		}

		consumer, err := bus.NewIggyGroupConsumer(
			config.IG.Addr,
			config.IG.Username,
			config.IG.Password,
			"ingest-batch-consumer",
			bus.DefaultStreamName,
			ingest.IngestBatchTopic,
			bus.WithIggyBatchSize(batchSize),
			bus.WithIggyPollInterval(pollInterval),
		)
		if err != nil {
			log.Printf("failed to create Iggy consumer: %v\n", err)
		} else {
			Server.BusConsumer = consumer
		}
	}
}

func InitForTest(config *ServerConfig, pgPool *pgxpool.Pool, chPool driver.Conn, vk redis.Client) {
	Server = &server{
		PgPool: pgPool,
		ChPool: chPool,
		Config: config,
		VK:     vk,
	}
}

func (sc ServerConfig) InitTracing() func(context.Context) error {
	otelCollectorURL := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	otelProtocol := os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL")
	otelInsecureMode := os.Getenv("OTEL_INSECURE_MODE")
	otelServiceName := sc.OtelServiceName

	isInsecure := strings.ToLower(otelInsecureMode) != "false" &&
		otelInsecureMode != "0" &&
		strings.ToLower(otelInsecureMode) != "f"

	resources, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			attribute.String("service.name", otelServiceName),
			attribute.String("library.language", "go"),
		),
	)
	if err != nil {
		log.Printf("Could not set resources: %v\n", err)
	}

	var tracesClient otlptrace.Client
	if strings.Contains(otelProtocol, "http") {
		tracesClient = otlptracehttp.NewClient()
	} else {
		var opts []otlptracegrpc.Option
		opts = append(opts, otlptracegrpc.WithEndpoint(otelCollectorURL))
		if isInsecure {
			opts = append(opts, otlptracegrpc.WithInsecure())
		} else {
			opts = append(opts, otlptracegrpc.WithTLSCredentials(credentials.NewClientTLSFromCert(nil, "")))
		}
		tracesClient = otlptracegrpc.NewClient(opts...)
	}

	tracesExporter, err := otlptrace.New(context.Background(), tracesClient)
	if err != nil {
		log.Printf("Failed to create traces exporter: %v\n", err)
	}

	tracerProvider := trace.NewTracerProvider(
		trace.WithSampler(trace.AlwaysSample()),
		trace.WithBatcher(tracesExporter),
		trace.WithResource(resources),
	)
	otel.SetTracerProvider(tracerProvider)

	var metricsOpts []otlpmetricgrpc.Option
	metricsOpts = append(metricsOpts, otlpmetricgrpc.WithEndpoint(otelCollectorURL))
	if isInsecure {
		metricsOpts = append(metricsOpts, otlpmetricgrpc.WithInsecure())
	} else {
		metricsOpts = append(metricsOpts, otlpmetricgrpc.WithTLSCredentials(credentials.NewClientTLSFromCert(nil, "")))
	}

	metricsExporter, err := otlpmetricgrpc.New(context.Background(), metricsOpts...)
	if err != nil {
		log.Printf("Failed to create metrics exporter: %v\n", err)
	}

	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(resources),
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricsExporter)),
	)
	otel.SetMeterProvider(meterProvider)

	return func(ctx context.Context) error {
		if err := tracesExporter.Shutdown(ctx); err != nil {
			log.Printf("Failed to shutdown traces exporter: %v\n", err)
		}
		if err := metricsExporter.Shutdown(ctx); err != nil {
			log.Printf("Failed to shutdown metrics exporter: %v\n", err)
		}
		return nil
	}
}
