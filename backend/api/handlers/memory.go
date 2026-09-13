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

	points, err := app.GetMemoryUsagePlot(ctx, deps.RchPool, &flt)
	if err != nil {
		msg := "failed to query memory usage plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, points)
}
