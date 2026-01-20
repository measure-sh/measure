package server

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/stripe/stripe-go/v84"
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
	PG                      PostgresConfig
	CH                      ClickhouseConfig
	StripeAPIKey            string
	StripeUnitDaysMeterName string
	SiteOrigin              string
	EmailDomain             string
	TxEmailAddress          string
	OtelServiceName         string
	CloudEnv                bool
	BillingEnabled          bool
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
// billing feature enabled.
func (sc *ServerConfig) IsBillingEnabled() bool {
	if sc.BillingEnabled {
		return true
	}

	return false
}

func NewConfig() *ServerConfig {
	cloudEnv := false
	if os.Getenv("K_SERVICE") != "" && os.Getenv("K_REVISION") != "" {
		cloudEnv = true
	}

	billingEnabled := false
	if os.Getenv("BILLING_ENABLED") == "true" {
		billingEnabled = true
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
		log.Println("CLICKHOUSE_READER_DSN env var is not set, cannot start server")
	}

	stripeAPIKey := os.Getenv("STRIPE_API_KEY")
	if stripeAPIKey == "" {
		log.Println("STRIPE_API_KEY env var is not set, stripe integration will not work")
	}

	stripeUnitDaysMeterName := os.Getenv("STRIPE_UNIT_DAYS_METER_NAME")
	if stripeUnitDaysMeterName == "" {
		log.Println("STRIPE_UNIT_DAYS_METER_NAME env var is not set, stripe integration will not work")
	}

	siteOrigin := os.Getenv("SITE_ORIGIN")
	if siteOrigin == "" {
		log.Println("SITE_ORIGIN env var not set, usage notification emails will not include dashboard links")
	}

	emailDomain := os.Getenv("EMAIL_DOMAIN")
	if emailDomain == "" {
		log.Println("EMAIL_DOMAIN env var is not set, emails will use SITE_ORIGIN as domain")
	}

	var txEmailAddress string
	if emailDomain != "" {
		txEmailAddress = "noreply@" + emailDomain
	} else if siteOrigin != "" {
		parsedSiteOrigin, err := url.Parse(siteOrigin)
		if err != nil {
			log.Printf("Error parsing SITE_ORIGIN: %v\n", err)
		} else {
			txEmailAddress = "noreply@" + parsedSiteOrigin.Hostname()
		}
	}

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	return &ServerConfig{
		StripeAPIKey:            stripeAPIKey,
		StripeUnitDaysMeterName: stripeUnitDaysMeterName,
		PG: PostgresConfig{
			DSN: postgresDSN,
		},
		CH: ClickhouseConfig{
			DSN:       clickhouseDSN,
			ReaderDSN: clickhouseReaderDSN,
		},
		SiteOrigin:      siteOrigin,
		EmailDomain:     emailDomain,
		TxEmailAddress:  txEmailAddress,
		OtelServiceName: otelServiceName,
		CloudEnv:        cloudEnv,
		BillingEnabled:  billingEnabled,
	}
}

// InitForTest wires up the server singleton for use in tests.
// It accepts externally-created pools so callers can use testcontainers.
func InitForTest(config *ServerConfig, pgPool *pgxpool.Pool, chReader driver.Conn) {
	sqlf.SetDialect(sqlf.PostgreSQL)
	Server = &server{
		PgPool:  pgPool,
		RchPool: chReader,
		Config:  config,
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
		log.Printf("Unable to create PG connection pool: %v\n", err)
	}
	pgPool = pool

	chOpts, err := clickhouse.ParseDSN(config.CH.DSN)
	if err != nil {
		log.Printf("Unable to parse CH connection string: %v\n", err)
	}

	rChOpts, err := clickhouse.ParseDSN(config.CH.ReaderDSN)
	if err != nil {
		log.Printf("unable to parse reader CH connection string %v\n", err)
	}

	chPool, err := clickhouse.Open(chOpts)
	if err != nil {
		log.Printf("Unable to create CH connection pool: %v\n", err)
	}

	rChPool, err := clickhouse.Open(rChOpts)
	if err != nil {
		log.Printf("Unable to create reader CH connection pool: %v\n", err)
	}

	sqlf.SetDialect(sqlf.PostgreSQL)

	stripe.Key = config.StripeAPIKey

	Server = &server{
		PgPool:  pgPool,
		ChPool:  chPool,
		RchPool: rChPool,
		Config:  config,
	}
}
