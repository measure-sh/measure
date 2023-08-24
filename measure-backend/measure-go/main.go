package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var serverConfig ServerConfig
var server Server

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	pgConnectionString := os.Getenv("POSTGRES_CONNECTION_STRING")
	if pgConnectionString == "" {
		log.Fatal("\"POSTGRES_CONNECTION_STRING\" environment variable not detected")
	}

	chHost := os.Getenv("CLICKHOUSE_HOSTNAME")
	chPort := os.Getenv("CLICKHOUSE_PORT")
	chDbName := os.Getenv("CLICKHOUSE_DB_NAME")
	chDbUsername := os.Getenv("CLICKHOUSE_DB_USERNAME")
	chDbPassword := os.Getenv("CLICKHOUSE_DB_PASSWORD")

	if chHost == "" {
		log.Fatal("\"CLICKHOUSE_HOSTNAME\" environment variable not detected")
	}

	if chPort == "" {
		log.Fatal("\"CLICKHOUSE_PORT\" environment variable not detected")
	}

	if chDbName == "" {
		log.Fatal("\"CLICKHOUSE_DB_NAME\" environment variable not detected")
	}

	if chDbUsername == "" {
		log.Fatal("\"CLICKHOUSE_DB_USERNAME\" environment variable not detected")
	}

	if chDbPassword == "" {
		log.Fatal("\"CLICKHOUSE_DB_PASSWORD\" environment variable not detected")
	}

	serverConfig = *NewServerConfig()
	serverConfig.pg.connectionString = pgConnectionString
	serverConfig.ch.host = chHost
	serverConfig.ch.port = chPort
	serverConfig.ch.name = chDbName
	serverConfig.ch.username = chDbUsername
	serverConfig.ch.password = chDbPassword
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
		err = pgPool.QueryRow(context.Background(), "select type from dummy where type=$1", "type-a").Scan(&name)
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

	// time.AfterFunc(3*time.Second, func() {
	// 	fmt.Println(server.pgPool, server.chPool)
	// })

	r.Run(":8080") // listen and serve on 0.0.0.0:8080

}
