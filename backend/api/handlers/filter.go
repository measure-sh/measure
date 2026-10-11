package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"backend/libs/chquery"
	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/measure"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("handlers")

func endSpan(span trace.Span, err error) {
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
	}
	span.End()
}

func authorizeTeam(ctx context.Context, pg *pgxpool.Pool, userID, teamID string, scope measure.Scope) (ok bool, err error) {
	_, span := tracer.Start(ctx, "authz")
	defer func() {
		span.SetAttributes(attribute.Bool("authz.allowed", ok))
		endSpan(span, err)
	}()

	okTeam, err := measure.PerformAuthz(pg, userID, teamID, *measure.ScopeTeamRead)
	if err != nil {
		return false, err
	}
	okApp, err := measure.PerformAuthz(pg, userID, teamID, scope)
	if err != nil {
		return false, err
	}
	return okTeam && okApp, nil
}

func respondFilterError(c *gin.Context, err error) {
	var parseErr *filter.ParseError
	var invalid *filter.ValidationError

	var issues []filter.FilterExprIssue
	switch {
	case errors.As(err, &parseErr):
		// Reading stopped at a character, not a span.
		issues = []filter.FilterExprIssue{{Message: parseErr.Message}}
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

// filterEndpoint carries what varies between the endpoints that query
// with a filter.Filter: which entity the filter_expr grammar is
// checked against, which scope (besides team read) the caller must hold,
// the log_comment root and name the endpoint's ClickHouse queries are
// tagged with, and which extra query params the endpoint requires.
type filterEndpoint struct {
	entity   filter.Entity
	appScope measure.Scope
	logRoot  string
	logName  string
	// useQueryCache adds the use_query_cache ClickHouse setting, enabled in
	// release mode, to the endpoint's queries.
	useQueryCache bool
	// requireSpanName rejects requests without a span_name query param.
	requireSpanName bool
	// requireTimezone rejects requests without a timezone query param, which
	// plot endpoints need to bucket rows by day.
	requireTimezone bool
}

// prepareFilter runs the request prologue shared by the endpoints that
// query with a filter.Filter: it parses the app id from the :id
// route param, binds the query params into a filter, parses the filter_expr
// into its expression tree, authorizes the caller on the app's team, tags the
// context with the endpoint's ClickHouse settings, resolves the filter's
// custom keys and validates the filter. On a failed check it writes the
// error response itself and returns ok false; the handler then just returns.
func (h Handlers) prepareFilter(c *gin.Context, endpoint filterEndpoint) (app measure.App, flt filter.Filter, ctx context.Context, spanName string, ok bool) {
	deps := h.Deps
	ctx = c.Request.Context()
	spanCtx, span := tracer.Start(ctx, "prepare_filter")
	defer span.End()

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	spanName = c.Query("span_name")
	if endpoint.requireSpanName && spanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing span_name query param",
		})
		return
	}

	flt = filter.Filter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&flt); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	flt.Entity = endpoint.entity

	if err := flt.BuildExprTree(); err != nil {
		respondFilterError(c, err)
		return
	}

	if endpoint.requireTimezone && flt.Timezone == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	flt.SetDefaultTimeRangeIfUnset()

	app = measure.App{
		ID: &id,
	}
	teamCtx, teamSpan := tracer.Start(spanCtx, "get_team")
	team, err := app.GetTeam(teamCtx, deps.PgPool)
	endSpan(teamSpan, err)
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

	authorized, err := authorizeTeam(spanCtx, deps.PgPool, c.GetString("userId"), team.ID.String(), endpoint.appScope)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !authorized {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID
	flt.TeamID = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, endpoint.logRoot).String(),
	}
	if endpoint.useQueryCache {
		settings["use_query_cache"] = gin.Mode() == gin.ReleaseMode
	}

	settings = logcomment.Put(settings, lc, logcomment.Name, endpoint.logName)
	ctx = chquery.WithSettings(ctx, settings)

	keysCtx, keysSpan := tracer.Start(chquery.WithSettings(spanCtx, settings), "resolve_custom_keys")
	err = flt.ResolveCustomKeys(keysCtx, deps.RchPool)
	endSpan(keysSpan, err)
	if err != nil {
		msg := "failed to read the filter's custom keys"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := flt.Validate(); err != nil {
		respondFilterError(c, err)
		return
	}

	return app, flt, ctx, spanName, true
}

// authorizeApp reports whether the caller is in the team owning the app and
// has the scope there, along with the team's id. Returns false when they are
// not, after writing the error response.
func (h Handlers) authorizeApp(c *gin.Context, appID uuid.UUID, scope measure.Scope) (teamID uuid.UUID, ok bool) {
	ctx, span := tracer.Start(c.Request.Context(), "authorize_app")
	defer span.End()
	deps := h.Deps

	app := measure.App{ID: &appID}
	teamCtx, teamSpan := tracer.Start(ctx, "get_team")
	team, err := app.GetTeam(teamCtx, deps.PgPool)
	endSpan(teamSpan, err)
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

	authorized, err := authorizeTeam(ctx, deps.PgPool, c.GetString("userId"), team.ID.String(), scope)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return uuid.Nil, false
	}

	if !authorized {
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

	entity, err := filter.FindByName(c.Query("entity"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	teamID, ok := h.authorizeApp(c, appID, *measure.ScopeAppRead)
	if !ok {
		return
	}

	ctx = filter.WithFilterQuerySettings(ctx, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode, "filter_keys")
	keys, keysTruncated, err := entity.ListKeys(ctx, h.Deps.RchPool, teamID, appID, c.QueryArray("key"))
	if err != nil {
		msg := "Failed to read the filter keys"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"keys":           keys,
		"key_groups":     filter.ListKeyGroups(keys),
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

	entity, err := filter.FindByName(c.Query("entity"))
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
		queryParams.Limit = filter.DefaultValueLimit
	}
	if queryParams.Limit > filter.MaxValueLimit {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("`limit` cannot be more than %d", filter.MaxValueLimit),
		})
		return
	}

	teamID, authorized := h.authorizeApp(c, appID, *measure.ScopeAppRead)
	if !authorized {
		return
	}

	ctx = filter.WithFilterQuerySettings(ctx, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode, "filter_values")
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

	if key.ValueSuggestionMode == filter.ValueSuggestionModeNone {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Key %q is typed in and not picked from a list", key.Name),
		})
		return
	}

	valueList, err := entity.SuggestKeyValues(ctx, h.Deps.PgPool, h.Deps.RchPool, teamID, appID, key, filter.ValueRequest{
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
