package measure

import (
	"context"
	"time"

	"backend/libs/chquery"
	"backend/libs/config"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/logcomment"
	"backend/libs/opsys"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/leporo/sqlf"
)

const (
	// journeyMaxSeconds bounds how long one journey aggregate may run.
	journeyMaxSeconds = 30
	// journeyMaxMemoryBytes bounds server memory for one journey aggregate.
	journeyMaxMemoryBytes = 500 << 20
)

// JourneyEdge is a directed transition between two journey nodes.
type JourneyEdge struct {
	Source    string
	Target    string
	Sessions  uint64
	FirstSeen time.Time
}

// JourneyIssue is an exception or ANR group attached to a journey node.
type JourneyIssue struct {
	Node        string
	Fingerprint string
	IsANR       bool
	Count       uint64
}

// JourneyGraph is the aggregated navigational journey of an app.
type JourneyGraph struct {
	Nodes  []string
	Edges  []JourneyEdge
	Issues []JourneyIssue
}

// journeyFrag is a SQL fragment & the args bound to its placeholders.
type journeyFrag struct {
	sql  string
	args []any
}

// journeyExpr carries the platform specific SQL shared by the graph queries.
type journeyExpr struct {
	// name resolves a row to its node name, '' when the row is not a node.
	name journeyFrag
	// anchor resolves a row to the node an issue attaches to, NULL otherwise.
	anchor journeyFrag
	// nodeFilter matches rows eligible to become nodes.
	nodeFilter journeyFrag
	// anchorFilter matches anchor rows plus the issue rows riding on them.
	anchorFilter journeyFrag
	// withANR is true only where ANRs exist.
	withANR bool
}

// journeyExprFor builds the SQL fragments for an OS family. Unsupported
// families yield ok false, the caller returns an empty graph.
func journeyExprFor(family string) (je journeyExpr, ok bool) {
	switch family {
	case opsys.Android:
		activityTypes := []string{
			event.LifecycleActivityTypeCreated,
			event.LifecycleActivityTypeResumed,
		}
		fragmentTypes := []string{
			event.LifecycleFragmentTypeAttached,
			event.LifecycleFragmentTypeResumed,
		}
		return journeyExpr{
			name: journeyFrag{
				sql:  "multiIf(type = ?, `lifecycle_activity.class_name`, type = ?, `lifecycle_fragment.class_name`, type = ?, `screen_view.name`, '')",
				args: []any{event.TypeLifecycleActivity, event.TypeLifecycleFragment, event.TypeScreenView},
			},
			// fragments never anchor issues.
			anchor: journeyFrag{
				sql:  "multiIf(type = ?, `lifecycle_activity.class_name`, type = ?, `screen_view.name`, NULL)",
				args: []any{event.TypeLifecycleActivity, event.TypeScreenView},
			},
			nodeFilter: journeyFrag{
				sql:  "((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ?))",
				args: []any{event.TypeLifecycleActivity, activityTypes, event.TypeLifecycleFragment, fragmentTypes, event.TypeScreenView},
			},
			anchorFilter: journeyFrag{
				sql:  "((type = ? and `lifecycle_activity.type` in ?) or (type = ?) or (type = ? and " + config.FatalExceptionExpr + ") or (type = ?))",
				args: []any{event.TypeLifecycleActivity, activityTypes, event.TypeScreenView, event.TypeException, event.TypeANR},
			},
			withANR: true,
		}, true
	case opsys.AppleFamily:
		viewControllerTypes := []string{
			event.LifecycleViewControllerTypeViewDidLoad,
			event.LifecycleViewControllerTypeViewDidAppear,
		}
		swiftUITypes := []string{
			event.LifecycleSwiftUITypeOnAppear,
		}
		return journeyExpr{
			name: journeyFrag{
				sql:  "multiIf(type = ?, `lifecycle_view_controller.class_name`, type = ?, `lifecycle_swift_ui.class_name`, type = ?, `screen_view.name`, '')",
				args: []any{event.TypeLifecycleViewController, event.TypeLifecycleSwiftUI, event.TypeScreenView},
			},
			anchor: journeyFrag{
				sql:  "multiIf(type = ?, `lifecycle_view_controller.class_name`, type = ?, `lifecycle_swift_ui.class_name`, type = ?, `screen_view.name`, NULL)",
				args: []any{event.TypeLifecycleViewController, event.TypeLifecycleSwiftUI, event.TypeScreenView},
			},
			nodeFilter: journeyFrag{
				sql:  "((type = ? and `lifecycle_view_controller.type` in ?) or (type = ? and `lifecycle_swift_ui.type` in ?) or (type = ?))",
				args: []any{event.TypeLifecycleViewController, viewControllerTypes, event.TypeLifecycleSwiftUI, swiftUITypes, event.TypeScreenView},
			},
			anchorFilter: journeyFrag{
				sql:  "((type = ? and `lifecycle_view_controller.type` in ?) or (type = ? and `lifecycle_swift_ui.type` in ?) or (type = ?) or (type = ? and " + config.FatalExceptionExpr + "))",
				args: []any{event.TypeLifecycleViewController, viewControllerTypes, event.TypeLifecycleSwiftUI, swiftUITypes, event.TypeScreenView, event.TypeException},
			},
		}, true
	}

	return
}

// journeyCtx names the query in its log comment. Bounded queries also carry
// runtime & memory caps.
func journeyCtx(ctx context.Context, name string, bounded bool) context.Context {
	lc := logcomment.New(2)
	lc.MustPut(logcomment.Root, logcomment.Journeys)

	settings := logcomment.Put(clickhouse.Settings{}, lc, logcomment.Name, name)
	if bounded {
		settings["max_execution_time"] = journeyMaxSeconds
		settings["max_memory_usage"] = journeyMaxMemoryBytes
	}

	return chquery.WithSettings(ctx, settings)
}

// journeyBounds applies the scope & window filters every graph query shares.
func (a App) journeyBounds(stmt *sqlf.Stmt, af *filter.AppFilter) *sqlf.Stmt {
	stmt.
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID)

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	return stmt.Where("timestamp >= ? and timestamp <= ?", af.From, af.To)
}

// GetJourneyGraph aggregates the implicit navigational journey of an app into
// nodes, edges & per node issues. All grouping happens in ClickHouse, only the
// bounded result set crosses the wire.
func (a App) GetJourneyGraph(ctx context.Context, rch driver.Conn, af *filter.AppFilter) (g JourneyGraph, err error) {
	je, ok := journeyExprFor(a.Family())
	if !ok {
		return
	}

	ctx = chquery.WithTeamScope(ctx, a.TeamId)

	if g.Nodes, err = a.journeyNodes(ctx, rch, af, je); err != nil {
		return
	}

	if g.Edges, err = a.journeyEdges(ctx, rch, af, je); err != nil {
		return
	}

	g.Issues, err = a.journeyIssues(ctx, rch, af, je)

	return
}

// journeyNodesStmt builds the node name query, ordered by first appearance.
func (a App) journeyNodesStmt(af *filter.AppFilter, je journeyExpr) *sqlf.Stmt {
	stmt := sqlf.
		From("journey").
		Select(je.name.sql+" as name", je.name.args...)

	a.journeyBounds(stmt, af)
	stmt.Where(je.nodeFilter.sql, je.nodeFilter.args...)

	return stmt.
		Where("name != ''").
		GroupBy("name").
		OrderBy("min(timestamp)")
}

// journeyNodes lists the node names in the window, first appearance first.
func (a App) journeyNodes(ctx context.Context, rch driver.Conn, af *filter.AppFilter, je journeyExpr) (nodes []string, err error) {
	stmt := a.journeyNodesStmt(af, je)

	defer stmt.Close()

	rows, err := rch.Query(journeyCtx(ctx, "journey_nodes", false), stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		if err = rows.Scan(&name); err != nil {
			return
		}
		nodes = append(nodes, name)
	}

	err = rows.Err()

	return
}

// journeyEdgesStmt builds the edge query. The partition by session id is what
// keeps concurrent sessions from linking.
func (a App) journeyEdgesStmt(af *filter.AppFilter, je journeyExpr) *sqlf.Stmt {
	steps := sqlf.
		From("journey").
		Select("session_id").
		Select("timestamp").
		Select(je.name.sql+" as name", je.name.args...).
		Select("any(name) over (partition by session_id order by timestamp rows between 1 following and 1 following) as next_name")

	a.journeyBounds(steps, af)
	steps.Where(je.nodeFilter.sql, je.nodeFilter.args...)

	stmt := sqlf.
		From("steps").
		Select("name as source").
		Select("next_name as target").
		Select("uniqExact(session_id) as sessions").
		Select("min(timestamp) as first_seen").
		Where("next_name != ''").
		Where("name != ''").
		Where("next_name != name").
		GroupBy("source").
		GroupBy("target").
		OrderBy("first_seen")

	// With closes steps, so only stmt is ever closed by the caller.
	return stmt.With("steps", steps)
}

// journeyEdges counts session transitions between consecutive nodes.
func (a App) journeyEdges(ctx context.Context, rch driver.Conn, af *filter.AppFilter, je journeyExpr) (edges []JourneyEdge, err error) {
	stmt := a.journeyEdgesStmt(af, je)

	defer stmt.Close()

	rows, err := rch.Query(journeyCtx(ctx, "journey_edges", true), stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var edge JourneyEdge
		if err = rows.Scan(&edge.Source, &edge.Target, &edge.Sessions, &edge.FirstSeen); err != nil {
			return
		}
		edges = append(edges, edge)
	}

	err = rows.Err()

	return
}

// journeyIssuesStmt builds the per node issue query. Each issue rides the last
// anchor node seen in its session, anyLast skips the NULL non anchor rows. An
// issue with no anchor yet in its session gets an empty node name, it stays
// counted but attaches to no node.
func (a App) journeyIssuesStmt(af *filter.AppFilter, je journeyExpr) *sqlf.Stmt {
	anchored := sqlf.
		From("journey").
		Select("type").
		Select("`exception.fingerprint` as ex_fp")

	if je.withANR {
		anchored.Select("`anr.fingerprint` as anr_fp")
	}

	anchored.Select("anyLast("+je.anchor.sql+") over (partition by session_id order by timestamp rows between unbounded preceding and current row) as node", je.anchor.args...)

	a.journeyBounds(anchored, af)
	anchored.Where(je.anchorFilter.sql, je.anchorFilter.args...)

	fingerprint := journeyFrag{sql: "ex_fp"}
	isANR := journeyFrag{sql: "false"}
	issueTypes := journeyFrag{sql: "(type = ?)", args: []any{event.TypeException}}

	if je.withANR {
		fingerprint = journeyFrag{sql: "if(type = ?, anr_fp, ex_fp)", args: []any{event.TypeANR}}
		isANR = journeyFrag{sql: "toBool(type = ?)", args: []any{event.TypeANR}}
		issueTypes = journeyFrag{sql: "(type = ? or type = ?)", args: []any{event.TypeException, event.TypeANR}}
	}

	stmt := sqlf.
		From("anchored").
		Select("ifNull(node, '') as node_name").
		Select(fingerprint.sql+" as fingerprint", fingerprint.args...).
		Select(isANR.sql+" as is_anr", isANR.args...).
		Select("count() as issue_count").
		Where(issueTypes.sql, issueTypes.args...).
		GroupBy("node_name").
		GroupBy("fingerprint").
		GroupBy("is_anr")

	// With closes anchored, so only stmt is ever closed by the caller.
	return stmt.With("anchored", anchored)
}

// journeyIssues counts exceptions & ANRs per node.
func (a App) journeyIssues(ctx context.Context, rch driver.Conn, af *filter.AppFilter, je journeyExpr) (issues []JourneyIssue, err error) {
	stmt := a.journeyIssuesStmt(af, je)

	defer stmt.Close()

	rows, err := rch.Query(journeyCtx(ctx, "journey_issues", true), stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var issue JourneyIssue
		if err = rows.Scan(&issue.Node, &issue.Fingerprint, &issue.IsANR, &issue.Count); err != nil {
			return
		}
		issues = append(issues, issue)
	}

	err = rows.Err()

	return
}
