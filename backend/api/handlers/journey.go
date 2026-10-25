package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
)

func journeyEndpoint(logName string) filterEndpoint {
	return filterEndpoint{
		entity:   filter.JourneysEntity,
		appScope: *measure.ScopeAppRead,
		logRoot:  logcomment.Journeys,
		logName:  logName,
	}
}

// journeyListEndpoint is the endpoint of a query that shows more data about a
// journey, such as the errors at a node. It takes the sample percent of the
// journey.
func journeyListEndpoint(logName string) filterEndpoint {
	endpoint := journeyEndpoint(logName)
	endpoint.acceptSamplePercent = true
	return endpoint
}

// journeySelection reads the selection from the query params. A node comes
// from node. A link comes from source and target. A path comes from two or
// more path params. If there is no selection, it writes an error response
// and returns false.
func journeySelection(c *gin.Context) (selection measure.JourneySelection, ok bool) {
	if node := c.Query("node"); node != "" {
		return measure.JourneySelection{Node: node}, true
	}
	source, target := c.Query("source"), c.Query("target")
	if source != "" && target != "" {
		return measure.JourneySelection{Path: []string{source, target}}, true
	}
	if path := c.QueryArray("path"); len(path) >= 2 {
		return measure.JourneySelection{Path: path}, true
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": "a node, a source and target, or a path of two or more nodes is required"})
	return measure.JourneySelection{}, false
}

// journeyMaxLinks reads the max_links query param. If the value is not a
// whole number from 1 to measure.JourneyMaxLinks, it writes an error response
// and returns false.
func journeyMaxLinks(c *gin.Context) (maxLinks int, ok bool) {
	value := c.Query("max_links")
	if value == "" {
		return measure.JourneyMaxLinks, true
	}
	maxLinks, err := strconv.Atoi(value)
	if err != nil || maxLinks < 1 || maxLinks > measure.JourneyMaxLinks {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("max_links must be a whole number from 1 to %d", measure.JourneyMaxLinks)})
		return 0, false
	}
	return maxLinks, true
}

func (h Handlers) GetJourney(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, journeyEndpoint("journey"))
	if !ok {
		return
	}
	maxLinks, ok := journeyMaxLinks(c)
	if !ok {
		return
	}

	journey, err := measure.GetJourney(ctx, h.Deps.VK, h.Deps.RchPool, &flt)
	if err != nil {
		respondQueryError(c, `error fetching journey`, err)
		return
	}

	c.JSON(http.StatusOK, journey.TopLinks(maxLinks))
}

func (h Handlers) GetJourneyPathUsers(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, journeyListEndpoint("path_users"))
	if !ok {
		return
	}
	path := c.QueryArray("path")
	if len(path) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a path of two or more nodes is required"})
		return
	}

	pathUsers, err := measure.GetJourneyPathUsers(ctx, h.Deps.VK, h.Deps.RchPool, &flt, path)
	if err != nil {
		respondQueryError(c, `error fetching journey path users`, err)
		return
	}

	c.JSON(http.StatusOK, pathUsers)
}

func (h Handlers) GetJourneyErrors(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, journeyListEndpoint("errors"))
	if !ok {
		return
	}
	selection, ok := journeySelection(c)
	if !ok {
		return
	}

	page, err := measure.GetJourneyErrors(ctx, h.Deps.VK, h.Deps.RchPool, &flt, selection)
	respondSampledPage(c, `error fetching journey errors`, page, err)
}

func (h Handlers) GetJourneyTraces(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, journeyListEndpoint("traces"))
	if !ok {
		return
	}
	selection, ok := journeySelection(c)
	if !ok {
		return
	}
	quantile, ok := measure.FunnelQuantiles[c.Query("quantile")]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "quantile must be one of p50, p90, p95 or p99"})
		return
	}

	page, err := measure.GetJourneyTraces(ctx, h.Deps.VK, h.Deps.RchPool, &flt, selection, quantile)
	respondSampledPage(c, `error fetching journey traces`, page, err)
}

func (h Handlers) GetJourneyNetwork(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, journeyListEndpoint("network"))
	if !ok {
		return
	}
	selection, ok := journeySelection(c)
	if !ok {
		return
	}
	quantile, ok := measure.FunnelQuantiles[c.Query("quantile")]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "quantile must be one of p50, p90, p95 or p99"})
		return
	}

	page, err := measure.GetJourneyNetwork(ctx, h.Deps.VK, h.Deps.RchPool, &flt, selection, quantile)
	respondSampledPage(c, `error fetching journey network`, page, err)
}

func (h Handlers) GetJourneySessions(c *gin.Context) {
	_, flt, ctx, _, ok := h.prepareFilter(c, journeyListEndpoint("sessions"))
	if !ok {
		return
	}
	selection, ok := journeySelection(c)
	if !ok {
		return
	}

	page, err := measure.GetJourneySessions(ctx, h.Deps.VK, h.Deps.RchPool, &flt, selection)
	respondSampledPage(c, `error fetching journey sessions`, page, err)
}
