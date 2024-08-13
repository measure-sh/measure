package measure

import (
	"fmt"
	"measure-backend/measure-go/server"
	"net/http"
	"net/http/httputil"
	"net/url"

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
	presignedUrl := config.AWSEndpoint + payload

	parsed, err := url.Parse(presignedUrl)
	if err != nil {
		msg := "failed to parse reconstructed presigned url"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(parsed)
	proxy.Director = func(req *http.Request) {
		req.URL.Scheme = parsed.Scheme
		req.URL.Host = parsed.Host
		req.URL.Path = parsed.Path
		req.URL.RawQuery = parsed.RawQuery
		req.Host = parsed.Host

		req.Header = c.Request.Header

		fmt.Printf("Attachment proxy target url: %s\n", req.URL.String())
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		fmt.Printf("Attachment proxy http status: %s\n", resp.Status)
		return nil
	}

	proxy.ServeHTTP(c.Writer, c.Request)
}
