package main

import (
	"context"
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
	/* connection string of the postgres instance */
	dsn string
}

type ClickhouseConfig struct {
	/* connection string of the clickhouse instance */
	dsn string
}

type ServerConfig struct {
	pg PostgresConfig
	ch ClickhouseConfig
}

func NewServerConfig() *ServerConfig {
	return &ServerConfig{
		pg: PostgresConfig{
			dsn: "postgresql://postgres:postgres@localhost:54322/default",
		},
		ch: ClickhouseConfig{
			dsn: "clickhouse://default:@127.0.0.1:9000/default",
		},
	}
}

func (s *Server) Configure(serverConfig *ServerConfig) *Server {
	pgPool, err := pgxpool.New(context.Background(), serverConfig.pg.dsn)
	if err != nil {
		log.Fatalf("Unable to create PG connection pool: %v\n", err)
	}

	chOpts, err := clickhouse.ParseDSN(serverConfig.ch.dsn)
	if err != nil {
		log.Fatalf("Unable to parse CH connection string: %v\n", err)
	}

	chPool, err := clickhouse.Open(chOpts)
	if err != nil {
		log.Fatalf("Unable to create CH connection pool: %v", err)
	}

	return &Server{
		pgPool: pgPool,
		chPool: chPool,
	}
}
