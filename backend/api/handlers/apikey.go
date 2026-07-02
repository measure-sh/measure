package handlers

import (
	"fmt"
	"net/http"

	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h Handlers) RotateApiKey(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := measure.App{
		ID: &appId,
	}

	team, err := app.GetTeam(c, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to rotate app api keys in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	apiKey, err := app.RotateAPIKey(deps.PgPool)
	if err != nil {
		msg := "failed to rotate app api key"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"api_key": apiKey,
		"ok":      "done",
	})
}
