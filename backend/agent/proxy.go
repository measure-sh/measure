package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"

	"backend/agent/server"
	"backend/libs/objstore"

	"github.com/gin-gonic/gin"
)

// proxyAttachment proxies presigned S3 URLs to an S3-like server. Attachment
// URLs in agent tool results point at this service's origin, so it serves the
// same read proxy as api. Each service owns its transport, so this mirrors
// api's handler rather than sharing one out of libs.
func proxyAttachment(deps *server.Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		payload := c.Query("payload")
		if payload == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "need payload for proxying to object store",
			})
			return
		}

		parsed, err := objstore.ValidateProxyPayload(payload, deps.Config.AWSEndpoint)
		if err != nil {
			fmt.Println("attachment proxy validation failed:", err)
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
				fmt.Printf("Attachment proxy http status: %s\n", resp.Status)
			}
			return nil
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
