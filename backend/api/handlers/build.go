package handlers

import (
	"errors"
	"fmt"
	"mime"
	"net/http"
	"net/http/httputil"
	"net/url"

	"backend/api/server"
	"backend/libs/exprfilter"
	"backend/libs/measure"
	"backend/libs/objstore"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func buildFileDownloadConfig(deps *server.Deps) measure.BuildFileDownloadConfig {
	return measure.BuildFileDownloadConfig{
		IsCloud:                deps.Config.IsCloud(),
		AWSEndpoint:            deps.Config.AWSEndpoint,
		SymbolsBucket:          deps.Config.SymbolsBucket,
		SymbolsBucketRegion:    deps.Config.SymbolsBucketRegion,
		SymbolsAccessKey:       deps.Config.SymbolsAccessKey,
		SymbolsSecretAccessKey: deps.Config.SymbolsSecretAccessKey,
	}
}

func (h Handlers) GetBuilds(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `Id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ef := exprfilter.ExprFilter{
		AppID: id,
		Limit: exprfilter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&ef); err != nil {
		msg := `Failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	ef.Entity = exprfilter.BuildsEntity

	if err := ef.BuildExprTree(); err != nil {
		respondFilterError(c, err)
		return
	}

	if err := ef.Validate(); err != nil {
		respondFilterError(c, err)
		return
	}

	if !ef.HasTimeRange() {
		ef.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	builds, next, previous, err := measure.GetBuildsWithFilter(ctx, deps.PgPool, &ef)
	if err != nil {
		msg := "failed to get app's builds"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Downloads are served by the authenticated download endpoint, which
	// packages the artifact the way its platform tooling expects.
	for i := range builds {
		for j := range builds[i].Files {
			builds[i].Files[j].DownloadURL = fmt.Sprintf("/apps/%s/builds/%s/download", id, builds[i].Files[j].ID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": builds,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) DownloadBuildFile(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `Id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	buildFileId, err := uuid.Parse(c.Param("buildFileId"))
	if err != nil {
		msg := `build file id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	buildFile, err := measure.GetBuildFile(ctx, deps.PgPool, id, buildFileId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			msg := fmt.Sprintf("no build file [%s] exists for app [%s]", buildFileId, id)
			c.JSON(http.StatusNotFound, gin.H{"error": msg})
			return
		}
		msg := "failed to get app's build file"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	download, err := measure.OpenBuildFileDownload(ctx, buildFileDownloadConfig(deps), buildFile)
	if err != nil {
		msg := "failed to open build file download"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	defer func() {
		if err := download.Close(); err != nil {
			fmt.Println("failed to close build file download:", err)
		}
	}()

	// The response streams with chunked transfer encoding and sets no
	// Content-Length, because load balancers commonly cap buffered
	// responses in size but stream chunked ones unbounded.
	c.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": download.Filename}))
	c.Header("Content-Type", download.ContentType)
	c.Status(http.StatusOK)

	// The response is already streaming, so a failure here can no longer
	// produce an error status, and a chunked response that returns normally
	// ends with a valid terminator, which would make a truncated download
	// look complete to the client. panic(http.ErrAbortHandler) cannot be
	// used because the panic middleware recovers it and finishes the
	// response cleanly, so the connection is hijacked and closed instead.
	if err := download.Stream(c.Writer); err != nil {
		fmt.Println("failed to stream build file download:", err)
		if hijacker, ok := c.Writer.(http.Hijacker); ok {
			if conn, _, hijackErr := hijacker.Hijack(); hijackErr == nil {
				conn.Close()
			}
		}
	}
}

func (h Handlers) PutBuilds(c *gin.Context) {
	deps := h.Deps
	// Non-Cloud deployments proxy to the ingest service so SDKs still
	// using the API endpoint keep working. This is temporary; SDK
	// consumers should migrate to the ingest endpoint.
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

// ProxySymbol proxies presigned S3 URLs to an S3-like server. The S3
// origin the presigned URL was constructed with must match the origin
// the proxied URL is sent to.
func (h Handlers) ProxySymbol(c *gin.Context) {
	deps := h.Deps
	payload := c.Query("payload")
	if payload == "" {
		msg := `need payload for proxying to object store`
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	config := deps.Config

	parsed, err := objstore.ValidateProxyPayload(payload, config.AWSEndpoint)
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
