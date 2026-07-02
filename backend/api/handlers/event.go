package handlers

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

func (h Handlers) PutEvents(c *gin.Context) {
	deps := h.Deps
	// Proxy to ingest service
	//
	// Proxy to ingest service for non-Cloud
	// environments so that SDKS using API endpoint
	// continue to work. This is temporary & will be
	// eventually removed.
	//
	// SDK consumers are encouraged to migrate to the
	// ingest endpoint.
	if !deps.Config.IsCloud() {
		ingestOrigin := "http://ingest:8085"
		target, err := url.Parse(ingestOrigin)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to parse ingest origin",
			})
			return
		}
		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.ServeHTTP(c.Writer, c.Request)
		return
	}

	c.Status(http.StatusGone)
}
