package handlers

import (
	"context"
	"fmt"
	"net/http"
	"slices"

	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
)

type devicesEndpoint struct {
	logName         string
	requireSpanName bool
	requireTimezone bool
}

func (h Handlers) prepareDevicesFilter(c *gin.Context, endpoint devicesEndpoint) (app measure.App, flt filter.Filter, ctx context.Context, page measure.DevicesPage, spanName string, ok bool) {
	order := c.DefaultQuery("order", "desc")
	if order != "desc" && order != "asc" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order must be desc or asc"})
		return
	}
	page.Ascending = order == "asc"
	page.Percentile = c.DefaultQuery("percentile", "p95")
	if !slices.Contains(measure.DevicesPercentiles, page.Percentile) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "percentile must be p50, p90 or p95"})
		return
	}
	app, flt, ctx, spanName, ok = h.prepareFilter(c, filterEndpoint{
		entity:          filter.DevicesEntity,
		appScope:        *measure.ScopeAppRead,
		logRoot:         logcomment.Devices,
		logName:         endpoint.logName,
		useQueryCache:   true,
		requireSpanName: endpoint.requireSpanName,
		requireTimezone: endpoint.requireTimezone,
	})
	return
}

func respondDevicesPage[Row any](c *gin.Context, rows []Row, next, previous bool, err error, msg string) {
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"results": rows,
		"meta":    gin.H{"next": next, "previous": previous},
	})
}

func (h Handlers) GetDevicesSessions(c *gin.Context) {
	app, flt, ctx, page, _, ok := h.prepareDevicesFilter(c, devicesEndpoint{logName: "devices_sessions"})
	if !ok {
		return
	}
	rows, next, previous, err := app.GetDevicesSessionsCached(ctx, h.Deps.VK, h.Deps.RchPool, &flt, page)
	respondDevicesPage(c, rows, next, previous, err, "failed to query device sessions")
}

func (h Handlers) GetDevicesSessionsPlot(c *gin.Context) {
	app, flt, ctx, _, _, ok := h.prepareDevicesFilter(c, devicesEndpoint{logName: "devices_sessions_plot", requireTimezone: true})
	if !ok {
		return
	}
	points, err := app.GetDevicesSessionsPlotCached(ctx, h.Deps.VK, h.Deps.RchPool, &flt)
	if err != nil {
		msg := "failed to query device sessions plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	c.JSON(http.StatusOK, points)
}

func (h Handlers) GetDevicesErrors(c *gin.Context) {
	app, flt, ctx, page, _, ok := h.prepareDevicesFilter(c, devicesEndpoint{logName: "devices_errors"})
	if !ok {
		return
	}
	rows, next, previous, err := app.GetDevicesErrorsCached(ctx, h.Deps.VK, h.Deps.RchPool, &flt, page)
	respondDevicesPage(c, rows, next, previous, err, "failed to query device errors")
}

func (h Handlers) GetDevicesLaunches(c *gin.Context) {
	launchType := c.DefaultQuery("launch_type", event.TypeColdLaunch)
	if !slices.Contains(measure.LaunchTypes, launchType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("launch_type must be one of %v", measure.LaunchTypes)})
		return
	}
	app, flt, ctx, page, _, ok := h.prepareDevicesFilter(c, devicesEndpoint{logName: "devices_launches"})
	if !ok {
		return
	}
	rows, next, previous, err := app.GetDevicesLaunchesCached(ctx, h.Deps.VK, h.Deps.RchPool, &flt, page, launchType)
	respondDevicesPage(c, rows, next, previous, err, "failed to query device launch times")
}

func (h Handlers) GetDevicesSpans(c *gin.Context) {
	app, flt, ctx, page, spanName, ok := h.prepareDevicesFilter(c, devicesEndpoint{logName: "devices_spans", requireSpanName: true})
	if !ok {
		return
	}
	rows, next, previous, err := app.GetDevicesSpansCached(ctx, h.Deps.VK, h.Deps.RchPool, &flt, page, spanName)
	respondDevicesPage(c, rows, next, previous, err, "failed to query device span durations")
}

func (h Handlers) GetDevicesMemory(c *gin.Context) {
	app, flt, ctx, page, _, ok := h.prepareDevicesFilter(c, devicesEndpoint{logName: "devices_memory"})
	if !ok {
		return
	}
	// The app platform determines which memory event is queried.
	if err := app.Populate(ctx, h.Deps.PgPool); err != nil {
		fmt.Println("failed to populate app", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to populate app"})
		return
	}
	rows, next, previous, err := app.GetDevicesMemoryCached(ctx, h.Deps.VK, h.Deps.RchPool, &flt, page)
	respondDevicesPage(c, rows, next, previous, err, "failed to query device memory usage")
}
