package agent

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"time"

	chparser "github.com/AfterShip/clickhouse-sql-parser/parser"
	"github.com/google/uuid"
)

// maxQueryBytes caps how much input run_sql will look at. Real agent queries
// are a few hundred bytes; the cap just keeps oversized input from wasting
// work.
const maxQueryBytes = 16 * 1024

var (
	placeholderRe = regexp.MustCompile(`\{\{\s*([A-Za-z0-9_]+)\s*\}\}`)
	settingsRe    = regexp.MustCompile(`(?i)\bsettings\b`)
)

// tableRef records one {{table}} placeholder: the table it names, and where
// the name starts and ends in the substituted query. Validation accepts a
// table reference only at these positions, and expansion rewrites these same
// positions, so the two can never disagree.
type tableRef struct {
	name  string
	start int
	end   int
}

// substPlaceholders replaces each {{table}} with the table name, since the
// parser cannot read the braces, and records the position of each name.
func substPlaceholders(query string) (string, []tableRef) {
	var b strings.Builder
	var refs []tableRef
	last := 0
	for _, m := range placeholderRe.FindAllStringSubmatchIndex(query, -1) {
		b.WriteString(query[last:m[0]])
		name := query[m[2]:m[3]]
		refs = append(refs, tableRef{name: name, start: b.Len(), end: b.Len() + len(name)})
		b.WriteString(name)
		last = m[1]
	}
	b.WriteString(query[last:])
	return b.String(), refs
}

// validateAgentSQL checks that a query is a single SELECT that references
// tables only via {{table}} placeholders. It swaps each placeholder for the
// table name, parses the result as ClickHouse SQL, and checks the syntax
// tree: every table name must be at a placeholder position. It
// returns the substituted query and the placeholder positions, which
// expandPlaceholders rewrites into scoped subqueries. If a bad query gets
// through anyway, ClickHouse still limits the damage: the agent_sql role can
// only SELECT from events and spans, runs readonly, and the
// agent_team_isolation row policy filters rows to the team.
func validateAgentSQL(query string, sets *tableSets) (string, []tableRef, error) {
	if len(query) > maxQueryBytes {
		return "", nil, fmt.Errorf("query is too long (max %d bytes)", maxQueryBytes)
	}

	// Blank out quoted text before the scans below, so a keyword or comment
	// marker inside a string value or a quoted column name is never read as
	// SQL. Quoted names are common here: events and spans have hundreds of
	// dotted, backtick-quoted columns.
	masked := mask(query)

	if strings.Contains(masked, ";") {
		return "", nil, fmt.Errorf("only a single statement is allowed (no ';')")
	}

	// Reject comments outright. ClickHouse treats them as whitespace, but the
	// parser does not know the # form, and the SETTINGS scan below cannot
	// tell comment text from SQL. Generated queries never need comments
	// anyway.
	if hasComment(masked) {
		return "", nil, fmt.Errorf("comments are not allowed in queries")
	}

	// The AST walk also rejects SETTINGS, but this plain-text scan stays as a
	// second, independent check. SQL_agent_team_ids can be changed even in
	// readonly mode, so a SETTINGS clause that got through could override
	// the team scope and read another team's rows and this check prevents it.
	if settingsRe.MatchString(masked) {
		return "", nil, fmt.Errorf("SETTINGS is not allowed in queries")
	}

	subst, refs := substPlaceholders(query)
	if len(refs) == 0 {
		return "", nil, fmt.Errorf("reference tables only via {{table}} placeholders; call get_schema for the available tables")
	}
	for _, r := range refs {
		if !sets.scoped[r.name] {
			return "", nil, fmt.Errorf("unknown table placeholder {{%s}}; call get_schema for the available tables", r.name)
		}
	}

	stmts, err := chparser.NewParser(subst).ParseStmts()
	if err != nil {
		return "", nil, fmt.Errorf("invalid SQL: %v", err)
	}
	if len(stmts) != 1 {
		return "", nil, fmt.Errorf("only a single statement is allowed")
	}
	sel, ok := stmts[0].(*chparser.SelectQuery)
	if !ok {
		return "", nil, fmt.Errorf("only SELECT queries are allowed")
	}

	if err := checkAgentAST(sel, refs, sets); err != nil {
		return "", nil, err
	}
	return subst, refs, nil
}

// inTableOps are the IN operators. When their right side is a lone
// identifier, ClickHouse reads it as a table name: "x in spans" reads the
// spans table.
var inTableOps = map[string]bool{
	"IN":            true,
	"NOT IN":        true,
	"GLOBAL IN":     true,
	"GLOBAL NOT IN": true,
}

// checkAgentAST walks the parsed query and enforces the table rules: no
// SETTINGS or FORMAT clause anywhere, no table functions, no other
// databases, and every table name either a CTE or at a placeholder
// position. Each placeholder must also be used as a table. Expansion
// rewrites every placeholder position, so one in an alias or a string
// literal would become broken SQL; it is rejected here instead.
func checkAgentAST(sel *chparser.SelectQuery, refs []tableRef, sets *tableSets) error {
	spanName := make(map[[2]int]string, len(refs))
	claimed := make(map[[2]int]bool, len(refs))
	for _, r := range refs {
		spanName[[2]int{r.start, r.end}] = r.name
	}

	// cteNames collects WITH names so that a later reference to one is not
	// read as an unknown table. The parser puts the name in different fields
	// (Expr for "with t as (select ...)", Alias for "with (select ...) as
	// t"), so idents from both sides are collected.
	// Collecting too much is safe: an extra name only matters if it matches a
	// real table, and that case is rejected as shadowing below.
	cteNames := map[string]bool{}

	// columnSpace holds every node inside an ARRAY JOIN operand. The parser
	// models the operands as joined tables, but ClickHouse reads them as
	// column expressions, so the table checks must skip them.
	columnSpace := map[chparser.Expr]bool{}

	var verr error
	deny := func(format string, args ...any) bool {
		if verr == nil {
			verr = fmt.Errorf(format, args...)
		}
		return false
	}

	// claimTable checks one name found in table position: a CTE name passes,
	// a name at a placeholder position is claimed for expansion, and
	// anything else is some form of raw table reference.
	claimTable := func(name string, start, end int) bool {
		if cteNames[name] {
			return true
		}
		span := [2]int{start, end}
		if spanName[span] == name {
			claimed[span] = true
			return true
		}
		if sets.scoped[name] {
			return deny("reference table %s via the {{%s}} placeholder", name, name)
		}
		if sets.all[name] {
			return deny("table %s is not queryable; query {{events}} or {{spans}} instead", name)
		}
		return deny("unknown table %s; call get_schema for the available tables", name)
	}

	chparser.Walk(sel, func(node chparser.Expr) bool {
		if verr != nil {
			return false
		}
		switch n := node.(type) {
		case *chparser.WithClause:
			for _, cte := range n.CTEs {
				for _, side := range []chparser.Expr{cte.Expr, cte.Alias} {
					id, ok := side.(*chparser.Ident)
					if !ok {
						continue
					}
					if sets.all[id.Name] {
						return deny("CTE name %s shadows a table; pick another name", id.Name)
					}
					cteNames[id.Name] = true
				}
			}
		case *chparser.SelectQuery:
			if n.Settings != nil {
				return deny("SETTINGS is not allowed in queries")
			}
			if n.Format != nil {
				return deny("FORMAT is not allowed in queries")
			}
		case *chparser.JoinExpr:
			if isArrayJoin(n.Modifiers) {
				markArrayJoinOperands(n, columnSpace)
			}
		case *chparser.TableFunctionExpr:
			if columnSpace[node] {
				return true
			}
			return deny("table functions are not allowed (%s)", chparser.Format(n.Name))
		case *chparser.TableIdentifier:
			if columnSpace[node] {
				return true
			}
			if n.Database != nil {
				return deny("cross-database references are not allowed (%s)", chparser.Format(n))
			}
			return claimTable(n.Table.Name, int(n.Pos()), int(n.End()))
		case *chparser.BinaryOperation:
			if !inTableOps[string(n.Operation)] || columnSpace[node] {
				return true
			}
			switch rhs := n.RightExpr.(type) {
			case *chparser.Ident:
				return claimTable(rhs.Name, int(rhs.Pos()), int(rhs.End()))
			case *chparser.Path, *chparser.NestedIdentifier, *chparser.TableIdentifier:
				return deny("cross-database references are not allowed (%s)", chparser.Format(rhs))
			}
		}
		return true
	})
	if verr != nil {
		return verr
	}

	for _, r := range refs {
		if !claimed[[2]int{r.start, r.end}] {
			return fmt.Errorf("placeholder {{%s}} must be a table in FROM, JOIN or IN", r.name)
		}
	}
	return nil
}

// isArrayJoin reports whether a join's modifiers spell some form of ARRAY
// JOIN ("array JOIN", "left array JOIN").
func isArrayJoin(modifiers []string) bool {
	for _, m := range modifiers {
		if strings.Contains(strings.ToLower(m), "array") {
			return true
		}
	}
	return false
}

// markArrayJoinOperands marks the operands of one ARRAY JOIN as column
// space. The first operand is the join's Left. Further comma-separated
// operands are under the Right, a chain of JoinExprs without modifiers
// ending in a plain table expression. A JoinExpr with modifiers is not an
// operand but the next real join, so marking stops there.
func markArrayJoinOperands(j *chparser.JoinExpr, cols map[chparser.Expr]bool) {
	markColumnSpace(j.Left, cols)
	next := j.Right
	for next != nil {
		t, ok := next.(*chparser.JoinExpr)
		if !ok {
			markColumnSpace(next, cols)
			return
		}
		if len(t.Modifiers) != 0 {
			return
		}
		markColumnSpace(t.Left, cols)
		next = t.Right
	}
}

// markColumnSpace adds node and everything under it to cols, except
// subqueries: a subquery reads tables and must stay subject to the table
// checks.
func markColumnSpace(node chparser.Expr, cols map[chparser.Expr]bool) {
	chparser.Walk(node, func(n chparser.Expr) bool {
		switch n.(type) {
		case *chparser.SubQuery, *chparser.SelectQuery:
			return false
		}
		cols[n] = true
		return true
	})
}

// mask blanks out the contents of quoted regions so the text scans see the
// query's structure without tripping on data. Single quoted strings and the
// backtick or double quoted identifiers are blanked, since column names can
// contain keywords. The quote characters themselves are kept so positions do
// not shift. A backslash or a doubled quote escapes the quote, and an
// unterminated quote blanks everything to the end, which errs toward
// rejection.
func mask(query string) string {
	b := []byte(query)
	for i := 0; i < len(b); i++ {
		q := b[i]
		if q != '\'' && q != '`' && q != '"' {
			continue
		}
		for i++; i < len(b); i++ {
			if b[i] == '\\' && i+1 < len(b) {
				b[i] = ' '
				i++
				b[i] = ' '
				continue
			}
			if b[i] == q {
				// A doubled quote is an escaped quote, part of the value.
				if i+1 < len(b) && b[i+1] == q {
					b[i] = ' '
					i++
					b[i] = ' '
					continue
				}
				break
			}
			b[i] = ' '
		}
	}
	return string(b)
}

// hasComment reports whether a masked query contains a comment marker.
// ClickHouse reads -- and # as line comments and /* as a block comment.
// Quoted text is already blanked, so any marker that remains is a real
// comment.
func hasComment(masked string) bool {
	return strings.Contains(masked, "--") ||
		strings.Contains(masked, "/*") ||
		strings.Contains(masked, "#")
}

// expandPlaceholders replaces each placeholder with a subquery that filters
// the table to the team, the given apps, and the from/to range on its time
// column, so the query cannot scan outside its scope. app_id stays
// selectable so queries can group by it. Replacement runs right to left so
// earlier positions stay valid as the text grows.
func expandPlaceholders(query string, refs []tableRef, teamID uuid.UUID, appIDs []uuid.UUID, from, to time.Time) string {
	quoted := make([]string, len(appIDs))
	for i, id := range appIDs {
		quoted[i] = fmt.Sprintf("toUUID('%s')", id)
	}
	appScope := fmt.Sprintf(" and app_id in (%s)", strings.Join(quoted, ", "))
	for _, r := range slices.Backward(refs) {
		timeCol := agentTables[r.name]
		sub := fmt.Sprintf(
			"(select * from %s where team_id = toUUID('%s')%s and %s >= %s and %s <= %s)",
			r.name, teamID, appScope, timeCol, chTime(from), timeCol, chTime(to))
		query = query[:r.start] + sub + query[r.end:]
	}
	return query
}

// chTime renders a time as a ClickHouse DateTime64(3, 'UTC') literal.
func chTime(t time.Time) string {
	return fmt.Sprintf("toDateTime64('%s', 3, 'UTC')", t.UTC().Format("2006-01-02 15:04:05.000"))
}
