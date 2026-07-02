package handlers

import (
	"fmt"
	"net/http"

	"backend/api/server"
	"backend/libs/group"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Deprecated: Use GetErrorGroupCommonPath instead.
func (h Handlers) GetCrashGroupCommonPath(c *gin.Context) {
	deps := h.Deps
	getCrashOrANRGroupCommonPath(c, deps, group.GroupTypeCrash)
}

// Deprecated: Use GetErrorGroupCommonPath instead.
func (h Handlers) GetANRGroupCommonPath(c *gin.Context) {
	deps := h.Deps
	getCrashOrANRGroupCommonPath(c, deps, group.GroupTypeANR)
}

func (h Handlers) GetErrorGroupCommonPath(c *gin.Context) {
	deps := h.Deps
	getCrashOrANRGroupCommonPath(c, deps, group.GroupTypeError)
}

func getCrashOrANRGroupCommonPath(c *gin.Context, deps *server.Deps, groupType group.GroupType) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// Get groupId from the appropriate param based on type
	var groupId string
	switch groupType {
	case group.GroupTypeCrash:
		groupId = c.Param("crashGroupId")
	case group.GroupTypeANR:
		groupId = c.Param("anrGroupId")
	case group.GroupTypeError:
		groupId = c.Param("errorGroupId")
	}

	if groupId == "" {
		msg := fmt.Sprintf(`%s group id is invalid or missing`, groupType)
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	data, err := measure.GetIssueGroupCommonPath(ctx, deps.RchPool, *team.ID, id, groupType, groupId)
	if err != nil {
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/json", data)
}
