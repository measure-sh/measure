package main

import (
	"context"
	"fmt"
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
	pgPool := server.pgPool

	defer server.pgPool.Close()
	defer server.chPool.Close()

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.GET("/employees", func(c *gin.Context) {
		var name string
		var department string
		err := pgPool.QueryRow(context.Background(), "select type from dummy where type=$1", "type-a").Scan(&name)
		if err != nil {
			fmt.Fprintf(os.Stderr, "QueryRow failed: %v\n", err)
			return
		}
		c.JSON(200, gin.H{
			"name":       name,
			"department": department,
		})
	})

	r.PUT("/events", authorize(), putEvent)

	r.POST("/events", authorize(), postEvent)

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
