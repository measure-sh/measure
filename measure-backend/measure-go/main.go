package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {

	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	connectionString := os.Getenv("POSTGRES_CONNECTION_STRING")

	if connectionString == "" {
		log.Fatal("\"POSTGRES_CONNECTION_STRING\" environment variable not detected")
	}

	// create a new connection pool
	pool, err := pgxpool.New(context.Background(), connectionString)

	if err != nil {
		log.Fatalf("Unable to create connection pool: %v\n", err)
	}
	defer pool.Close()

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.GET("/employees", func(c *gin.Context) {
		var name string
		var department string
		err = pool.QueryRow(context.Background(), "select name, department from employees where id=$1", 3).Scan(&name, &department)
		if err != nil {
			fmt.Fprintf(os.Stderr, "QueryRow failed: %v\n", err)
			return
		}
		c.JSON(200, gin.H{
			"name":       name,
			"department": department,
		})
	})

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
}
