package handlers

import (
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

	points, err := app.GetMemoryUsagePlot(ctx, deps.RchPool, &flt, c.Query("app_importance"))
	if err != nil {
		if err.Error() == "invalid app importance" {
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

func (h Handlers) GetMemoryUsageBreakdown(c *gin.Context) {
	deps := h.Deps
	app, flt, ctx, _, ok := h.prepareFilter(c, filterEndpoint{
		entity:          filter.SessionsEntity,
		appScope:        *measure.ScopeAppRead,
		logRoot:         logcomment.Sessions,
		logName:         "memory_usage_breakdown",
		requireTimezone: true,
	})
	if !ok {
		return
	}

	points, err := app.GetMemoryUsageBreakdown(ctx, deps.RchPool, &flt, c.Query("app_importance"))
	if err != nil {
		if err.Error() == "invalid app importance" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		msg := "failed to query memory usage breakdown"
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

	points, err := app.GetMemoryUsageDistribution(ctx, deps.RchPool, &flt, c.Query("app_importance"))
	if err != nil {
		if err.Error() == "invalid app importance" {
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
