package server

import (
	"backend/api/inet"
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/wneessen/go-mail"
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
	ChPool  driver.Conn
	RchPool driver.Conn
	Mail    *mail.Client
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
	AttachmentOrigin           string
	SiteOrigin                 string
	APIOrigin                  string
	SymbolicatorOrigin         string
	OAuthGitHubKey             string
	OAuthGitHubSecret          string
	OAuthGoogleKey             string
	AccessTokenSecret          []byte
	RefreshTokenSecret         []byte
	SmtpHost                   string
	SmtpPort                   string
	SmtpUser                   string
	SmtpPassword               string
	EmailDomain                string
	TxEmailAddress             string
	SlackClientID              string
	SlackClientSecret          string
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

	// capture google service account email when running in
	// cloud. need this to create signed PUT URLs for uploading
	// symbol files.
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

	attachmentOrigin := os.Getenv("ATTACHMENTS_S3_ORIGIN")
	if attachmentOrigin == "" {
		log.Println("ATTACHMENTS_S3_ORIGIN env var not set, event attachment downloads will be proxied")
	}

	siteOrigin := os.Getenv("SITE_ORIGIN")
	if siteOrigin == "" {
		log.Fatal("SITE_ORIGIN env var not set. Authentication and emails might not work.")
	}

	apiOrigin := os.Getenv("API_ORIGIN")
	if apiOrigin == "" {
		// log.Fatal("API_ORIGIN env var not set. Need for proxying session attachments.")
		log.Println("API_ORIGIN env var not set. Need for proxying session attachments.")
	}

	symbolicatorOrigin := os.Getenv("SYMBOLICATOR_ORIGIN")
	if symbolicatorOrigin == "" {
		// log.Fatal("SYMBOLICATOR_ORIGIN env var not set. Need for de-obfuscating events.")
		log.Println("SYMBOLICATOR_ORIGIN env var not set. Need for de-obfuscating events.")
	}

	oauthGitHubKey := os.Getenv("OAUTH_GITHUB_KEY")
	if oauthGitHubKey == "" {
		log.Println("OAUTH_GITHUB_KEY env var is not set, dashboard authn won't work")
	}

	oauthGitHubSecret := os.Getenv("OAUTH_GITHUB_SECRET")
	if oauthGitHubSecret == "" {
		log.Println("OAUTH_GITHUB_SECRET env var is not set, dashboard authn won't work")
	}

	oauthGoogleKey := os.Getenv("OAUTH_GOOGLE_KEY")
	if oauthGoogleKey == "" {
		log.Println("OAUTH_GOOGLE_KEY env var is not set, dashboard authn won't work")
	}

	atSecret := os.Getenv("SESSION_ACCESS_SECRET")
	if atSecret == "" {
		log.Println("SESSION_ACCESS_SECRET env var is not set, dashboard authn won't work")
	}

	rtSecret := os.Getenv("SESSION_REFRESH_SECRET")
	if rtSecret == "" {
		log.Println("SESSION_REFRESH_SECRET env var is not set, dashboard authn won't work")
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		// log.Fatal("POSTGRES_DSN env var is not set, cannot start server")
		log.Println("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")
	if clickhouseDSN == "" {
		// log.Fatal("CLICKHOUSE_DSN env var is not set, cannot start server")
		log.Println("CLICKHOUSE_DSN env var is not set, cannot start server")
	}

	clickhouseReaderDSN := os.Getenv("CLICKHOUSE_READER_DSN")
	if clickhouseReaderDSN == "" {
		// log.Fatal("CLICKHOUSE_READER_DSN env var is not set, cannot start server")
		log.Println("CLICKHOUSE_READER_DSN env var is not set, cannot start server")
	}

	smtpHost := os.Getenv("SMTP_HOST")
	if smtpHost == "" {
		log.Println("SMTP_HOST env var is not set, emails will not work")
	}

	smtpPort := os.Getenv("SMTP_PORT")
	if smtpPort == "" {
		log.Println("SMTP_PORT env var is not set, emails will not work")
	}

	smtpUser := os.Getenv("SMTP_USER")
	if smtpUser == "" {
		log.Println("SMTP_USER env var is not set, emails will not work")
	}

	smtpPassword := os.Getenv("SMTP_PASSWORD")
	if smtpPassword == "" {
		log.Println("SMTP_PASSWORD env var is not set, emails will not work")
	}

	emailDomain := os.Getenv("EMAIL_DOMAIN")
	if emailDomain == "" {
		log.Println("EMAIL_DOMAIN env var is not set, emails will use SITE_ORIGIN as domain")
	}

	var txEmailAddress string
	if emailDomain != "" {
		txEmailAddress = "noreply@" + emailDomain
	} else {
		parsedSiteOrigin, err := url.Parse(siteOrigin)
		if err != nil {
			log.Fatalf("Error parsing SITE_ORIGIN: %v\n", err)
		}
		txEmailAddress = "noreply@" + parsedSiteOrigin.Hostname()
	}

	slackClientID := os.Getenv("SLACK_CLIENT_ID")
	if slackClientID == "" {
		log.Println("SLACK_CLIENT_ID env var is not set, Slack integration will not work")
	}

	slackClientSecret := os.Getenv("SLACK_CLIENT_SECRET")
	if slackClientSecret == "" {
		log.Println("SLACK_CLIENT_SECRET env var is not set, Slack integration will not work")
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
		AttachmentOrigin:           attachmentOrigin,
		SiteOrigin:                 siteOrigin,
		APIOrigin:                  apiOrigin,
		SymbolicatorOrigin:         symbolicatorOrigin,
		OAuthGitHubKey:             oauthGitHubKey,
		OAuthGitHubSecret:          oauthGitHubSecret,
		OAuthGoogleKey:             oauthGoogleKey,
		AccessTokenSecret:          []byte(atSecret),
		RefreshTokenSecret:         []byte(rtSecret),
		SmtpHost:                   smtpHost,
		SmtpPort:                   smtpPort,
		SmtpUser:                   smtpUser,
		SmtpPassword:               smtpPassword,
		EmailDomain:                emailDomain,
		TxEmailAddress:             txEmailAddress,
		SlackClientID:              slackClientID,
		SlackClientSecret:          slackClientSecret,
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

	if gin.Mode() == gin.ReleaseMode {
		chOpts.Settings = clickhouse.Settings{
			"use_query_cache":                1,
			"query_cache_ttl":                600,
			"query_cache_min_query_duration": 1000,
		}
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

	if err := inet.Init(); err != nil {
		// log.Fatalf("Unable to initialize geo ip lookup system: %v", err)
		log.Printf("Unable to initialize geo ip lookup system: %v", err)
	}

	// init email client
	var mailClient *mail.Client
	if config.SmtpHost != "" || config.SmtpPort != "" || config.SmtpUser != "" || config.SmtpPassword != "" {
		smtpConfigPort, err := strconv.Atoi(config.SmtpPort)
		if err != nil {
			log.Printf("Invalid smtp port: %s", err)
		}

		mailClient, err = mail.NewClient(config.SmtpHost, mail.WithPort(smtpConfigPort), mail.WithSMTPAuth(mail.SMTPAuthPlain),
			mail.WithUsername(config.SmtpUser), mail.WithPassword(config.SmtpPassword))
		if err != nil {
			log.Printf("failed to create email client: %s", err)
		}
	}

	Server = &server{
		PgPool:  pgPool,
		RpgPool: rPgPool,
		ChPool:  chPool,
		RchPool: rChPool,
		Config:  config,
		Mail:    mailClient,
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
