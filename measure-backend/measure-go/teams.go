package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func getTeams(c *gin.Context) {
	teams := `[
		{
		  "id": "6c0f7001-1e81-4cb0-a08c-2a29e94e36da",
		  "name": "Anup's team"
		},
		{
		  "id": "25226540-72cf-4982-a16f-9b3c85912b65",
		  "name": "Measure"
		},
		{
		  "id": "25226540-72cf-4982-a16f-9b3c85912b65",
		  "name": "Leftshift"
		}
	  ]`

	c.Data(http.StatusOK, "application/json", []byte(teams))
}
