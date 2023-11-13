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
		  "id": "93848f57-9cdf-4b21-87e9-1cad562684b6",
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
		"25226540-72cf-4982-a16f-9b3c85912b65": `[
			{
			  "id": "c6643110-d3e5-4b1c-bfcc-75b46b52ae79",
			  "name": "Passwordly prod"
			},
			{
			  "id": "e2abe28a-f6bc-4f57-88fe-81f10d1c5afc",
			  "name": "Passwordly alpha"
			},
			{
			  "id": "b17f7003-4ab6-4b1a-a5d8-ed5a72cb4569",
			  "name": "Passwordly debug"
			}
		  ]`,
		"93848f57-9cdf-4b21-87e9-1cad562684b6": `[
			{
			  "id": "20014be8-aaa9-4e56-8810-9f1a48ec1099",
			  "name": "Musicly prod"
			},
			{
			  "id": "463c959c-94c2-4f49-bd2b-6caab360c152",
			  "name": "Musicly alpha"
			},
			{
			  "id": "2a7f230e-6d5e-4036-b4e6-1102c22f4433",
			  "name": "Musicly debug"
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
