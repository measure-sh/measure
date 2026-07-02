package handlers

import (
	"fmt"
	"net/http"

	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h Handlers) GetNotifPrefs(c *gin.Context) {
	deps := h.Deps
	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "user id invalid or missing",
		})
		return
	}

	notifPref, err := measure.GetNotifPref(deps.PgPool, userId)
	if err != nil {
		msg := `unable to fetch notification prefs`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, notifPref)
}

func (h Handlers) UpdateNotifPrefs(c *gin.Context) {
	deps := h.Deps
	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "user id invalid or missing",
		})
		return
	}

	notifPref := measure.NewNotifPref(userId)

	var payload measure.NotifPrefPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse notification preferences json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	notifPref.ErrorSpike = payload.ErrorSpike
	notifPref.AppHangSpike = payload.AppHangSpike
	notifPref.BugReport = payload.BugReport
	notifPref.DailySummary = payload.DailySummary

	if err := notifPref.Update(deps.PgPool); err != nil {
		msg := `failed to update notification preferences`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}
