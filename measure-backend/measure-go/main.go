package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

var serverConfig ServerConfig
var server Server

func main() {
	serverConfig = *NewServerConfig()

	pgDSN := os.Getenv("POSTGRES_DSN")
	if pgDSN == "" {
		log.Printf(`"POSTGRES_DSN" missing, will proceed with default "%s"`, serverConfig.pg.dsn)
	} else {
		serverConfig.pg.dsn = pgDSN
	}

	chDSN := os.Getenv("CLICKHOUSE_DSN")
	if chDSN == "" {
		log.Printf(`"CLICKHOUSE_DSN" missing, will proceed with default "%s"`, serverConfig.ch.dsn)
	} else {
		serverConfig.ch.dsn = chDSN
	}

	server = *new(Server).Configure(&serverConfig)

	defer server.pgPool.Close()
	defer server.chPool.Close()

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.PUT("/sessions", authorize(), putSession)

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
