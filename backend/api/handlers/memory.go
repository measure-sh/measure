package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
)

func (h Handlers) GetMemoryUsagePlot(c *gin.Context) {
	deps := h.Deps
	app, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:          filter.SessionsEntity,
		appScope:        *measure.ScopeAppRead,
		logRoot:         logcomment.Sessions,
		logName:         "memory_usage_plot",
		requireTimezone: true,
	})
	if !ok {
		return
	}
	if err := app.Populate(ctx, deps.PgPool); err != nil {
		fmt.Println("failed to populate app", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to populate app"})
		return
	}

	points, err := app.GetMemoryUsagePlot(ctx, deps.RchPool, &flt, c.Query("app_importance"))
	if err != nil {
		if errors.Is(err, measure.ErrInvalidMemoryAppImportance) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		msg := "failed to query memory usage plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, points)
}

func (h Handlers) GetMemoryUsageDistribution(c *gin.Context) {
	deps := h.Deps
	app, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:          filter.SessionsEntity,
		appScope:        *measure.ScopeAppRead,
		logRoot:         logcomment.Sessions,
		logName:         "memory_usage_distribution",
		requireTimezone: true,
	})
	if !ok {
		return
	}
	if err := app.Populate(ctx, deps.PgPool); err != nil {
		fmt.Println("failed to populate app", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to populate app"})
		return
	}

	points, err := app.GetMemoryUsageDistribution(ctx, deps.RchPool, &flt, c.Query("app_importance"))
	if err != nil {
		if errors.Is(err, measure.ErrInvalidMemoryAppImportance) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		msg := "failed to query memory usage distribution"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, points)
}

func (h Handlers) GetHighMemoryUsageSessions(c *gin.Context) {
	deps := h.Deps
	app, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:   filter.SessionsEntity,
		appScope: *measure.ScopeAppRead,
		logRoot:  logcomment.Sessions,
		logName:  "high_memory_usage_sessions",
	})
	if !ok {
		return
	}
	if err := app.Populate(ctx, deps.PgPool); err != nil {
		fmt.Println("failed to populate app", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to populate app"})
		return
	}

	sessions, next, previous, err := app.GetHighMemoryUsageSessions(ctx, deps.RchPool, &flt, c.Query("app_importance"))
	if err != nil {
		if errors.Is(err, measure.ErrInvalidMemoryAppImportance) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		msg := "failed to query high memory usage sessions"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": sessions,
		"meta":    gin.H{"next": next, "previous": previous},
	})
}
