package server

import (
	"context"
	"log"
	"net/url"
	"os"
	"strconv"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/wneessen/go-mail"
)

var Server *server

type server struct {
	PgPool *pgxpool.Pool
	ChPool driver.Conn
	Mail   *mail.Client
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
	PG              PostgresConfig
	CH              ClickhouseConfig
	SiteOrigin      string
	SmtpHost        string
	SmtpPort        string
	SmtpUser        string
	SmtpPassword    string
	TxEmailAddress  string
	OtelServiceName string
}

func NewConfig() *ServerConfig {

	siteOrigin := os.Getenv("SITE_ORIGIN")
	if siteOrigin == "" {
		log.Fatal("SITE_ORIGIN env var not set. Need for Cross Origin Resource Sharing (CORS) to work.")
	}

	var txEmailAddress string = ""
	parsedSiteOrigin, err := url.Parse(siteOrigin)
	if err != nil {
		log.Fatalf("Error parsing SITE_ORIGIN: %v\n", err)
	}
	txEmailAddress = "noreply@" + parsedSiteOrigin.Hostname()

	postgresDSN := os.Getenv("POSTGRES_DSN")
	if postgresDSN == "" {
		log.Fatal("POSTGRES_DSN env var is not set, cannot start server")
	}

	clickhouseDSN := os.Getenv("CLICKHOUSE_DSN")
	if clickhouseDSN == "" {
		log.Fatal("CLICKHOUSE_DSN env var is not set, cannot start server")
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

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")
	if otelServiceName == "" {
		log.Println("OTEL_SERVICE_NAME env var is not set, o11y will not work")
	}

	return &ServerConfig{
		PG: PostgresConfig{
			DSN: postgresDSN,
		},
		CH: ClickhouseConfig{
			DSN: clickhouseDSN,
		},
		SiteOrigin:      siteOrigin,
		SmtpHost:        smtpHost,
		SmtpPort:        smtpPort,
		SmtpUser:        smtpUser,
		SmtpPassword:    smtpPassword,
		TxEmailAddress:  txEmailAddress,
		OtelServiceName: otelServiceName,
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
		PgPool: pgPool,
		ChPool: chPool,
		Config: config,
		Mail:   mailClient,
	}
}
