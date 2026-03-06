package measure

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"backend/api/server"

	"github.com/gin-gonic/gin"
)

// ProxyAttachment proxies presigned S3 URLs to an S3-like
// server.
//
// We parse the payload from the incoming request's query
// string, then construct a new URL by replacing the S3 origin.
// Next, we create a reverse proxy and configure it to pipe
// response back to the original caller.
//
// The original S3 origin used when constructing the presigned
// URL must match the proxied presigned URL.
func ProxyAttachment(c *gin.Context) {
	payload := c.Query("payload")
	if payload == "" {
		msg := `need payload for proxying to object store`
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	config := server.Server.Config
	presignedUrl := payload

	// if the payload already contains origin, then
	// don't prepend the origin.
	if !strings.HasPrefix(payload, config.AWSEndpoint) {
		presignedUrl = config.AWSEndpoint + payload
	}

	parsed, err := url.Parse(presignedUrl)
	if err != nil {
		msg := "failed to parse reconstructed presigned url"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
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
