package server

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"strconv"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/wneessen/go-mail"
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
	PG              PostgresConfig
	CH              ClickhouseConfig
	SiteOrigin      string
	SmtpHost        string
	SmtpPort        string
	SmtpUser        string
	SmtpPassword    string
	EmailDomain     string
	TxEmailAddress  string
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

	siteOrigin := os.Getenv("SITE_ORIGIN")
	if siteOrigin == "" {
		log.Fatal("SITE_ORIGIN env var not set. Need for Cross Origin Resource Sharing (CORS) to work.")
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		log.Fatal("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")
	if clickhouseDSN == "" {
		log.Fatal("CLICKHOUSE_DSN env var is not set, cannot start server")
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

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	return &ServerConfig{
		PG: PostgresConfig{
			DSN: postgresDSN,
		},
		CH: ClickhouseConfig{
			DSN:       clickhouseDSN,
			ReaderDSN: clickhouseReaderDSN,
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
	// oConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
	// 	_, err := conn.Exec(ctx, "SET role operator")
	// 	return err
	// }

	// reader pool
	rConfig, err := pgxpool.ParseConfig(config.PG.DSN)
	if err != nil {
		log.Fatalf("Unable to parse reader postgres connection string: %v\n", err)
	}
	// rConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
	// 	_, err := conn.Exec(ctx, "SET role reader")
	// 	return err
	// }

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
