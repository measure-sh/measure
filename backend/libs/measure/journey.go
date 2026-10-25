package measure

import (
	"cmp"
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/network"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	valkey "github.com/valkey-io/valkey-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const (
	// A journey has only this number of nodes and links, the ones with the
	// most users, so the response stays small. The user selects which of the
	// nodes the graph shows, and a caller can ask for fewer links.
	journeyMaxNodes = 500
	JourneyMaxLinks = 5000

	// A node id is the kind of the node, a colon and the name. Thus a screen
	// and a custom event with the same name are different nodes.
	journeyScreenPrefix = "screen:"
	journeyEventPrefix  = "event:"
	// journeyFatalNode is the id of the last step of a session that ends in a
	// fatal error.
	journeyFatalNode = "fatal"

	// A journey result stays in the cache for this time. New events in this
	// time usually do not change the result much.
	journeyCacheTTL = 10 * time.Minute
)

var journeyCache = queryCache{name: "journey", version: 1}

// journeyCacheKey identifies a cached journey result. Params holds all other
// values that the result uses.
type journeyCacheKey struct {
	Query         string
	TeamID        uuid.UUID
	AppID         uuid.UUID
	From          time.Time
	To            time.Time
	FilterExpr    string
	SamplePercent float64
	Limit         int
	Offset        int
	Params        []any
}

// flt must have the bounds from alignCachedRange. Then the key has the range
// that the query uses.
func newJourneyCacheKey(query string, flt *filter.Filter, params ...any) journeyCacheKey {
	return journeyCacheKey{
		Query:         query,
		TeamID:        flt.TeamID,
		AppID:         flt.AppID,
		From:          flt.From,
		To:            flt.To,
		FilterExpr:    flt.FilterExpr,
		SamplePercent: flt.SamplePercent,
		Limit:         flt.Limit,
		Offset:        flt.Offset,
		Params:        params,
	}
}

// JourneyNode is a screen, a custom event or the fatal error step. Users are
// app installations. Each installation counts one time for each node.
type JourneyNode struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Step  uint64 `json:"step"`
	Users uint64 `json:"users"`
	// Continuing is the number of users that went from the node to a different
	// step of the same session one or more times.
	Continuing           uint64   `json:"continuing"`
	MedianMsFromPrevious *float64 `json:"median_ms_from_previous"`
}

// JourneyLink is the number of users that went from one node to the next node
// in the same session one or more times.
type JourneyLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Users  uint64 `json:"users"`
}

type Journey struct {
	Nodes []JourneyNode `json:"nodes"`
	Links []JourneyLink `json:"links"`
	// SamplePercent is the percent of the app's installations that the
	// journey read, or nil when it found no installations.
	SamplePercent *float64 `json:"sample_percent"`
}

// JourneySelection is a node or a path. A path has two or more nodes. A
// session goes through a path when its steps have these nodes one after the
// other. A link is a path of two nodes.
type JourneySelection struct {
	Node string
	Path []string
}

type JourneyError struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	ErrorType  string         `json:"error_type"`
	Severity   event.Severity `json:"severity"`
	Message    string         `json:"message"`
	MethodName string         `json:"method_name"`
	FileName   string         `json:"file_name"`
	Count      uint64         `json:"count"`
	Users      uint64         `json:"users"`
}

type JourneyTrace struct {
	SpanName   string  `json:"span_name"`
	Count      uint64  `json:"count"`
	Users      uint64  `json:"users"`
	DurationMs float64 `json:"duration_ms"`
}

type JourneyEndpoint struct {
	Domain      string  `json:"domain"`
	PathPattern string  `json:"path_pattern"`
	Count       uint64  `json:"count"`
	Users       uint64  `json:"users"`
	LatencyMs   float64 `json:"latency_ms"`
}

// journeyNodeIDExpr gives the node id of a screen or custom event row.
const journeyNodeIDExpr = "if(type = 'custom', concat('" + journeyEventPrefix + "', `custom.name`), concat('" + journeyScreenPrefix + "', `screen.name`))"

// journeyStepsStmt starts a query on the step rows of the range in table, a
// sample of analytics_events. The step rows are the screens, the custom
// events and the fatal errors.
func journeyStepsStmt(table string, flt *filter.Filter) (*sqlf.Stmt, error) {
	stmt := sqlf.
		From(table).
		Where("team_id = toUUID(?)", flt.TeamID).
		Where("app_id = toUUID(?)", flt.AppID).
		Where(analyticsDays("timestamp", flt.From, flt.To)).
		Where("timestamp >= ? and timestamp <= ?", flt.From, flt.To).
		Where("(type in ? or (type in ? and `error.severity` = 'fatal' and (type != ? or `app_hang.state` = 'killed')))",
			[]string{
				event.TypeLifecycleActivity,
				event.TypeLifecycleFragment,
				event.TypeLifecycleViewController,
				event.TypeLifecycleSwiftUI,
				event.TypeScreenView,
				event.TypeCustom,
			},
			errorEventTypes,
			event.TypeAppHang)
	if flt.HasFilterExpr() {
		predicate, err := flt.Predicate(nil)
		if err != nil {
			stmt.Close()
			return nil, err
		}
		defer predicate.Close()
		stmt.Where(predicate.String(), predicate.Args()...)
	}
	return stmt, nil
}

// journeySessionsStmt gives the steps of each session in the range. ids has
// the cityHash64 of the node id of each step. times has the milliseconds of
// each step. A hash has 8 bytes, also for a long name. Thus the memory of a
// query depends only on the number of rows.
//
// A step is a screen or a custom event. Rows in sequence with the same node
// id are one step. A fatal crash, an ANR or a killed app hang stops the
// session. The query removes the steps after the first of these errors. Then
// it adds the fatal error step.
//
// factor is the number of installations that one installation in the sample
// represents. withUserID adds the last user id of the session.
//
// If a lambda reads an element of an array by index, such as kept[i - 1],
// ClickHouse copies the full array for each element. Thus the journey queries
// use a copy of the array that is moved by one position.
func journeySessionsStmt(flt *filter.Filter, withUserID bool) (*sqlf.Stmt, error) {
	stmt, err := journeyStepsStmt(analyticsEventsSample(flt), flt)
	if err != nil {
		return nil, err
	}
	stmt.
		Select("installation_id").
		Select("session_id").
		Select("any(_sample_factor) as factor").
		Select("countIf(`error.severity` = 'fatal') > 0 as crashed").
		Select("toUnixTimestamp64Milli(minIf(timestamp, `error.severity` = 'fatal')) as crashed_at").
		Select("arraySort(groupArrayIf((toUnixTimestamp64Milli(timestamp), cityHash64("+journeyNodeIDExpr+")), `error.severity` = '')) as found").
		Select("arrayFilter(s -> not crashed or s.1 <= crashed_at, found) as kept").
		Select("arrayFilter((s, previous) -> s.2 != previous, kept, arrayPopBack(arrayPushFront(arrayMap(s -> s.2, kept), toUInt64(0)))) as merged").
		Select("if(crashed, arrayPushBack(merged, (crashed_at, cityHash64(?))), merged) as steps", journeyFatalNode).
		Select("arrayMap(s -> s.2, steps) as ids").
		Select("arrayMap(s -> s.1, steps) as times").
		GroupBy("installation_id, session_id")
	if withUserID {
		stmt.Select("argMaxIf(`attribute.user_id`, timestamp, `attribute.user_id` != '') as user_id")
	}
	return stmt, nil
}

// journeyWindowsStmt gives the windows of the selection in each session. A
// window is a (from, to) tuple of milliseconds.
//
// A node window starts when the session reaches the node. It stops at the
// next step. After the last step, it stops at the end of the session. A path
// window starts at the first node of the path and stops at the last node. A
// session has one window each time it goes through the path.
func journeyWindowsStmt(selection JourneySelection) *sqlf.Stmt {
	stmt := sqlf.
		From("journey_sessions").
		Select("session_id").
		Select("installation_id").
		Select("factor")

	if selection.Node != "" {
		return stmt.
			Select("arrayFilter((w, id) -> id = cityHash64(?), arrayZip(times, arrayPopFront(arrayPushBack(times, ?))), ids) as windows", selection.Node, int64(math.MaxInt64)).
			Where("notEmpty(windows)")
	}

	// The step at position i of the copy number j is the step at position
	// i + j of the session. A window starts at a step when the steps of the
	// copies are the nodes of the path.
	shifted := func(column string, j int) string {
		return fmt.Sprintf("arrayResize(arraySlice(%s, %d), length(%s), 0)", column, j+1, column)
	}
	last := len(selection.Path) - 1
	params := []string{"w"}
	conditions := []string{}
	copies := []string{}
	args := []any{}
	for j, node := range selection.Path {
		params = append(params, fmt.Sprintf("s%d", j))
		conditions = append(conditions, fmt.Sprintf("s%d = cityHash64(?)", j))
		copies = append(copies, shifted("ids", j))
		args = append(args, node)
	}
	return stmt.
		Select(fmt.Sprintf("arrayFilter((%s) -> %s, arrayZip(times, %s), %s) as windows",
			strings.Join(params, ", "), strings.Join(conditions, " and "), shifted("times", last), strings.Join(copies, ", ")), args...).
		Where("notEmpty(windows)")
}

func startJourneySpan(ctx context.Context, name string, flt *filter.Filter, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	ctx, span := tracer.Start(ctx, name)
	span.SetAttributes(
		attribute.String("journey.app_id", flt.AppID.String()),
		attribute.String("journey.team_id", flt.TeamID.String()),
		attribute.String("journey.from", flt.From.Format(time.RFC3339)),
		attribute.String("journey.to", flt.To.Format(time.RFC3339)),
		attribute.Bool("journey.filter_expr", flt.HasFilterExpr()))
	span.SetAttributes(attrs...)
	return ctx, span
}

func startJourneyListSpan(ctx context.Context, name string, flt *filter.Filter, selection JourneySelection, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return startJourneySpan(ctx, name, flt, append([]attribute.KeyValue{
		attribute.Bool("journey.node", selection.Node != ""),
		attribute.Int("journey.path_steps", len(selection.Path)),
		attribute.Int("journey.limit", flt.Limit),
		attribute.Int("journey.offset", flt.Offset),
	}, attrs...)...)
}

func endJourneySpan(span trace.Span, err error, results ...attribute.KeyValue) {
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
	} else {
		span.SetAttributes(results...)
	}
	span.End()
}

// GetJourney gives the number of users for each node and each link.
//
// The journey has the journeyMaxNodes nodes with the most users and the fatal
// error node. It has the JourneyMaxLinks links with the most users between
// these nodes. It also has all links to the fatal error node.
func GetJourney(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter) (Journey, error) {
	flt = alignCachedRange(flt)
	return cachedQuery(ctx, vk, journeyCache, flt.AppID, "journey", newJourneyCacheKey("journey", flt), journeyCacheTTL, func() (journey Journey, err error) {
		ctx, span := startJourneySpan(ctx, "journey.get", flt)
		defer func() {
			endJourneySpan(span, err,
				attribute.Int("journey.nodes", len(journey.Nodes)),
				attribute.Int("journey.links", len(journey.Links)))
		}()

		sessionsStmt, err := journeySessionsStmt(flt, false)
		if err != nil {
			return Journey{}, err
		}

		// visit is one step of a session. It has the node id, the position
		// from 0, the timestamp, the milliseconds from the previous step and
		// the id of the next step. 0 is the id of the next step after the
		// last step.
		//
		// One row of visits is the visits of one installation to one node.
		// step is the position where the installation reached the node
		// first. gaps has the time from the previous step for each visit.
		// targets has the nodes that come next.
		visitsStmt := sqlf.
			From("journey_sessions array join arrayZip(" +
				"ids, " +
				"arrayMap(i -> toUInt64(i - 1), arrayEnumerate(ids)), " +
				"times, " +
				"arrayDifference(times), " +
				"arrayPopFront(arrayPushBack(ids, toUInt64(0)))" +
				") as visit").
			Select("installation_id").
			Select("any(factor) as factor").
			Select("visit.1 as id").
			Select("argMin(visit.2, (visit.3, visit.2)) as step").
			Select("max(visit.5 != 0) as continued").
			Select("groupArrayIf(visit.4, visit.2 > 0) as gaps").
			Select("arrayDistinct(groupArrayIf(visit.5, visit.5 != 0)) as targets").
			GroupBy("installation_id, id")

		// A row with the target 0 has the counts of a node. All other rows
		// have the counts of a link. Each group keeps the steps and the gaps
		// in plain arrays. A quantile state in each group uses much more
		// memory.
		countsStmt := sqlf.
			From("visits array join arrayPushFront(targets, toUInt64(0)) as target").
			Select("id").
			Select("target").
			Select("toUInt64(round(count() * max(factor))) as users").
			Select("toUInt64(round(countIf(continued) * max(factor))) as continuing").
			Select("groupArrayIf(step, target = 0) as first_steps").
			Select("groupArrayArrayIf(gaps, target = 0) as all_gaps").
			Select("max(factor) as sample_factor").
			GroupBy("id, target")

		// The step and the gap of a node are the lower median of their
		// values.
		stmt := sqlf.
			With("journey_sessions", sessionsStmt).
			With("visits", visitsStmt).
			With("counts", countsStmt).
			From("counts").
			Select("id").
			Select("id = cityHash64(?)", journeyFatalNode).
			Select("target").
			Select("users").
			Select("continuing").
			Select("arrayElement(arraySort(first_steps), intDiv(length(first_steps) + 1, 2))").
			Select("if(empty(all_gaps), nan, toFloat64(arrayElement(arraySort(all_gaps), intDiv(length(all_gaps) + 1, 2))))").
			Select("sample_factor")
		defer stmt.Close()

		rows, err := rch.Query(analyticsCtx(ctx, flt.TeamID, journeyMaxMemoryBytes), stmt.String(), stmt.Args()...)
		if err != nil {
			return Journey{}, fmt.Errorf("failed to query journey: %w", err)
		}
		defer rows.Close()

		type nodeRow struct {
			hash  uint64
			fatal bool
			node  JourneyNode
		}
		type linkRow struct {
			source, target, users uint64
		}
		nodeRows := []nodeRow{}
		linkRows := []linkRow{}
		var factor float64
		for rows.Next() {
			var hash, target, users, continuing, step uint64
			var fatal bool
			var median float64
			if err := rows.Scan(&hash, &fatal, &target, &users, &continuing, &step, &median, &factor); err != nil {
				return Journey{}, fmt.Errorf("failed to scan journey: %w", err)
			}
			if target != 0 {
				linkRows = append(linkRows, linkRow{source: hash, target: target, users: users})
				continue
			}
			node := JourneyNode{Step: step, Users: users, Continuing: continuing}
			// The median is NaN when the node is always the first step.
			if !math.IsNaN(median) {
				node.MedianMsFromPrevious = &median
			}
			nodeRows = append(nodeRows, nodeRow{hash: hash, fatal: fatal, node: node})
		}
		if err := rows.Err(); err != nil {
			return Journey{}, fmt.Errorf("failed to read journey: %w", err)
		}

		slices.SortFunc(nodeRows, func(a, b nodeRow) int {
			return cmp.Or(cmp.Compare(b.node.Users, a.node.Users), cmp.Compare(a.hash, b.hash))
		})
		kept := map[uint64]*nodeRow{}
		keptNodes := 0
		for i := range nodeRows {
			if !nodeRows[i].fatal {
				if keptNodes == journeyMaxNodes {
					continue
				}
				keptNodes++
			}
			kept[nodeRows[i].hash] = &nodeRows[i]
		}

		slices.SortFunc(linkRows, func(a, b linkRow) int {
			return cmp.Or(cmp.Compare(b.users, a.users), cmp.Compare(a.source, b.source), cmp.Compare(a.target, b.target))
		})
		keptLinkRows := []linkRow{}
		keptLinks := 0
		for _, linkRow := range linkRows {
			if kept[linkRow.source] == nil || kept[linkRow.target] == nil {
				continue
			}
			if !kept[linkRow.target].fatal {
				if keptLinks == JourneyMaxLinks {
					continue
				}
				keptLinks++
			}
			keptLinkRows = append(keptLinkRows, linkRow)
		}

		// Get the node ids of the kept nodes only. The ids of all nodes can
		// use too much memory.
		hashes := []uint64{}
		for hash, nodeRow := range kept {
			if nodeRow.fatal {
				nodeRow.node.ID, nodeRow.node.Name, nodeRow.node.Kind = journeyFatalNode, "Fatal error", "fatal"
				continue
			}
			hashes = append(hashes, hash)
		}
		if len(hashes) > 0 {
			ids, err := journeyNodeIDs(ctx, rch, flt, factor, hashes)
			if err != nil {
				return Journey{}, err
			}
			for hash, id := range ids {
				kind, name, _ := strings.Cut(id, ":")
				kept[hash].node.ID, kept[hash].node.Name, kept[hash].node.Kind = id, name, kind
			}
		}

		journey = Journey{Nodes: []JourneyNode{}, Links: []JourneyLink{}, SamplePercent: samplePercent(factor)}
		for _, nodeRow := range nodeRows {
			if kept[nodeRow.hash] != nil {
				journey.Nodes = append(journey.Nodes, kept[nodeRow.hash].node)
			}
		}
		slices.SortStableFunc(journey.Nodes, func(a, b JourneyNode) int {
			return cmp.Compare(a.Step, b.Step)
		})
		for _, linkRow := range keptLinkRows {
			journey.Links = append(journey.Links, JourneyLink{Source: kept[linkRow.source].node.ID, Target: kept[linkRow.target].node.ID, Users: linkRow.users})
		}
		return journey, nil
	})
}

// journeyNodeIDs gives the node id of each of the hashes. It reads the share
// of installations given by factor, the sample factor of the query that found
// the hashes. ClickHouse works out a sample of a row count again for each
// query, so rows added in between would make it read fewer installations and
// miss the nodes that only those installations reached.
func journeyNodeIDs(ctx context.Context, rch driver.Conn, flt *filter.Filter, factor float64, hashes []uint64) (map[uint64]string, error) {
	stmt, err := journeyStepsStmt("analytics_events sample "+strconv.FormatFloat(1/factor, 'f', -1, 64), flt)
	if err != nil {
		return nil, err
	}
	stmt.
		Select("cityHash64("+journeyNodeIDExpr+") as hash").
		Select("any("+journeyNodeIDExpr+")").
		Where("`error.severity` = ''").
		Where("hash in ?", hashes).
		GroupBy("hash")
	defer stmt.Close()

	rows, err := rch.Query(analyticsCtx(ctx, flt.TeamID, journeyMaxMemoryBytes), stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query journey node ids: %w", err)
	}
	defer rows.Close()
	ids := map[uint64]string{}
	for rows.Next() {
		var hash uint64
		var id string
		if err := rows.Scan(&hash, &id); err != nil {
			return nil, fmt.Errorf("failed to scan journey node ids: %w", err)
		}
		ids[hash] = id
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read journey node ids: %w", err)
	}
	return ids, nil
}

// Top gives the journey with only the given number of screens and custom
// events with the most users, and their links as WithNodes keeps them.
func (j Journey) Top(nodes, links int) Journey {
	byUsers := slices.Clone(j.Nodes)
	slices.SortStableFunc(byUsers, func(a, b JourneyNode) int {
		return cmp.Compare(b.Users, a.Users)
	})
	ids := []string{}
	for _, node := range byUsers {
		if node.ID != journeyFatalNode && len(ids) < nodes {
			ids = append(ids, node.ID)
		}
	}
	return j.WithNodes(ids, links)
}

// TopLinks gives the journey with all its nodes, the given number of links
// with the most users, and all links to the fatal error node.
func (j Journey) TopLinks(links int) Journey {
	ids := []string{}
	for _, node := range j.Nodes {
		ids = append(ids, node.ID)
	}
	return j.WithNodes(ids, links)
}

// WithNodes gives the journey with only the nodes in ids. It has the given
// number of links with the most users between these nodes, and all their
// links to the fatal error node, which it has when one of these links exists.
func (j Journey) WithNodes(ids []string, links int) Journey {
	kept := map[string]bool{}
	for _, id := range ids {
		kept[id] = true
	}
	byUsers := slices.Clone(j.Links)
	slices.SortStableFunc(byUsers, func(a, b JourneyLink) int {
		return cmp.Compare(b.Users, a.Users)
	})
	result := Journey{Nodes: []JourneyNode{}, Links: []JourneyLink{}, SamplePercent: j.SamplePercent}
	keptLinks := 0
	for _, link := range byUsers {
		toFatal := link.Target == journeyFatalNode
		if !kept[link.Source] || (!toFatal && !kept[link.Target]) {
			continue
		}
		if toFatal {
			kept[journeyFatalNode] = true
		} else {
			if keptLinks == links {
				continue
			}
			keptLinks++
		}
		result.Links = append(result.Links, link)
	}
	for _, node := range j.Nodes {
		if kept[node.ID] {
			result.Nodes = append(result.Nodes, node)
		}
	}
	return result
}

// JourneyPathUsers is the number of users that went through a path in one or
// more sessions.
type JourneyPathUsers struct {
	Users uint64 `json:"users"`
	// SamplePercent is the percent of the app's installations that the query
	// read, or nil when it found no installations.
	SamplePercent *float64 `json:"sample_percent"`
}

// GetJourneyPathUsers gives the number of users that went through the path in
// one or more sessions.
func GetJourneyPathUsers(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, path []string) (JourneyPathUsers, error) {
	flt = alignCachedRange(flt)
	return cachedQuery(ctx, vk, journeyCache, flt.AppID, "path_users", newJourneyCacheKey("path_users", flt, path), journeyCacheTTL, func() (pathUsers JourneyPathUsers, err error) {
		ctx, span := startJourneySpan(ctx, "journey.path_users", flt,
			attribute.Int("journey.path_steps", len(path)))
		defer func() {
			endJourneySpan(span, err, attribute.Int64("journey.users", int64(pathUsers.Users)))
		}()

		sessionsStmt, err := journeySessionsStmt(flt, false)
		if err != nil {
			return JourneyPathUsers{}, err
		}

		stmt := sqlf.
			With("journey_sessions", sessionsStmt).
			From("journey_sessions").
			Select("toUInt64(round(uniqExactIf(installation_id, hasSubstr(ids, arrayMap(id -> cityHash64(id), ?))) * max(factor)))", path).
			Select("max(factor)")
		defer stmt.Close()

		var factor float64
		if err := rch.QueryRow(analyticsCtx(ctx, flt.TeamID, journeyMaxMemoryBytes), stmt.String(), stmt.Args()...).Scan(&pathUsers.Users, &factor); err != nil {
			return JourneyPathUsers{}, fmt.Errorf("failed to query journey path users: %w", err)
		}
		pathUsers.SamplePercent = samplePercent(factor)
		return pathUsers, nil
	})
}

// journeyListStmt starts a list query. The query reads the analytics_events
// rows in the windows of the selection. A window gets only the rows of its
// session.
func journeyListStmt(flt *filter.Filter, selection JourneySelection) (*sqlf.Stmt, error) {
	sessionsStmt, err := journeySessionsStmt(flt, false)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		With("journey_sessions", sessionsStmt).
		With("windows", journeyWindowsStmt(selection)).
		From("analytics_events").
		Join("windows", "windows.session_id = analytics_events.session_id").
		Where("arrayExists(w -> toUnixTimestamp64Milli(analytics_events.timestamp) between w.1 and w.2, windows.windows)").
		Where("analytics_events.team_id = toUUID(?)", flt.TeamID).
		Where("analytics_events.app_id = toUUID(?)", flt.AppID).
		Where(analyticsDays("analytics_events.timestamp", flt.From, flt.To)).
		Where("analytics_events.timestamp >= ? and analytics_events.timestamp <= ?", flt.From, flt.To)
	if flt.HasFilterExpr() {
		predicate, err := flt.Predicate(nil)
		if err != nil {
			stmt.Close()
			return nil, err
		}
		defer predicate.Close()
		stmt.Where(predicate.String(), predicate.Args()...)
	}
	return stmt, nil
}

// GetJourneyErrors gives the error groups of the errors in the windows of the
// selection. The groups with the most users come first. An error without a
// row in a group table is not in the list, because it has no details.
func GetJourneyErrors(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, selection JourneySelection) (SampledPage[JourneyError], error) {
	flt = alignCachedRange(flt)
	return cachedQuery(ctx, vk, journeyCache, flt.AppID, "errors", newJourneyCacheKey("errors", flt, selection), journeyCacheTTL, func() (page SampledPage[JourneyError], err error) {
		ctx, span := startJourneyListSpan(ctx, "journey.errors", flt, selection)
		defer func() {
			endJourneySpan(span, err,
				attribute.Int("journey.results", len(page.Results)),
				attribute.Bool("journey.next", page.Next))
		}()

		countsStmt, err := journeyListStmt(flt, selection)
		if err != nil {
			return SampledPage[JourneyError]{}, err
		}
		countsStmt.
			Select("`error.fingerprint` as fingerprint").
			Select("type as source_type").
			Select("`error.severity` as severity_class").
			Select("toUInt64(round(count() * max(windows.factor))) as instances").
			Select("toUInt64(round(uniqExact(windows.installation_id) * max(windows.factor))) as users").
			Select("max(windows.factor) as sample_factor").
			Where("type in ?", errorEventTypes).
			GroupBy("fingerprint, source_type, severity_class")

		// The timestamp of a group row is the newest event of its version and
		// month. Thus each group with an error in the range has a row at or
		// after From.
		groupStmts := errorGroupStmts(flt.TeamID, flt.AppID)
		for _, groupStmt := range groupStmts {
			groupStmt.Where("timestamp >= toDateTime64(?, 3, 'UTC')", flt.From)
		}

		stmt := sqlf.
			With("counts", countsStmt).
			With("groups", unionStmts(groupStmts)).
			From("counts").
			Join("groups", "groups.id = counts.fingerprint and groups.source_type = counts.source_type and groups.severity_class = counts.severity_class").
			Select("counts.fingerprint").
			Select("counts.source_type").
			Select("groups.type").
			Select("groups.severity").
			Select("groups.message").
			Select("groups.method_name").
			Select("groups.file_name").
			Select("counts.instances").
			Select("counts.users").
			Select("counts.sample_factor").
			OrderBy("counts.users desc, counts.instances desc, counts.fingerprint, counts.source_type, counts.severity_class").
			Limit(uint64(flt.Limit) + 1).
			Offset(uint64(flt.Offset))
		defer stmt.Close()

		rows, err := rch.Query(analyticsCtx(ctx, flt.TeamID, journeyMaxMemoryBytes), stmt.String(), stmt.Args()...)
		if err != nil {
			return SampledPage[JourneyError]{}, fmt.Errorf("failed to query journey errors: %w", err)
		}
		defer rows.Close()

		journeyErrors := []JourneyError{}
		var factor float64
		for rows.Next() {
			var journeyError JourneyError
			var severity string
			if err := rows.Scan(&journeyError.ID, &journeyError.ErrorType, &journeyError.Type, &severity, &journeyError.Message, &journeyError.MethodName, &journeyError.FileName, &journeyError.Count, &journeyError.Users, &factor); err != nil {
				return SampledPage[JourneyError]{}, fmt.Errorf("failed to scan journey errors: %w", err)
			}
			journeyError.Severity = event.Severity(severity)
			journeyErrors = append(journeyErrors, journeyError)
		}
		if err := rows.Err(); err != nil {
			return SampledPage[JourneyError]{}, fmt.Errorf("failed to read journey errors: %w", err)
		}
		page = SampledPage[JourneyError]{Results: journeyErrors, Previous: flt.Offset > 0, SamplePercent: samplePercent(factor)}
		if len(journeyErrors) > flt.Limit {
			page.Results, page.Next = journeyErrors[:flt.Limit], true
		}
		return page, nil
	})
}

// GetJourneyTraces gives the root spans that started in the windows of the
// selection, with the quantile of their durations. The span names with the
// most users come first.
func GetJourneyTraces(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, selection JourneySelection, quantile float64) (SampledPage[JourneyTrace], error) {
	flt = alignCachedRange(flt)
	return cachedQuery(ctx, vk, journeyCache, flt.AppID, "traces", newJourneyCacheKey("traces", flt, selection, quantile), journeyCacheTTL, func() (page SampledPage[JourneyTrace], err error) {
		ctx, span := startJourneyListSpan(ctx, "journey.traces", flt, selection,
			attribute.Float64("journey.quantile", quantile))
		defer func() {
			endJourneySpan(span, err,
				attribute.Int("journey.results", len(page.Results)),
				attribute.Bool("journey.next", page.Next))
		}()

		stmt, err := journeyListStmt(flt, selection)
		if err != nil {
			return SampledPage[JourneyTrace]{}, err
		}
		stmt.
			Select("toString(`span.name`) as name").
			Select("toUInt64(round(count() * max(windows.factor))) as instances").
			Select("toUInt64(round(uniqExact(windows.installation_id) * max(windows.factor))) as users").
			Select("round(quantile(?)(`span.duration_ms`), 2)", quantile).
			Select("max(windows.factor) as sample_factor").
			Where("type = 'span'").
			GroupBy("name").
			OrderBy("users desc, instances desc, name").
			Limit(uint64(flt.Limit) + 1).
			Offset(uint64(flt.Offset))
		defer stmt.Close()

		rows, err := rch.Query(analyticsCtx(ctx, flt.TeamID, journeyMaxMemoryBytes), stmt.String(), stmt.Args()...)
		if err != nil {
			return SampledPage[JourneyTrace]{}, fmt.Errorf("failed to query journey traces: %w", err)
		}
		defer rows.Close()

		journeyTraces := []JourneyTrace{}
		var factor float64
		for rows.Next() {
			var journeyTrace JourneyTrace
			if err := rows.Scan(&journeyTrace.SpanName, &journeyTrace.Count, &journeyTrace.Users, &journeyTrace.DurationMs, &factor); err != nil {
				return SampledPage[JourneyTrace]{}, fmt.Errorf("failed to scan journey traces: %w", err)
			}
			journeyTraces = append(journeyTraces, journeyTrace)
		}
		if err := rows.Err(); err != nil {
			return SampledPage[JourneyTrace]{}, fmt.Errorf("failed to read journey traces: %w", err)
		}
		page = SampledPage[JourneyTrace]{Results: journeyTraces, Previous: flt.Offset > 0, SamplePercent: samplePercent(factor)}
		if len(journeyTraces) > flt.Limit {
			page.Results, page.Next = journeyTraces[:flt.Limit], true
		}
		return page, nil
	})
}

// GetJourneyNetwork gives the URL patterns of the network requests in the
// windows of the selection, with the quantile of their latencies. The
// patterns with the most users come first.
//
// A request counts one time for each pattern that its path matches. The list
// does not include requests without a response. It also does not include
// requests that took more than one minute. These are long connections. Their
// latency is the time that the connection stayed open.
func GetJourneyNetwork(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, selection JourneySelection, quantile float64) (SampledPage[JourneyEndpoint], error) {
	flt = alignCachedRange(flt)
	return cachedQuery(ctx, vk, journeyCache, flt.AppID, "network", newJourneyCacheKey("network", flt, selection, quantile), journeyCacheTTL, func() (page SampledPage[JourneyEndpoint], err error) {
		ctx, span := startJourneyListSpan(ctx, "journey.network", flt, selection,
			attribute.Float64("journey.quantile", quantile))
		defer func() {
			endJourneySpan(span, err,
				attribute.Int("journey.results", len(page.Results)),
				attribute.Bool("journey.next", page.Next))
		}()

		requestsStmt, err := journeyListStmt(flt, selection)
		if err != nil {
			return SampledPage[JourneyEndpoint]{}, err
		}
		requestsStmt.
			Select("windows.installation_id as installation_id").
			Select("windows.factor as factor").
			Select("`http.domain` as domain").
			Select("`http.path` as path").
			Select("`http.latency_ms` as latency_ms").
			Where("type = 'http'").
			Where("`http.status_code` != 0").
			Where("latency_ms <= 60000")

		patternsStmt := sqlf.
			From("url_patterns final").
			Select("domain").
			Select("path").
			Where("team_id = toUUID(?)", flt.TeamID).
			Where("app_id = toUUID(?)", flt.AppID)

		stmt := sqlf.
			With("requests", requestsStmt).
			With("patterns", patternsStmt).
			From("requests").
			Join("patterns", "requests.domain = patterns.domain and "+network.PathPatternMatchExpression("requests.path", "patterns.path")).
			Select("requests.domain as endpoint_domain").
			Select("patterns.path as endpoint_path").
			Select("toUInt64(round(count() * max(requests.factor))) as requests").
			Select("toUInt64(round(uniqExact(requests.installation_id) * max(requests.factor))) as users").
			Select("round(quantile(?)(requests.latency_ms), 2)", quantile).
			Select("max(requests.factor) as sample_factor").
			GroupBy("endpoint_domain, endpoint_path").
			OrderBy("users desc, requests desc, endpoint_domain, endpoint_path").
			Limit(uint64(flt.Limit) + 1).
			Offset(uint64(flt.Offset))
		defer stmt.Close()

		rows, err := rch.Query(analyticsCtx(ctx, flt.TeamID, journeyMaxMemoryBytes), stmt.String(), stmt.Args()...)
		if err != nil {
			return SampledPage[JourneyEndpoint]{}, fmt.Errorf("failed to query journey network: %w", err)
		}
		defer rows.Close()

		journeyEndpoints := []JourneyEndpoint{}
		var factor float64
		for rows.Next() {
			var journeyEndpoint JourneyEndpoint
			if err := rows.Scan(&journeyEndpoint.Domain, &journeyEndpoint.PathPattern, &journeyEndpoint.Count, &journeyEndpoint.Users, &journeyEndpoint.LatencyMs, &factor); err != nil {
				return SampledPage[JourneyEndpoint]{}, fmt.Errorf("failed to scan journey network: %w", err)
			}
			journeyEndpoints = append(journeyEndpoints, journeyEndpoint)
		}
		if err := rows.Err(); err != nil {
			return SampledPage[JourneyEndpoint]{}, fmt.Errorf("failed to read journey network: %w", err)
		}
		page = SampledPage[JourneyEndpoint]{Results: journeyEndpoints, Previous: flt.Offset > 0, SamplePercent: samplePercent(factor)}
		if len(journeyEndpoints) > flt.Limit {
			page.Results, page.Next = journeyEndpoints[:flt.Limit], true
		}
		return page, nil
	})
}

// GetJourneySessions gives the sessions with a window of the selection. The
// session with the newest window start comes first. The user id is the last
// user id of the steps of the session.
func GetJourneySessions(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, selection JourneySelection) (SampledPage[FunnelStepSession], error) {
	flt = alignCachedRange(flt)
	return cachedQuery(ctx, vk, journeyCache, flt.AppID, "sessions", newJourneyCacheKey("sessions", flt, selection), journeyCacheTTL, func() (page SampledPage[FunnelStepSession], err error) {
		ctx, span := startJourneyListSpan(ctx, "journey.sessions", flt, selection)
		defer func() {
			endJourneySpan(span, err,
				attribute.Int("journey.results", len(page.Results)),
				attribute.Bool("journey.next", page.Next))
		}()

		sessionsStmt, err := journeySessionsStmt(flt, true)
		if err != nil {
			return SampledPage[FunnelStepSession]{}, err
		}

		windowsStmt := journeyWindowsStmt(selection).
			Select("user_id").
			Select("arrayMax(arrayMap(w -> w.1, windows)) as latest_window")

		// The page is chosen before the session times are read, so only the
		// sessions of the page are looked up.
		stmt := sqlf.
			With("journey_sessions", sessionsStmt).
			With("windows", windowsStmt).
			From("windows").
			Select("session_id").
			Select("installation_id").
			Select("user_id").
			Select("factor").
			OrderBy("latest_window desc, session_id").
			Limit(uint64(flt.Limit) + 1).
			Offset(uint64(flt.Offset))
		defer stmt.Close()

		page, err = stepSessionsPage(analyticsCtx(ctx, flt.TeamID, journeyMaxMemoryBytes), rch, flt, stmt)
		if err != nil {
			return SampledPage[FunnelStepSession]{}, fmt.Errorf("failed to query journey sessions: %w", err)
		}
		return page, nil
	})
}
