package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"

	"backend/api/server"
	"backend/libs/ambient"
	"backend/libs/chquery"
	"backend/libs/config"
	"backend/libs/event"
	"backend/libs/exprfilter"
	"backend/libs/filter"
	"backend/libs/group"
	"backend/libs/journey"
	"backend/libs/logcomment"
	"backend/libs/measure"
	"backend/libs/metrics"
	"backend/libs/network"
	"backend/libs/opsys"
	"backend/libs/timeline"
	"backend/libs/udattr"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"golang.org/x/sync/errgroup"
)

// presignConfig builds the storage config event.PreSignURL needs from the
// process config.
func presignConfig(deps *server.Deps) event.PreSignConfig {
	return event.PreSignConfig{
		IsCloud:                    deps.Config.IsCloud(),
		AWSEndpoint:                deps.Config.AWSEndpoint,
		AttachmentsBucket:          deps.Config.AttachmentsBucket,
		AttachmentsBucketRegion:    deps.Config.AttachmentsBucketRegion,
		AttachmentsAccessKey:       deps.Config.AttachmentsAccessKey,
		AttachmentsSecretAccessKey: deps.Config.AttachmentsSecretAccessKey,
		AttachmentOrigin:           deps.Config.AttachmentOrigin,
		Origin:                     deps.Config.APIOrigin,
	}
}

func (h Handlers) GetAppJourney(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app journey request validation failed"

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}

	if err := app.Populate(ctx, deps.PgPool); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	team := &measure.Team{
		ID: &app.TeamId,
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

	ctx = ambient.WithTeamId(ctx, *team.ID)

	msg = `failed to compute app's journey`

	g, err := app.GetJourneyGraph(ctx, deps.RchPool, &af)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	lc := logcomment.New(2)
	lc.MustPut(logcomment.Root, logcomment.Journeys)

	settings := clickhouse.Settings{
		"log_comment": lc.String(),
	}

	crashFingerprints, anrFingerprints := journeyFingerprints(g.Issues)

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "fatal_exception_groups"))

	exceptionGroups, err := group.GetExceptionGroupsFromFingerprints(ctx, deps.RchPool, &af, crashFingerprints)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	crashTitles := make(map[string]string, len(exceptionGroups))
	for i := range exceptionGroups {
		crashTitles[exceptionGroups[i].ID] = exceptionGroups[i].GetDisplayTitle()
	}

	anrTitles := map[string]string{}

	if app.Family() == opsys.Android {
		ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "anr_groups"))

		anrGroups, err := group.GetANRGroupsFromFingerprints(ctx, deps.RchPool, &af, anrFingerprints)
		if err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		for i := range anrGroups {
			anrTitles[anrGroups[i].ID] = anrGroups[i].GetDisplayTitle()
		}
	}

	result := journey.Build(g, &journey.Options{
		BiGraph: af.BiGraph,
	})

	var nodes []journeyNode
	for _, name := range result.Nodes {
		nodes = append(nodes, journeyNode{
			ID: name,
			Issues: gin.H{
				"crashes": journeyIssues(result.Crashes[name], crashTitles),
				"anrs":    journeyIssues(result.ANRs[name], anrTitles),
			},
		})
	}

	var links []journeyLink
	for _, edge := range result.Edges {
		links = append(links, journeyLink{
			Source: edge.Source,
			Target: edge.Target,
			Value:  edge.Sessions,
		})
	}

	totalIssues := uint64(0)
	for i := range g.Issues {
		totalIssues += g.Issues[i].Count
	}

	c.JSON(http.StatusOK, gin.H{
		"totalIssues": totalIssues,
		"nodes":       nodes,
		"links":       links,
	})
}

// journeyLink is a transition between two journey nodes.
type journeyLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Value  uint64 `json:"value"`
}

// journeyIssue is a crash or ANR group attached to a journey node.
type journeyIssue struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Count uint64 `json:"count"`
}

// journeyNode is a node of the journey graph & its issues.
type journeyNode struct {
	ID     string `json:"id"`
	Issues gin.H  `json:"issues"`
}

// journeyFingerprints splits the graph's issue fingerprints by kind. The group
// lookups dedupe their input themselves.
func journeyFingerprints(issues []measure.JourneyIssue) (crashes, anrs []string) {
	for i := range issues {
		if issues[i].IsANR {
			anrs = append(anrs, issues[i].Fingerprint)
			continue
		}
		crashes = append(crashes, issues[i].Fingerprint)
	}

	return
}

// journeyIssues titles a node's issues, dropping those with no matching group.
// Issues are ordered by count descending.
func journeyIssues(nodeIssues []journey.Issue, titles map[string]string) (issues []journeyIssue) {
	issues = []journeyIssue{}

	for _, issue := range nodeIssues {
		title, ok := titles[issue.Fingerprint]
		if !ok {
			continue
		}
		issues = append(issues, journeyIssue{
			ID:    issue.Fingerprint,
			Title: title,
			Count: issue.Count,
		})
	}

	sort.Slice(issues, func(i, j int) bool {
		return issues[i].Count > issues[j].Count
	})

	return
}

func (h Handlers) GetAppMetrics(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse app metrics request`
		fmt.Println(msg, err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `app metrics request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}

	if err := app.Populate(ctx, deps.PgPool); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	team := &measure.Team{
		ID: &app.TeamId,
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

	ctx = ambient.WithTeamId(ctx, app.TeamId)

	excludedVersions, err := af.GetExcludedVersions(ctx, deps.RchPool)
	if err != nil {
		msg := `failed to fetch excluded versions`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	var metricsGroup errgroup.Group

	// each go routine isolates log comment &
	// clickhouse settings for safe concurrency

	var adoption *metrics.SessionAdoption
	metricsGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
		}
		ctx := chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "adoption"))

		adoption, err = app.GetAdoptionMetrics(ctx, deps.RchPool, &af)
		if err != nil {
			err = fmt.Errorf("failed to fetch adoption metrics: %w", err)
		}
		return
	})

	var crashFree *metrics.CrashFreeSession
	var perceivedCrashFree *metrics.PerceivedCrashFreeSession
	var anrFree *metrics.ANRFreeSession
	var perceivedANRFree *metrics.PerceivedANRFreeSession
	metricsGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
		}
		ctx := chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "issue_free"))

		crashFree, perceivedCrashFree, anrFree, perceivedANRFree, err = app.GetIssueFreeMetrics(ctx, deps.RchPool, &af)
		if err != nil {
			err = fmt.Errorf("failed to fetch issue free metrics: %w", err)
		}
		return
	})

	var launch *metrics.LaunchMetric
	metricsGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
		}
		ctx := chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "launch"))

		launch, err = app.GetLaunchMetrics(ctx, deps.RchPool, &af)
		if err != nil {
			err = fmt.Errorf("failed to fetch launch metrics: %w", err)
		}
		return
	})

	var sizes *metrics.SizeMetric = nil
	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 && !af.HasMultiVersions() {
		metricsGroup.Go(func() (err error) {
			lc := logcomment.New(2)
			settings := clickhouse.Settings{
				"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
				"use_query_cache": gin.Mode() == gin.ReleaseMode,
				"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
			}
			ctx := chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "sizes"))

			sizes, err = app.GetSizeMetrics(ctx, deps.PgPool, &af, excludedVersions)
			if err != nil {
				err = fmt.Errorf("failed to fetch size metrics: %w", err)
			}
			return
		})
	}

	if err = metricsGroup.Wait(); err != nil {
		err = fmt.Errorf("failed to fetch metrics: %w", err)
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cold_launch": gin.H{
			"p95":                launch.ColdLaunchP95,
			"unselected_p95":     launch.UnselectedColdLaunchP95,
			"no_data":            launch.ColdNoData,
			"unselected_no_data": launch.UnselectedColdNoData,
		},
		"warm_launch": gin.H{
			"p95":                launch.WarmLaunchP95,
			"unselected_p95":     launch.UnselectedWarmLaunchP95,
			"no_data":            launch.WarmNoData,
			"unselected_no_data": launch.UnselectedWarmNoData,
		},
		"hot_launch": gin.H{
			"p95":                launch.HotLaunchP95,
			"unselected_p95":     launch.UnselectedHotLaunchP95,
			"no_data":            launch.HotNoData,
			"unselected_no_data": launch.UnselectedHotNoData,
		},
		"adoption":                      adoption,
		"sizes":                         sizes,
		"crash_free_sessions":           crashFree,
		"anr_free_sessions":             anrFree,
		"perceived_crash_free_sessions": perceivedCrashFree,
		"perceived_anr_free_sessions":   perceivedANRFree,
	})
}

func (h Handlers) GetAppFilters(c *gin.Context) {
	deps := h.Deps
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	ctx := c.Request.Context()

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := "failed to expand app filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := af.Validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	app, err := measure.SelectApp(ctx, deps.PgPool, id)
	if err != nil {
		msg := "failed to select app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	ctx = ambient.WithTeamId(ctx, *team.ID)

	var fl filter.FilterList

	// The builds filter source reads version options from uploaded build
	// mappings; every other source derives its options from event data.
	if af.Builds {
		err = af.GetBuildFilters(ctx, deps.PgPool, &fl)
	} else {
		err = af.GetGenericFilters(ctx, deps.RchPool, &fl, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode)
	}

	if err != nil {
		msg := `failed to query app filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// club version names & version codes
	var versions []any
	for i := range fl.Versions {
		version := gin.H{"name": fl.Versions[i], "code": fl.VersionCodes[i]}
		versions = append(versions, version)
	}

	// club os names & versions
	var osVersions []any
	for i := range fl.OsVersions {
		osVersion := gin.H{"name": fl.OsNames[i], "version": fl.OsVersions[i]}
		osVersions = append(osVersions, osVersion)
	}

	udAttrs := gin.H{
		"operator_types": nil,
		"key_types":      nil,
	}

	// set user defined attribute keys only if
	// requested
	if af.UDAttrKeys {
		udAttrs["operator_types"] = udattr.GetUDAttrsOpMap()
		udAttrs["key_types"] = fl.UDKeyTypes
	}

	c.JSON(http.StatusOK, gin.H{
		"versions":             versions,
		"os_versions":          osVersions,
		"countries":            fl.Countries,
		"network_providers":    fl.NetworkProviders,
		"network_types":        fl.NetworkTypes,
		"network_generations":  fl.NetworkGenerations,
		"locales":              fl.DeviceLocales,
		"device_manufacturers": fl.DeviceManufacturers,
		"device_names":         fl.DeviceNames,
		"ud_attrs":             udAttrs,
	})
}

func (h Handlers) GetErrorOverview(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "error overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Errors).String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "errors_list"))

	errGroups, next, previous, err := app.GetErrorGroupsWithFilter(ctx, deps.RchPool, &af)
	if err != nil {
		msg := "failed to get app's error groups with filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	meta := gin.H{
		"next":     next,
		"previous": previous,
	}

	c.JSON(http.StatusOK, gin.H{
		"results": errGroups,
		"meta":    meta,
	})
}

func (h Handlers) GetErrorOverviewPlotInstances(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `error overview plot request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
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

	app.TeamId = *team.ID
	ctx = ambient.WithTeamId(ctx, *team.ID)

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Errors).String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "plots_instances"))

	errorInstances, err := app.GetErrorPlotInstances(ctx, deps.RchPool, &af)
	if err != nil {
		msg := `failed to query error instances`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range errorInstances {
		instance := instance{
			ID: errorInstances[i].Version,
			Data: []gin.H{{
				"datetime":            errorInstances[i].DateTime,
				"instances":           errorInstances[i].Instances,
				"error_free_sessions": errorInstances[i].IssueFreeSessions,
			}},
		}

		ndx, ok := lut[errorInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[errorInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func (h Handlers) GetErrorDetailErrors(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	errorGroupId := c.Param("errorGroupId")
	if errorGroupId == "" {
		msg := `error group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "error detail request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
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

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Errors).String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "detail-stacktrace"))

	errorEvents, next, previous, err := app.GetErrorsWithFilter(ctx, deps.RchPool, errorGroupId, &af)
	if err != nil {
		msg := `failed to get error group's events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	for i := range errorEvents {
		var atts []event.Attachment
		switch ev := errorEvents[i].(type) {
		case *event.EventException:
			atts = ev.Attachments
		case *event.EventANR:
			atts = ev.Attachments
		}
		for j := range atts {
			if err := atts[j].PreSignURL(ctx, presignConfig(deps)); err != nil {
				msg := `failed to generate URLs for attachment`
				fmt.Println(msg, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": errorEvents,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetErrorDetailPlotInstances(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	errorGroupId := c.Param("errorGroupId")
	if errorGroupId == "" {
		msg := `error group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "error detail plot request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
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

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Errors).String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "detail_plots_instances"))

	errorInstances, err := app.GetErrorGroupPlotInstances(ctx, deps.RchPool, errorGroupId, &af)
	if err != nil {
		msg := `failed to query data for error instances plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range errorInstances {
		instance := instance{
			ID: errorInstances[i].Version,
			Data: []gin.H{{
				"datetime":  errorInstances[i].DateTime,
				"instances": errorInstances[i].Instances,
			}},
		}

		ndx, ok := lut[errorInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[errorInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func (h Handlers) GetErrorDetailAttributeDistribution(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	errorGroupId := c.Param("errorGroupId")
	if errorGroupId == "" {
		msg := `error group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "error detail distribution request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
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

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Errors),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "plots_distribution"))

	distribution, err := app.GetErrorGroupAttributesDistribution(ctx, deps.RchPool, errorGroupId, &af)
	if err != nil {
		msg := `failed to query data for error distribution plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, distribution)
}

func (h Handlers) CreateApp(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app := measure.NewApp(teamId)
	if err := c.ShouldBindJSON(&app); err != nil {
		msg := `failed to parse app json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// In cloud, retention is plan-driven. We fail app creation on Autumn errors
	//  to avoid silently creating an app with incorrect retention.
	if deps.Config.IsBillingEnabled() {
		retention, err := measure.GetPlanRetentionDays(c.Request.Context(), deps.PgPool, deps.Config.IsBillingEnabled(), teamId)
		if err != nil {
			log.Printf("CreateApp: plan retention lookup for team %s failed: %v", teamId, err)
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "failed to determine plan retention, please try again"})
			return
		}
		app.Retention = retention
	}

	tx, err := deps.PgPool.Begin(context.Background())
	if err != nil {
		msg := `failed to start transaction`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	defer tx.Rollback(context.Background()) // Rollback if not committed

	apiKey, err := app.Add(tx)
	if err != nil {
		msg := "failed to create app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	app.APIKey = apiKey

	// Create default config for the app
	userUUID, _ := uuid.Parse(userId)
	appUUID, _ := uuid.Parse(app.ID.String())

	err = measure.CreateConfig(c.Request.Context(), tx, teamId, appUUID, &userUUID)
	if err != nil {
		msg := "failed to create default config for app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Create default threshold prefs for the app
	now := time.Now().UTC()
	stmtThresholdPrefs := sqlf.PostgreSQL.
		InsertInto("measure.app_threshold_prefs").
		Set("app_id", app.ID).
		Set("error_good_threshold", measure.DefaultErrorGoodThreshold).
		Set("error_caution_threshold", measure.DefaultErrorCautionThreshold).
		Set("error_spike_min_count_threshold", measure.DefaultErrorSpikeMinCountThreshold).
		Set("error_spike_min_rate_threshold", measure.DefaultErrorSpikeMinRateThreshold).
		Set("created_at", now).
		Set("updated_at", now)
	defer stmtThresholdPrefs.Close()
	_, err = tx.Exec(c.Request.Context(), stmtThresholdPrefs.String(), stmtThresholdPrefs.Args()...)
	if err != nil {
		msg := "failed to create default threshold prefs for app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = tx.Commit(context.Background())
	if err != nil {
		msg := "failed to commit transaction"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusCreated, app)
}

func (h Handlers) GetSessionsOverview(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "sessions overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Sessions).String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "list"))
	sessions, next, previous, err := app.GetSessionsWithFilter(ctx, deps.RchPool, &af)
	if err != nil {
		msg := "failed to get app's sessions"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": sessions,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetSessionsOverviewPlotInstances(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `sessions overview request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Sessions).String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "plots_instances"))
	sessionInstances, err := app.GetSessionsInstancesPlot(ctx, deps.RchPool, &af)
	if err != nil {
		msg := `failed to query data for sessions overview plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range sessionInstances {
		instance := instance{
			ID: sessionInstances[i].Version,
			Data: []gin.H{{
				"datetime":  sessionInstances[i].DateTime,
				"instances": sessionInstances[i].Instances,
			}},
		}

		ndx, ok := lut[sessionInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[sessionInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func (h Handlers) GetSession(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	sessionId, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		msg := `session id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := &measure.App{
		ID: &appId,
	}

	if err := app.Populate(ctx, deps.PgPool); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	userId := c.GetString("userId")

	ok, err := measure.PerformAuthz(deps.PgPool, userId, app.TeamId.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, app.TeamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	ok, err = measure.PerformAuthz(deps.PgPool, userId, app.TeamId.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, app.TeamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	lc := logcomment.New(2).MustPut(logcomment.Root, logcomment.Sessions)
	settings := clickhouse.Settings{
		"log_comment":     lc.String(),
		"use_query_cache": 1,
		// cache for 10 mins
		"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "detail"))

	session, err := app.GetSessionEvents(ctx, deps.RchPool, sessionId)
	if err != nil {
		msg := `failed to fetch session data for timeline`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	var attachmentGroup errgroup.Group
	attachmentGroup.SetLimit(16)

	// generate pre-sign URLs for
	// attachments
	for i := range session.Events {
		if !session.Events[i].HasAttachments() {
			continue
		}
		for j := range session.Events[i].Attachments {
			attachmentGroup.Go(func() (err error) {
				if err = session.Events[i].Attachments[j].PreSignURL(ctx, presignConfig(deps)); err != nil {
					return
				}
				return
			})
		}
	}

	if err := attachmentGroup.Wait(); err != nil {
		msg := `failed to generate URLs for attachment`
		err = fmt.Errorf("%s: %v", msg, err)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	duration := session.DurationFromEvents().Milliseconds()
	cpuUsageEvents := session.EventsOfType(event.TypeCPUUsage)
	cpuUsages := timeline.ComputeCPUUsage(cpuUsageEvents)

	memoryUsageEvents := session.EventsOfType(event.TypeMemoryUsage)
	memoryUsages := timeline.ComputeMemoryUsage(memoryUsageEvents)

	memoryUsageAbsEvents := session.EventsOfType(event.TypeMemoryUsageAbs)
	memoryUsageAbsolutes := timeline.ComputeMemoryUsageAbs(memoryUsageAbsEvents)

	typeList := []string{
		event.TypeGestureClick,
		event.TypeGestureLongClick,
		event.TypeGestureScroll,
		event.TypeNavigation,
		event.TypeString,
		event.TypeLog,
		event.TypeNetworkChange,
		event.TypeColdLaunch,
		event.TypeWarmLaunch,
		event.TypeHotLaunch,
		event.TypeLifecycleActivity,
		event.TypeLifecycleFragment,
		event.TypeLifecycleViewController,
		event.TypeLifecycleSwiftUI,
		event.TypeLifecycleApp,
		event.TypeTrimMemory,
		event.TypeLowMemory,
		event.TypeAppExit,
		event.TypeException,
		event.TypeANR,
		event.TypeHttp,
		event.TypeScreenView,
		event.TypeBugReport,
		event.TypeCustom,
		event.TypeProfile,
	}

	eventMap := session.EventsOfTypes(typeList...)
	threads := make(timeline.Threads)

	gestureClickEvents := eventMap[event.TypeGestureClick]
	if len(gestureClickEvents) > 0 {
		gestureClicks := timeline.ComputeGestureClicks(gestureClickEvents)
		threadedGestureClicks := timeline.GroupByThreads(gestureClicks)
		threads.Organize(event.TypeGestureClick, threadedGestureClicks)
	}

	gestureLongClickEvents := eventMap[event.TypeGestureLongClick]
	if len(gestureLongClickEvents) > 0 {
		gestureLongClicks := timeline.ComputeGestureLongClicks(gestureLongClickEvents)
		threadedGestureLongClicks := timeline.GroupByThreads(gestureLongClicks)
		threads.Organize(event.TypeGestureLongClick, threadedGestureLongClicks)
	}

	gestureScrollEvents := eventMap[event.TypeGestureScroll]
	if len(gestureScrollEvents) > 0 {
		gestureScrolls := timeline.ComputeGestureScrolls(gestureScrollEvents)
		threadedGestureScrolls := timeline.GroupByThreads(gestureScrolls)
		threads.Organize(event.TypeGestureScroll, threadedGestureScrolls)
	}

	navEvents := eventMap[event.TypeNavigation]
	if len(navEvents) > 0 {
		navs := timeline.ComputeNavigation(navEvents)
		threadedNavs := timeline.GroupByThreads(navs)
		threads.Organize(event.TypeNavigation, threadedNavs)
	}

	screenViewEvents := eventMap[event.TypeScreenView]
	if len(screenViewEvents) > 0 {
		screenViews := timeline.ComputeScreenViews(screenViewEvents)
		threadedScreenViews := timeline.GroupByThreads(screenViews)
		threads.Organize(event.TypeScreenView, threadedScreenViews)
	}

	bugReportEvents := eventMap[event.TypeBugReport]
	if len(bugReportEvents) > 0 {
		bugReports := timeline.ComputeBugReport(bugReportEvents)
		threadedBugReports := timeline.GroupByThreads(bugReports)
		threads.Organize(event.TypeBugReport, threadedBugReports)
	}

	customEvents := eventMap[event.TypeCustom]
	if len(customEvents) > 0 {
		customs := timeline.ComputeCustom(customEvents)
		threadedCustoms := timeline.GroupByThreads(customs)
		threads.Organize(event.TypeCustom, threadedCustoms)
	}

	stringEvents := eventMap[event.TypeString]
	if len(stringEvents) > 0 {
		strings := timeline.ComputeLogString(stringEvents)
		threadedStrings := timeline.GroupByThreads(strings)
		threads.Organize(event.TypeString, threadedStrings)
	}

	logEvents := eventMap[event.TypeLog]
	if len(logEvents) > 0 {
		logs := timeline.ComputeLogs(logEvents)
		threadedLogs := timeline.GroupByThreads(logs)
		threads.Organize(event.TypeLog, threadedLogs)
	}

	netChangeEvents := eventMap[event.TypeNetworkChange]
	if len(netChangeEvents) > 0 {
		netChanges := timeline.ComputeNetworkChange(netChangeEvents)
		threadedNetChanges := timeline.GroupByThreads(netChanges)
		threads.Organize(event.TypeNetworkChange, threadedNetChanges)
	}

	coldLaunchEvents := eventMap[event.TypeColdLaunch]
	if len(coldLaunchEvents) > 0 {
		coldLaunches := timeline.ComputeColdLaunches(coldLaunchEvents)
		threadedColdLaunches := timeline.GroupByThreads(coldLaunches)
		threads.Organize(event.TypeColdLaunch, threadedColdLaunches)
	}

	profileEvents := eventMap[event.TypeProfile]
	if len(profileEvents) > 0 {
		profiles := timeline.ComputeProfiles(profileEvents)
		threadedProfiles := timeline.GroupByThreads(profiles)
		threads.Organize(event.TypeProfile, threadedProfiles)
	}

	warmLaunchEvents := eventMap[event.TypeWarmLaunch]
	if len(warmLaunchEvents) > 0 {
		warmLaunches := timeline.ComputeWarmLaunches(warmLaunchEvents)
		threadedWarmLaunches := timeline.GroupByThreads(warmLaunches)
		threads.Organize(event.TypeWarmLaunch, threadedWarmLaunches)
	}

	hotLaunchEvents := eventMap[event.TypeHotLaunch]
	if len(hotLaunchEvents) > 0 {
		hotLaunches := timeline.ComputeHotLaunches(hotLaunchEvents)
		threadedHotLaunches := timeline.GroupByThreads(hotLaunches)
		threads.Organize(event.TypeHotLaunch, threadedHotLaunches)
	}

	lifecycleActivityEvents := eventMap[event.TypeLifecycleActivity]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleActivities := timeline.ComputeLifecycleActivities(lifecycleActivityEvents)
		threadedLifecycleActivities := timeline.GroupByThreads(lifecycleActivities)
		threads.Organize(event.TypeLifecycleActivity, threadedLifecycleActivities)
	}

	lifecycleFragmentEvents := eventMap[event.TypeLifecycleFragment]
	if len(lifecycleFragmentEvents) > 0 {
		lifecycleFragments := timeline.ComputeLifecycleFragments(lifecycleFragmentEvents)
		threadedLifecycleFragments := timeline.GroupByThreads(lifecycleFragments)
		threads.Organize(event.TypeLifecycleFragment, threadedLifecycleFragments)
	}

	lifecycleViewControllerEvents := eventMap[event.TypeLifecycleViewController]
	if len(lifecycleViewControllerEvents) > 0 {
		lifecycleViewControllers := timeline.ComputeLifecycleViewControllers(lifecycleViewControllerEvents)
		threadedLifecycleViewControllers := timeline.GroupByThreads(lifecycleViewControllers)
		threads.Organize(event.TypeLifecycleViewController, threadedLifecycleViewControllers)
	}

	lifecycleSwiftUIEvents := eventMap[event.TypeLifecycleSwiftUI]
	if len(lifecycleSwiftUIEvents) > 0 {
		lifecycleSwiftUIViews := timeline.ComputeLifecycleSwiftUIViews(lifecycleSwiftUIEvents)
		threadedLifecycleSwiftUIViews := timeline.GroupByThreads(lifecycleSwiftUIViews)
		threads.Organize(event.TypeLifecycleSwiftUI, threadedLifecycleSwiftUIViews)
	}

	lifecycleAppEvents := eventMap[event.TypeLifecycleApp]
	if len(lifecycleAppEvents) > 0 {
		lifecycleApps := timeline.ComputeLifecycleApps(lifecycleAppEvents)
		threadedLifecycleApps := timeline.GroupByThreads(lifecycleApps)
		threads.Organize(event.TypeLifecycleApp, threadedLifecycleApps)
	}

	trimMemoryEvents := eventMap[event.TypeTrimMemory]
	if len(trimMemoryEvents) > 0 {
		trimMemories := timeline.ComputeTrimMemories(trimMemoryEvents)
		threadedTrimMemories := timeline.GroupByThreads(trimMemories)
		threads.Organize(event.TypeTrimMemory, threadedTrimMemories)
	}

	lowMemoryEvents := eventMap[event.TypeLowMemory]
	if len(lowMemoryEvents) > 0 {
		lowMemories := timeline.ComputeLowMemories(lowMemoryEvents)
		threadedLowMemories := timeline.GroupByThreads(lowMemories)
		threads.Organize(event.TypeLowMemory, threadedLowMemories)
	}

	appExitEvents := eventMap[event.TypeAppExit]
	if len(appExitEvents) > 0 {
		appExits := timeline.ComputeAppExits(appExitEvents)
		threadedAppExits := timeline.GroupByThreads(appExits)
		threads.Organize(event.TypeAppExit, threadedAppExits)
	}

	exceptionEvents := eventMap[event.TypeException]
	if len(exceptionEvents) > 0 {
		exceptions, err := timeline.ComputeExceptions(c, app.ID, exceptionEvents)
		if err != nil {
			msg := fmt.Sprintf(`unable to compute exceptions for session %q for app %q`, sessionId, app.ID)
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
		threadedExceptions := timeline.GroupByThreads(exceptions)
		threads.Organize(event.TypeException, threadedExceptions)
	}

	anrEvents := eventMap[event.TypeANR]
	if len(anrEvents) > 0 {
		anrs, err := timeline.ComputeANRs(c, app.ID, anrEvents)
		if err != nil {
			msg := fmt.Sprintf(`unable to compute ANRs for session %q for app %q`, sessionId, app.ID)
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
		threadedANRs := timeline.GroupByThreads(anrs)
		threads.Organize(event.TypeANR, threadedANRs)
	}

	httpEvents := eventMap[event.TypeHttp]
	if len(httpEvents) > 0 {
		httpies := timeline.ComputeHttp(httpEvents)
		threadedHttpies := timeline.GroupByThreads(httpies)
		threads.Organize(event.TypeHttp, threadedHttpies)
	}

	threads.Sort()

	sessionTraces, err := app.FetchTracesForSessionId(ctx, deps.RchPool, sessionId)
	if err != nil {
		msg := `failed to fetch trace data for timeline`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// no event rows & no traces means the session
	// does not exist for this app
	if session.Attribute == nil && len(sessionTraces) == 0 {
		msg := fmt.Sprintf(`session %q for app %q does not exist`, sessionId, app.ID)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
		return
	}

	// For trace only sessions, populate session's attribute
	// and duration from traces.
	if !session.HasEvents() && len(sessionTraces) > 0 {
		session.Attribute = &event.Attribute{}
		session.Attribute.AppVersion = sessionTraces[0].AppVersion
		session.Attribute.AppBuild = sessionTraces[0].AppBuild
		session.Attribute.DeviceManufacturer = sessionTraces[0].DeviceManufacturer
		session.Attribute.DeviceModel = sessionTraces[0].DeviceModel
		session.Attribute.NetworkType = sessionTraces[0].NetworkType

		// use the trace duration as the session's duration
		lastTraceTime := sessionTraces[0].StartTime
		firstTraceTime := sessionTraces[len(sessionTraces)-1].StartTime
		duration = lastTraceTime.Sub(firstTraceTime).Milliseconds()
	}

	response := gin.H{
		"session_id":            sessionId,
		"attribute":             session.Attribute,
		"app_id":                appId,
		"duration":              duration,
		"cpu_usage":             cpuUsages,
		"memory_usage":          memoryUsages,
		"memory_usage_absolute": memoryUsageAbsolutes,
		"threads":               threads,
		"traces":                sessionTraces,
	}

	c.JSON(http.StatusOK, response)
}

func (h Handlers) GetAppRetention(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := measure.App{
		ID: &appId,
	}

	team, err := app.GetTeam(c, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read app settings in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	retention, err := app.GetAppRetention(deps.PgPool)
	if err != nil {
		msg := `unable to fetch app retention`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"retention": retention})
}

func (h Handlers) UpdateAppRetention(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := measure.App{
		ID: &appId,
	}

	team, err := app.GetTeam(c, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to modify app settings in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	if deps.Config.IsBillingEnabled() {
		msg := `retention is determined by your plan and cannot be changed directly`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	type RetentionPayload struct {
		Retention int `json:"retention"`
	}
	var payload RetentionPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse app settings json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if payload.Retention < measure.MIN_RETENTION_DAYS || payload.Retention > measure.MAX_RETENTION_DAYS {
		msg := fmt.Sprintf(`retention period must be between %d and %d days`, measure.MIN_RETENTION_DAYS, measure.MAX_RETENTION_DAYS)
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	err = app.UpdateRetention(deps.PgPool, payload.Retention)
	if err != nil {
		msg := "failed to update app retention"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

func (h Handlers) RenameApp(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := measure.App{
		ID: &appId,
	}

	team, err := app.GetTeam(c, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to modify app in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	var payload struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse app rename json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app.AppName = payload.Name

	err = app.Rename(deps.PgPool)
	if err != nil {
		msg := `failed to rename app`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

func (h Handlers) CreateShortFilters(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := measure.App{
		ID: &appId,
	}

	team, err := app.GetTeam(c, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create short filters in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	var payload filter.ShortFiltersPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse filters json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	// embed app id in filter payload
	payload.AppID = appId

	shortFilters, err := filter.NewShortFilters(payload)
	if err != nil {
		msg := `failed to create filter hash`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if err = shortFilters.Create(ctx, deps.PgPool); err != nil {
		msg := `failed to create short code from filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"filter_short_code": shortFilters.Code,
	})
}

func (h Handlers) GetRootSpanNames(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment":      lc.MustPut(logcomment.Root, logcomment.Spans),
		"use_query_cache":  gin.Mode() == gin.ReleaseMode,
		"use_skip_indexes": 0,
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "names_list"))

	traceNames, err := app.FetchRootSpanNames(ctx, deps.RchPool)
	if err != nil {
		msg := "failed to get app's traces"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": traceNames,
	})
}

func (h Handlers) GetSpansForSpanName(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	spanName := c.Query("span_name")
	if spanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing span_name query param",
		})
		return
	}

	ef := exprfilter.ExprFilter{
		AppID: id,
		Limit: exprfilter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&ef); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	ef.Entity = exprfilter.SpansEntity

	if err := ef.BuildExprTree(); err != nil {
		respondFilterError(c, err)
		return
	}

	ef.SetDefaultTimeRangeIfUnset()

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID
	ef.TeamID = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment":     lc.MustPut(logcomment.Root, logcomment.Spans),
		"use_query_cache": gin.Mode() == gin.ReleaseMode,
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "list"))

	if err := ef.ResolveCustomKeys(ctx, deps.RchPool); err != nil {
		msg := "failed to read the filter's custom keys"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := ef.Validate(); err != nil {
		respondFilterError(c, err)
		return
	}

	spans, next, previous, err := app.GetSpansForSpanNameWithFilter(ctx, deps.RchPool, spanName, &ef)
	if err != nil {
		msg := "failed to get app's root spans"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": spans,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetMetricsPlotForSpanName(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	spanName := c.Query("span_name")
	if spanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing span_name query param",
		})
		return
	}

	ef := exprfilter.ExprFilter{
		AppID: id,
		Limit: exprfilter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&ef); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	ef.Entity = exprfilter.SpansEntity

	if err := ef.BuildExprTree(); err != nil {
		respondFilterError(c, err)
		return
	}

	ef.SetDefaultTimeRangeIfUnset()

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID
	ef.TeamID = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Spans),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "plots_metrics"))

	if err := ef.ResolveCustomKeys(ctx, deps.RchPool); err != nil {
		msg := "failed to read the filter's custom keys"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := ef.Validate(); err != nil {
		respondFilterError(c, err)
		return
	}

	spanMetricsPlotInstances, err := app.GetMetricsPlotForSpanNameWithFilter(ctx, deps.RchPool, spanName, &ef)
	if err != nil {
		msg := "failed to get span's plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range spanMetricsPlotInstances {
		instance := instance{
			ID: spanMetricsPlotInstances[i].Version,
			Data: []gin.H{{
				"datetime": spanMetricsPlotInstances[i].DateTime,
				"p50":      spanMetricsPlotInstances[i].P50,
				"p90":      spanMetricsPlotInstances[i].P90,
				"p95":      spanMetricsPlotInstances[i].P95,
				"p99":      spanMetricsPlotInstances[i].P99,
			}},
		}

		ndx, ok := lut[spanMetricsPlotInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[spanMetricsPlotInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func (h Handlers) GetTrace(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	traceId := c.Param("traceId")

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Spans),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "trace"))

	trace, err := app.GetTrace(ctx, deps.RchPool, traceId)
	if err != nil {
		msg := "failed to get trace"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, trace)
}

func (h Handlers) GetBugReportsOverview(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "bug reports overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeBugReportRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "list"))

	bugReports, next, previous, err := app.GetBugReportsWithFilter(ctx, deps.RchPool, &af)
	if err != nil {
		msg := "failed to get app's bug reports"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": bugReports,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetBugReportsInstancesPlot(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `bug reports plot request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeBugReportRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "plots_instances"))

	bugReportInstances, err := app.GetBugReportInstancesPlot(ctx, deps.RchPool, &af)
	if err != nil {
		msg := `failed to query data for bug reports plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range bugReportInstances {
		instance := instance{
			ID: bugReportInstances[i].Version,
			Data: []gin.H{{
				"datetime":  bugReportInstances[i].DateTime,
				"instances": bugReportInstances[i].Instances,
			}},
		}

		ndx, ok := lut[bugReportInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[bugReportInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func (h Handlers) GetBugReport(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	bugReportId := c.Param("bugReportId")

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeBugReportRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "detail"))

	bugReport, err := app.GetBugReportById(ctx, deps.RchPool, presignConfig(deps), bugReportId)
	if err != nil {
		msg := "failed to get bug report"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, bugReport)
}

func (h Handlers) UpdateBugReportStatus(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	bugReportId := c.Param("bugReportId")

	app := measure.App{
		ID: &id,
	}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeBugReportAll)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	var payload measure.BugReportStatusUpdatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse bug report status update json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "update_status"))

	if err := app.UpdateBugReportStatusById(ctx, deps.ChPool, bugReportId, *payload.Status); err != nil {
		msg := "failed to update bug report status"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

func (h Handlers) GetAlertsOverview(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "alerts overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
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

	alerts, next, previous, err := measure.GetAlertsWithFilter(ctx, deps.PgPool, &af)
	if err != nil {
		msg := "failed to get app's alerts"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": alerts,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func (h Handlers) GetConfig(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	idParam := c.Param("id")

	id, err := uuid.Parse(idParam)
	if err != nil {
		msg := `id invalid or missing`
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

	GetConfigForDashboard(c, deps, id)
}

func (h Handlers) PatchConfig(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	idParam := c.Param("id")

	appId, err := uuid.Parse(idParam)
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := measure.App{
		ID: &appId,
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

	okApp, err := measure.PerformAuthz(deps.PgPool, userId, team.ID.String(), *measure.ScopeAppAll)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	err = PatchConfigForApp(c, deps, appId, userId)
	if err != nil {
		msg := "failed to update SDK config"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "config updated successfully"})
}

// GetNetworkRequestsEndpoints serves the dashboard's endpoint search.
func (h Handlers) GetNetworkRequestsEndpoints(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "network endpoint search request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
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

	endpoints, err := network.FetchEndpoints(ctx, deps.RchPool, *app.ID, *team.ID, c.Query("query"), &af)
	if err != nil {
		msg := "failed to get network endpoints"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": endpoints})
}

func (h Handlers) GetNetworkEndpointLatencyPlot(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	domain := c.Query("domain")
	path := c.Query("path")

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "network metrics request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		msg := "failed to compute time group expression"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
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

	result, err := network.GetLatencyPlot(ctx, deps.RchPool, *app.ID, *team.ID, domain, path, &af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		msg := "failed to get network latency metrics"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h Handlers) GetNetworkRequestsTrends(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "network overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
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

	trendsLimit := 10
	if v, err := strconv.Atoi(c.Query("trends_limit")); err == nil && v > 0 {
		trendsLimit = v
	}
	if trendsLimit > 50 {
		trendsLimit = 50
	}

	result, err := network.FetchTrends(ctx, deps.RchPool, *app.ID, *team.ID, &af, trendsLimit)
	if err != nil {
		msg := "failed to get network overview"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h Handlers) GetNetworkEndpointTimelinePlot(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "endpoint timeline request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	domain := c.Query("domain")
	path := c.Query("path")

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

	result, err := network.FetchTimelinePlot(ctx, deps.RchPool, *app.ID, *team.ID, domain, path, &af)
	if err != nil {
		msg := "failed to get endpoint timeline data"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h Handlers) GetNetworkStatusCodesPlot(c *gin.Context) {
	h.getNetworkStatusCodesPlot(c, false)
}

func (h Handlers) GetNetworkEndpointStatusCodesPlot(c *gin.Context) {
	h.getNetworkStatusCodesPlot(c, true)
}

func (h Handlers) getNetworkStatusCodesPlot(c *gin.Context, exactCodes bool) {
	deps := h.Deps
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	domain := c.Query("domain")
	path := c.Query("path")
	if exactCodes && domain == "" && path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing endpoint query params"})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx, deps.PgPool); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "network status codes plot request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		msg := "failed to compute time group expression"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
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

	if exactCodes {
		result, err := network.GetEndpointStatusCodesPlot(ctx, deps.RchPool, *app.ID, *team.ID, domain, path, &af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
		if err != nil {
			msg := "failed to get network endpoint status codes plot"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusOK, result)
		return
	}

	result, err := network.GetStatusCodesPlot(ctx, deps.RchPool, *app.ID, *team.ID, domain, path, &af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		msg := "failed to get network status codes plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}
