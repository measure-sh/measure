package measure

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	"backend/api/server"

	"github.com/gin-gonic/gin"
)

func PutBuilds(c *gin.Context) {
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

// ProxySymbol proxies presigned S3 URLs to an S3-like
// server.
//
// We parse the payload from the incoming request's query
// string, then construct a new URL by replacing the S3 origin.
// Next, we create a reverse proxy and configure it to pipe
// response back to the original caller.
//
// The original S3 origin used when constructing the presigned
// URL must match the proxied presigned URL.
func ProxySymbol(c *gin.Context) {
	payload := c.Query("payload")
	if payload == "" {
		msg := `need payload for proxying to object store`
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	config := server.Server.Config

	parsed, err := validateProxyPayload(payload, config.AWSEndpoint)
	if err != nil {
		fmt.Println("symbol proxy validation failed:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid proxy payload",
		})
		return
	}

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.Out.URL.Scheme = parsed.Scheme
			pr.Out.URL.Host = parsed.Host
			pr.Out.URL.Path = parsed.Path
			pr.Out.URL.RawQuery = parsed.RawQuery
			pr.Out.Host = parsed.Host
			pr.Out.Header = pr.In.Header.Clone()
		},
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode != http.StatusOK {
			fmt.Printf("Symbol proxy http status: %s\n", resp.Status)
		}
		return nil
	}

	proxy.ServeHTTP(c.Writer, c.Request)
}
