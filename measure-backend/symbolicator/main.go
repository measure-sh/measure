package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func createDataDirs() {
	// create mapping path
	if err := os.MkdirAll("/data/mappings", 0750); err != nil {
		log.Fatal("failed to create /data/mappings dir", err)
	}
	// create exceptions path
	if err := os.MkdirAll("/data/exceptions", 0750); err != nil {
		log.Fatal("failed to create /data/exceptions dir", err)
	}
	// create app exit traces path
	if err := os.MkdirAll("/data/app_exit_traces", 0750); err != nil {
		log.Fatal("failed to create /data/app_exit_traces dir", err)
	}
}

func main() {
	r := gin.Default()
	createDataDirs()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	r.POST("/symbolicate", symbolicate)

	r.Run(":8181") // listen and serve on 0.0.0.0:8181
}
