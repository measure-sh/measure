package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"backend/libs/exprfilter"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func respondFilterError(c *gin.Context, err error) {
	var parseErr *exprfilter.ParseError
	var invalid *exprfilter.ValidationError

	var issues []exprfilter.FilterExprIssue
	switch {
	case errors.As(err, &parseErr):
		// Reading stopped at a character, not a span.
		issues = []exprfilter.FilterExprIssue{{Message: parseErr.Message}}
	case errors.As(err, &invalid):
		issues = invalid.Issues
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{
		"error":              "invalid_filter_expr",
		"filter_expr_issues": issues,
	})
}

// authorizeAppRead reports whether the caller may read the app, along with the
// id of the team owning it. Returns false when they may not.
func (h Handlers) authorizeAppRead(c *gin.Context, appID uuid.UUID) (teamID uuid.UUID, ok bool) {
	ctx := c.Request.Context()
	deps := h.Deps

	app := measure.App{ID: &appID}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "Failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return uuid.Nil, false
	}
	if team == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("No team exists for app [%s]", appID)})
		return uuid.Nil, false
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return uuid.Nil, false
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return uuid.Nil, false
	}

	if !okTeam || !okApp {
		c.JSON(http.StatusForbidden, gin.H{"error": `you are not authorized to access this app`})
		return uuid.Nil, false
	}

	return *team.ID, true
}

func (h Handlers) GetFilterKeys(c *gin.Context) {
	ctx := c.Request.Context()

	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `id invalid or missing`})
		return
	}

	entity, err := exprfilter.FindByName(c.Query("entity"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	teamID, ok := h.authorizeAppRead(c, appID)
	if !ok {
		return
	}

	ctx = exprfilter.WithFilterQuerySettings(ctx, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode, "filter_keys")
	keys, keysTruncated, err := entity.ListKeys(ctx, h.Deps.PgPool, h.Deps.RchPool, teamID, appID, c.QueryArray("key"))
	if err != nil {
		msg := "Failed to read the filter keys"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"keys":           keys,
		"key_groups":     exprfilter.ListKeyGroups(keys),
		"keys_truncated": keysTruncated,
	})
}

func (h Handlers) GetFilterValues(c *gin.Context) {
	ctx := c.Request.Context()

	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `id invalid or missing`})
		return
	}

	entity, err := exprfilter.FindByName(c.Query("entity"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var queryParams struct {
		KeyName string `form:"key_name" binding:"required"`
		Search  string `form:"search"`
		Limit   int    `form:"limit"`
	}
	if err := c.ShouldBindQuery(&queryParams); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Failed to parse query parameters",
			"details": err.Error(),
		})
		return
	}

	if queryParams.Limit <= 0 {
		queryParams.Limit = exprfilter.DefaultValueLimit
	}
	if queryParams.Limit > exprfilter.MaxValueLimit {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("`limit` cannot be more than %d", exprfilter.MaxValueLimit),
		})
		return
	}

	teamID, authorized := h.authorizeAppRead(c, appID)
	if !authorized {
		return
	}

	ctx = exprfilter.WithFilterQuerySettings(ctx, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode, "filter_values")
	key, found, err := entity.FindKey(ctx, h.Deps.RchPool, teamID, appID, queryParams.KeyName)
	if err != nil {
		msg := "Failed to read the filter values"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !found {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Entity %q has no key %q", entity.Name, queryParams.KeyName),
		})
		return
	}

	if key.ValueSuggestionMode == exprfilter.ValueSuggestionModeNone {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Key %q is typed in and not picked from a list", key.Name),
		})
		return
	}

	valueList, err := entity.SuggestKeyValues(ctx, h.Deps.PgPool, h.Deps.RchPool, teamID, appID, key, exprfilter.ValueRequest{
		Search: queryParams.Search,
		Limit:  queryParams.Limit,
	})
	if err != nil {
		msg := "Failed to read the filter values"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"values":    valueList.Values,
		"truncated": valueList.Truncated,
	})
}
