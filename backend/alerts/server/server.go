package server

import (
	"backend/libs/autumn"
	"backend/libs/secret"
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"strconv"
	"time"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/valkey-io/valkey-go"
	redis "github.com/valkey-io/valkey-go"
	"github.com/wneessen/go-mail"
)

var Server *server

type server struct {
	PgPool *pgxpool.Pool
	ChPool driver.Conn
	Mail   *mail.Client
	Config *ServerConfig
	VK     valkey.Client
}

type PostgresConfig struct {
	/* connection string of the postgres instance */
	DSN string
}

type ClickhouseConfig struct {
	/* connection string of the clickhouse instance */
	DSN string
}

type RedisConfig struct {
	Host string
	Port int
}

type ServerConfig struct {
	PG              PostgresConfig
	CH              ClickhouseConfig
	RD              RedisConfig
	SiteOrigin      string
	SmtpHost        string
	SmtpPort        string
	SmtpUser        string
	SmtpPassword    string
	EmailDomain     string
	TxEmailAddress  string
	OtelServiceName string
	CloudEnv        bool
	BillingEnabled  bool
}

// IsCloud is true if the service is assumed
// running on a cloud environment.
func (sc *ServerConfig) IsCloud() bool {
	if sc.CloudEnv {
		return true
	}

	return false
}

// IsBillingEnabled is true if the service has
// billing enabled.
func (sc *ServerConfig) IsBillingEnabled() bool {
	return sc.BillingEnabled
}

func NewConfig() *ServerConfig {
	cloudEnv := false
	if os.Getenv("K_SERVICE") != "" && os.Getenv("K_REVISION") != "" {
		cloudEnv = true
	}

	siteOrigin := os.Getenv("SITE_ORIGIN")
	if siteOrigin == "" {
		log.Println("SITE_ORIGIN env var not set. Need for Cross Origin Resource Sharing (CORS) to work.")
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

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	billingEnabled := false
	if os.Getenv("BILLING_ENABLED") == "true" {
		billingEnabled = true
		autumnSecretKey, secErr := secret.FromEnvOrFile("AUTUMN_SECRET_KEY")
		if secErr != nil {
			log.Printf("failed to read AUTUMN_SECRET_KEY: %v", secErr)
		}
		if autumnSecretKey == "" {
			log.Println("AUTUMN_SECRET_KEY env var is not set, billing checks will fail-open")
		}
		autumn.Init(autumn.Config{SecretKey: autumnSecretKey})
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
		SiteOrigin:      siteOrigin,
		SmtpHost:        smtpHost,
		SmtpPort:        smtpPort,
		SmtpUser:        smtpUser,
		SmtpPassword:    smtpPassword,
		EmailDomain:     emailDomain,
		TxEmailAddress:  txEmailAddress,
		OtelServiceName: otelServiceName,
		CloudEnv:        cloudEnv,
		BillingEnabled:  billingEnabled,
	}
}

func Init(config *ServerConfig) {
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
			fmt.Printf("Dialing network: %s, address: %s\n", network, address)
			return d.Dial(ctx, csqlConnName, cloudsqlconn.WithPrivateIP())
		}
	}

	pool, err := pgxpool.NewWithConfig(ctx, oConfig)
	if err != nil {
		log.Printf("Unable to create PG connection pool: %v\n", err)
	}
	pgPool = pool

	var chPool driver.Conn
	chOpts, err := clickhouse.ParseDSN(config.CH.DSN)
	if err != nil {
		log.Printf("Unable to parse CH connection string: %v\n", err)
	}

	chOpts.Settings = clickhouse.Settings{
		// read more: https://clickhouse.com/docs/operations/settings/settings#compatibility
		"compatibility": "26.2",
	}

	chPool, err = clickhouse.Open(chOpts)
	if err != nil {
		log.Printf("Unable to create CH connection pool: %v\n", err)
	}

	sqlf.SetDialect(sqlf.PostgreSQL)

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

	// init redis client
	addr := fmt.Sprintf("%s:%d", config.RD.Host, config.RD.Port)
	options := redis.ClientOption{
		InitAddress: []string{addr},
	}

	options.ConnWriteTimeout = 30 * time.Second
	options.ClientName = "measure-alerts"

	vkClient, err := redis.NewClient(options)
	if err != nil {
		log.Printf("failed to create redis client: %v\n", err)
	}

	Server = &server{
		PgPool: pgPool,
		ChPool: chPool,
		Config: config,
		Mail:   mailClient,
		VK:     vkClient,
	}
}

func InitForTest(config *ServerConfig, pgPool *pgxpool.Pool, chPool driver.Conn, vk valkey.Client) {
	Server = &server{
		PgPool: pgPool,
		ChPool: chPool,
		Config: config,
		VK:     vk,
	}
}
