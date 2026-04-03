package measure

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"backend/api/server"

	"github.com/gin-gonic/gin"
)

func PutEvents(c *gin.Context) {
	// Proxy to ingest service
	//
	// Proxy to ingest service for non-Cloud
	// environments so that SDKS using API endpoint
	// continue to work. This is temporary & will be
	// eventually removed.
	//
	// SDK consumers are encouraged to migrate to the
	// ingest endpoint.
	if !server.Server.Config.IsCloud() {
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
