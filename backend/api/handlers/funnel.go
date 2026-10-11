package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"backend/libs/chquery"
	"backend/libs/config"
	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/measure"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// funnelParams parses the app and funnel ids from the path, writing a 400
// and returning false when either is invalid.
func funnelParams(c *gin.Context) (appID, funnelID uuid.UUID, ok bool) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `app id invalid or missing`})
		return uuid.Nil, uuid.Nil, false
	}
	funnelID, err = uuid.Parse(c.Param("funnelId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `funnel id invalid or missing`})
		return uuid.Nil, uuid.Nil, false
	}
	return appID, funnelID, true
}

// bindFunnelDraft writes a 400 and returns false when the body is not a
// valid draft.
func bindFunnelDraft(c *gin.Context) (draft measure.FunnelDraft, ok bool) {
	if err := c.ShouldBindJSON(&draft); err != nil {
		msg := `invalid request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return measure.FunnelDraft{}, false
	}
	if err := draft.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return measure.FunnelDraft{}, false
	}
	return draft, true
}

func respondFunnelError(c *gin.Context, msg string, err error) {
	if errors.Is(err, measure.ErrFunnelNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Funnel not found"})
		return
	}
	fmt.Println(msg, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
}

// GetFunnels returns a page of an app's funnels, most recently updated first.
func (h Handlers) GetFunnels(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `app id invalid or missing`})
		return
	}

	query := struct {
		Search string `form:"search"`
		Limit  int    `form:"limit"`
		Offset int    `form:"offset"`
	}{Limit: filter.DefaultPaginationLimit}
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Failed to parse query parameters",
			"details": err.Error(),
		})
		return
	}
	if query.Limit < 1 || query.Limit > filter.MaxPaginationLimit {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("`limit` must be between 1 and %d", filter.MaxPaginationLimit),
		})
		return
	}
	if query.Offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "`offset` cannot be negative"})
		return
	}

	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelRead); !ok {
		return
	}

	funnels, next, previous, err := measure.GetFunnels(c.Request.Context(), h.Deps.PgPool, appID, query.Search, query.Limit, query.Offset)
	if err != nil {
		msg := `error fetching funnels`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": funnels,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetFunnel(c *gin.Context) {
	appID, funnelID, ok := funnelParams(c)
	if !ok {
		return
	}
	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelRead); !ok {
		return
	}

	funnel, err := measure.GetFunnel(c.Request.Context(), h.Deps.PgPool, appID, funnelID)
	if err != nil {
		respondFunnelError(c, `error fetching funnel`, err)
		return
	}

	c.JSON(http.StatusOK, funnel)
}

func (h Handlers) CreateFunnel(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `app id invalid or missing`})
		return
	}
	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelAll); !ok {
		return
	}
	draft, ok := bindFunnelDraft(c)
	if !ok {
		return
	}

	funnel, err := measure.CreateFunnel(c.Request.Context(), h.Deps.PgPool, appID, c.GetString("userId"), draft)
	if err != nil {
		respondFunnelError(c, `error creating funnel`, err)
		return
	}

	c.JSON(http.StatusCreated, funnel)
}

func (h Handlers) UpdateFunnel(c *gin.Context) {
	appID, funnelID, ok := funnelParams(c)
	if !ok {
		return
	}
	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelAll); !ok {
		return
	}
	draft, ok := bindFunnelDraft(c)
	if !ok {
		return
	}

	funnel, err := measure.UpdateFunnel(c.Request.Context(), h.Deps.PgPool, appID, funnelID, draft)
	if err != nil {
		respondFunnelError(c, `error updating funnel`, err)
		return
	}

	c.JSON(http.StatusOK, funnel)
}

func (h Handlers) DeleteFunnel(c *gin.Context) {
	appID, funnelID, ok := funnelParams(c)
	if !ok {
		return
	}
	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelAll); !ok {
		return
	}

	if err := measure.DeleteFunnel(c.Request.Context(), h.Deps.PgPool, appID, funnelID); err != nil {
		respondFunnelError(c, `error deleting funnel`, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}

func (h Handlers) GetFunnelConversion(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:        filter.FunnelsEntity,
		appScope:      *measure.ScopeFunnelRead,
		logRoot:       logcomment.Funnels,
		logName:       "conversion",
		useQueryCache: true,
	})
	if !ok {
		return
	}
	funnelID, err := uuid.Parse(c.Param("funnelId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `funnel id invalid or missing`})
		return
	}

	funnel, err := measure.GetFunnel(ctx, h.Deps.PgPool, flt.AppID, funnelID)
	if err != nil {
		respondFunnelError(c, `error fetching funnel`, err)
		return
	}

	steps, err := measure.GetFunnelConversionCached(ctx, h.Deps.VK, h.Deps.RchPool, funnel, &flt)
	if err != nil {
		msg := `error fetching funnel conversion`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"steps": steps})
}

// funnelStep loads the funnel in the path and reads the range of steps from
// the step query param, which names the step users move into and covers the
// whole funnel when missing. It writes an error response and returns false
// when either is invalid.
func (h Handlers) funnelStep(c *gin.Context, ctx context.Context, appID uuid.UUID) (funnel measure.Funnel, stepRange measure.FunnelStepRange, ok bool) {
	funnelID, err := uuid.Parse(c.Param("funnelId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `funnel id invalid or missing`})
		return measure.Funnel{}, measure.FunnelStepRange{}, false
	}

	funnel, err = measure.GetFunnel(ctx, h.Deps.PgPool, appID, funnelID)
	if err != nil {
		respondFunnelError(c, `error fetching funnel`, err)
		return measure.Funnel{}, measure.FunnelStepRange{}, false
	}
	query, present := c.GetQuery("step")
	if !present {
		return funnel, measure.FunnelStepRange{From: 0, To: len(funnel.Steps) - 1}, true
	}
	step, err := strconv.Atoi(query)
	if err != nil || step < 1 || step >= len(funnel.Steps) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("step must be between 1 and %d", len(funnel.Steps)-1)})
		return measure.Funnel{}, measure.FunnelStepRange{}, false
	}
	return funnel, measure.FunnelStepRange{From: step - 1, To: step}, true
}

func (h Handlers) GetFunnelStepErrors(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:        filter.FunnelsEntity,
		appScope:      *measure.ScopeFunnelRead,
		logRoot:       logcomment.Funnels,
		logName:       "step_errors",
		useQueryCache: true,
	})
	if !ok {
		return
	}
	funnel, stepRange, ok := h.funnelStep(c, ctx, flt.AppID)
	if !ok {
		return
	}

	stepErrors, next, previous, err := measure.GetFunnelStepErrorsCached(ctx, h.Deps.VK, h.Deps.RchPool, funnel, &flt, stepRange)
	if err != nil {
		msg := `error fetching funnel step errors`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": stepErrors,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetFunnelStepTraces(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:        filter.FunnelsEntity,
		appScope:      *measure.ScopeFunnelRead,
		logRoot:       logcomment.Funnels,
		logName:       "step_traces",
		useQueryCache: true,
	})
	if !ok {
		return
	}
	funnel, stepRange, ok := h.funnelStep(c, ctx, flt.AppID)
	if !ok {
		return
	}
	quantile, ok := measure.FunnelQuantiles[c.Query("quantile")]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "quantile must be one of p50, p90, p95 or p99"})
		return
	}

	stepTraces, next, previous, err := measure.GetFunnelStepTracesCached(ctx, h.Deps.VK, h.Deps.RchPool, funnel, &flt, stepRange, quantile)
	if err != nil {
		msg := `error fetching funnel step traces`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": stepTraces,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetFunnelStepNetwork(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:        filter.FunnelsEntity,
		appScope:      *measure.ScopeFunnelRead,
		logRoot:       logcomment.Funnels,
		logName:       "step_network",
		useQueryCache: true,
	})
	if !ok {
		return
	}
	funnel, stepRange, ok := h.funnelStep(c, ctx, flt.AppID)
	if !ok {
		return
	}
	quantile, ok := measure.FunnelQuantiles[c.Query("quantile")]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "quantile must be one of p50, p90, p95 or p99"})
		return
	}

	stepEndpoints, next, previous, err := measure.GetFunnelStepNetworkCached(ctx, h.Deps.VK, h.Deps.RchPool, funnel, &flt, stepRange, quantile)
	if err != nil {
		msg := `error fetching funnel step network`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": stepEndpoints,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

var funnelOutcomes = map[string]bool{
	"dropped":   false,
	"converted": true,
}

func (h Handlers) GetFunnelStepSessions(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:        filter.FunnelsEntity,
		appScope:      *measure.ScopeFunnelRead,
		logRoot:       logcomment.Funnels,
		logName:       "step_sessions",
		useQueryCache: true,
	})
	if !ok {
		return
	}
	funnel, stepRange, ok := h.funnelStep(c, ctx, flt.AppID)
	if !ok {
		return
	}
	converted, ok := funnelOutcomes[c.Query("outcome")]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "outcome must be one of dropped or converted"})
		return
	}

	stepSessions, next, previous, err := measure.GetFunnelStepSessionsCached(ctx, h.Deps.VK, h.Deps.RchPool, funnel, &flt, stepRange, converted)
	if err != nil {
		msg := `error fetching funnel step sessions`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": stepSessions,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetFunnelTrend(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:          filter.FunnelsEntity,
		appScope:        *measure.ScopeFunnelRead,
		logRoot:         logcomment.Funnels,
		logName:         "trend",
		useQueryCache:   true,
		requireTimezone: true,
	})
	if !ok {
		return
	}
	funnelID, err := uuid.Parse(c.Param("funnelId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `funnel id invalid or missing`})
		return
	}
	period := measure.FunnelTrendPeriod(c.Query("period"))
	if !period.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "period must be one of day, week or month"})
		return
	}

	funnel, err := measure.GetFunnel(ctx, h.Deps.PgPool, flt.AppID, funnelID)
	if err != nil {
		respondFunnelError(c, `error fetching funnel`, err)
		return
	}

	trend, err := measure.GetFunnelTrendCached(ctx, h.Deps.VK, h.Deps.PgPool, h.Deps.RchPool, funnel, &flt, period, c.Query("builds") == "true")
	if err != nil {
		msg := `error fetching funnel trend`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, trend)
}

func (h Handlers) GetFunnelCadence(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:          filter.FunnelsEntity,
		appScope:        *measure.ScopeFunnelRead,
		logRoot:         logcomment.Funnels,
		logName:         "cadence",
		useQueryCache:   true,
		requireTimezone: true,
	})
	if !ok {
		return
	}
	funnelID, err := uuid.Parse(c.Param("funnelId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `funnel id invalid or missing`})
		return
	}
	weeks, err := strconv.Atoi(c.Query("weeks"))
	if err != nil || weeks < 1 || weeks > measure.FunnelCadenceMaxWeeks {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("weeks must be between 1 and %d", measure.FunnelCadenceMaxWeeks)})
		return
	}

	funnel, err := measure.GetFunnel(ctx, h.Deps.PgPool, flt.AppID, funnelID)
	if err != nil {
		respondFunnelError(c, `error fetching funnel`, err)
		return
	}

	cadence, err := measure.GetFunnelCadenceCached(ctx, h.Deps.VK, h.Deps.RchPool, funnel, &flt, weeks)
	if err != nil {
		msg := `error fetching funnel cadence`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, cadence)
}

func (h Handlers) SuggestFunnelEventNames(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `app id invalid or missing`})
		return
	}
	teamID, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelRead)
	if !ok {
		return
	}

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment":     lc.MustPut(logcomment.Root, logcomment.Funnels).String(),
		"use_query_cache": gin.Mode() == gin.ReleaseMode,
		"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
	}
	ctx := chquery.WithSettings(c.Request.Context(), logcomment.Put(settings, lc, logcomment.Name, "event_names"))

	names, err := measure.SuggestFunnelEventNames(ctx, h.Deps.RchPool, teamID, appID, c.Query("search"))
	if err != nil {
		msg := `error fetching funnel event names`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": names})
}

func (h Handlers) GetPinnedFunnels(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `app id invalid or missing`})
		return
	}
	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelRead); !ok {
		return
	}

	funnels, err := measure.GetPinnedFunnels(c.Request.Context(), h.Deps.PgPool, appID)
	if err != nil {
		msg := `error fetching pinned funnels`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": funnels})
}

func (h Handlers) ReorderPinnedFunnels(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `app id invalid or missing`})
		return
	}
	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelAll); !ok {
		return
	}

	var req struct {
		FunnelIDs []uuid.UUID `json:"funnel_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		msg := `invalid request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	funnels, err := measure.ReorderPinnedFunnels(c.Request.Context(), h.Deps.PgPool, appID, req.FunnelIDs)
	if errors.Is(err, measure.ErrPinnedFunnelsChanged) {
		c.JSON(http.StatusConflict, gin.H{"error": "Pinned funnels have changed, refresh the page to see the latest pins"})
		return
	}
	if err != nil {
		msg := `error reordering pinned funnels`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": funnels})
}

func (h Handlers) PinFunnel(c *gin.Context) {
	h.setFunnelPinned(c, true)
}

func (h Handlers) UnpinFunnel(c *gin.Context) {
	h.setFunnelPinned(c, false)
}

func (h Handlers) setFunnelPinned(c *gin.Context, pinned bool) {
	appID, funnelID, ok := funnelParams(c)
	if !ok {
		return
	}
	if _, ok := h.authorizeApp(c, appID, *measure.ScopeFunnelAll); !ok {
		return
	}

	funnel, err := measure.SetFunnelPinned(c.Request.Context(), h.Deps.PgPool, appID, funnelID, pinned)
	if errors.Is(err, measure.ErrPinnedFunnelsFull) {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Up to %d funnels can be pinned, unpin one to pin another", measure.MaxPinnedFunnels)})
		return
	}
	if err != nil {
		respondFunnelError(c, `error changing funnel pin`, err)
		return
	}

	c.JSON(http.StatusOK, funnel)
}
