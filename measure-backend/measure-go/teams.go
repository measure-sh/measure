package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

func getApps(c *gin.Context) {
	appMap := map[string]string{
		"6c0f7001-1e81-4cb0-a08c-2a29e94e36da": `[
			{
			  "id": "59ba1c7f-2a42-4b7f-b9cb-735d25146675",
			  "name": "Readly prod"
			},
			{
			  "id": "243f3214-0f41-4361-8ef3-21d8f5d99a70",
			  "name": "Readly alpha"
			},
			{
			  "id": "bae4fb9e-07cd-4435-a42e-d99986830c2c",
			  "name": "Readly debug"
			}
		  ]`,
	}

	teamId, err := uuid.Parse(c.Param("id"))

	if err != nil {
		msg := `team id is invalid or missing bal bla`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}

	app := appMap[teamId.String()]

	if app == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("no app exists for team %s", teamId.String())})
	} else {
		c.Data(http.StatusOK, "application/json", []byte(app))
	}
}
