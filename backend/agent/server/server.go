// Package server is the agent's boot layer. It owns the agent's runtime Config
// and Deps types, reads and builds them (NewConfig, Connect), and the agent's
// main threads a *Deps explicitly into the handlers and domain code.
//
// Each service owns its copy of this boot code: the shared libs carry only
// domain logic and the plain Config/Deps data types, never the construction.
// Kept in sync with the other services' server packages by hand.
package server

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/libs/autumn"
	"backend/libs/ga4"
	"backend/libs/inet"
	"backend/libs/posthog"
	"backend/libs/secret"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	redis "github.com/valkey-io/valkey-go"
	"github.com/wneessen/go-mail"
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

type PostgresConfig struct {
	/* connection string of the postgres instance */
	DSN string
}

type ClickhouseConfig struct {
	/* connection string of the clickhouse instance */
	DSN       string
	ReaderDSN string
}

type RedisConfig struct {
	Host string
	Port int
}

type IggyConfig struct {
	Addr     string
	Username string
	Password string
}

// Config is the agent's parsed runtime configuration. The server package owns it
// (built by NewConfig) and threads it explicitly into the code that needs it.
type Config struct {
	PG                           PostgresConfig
	CH                           ClickhouseConfig
	RD                           RedisConfig
	IG                           IggyConfig
	ServiceAccountEmail          string
	SymbolsBucket                string
	SymbolsBucketRegion          string
	SymbolsAccessKey             string
	SymbolsSecretAccessKey       string
	AttachmentsBucket            string
	AttachmentsBucketRegion      string
	AttachmentsAccessKey         string
	AttachmentsSecretAccessKey   string
	AWSEndpoint                  string
	AttachmentOrigin             string
	SiteOrigin                   string
	APIOrigin                    string
	AgentOrigin                  string
	SymbolicatorOrigin           string
	OAuthGitHubKey               string
	OAuthGitHubSecret            string
	OAuthGoogleKey               string
	OAuthGoogleSecret            string
	AccessTokenSecret            []byte
	RefreshTokenSecret           []byte
	SmtpHost                     string
	SmtpPort                     string
	SmtpUser                     string
	SmtpPassword                 string
	EmailDomain                  string
	TxEmailAddress               string
	SlackClientID                string
	SlackClientSecret            string
	SlackSigningSecret           string
	AutumnSecretKey              string
	AutumnWebhookSecret          string
	GA4MeasurementID             string
	GA4MeasurementProtocolSecret string
	PostHogAPIKey                string
	PostHogHost                  string
	OtelServiceName              string
	CloudEnv                     bool
	IngestEnforceTimeWindow      bool
	BillingEnabled               bool
}

// IsCloud is true if the service is
// running on a cloud environment.
func (c *Config) IsCloud() bool {
	return c.CloudEnv
}

// IsBillingEnabled is true if the service has
// billing feature enabled.
func (c *Config) IsBillingEnabled() bool {
	return c.BillingEnabled
}

// Deps holds the live infrastructure handles the agent uses at runtime. NewConfig +
// Connect build one in this package; it is threaded explicitly into the
// handlers and domain code that need a handle, rather than reached via a
// global.
type Deps struct {
	PgPool  *pgxpool.Pool
	ChPool  driver.Conn
	RchPool driver.Conn
	Mail    *mail.Client
	Config  *Config
	VK      redis.Client
}

// NewConfig reads the shared environment contract once and returns the parsed
// configuration. It is the single source of the env contract for every
// service: never fork it per service, or the contract drifts. It also
// performs the package-level inits that read the same env (billing, GA4,
// PostHog), keeping those side effects in one place.
func NewConfig() *Config {
	cloudEnv := false
	if os.Getenv("K_SERVICE") != "" && os.Getenv("K_REVISION") != "" {
		cloudEnv = true
	}

	billingEnabled := false
	if os.Getenv("BILLING_ENABLED") == "true" {
		billingEnabled = true
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

	symbolsSecretAccessKey, secErr := secret.FromEnvOrFile("SYMBOLS_SECRET_ACCESS_KEY")
	if secErr != nil {
		log.Printf("failed to read SYMBOLS_SECRET_ACCESS_KEY: %v", secErr)
	}
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

	attachmentsSecretAccessKey, secErr := secret.FromEnvOrFile("ATTACHMENTS_SECRET_ACCESS_KEY")
	if secErr != nil {
		log.Printf("failed to read ATTACHMENTS_SECRET_ACCESS_KEY: %v", secErr)
	}
	if attachmentsSecretAccessKey == "" {
		log.Println("ATTACHMENTS_SECRET_ACCESS_KEY env var not set, event attachment uploads won't work")
	}

	attachmentOrigin := os.Getenv("ATTACHMENTS_S3_ORIGIN")
	if attachmentOrigin == "" {
		log.Println("ATTACHMENTS_S3_ORIGIN env var not set, event attachment downloads will be proxied")
	}

	siteOrigin := os.Getenv("SITE_ORIGIN")
	if siteOrigin == "" {
		log.Println("SITE_ORIGIN env var not set. Authentication and emails might not work.")
	}

	apiOrigin := os.Getenv("API_ORIGIN")
	if apiOrigin == "" {
		log.Println("API_ORIGIN env var not set. Need for proxying session attachments.")
	}

	agentOrigin := os.Getenv("AGENT_ORIGIN")
	if agentOrigin == "" {
		log.Println("AGENT_ORIGIN env var not set. MCP tombstone responses will omit the new MCP URL.")
	}

	symbolicatorOrigin := os.Getenv("SYMBOLICATOR_ORIGIN")
	if symbolicatorOrigin == "" {
		log.Println("SYMBOLICATOR_ORIGIN env var not set. Need for de-obfuscating events.")
	}

	oauthGitHubKey := os.Getenv("OAUTH_GITHUB_KEY")
	if oauthGitHubKey == "" {
		log.Println("OAUTH_GITHUB_KEY env var is not set, dashboard authn won't work")
	}

	oauthGitHubSecret, secErr := secret.FromEnvOrFile("OAUTH_GITHUB_SECRET")
	if secErr != nil {
		log.Printf("failed to read OAUTH_GITHUB_SECRET: %v", secErr)
	}
	if oauthGitHubSecret == "" {
		log.Println("OAUTH_GITHUB_SECRET env var is not set, dashboard authn won't work")
	}

	oauthGoogleKey := os.Getenv("OAUTH_GOOGLE_KEY")
	if oauthGoogleKey == "" {
		log.Println("OAUTH_GOOGLE_KEY env var is not set, dashboard authn won't work")
	}

	oauthGoogleSecret, secErr := secret.FromEnvOrFile("OAUTH_GOOGLE_SECRET")
	if secErr != nil {
		log.Printf("failed to read OAUTH_GOOGLE_SECRET: %v", secErr)
	}
	if oauthGoogleSecret == "" {
		log.Println("OAUTH_GOOGLE_SECRET env var is not set, Google sign-in won't work")
	}

	atSecret, atErr := secret.FromEnvOrFile("SESSION_ACCESS_SECRET")
	if atErr != nil {
		log.Printf("failed to read SESSION_ACCESS_SECRET: %v", atErr)
	}
	if atSecret == "" {
		log.Println("SESSION_ACCESS_SECRET env var is not set, dashboard authn won't work")
	}

	rtSecret, secErr := secret.FromEnvOrFile("SESSION_REFRESH_SECRET")
	if secErr != nil {
		log.Printf("failed to read SESSION_REFRESH_SECRET: %v", secErr)
	}
	if rtSecret == "" {
		log.Println("SESSION_REFRESH_SECRET env var is not set, dashboard authn won't work")
	}

	postgresDSN, secErr := secret.FromEnvOrFile("POSTGRES_DSN")
	if secErr != nil {
		log.Printf("failed to read POSTGRES_DSN: %v", secErr)
	}
	if postgresDSN == "" {
		log.Println("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN, secErr := secret.FromEnvOrFile("CLICKHOUSE_DSN")
	if secErr != nil {
		log.Printf("failed to read CLICKHOUSE_DSN: %v", secErr)
	}
	if clickhouseDSN == "" {
		log.Println("CLICKHOUSE_DSN env var is not set, cannot start server")
	}

	clickhouseReaderDSN, secErr := secret.FromEnvOrFile("CLICKHOUSE_READER_DSN")
	if secErr != nil {
		log.Printf("failed to read CLICKHOUSE_READER_DSN: %v", secErr)
	}
	if clickhouseReaderDSN == "" {
		log.Println("CLICKHOUSE_READER_DSN env var is not set, cannot start server")
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

	// Iggy backs the message bus on self-host only; cloud uses Pub/Sub.
	iggyAddr := os.Getenv("IGGY_ADDR")
	if iggyAddr == "" && !cloudEnv {
		log.Println("IGGY_ADDR env var is not set, the Slack query agent will not work")
	}

	iggyUsername := os.Getenv("IGGY_USERNAME")
	if iggyUsername == "" && !cloudEnv {
		log.Println("IGGY_USERNAME env var is not set, the Slack query agent will not work")
	}

	iggyPassword := os.Getenv("IGGY_PASSWORD")
	if iggyPassword == "" && !cloudEnv {
		log.Println("IGGY_PASSWORD env var is not set, the Slack query agent will not work")
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

	smtpPassword, secErr := secret.FromEnvOrFile("SMTP_PASSWORD")
	if secErr != nil {
		log.Printf("failed to read SMTP_PASSWORD: %v", secErr)
	}
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
			log.Printf("Error parsing SITE_ORIGIN: %v\n", err)
		}
		txEmailAddress = "noreply@" + parsedSiteOrigin.Hostname()
	}

	slackClientID := os.Getenv("SLACK_CLIENT_ID")
	if slackClientID == "" {
		log.Println("SLACK_CLIENT_ID env var is not set, Slack integration will not work")
	}

	slackClientSecret, secErr := secret.FromEnvOrFile("SLACK_CLIENT_SECRET")
	if secErr != nil {
		log.Printf("failed to read SLACK_CLIENT_SECRET: %v", secErr)
	}
	if slackClientSecret == "" {
		log.Println("SLACK_CLIENT_SECRET env var is not set, Slack integration will not work")
	}

	slackSigningSecret, slckErr := secret.FromEnvOrFile("SLACK_SIGNING_SECRET")
	if slckErr != nil {
		log.Printf("failed to read SLACK_SIGNING_SECRET: %v", slckErr)
	}
	if slackSigningSecret == "" {
		log.Println("SLACK_SIGNING_SECRET env var is not set, Slack integration will not work")
	}

	autumnSecretKey, secErr := secret.FromEnvOrFile("AUTUMN_SECRET_KEY")
	if secErr != nil {
		log.Printf("failed to read AUTUMN_SECRET_KEY: %v", secErr)
	}
	if autumnSecretKey == "" {
		log.Println("AUTUMN_SECRET_KEY env var is not set, billing will not work")
	}

	autumnWebhookSecret, secErr := secret.FromEnvOrFile("AUTUMN_WEBHOOK_SECRET")
	if secErr != nil {
		log.Printf("failed to read AUTUMN_WEBHOOK_SECRET: %v", secErr)
	}
	if autumnWebhookSecret == "" {
		log.Println("AUTUMN_WEBHOOK_SECRET env var is not set, billing webhooks will not work")
	}

	autumn.Init(autumn.Config{
		SecretKey: autumnSecretKey,
	})

	ga4MeasurementID := os.Getenv("GA4_MEASUREMENT_ID")
	if ga4MeasurementID == "" {
		log.Println("GA4_MEASUREMENT_ID env var is not set, GA4 conversion events will not be sent")
	}

	ga4MeasurementProtocolSecret, secErr := secret.FromEnvOrFile("GA4_MEASUREMENT_PROTOCOL_SECRET")
	if secErr != nil {
		log.Printf("failed to read GA4_MEASUREMENT_PROTOCOL_SECRET: %v", secErr)
	}
	if ga4MeasurementProtocolSecret == "" {
		log.Println("GA4_MEASUREMENT_PROTOCOL_SECRET env var is not set, GA4 conversion events will not be sent")
	}

	ga4.Init(ga4MeasurementID, ga4MeasurementProtocolSecret)

	posthogAPIKey := os.Getenv("POSTHOG_API_KEY")
	if posthogAPIKey == "" {
		log.Println("POSTHOG_API_KEY env var is not set, PostHog events will not be sent")
	}

	posthogHost := os.Getenv("POSTHOG_HOST")
	if posthogHost == "" {
		log.Println("POSTHOG_HOST env var is not set, PostHog SDK default endpoint will be used")
	}

	posthog.Init(posthogAPIKey, posthogHost)

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	endpoint := os.Getenv("AWS_ENDPOINT_URL")
	enforceIngestTimeWindow := os.Getenv("INGEST_ENFORCE_TIME_WINDOW") != ""

	return &Config{
		PG: PostgresConfig{
			DSN: postgresDSN,
		},
		CH: ClickhouseConfig{
			DSN:       clickhouseDSN,
			ReaderDSN: clickhouseReaderDSN,
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
		ServiceAccountEmail:          serviceAccountEmail,
		SymbolsBucket:                symbolsBucket,
		SymbolsBucketRegion:          symbolsBucketRegion,
		SymbolsAccessKey:             symbolsAccessKey,
		SymbolsSecretAccessKey:       symbolsSecretAccessKey,
		AttachmentsBucket:            attachmentsBucket,
		AttachmentsBucketRegion:      attachmentsBucketRegion,
		AttachmentsAccessKey:         attachmentsAccessKey,
		AttachmentsSecretAccessKey:   attachmentsSecretAccessKey,
		AWSEndpoint:                  endpoint,
		AttachmentOrigin:             attachmentOrigin,
		SiteOrigin:                   siteOrigin,
		APIOrigin:                    apiOrigin,
		AgentOrigin:                  agentOrigin,
		SymbolicatorOrigin:           symbolicatorOrigin,
		OAuthGitHubKey:               oauthGitHubKey,
		OAuthGitHubSecret:            oauthGitHubSecret,
		OAuthGoogleKey:               oauthGoogleKey,
		OAuthGoogleSecret:            oauthGoogleSecret,
		AccessTokenSecret:            []byte(atSecret),
		RefreshTokenSecret:           []byte(rtSecret),
		SmtpHost:                     smtpHost,
		SmtpPort:                     smtpPort,
		SmtpUser:                     smtpUser,
		SmtpPassword:                 smtpPassword,
		EmailDomain:                  emailDomain,
		TxEmailAddress:               txEmailAddress,
		SlackClientID:                slackClientID,
		SlackClientSecret:            slackClientSecret,
		SlackSigningSecret:           slackSigningSecret,
		AutumnSecretKey:              autumnSecretKey,
		AutumnWebhookSecret:          autumnWebhookSecret,
		GA4MeasurementID:             ga4MeasurementID,
		GA4MeasurementProtocolSecret: ga4MeasurementProtocolSecret,
		PostHogAPIKey:                posthogAPIKey,
		PostHogHost:                  posthogHost,
		OtelServiceName:              otelServiceName,
		CloudEnv:                     cloudEnv,
		IngestEnforceTimeWindow:      enforceIngestTimeWindow,
		BillingEnabled:               billingEnabled,
	}
}

func WaitForPg(ctx context.Context, pgPool *pgxpool.Pool, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		if err := pgPool.Ping(ctx); err == nil {
			return nil // Ready
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

// Connect opens every infrastructure handle named in the config and returns
// them bundled in a Deps. Connection failures are logged but not fatal, so a
// service starts and degrades rather than refusing to come up.
func Connect(config *Config) *Deps {
	ctx := context.Background()
	var pgPool *pgxpool.Pool

	// read/write pool
	oConfig, err := pgxpool.ParseConfig(config.PG.DSN)
	if err != nil {
		log.Printf("Unable to parse postgres connection string: %v\n", err)
	}

	// See https://pkg.go.dev/github.com/jackc/pgx/v5#QueryExecMode
	oConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// IAM auth in Cloud with a passwordless DSN; a password DSN uses the plain path.
	if config.IsCloud() && oConfig.ConnConfig.Password == "" {
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
			// Fail closed: IAM auth has no instance to dial.
			log.Fatal("CSQL_CONN_NAME is not set but POSTGRES_DSN is in IAM form")
		}

		oConfig.ConnConfig.DialFunc = func(ctx context.Context, network string, address string) (net.Conn, error) {
			return d.Dial(ctx, csqlConnName, cloudsqlconn.WithPrivateIP())
		}
	}

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

	rChOpts, err := clickhouse.ParseDSN(config.CH.ReaderDSN)
	if err != nil {
		log.Printf("unable to parse reader CH connection string %v\n", err)
	}

	if gin.Mode() == gin.ReleaseMode {
		// read more: https://clickhouse.com/docs/operations/settings/settings#compatibility
		compatibility := "26.2"
		chOpts.Settings = clickhouse.Settings{
			"wait_for_async_insert":         1,
			"wait_for_async_insert_timeout": 1000,
			"compatibility":                 compatibility,
		}

		chOpts.Compression = &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		}

		rChOpts.Settings = clickhouse.Settings{
			"compatibility": compatibility,
		}
	}

	chPool, err := clickhouse.Open(chOpts)
	if err != nil {
		log.Printf("Unable to create CH connection pool: %v\n", err)
	}

	rChPool, err := clickhouse.Open(rChOpts)
	if err != nil {
		log.Printf("Unable to create reader CH connection pool: %v\n", err)
	}

	if err := inet.Init(); err != nil {
		log.Printf("Unable to initialize geo ip lookup system: %v\n", err)
	}

	// init redis client
	addr := fmt.Sprintf("%s:%d", config.RD.Host, config.RD.Port)
	options := redis.ClientOption{
		InitAddress: []string{addr},
	}

	options.ConnWriteTimeout = 30 * time.Second
	options.ClientName = "measure-agent"

	vkClient, err := redis.NewClient(options)
	if err != nil {
		log.Printf("failed to create redis client: %v\n", err)
	}

	// init email client
	var mailClient *mail.Client
	if config.SmtpHost != "" || config.SmtpPort != "" || config.SmtpUser != "" || config.SmtpPassword != "" {
		smtpConfigPort, err := strconv.Atoi(config.SmtpPort)
		if err != nil {
			log.Printf("Invalid smtp port: %v\n", err)
		}

		mailClient, err = mail.NewClient(config.SmtpHost, mail.WithPort(smtpConfigPort), mail.WithSMTPAuth(mail.SMTPAuthPlain),
			mail.WithUsername(config.SmtpUser), mail.WithPassword(config.SmtpPassword))
		if err != nil {
			log.Printf("failed to create email client: %v\n", err)
		}
	}

	return &Deps{
		PgPool:  pgPool,
		ChPool:  chPool,
		RchPool: rChPool,
		Config:  config,
		VK:      vkClient,
		Mail:    mailClient,
	}
}

func InitTracing(c *Config) func(context.Context) error {
	otelCollectorURL := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	otelProtocol := os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL")
	otelInsecureMode := os.Getenv("OTEL_INSECURE_MODE")
	otelServiceName := c.OtelServiceName

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

	// Traces
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

	// Metrics
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
