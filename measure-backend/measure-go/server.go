package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	pgPool *pgxpool.Pool
	chPool driver.Conn
}

type PostgresConfig struct {
	/* connection string of the postgres database */
	connectionString string `default:"postgresql://postgres:postgres@localhost:54322/default"`
}

type ClickhouseConfig struct {
	/* host address of the clickhouse database */
	host string `default:"localhost"`

	/* port of the clickhouse database */
	port string `default:"9000"`

	/* username of the clickhouse database */
	username string `default:"default"`

	/* password for the clickhouse database user */
	password string `default:""`

	/* name of the clickhouse database */
	name string `default:"default"`
}

type ServerConfig struct {
	pg PostgresConfig
	ch ClickhouseConfig
}

func NewServerConfig() *ServerConfig {
	return &ServerConfig{
		pg: PostgresConfig{
			connectionString: "postgresql://postgres:postgres@localhost:54322/default",
		},
		ch: ClickhouseConfig{
			host:     "localhost",
			port:     "9000",
			username: "default",
			password: "",
			name:     "default",
		},
	}
}

func (s *Server) Configure(serverConfig *ServerConfig) *Server {
	pgPool, err := pgxpool.New(context.Background(), serverConfig.pg.connectionString)
	if err != nil {
		log.Fatalf("Unable to create PG connection pool: %v\n", err)
	}

	chPool, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%s", serverConfig.ch.host, serverConfig.ch.port)},
		Auth: clickhouse.Auth{
			Database: serverConfig.ch.name,
			Username: serverConfig.ch.username,
			Password: serverConfig.ch.password,
		},
		ClientInfo: clickhouse.ClientInfo{
			Products: []struct {
				Name    string
				Version string
			}{
				{Name: "msr-go-client", Version: "0.1"},
			},
		},
		TLS: &tls.Config{
			InsecureSkipVerify: false,
		},
	})
	if err != nil {
		log.Fatalf("Unable to create CH connection pool: %v", err)
	}

	return &Server{
		pgPool: pgPool,
		chPool: chPool,
	}
}
