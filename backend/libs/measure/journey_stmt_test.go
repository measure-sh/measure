package measure

import (
	"strings"
	"testing"
	"time"

	"backend/libs/exprfilter"
	"backend/libs/opsys"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// TestJourneyStmtArgsAlign guards the placeholder/arg alignment of the three
// journey graph queries. Every fragment carries its own args, so a fragment
// edited without its args silently shifts every later bind.
func TestJourneyStmtArgsAlign(t *testing.T) {
	id := uuid.New()
	ef := &exprfilter.ExprFilter{
		Entity:     exprfilter.JourneysEntity,
		From:       time.Now().Add(-24 * time.Hour),
		To:         time.Now(),
		FilterExpr: "version_name:in:1.0 AND version_code:in:100",
	}
	if err := ef.BuildExprTree(); err != nil {
		t.Fatalf("build filter expression: %v", err)
	}

	for _, family := range []string{opsys.Android, opsys.AppleFamily} {
		a := App{TeamId: uuid.New(), ID: &id, OSNames: []string{family}}
		je, ok := journeyExprFor(family)
		if !ok {
			t.Fatalf("%s: no journey expressions", family)
		}

		builders := map[string]func(*exprfilter.ExprFilter, journeyExpr) (*sqlf.Stmt, error){
			"nodes":  a.journeyNodesStmt,
			"edges":  a.journeyEdgesStmt,
			"issues": a.journeyIssuesStmt,
		}

		for name, build := range builders {
			stmt, err := build(ef, je)
			if err != nil {
				t.Fatalf("%s/%s: %v", family, name, err)
			}
			sql, args := stmt.String(), stmt.Args()
			stmt.Close()

			if got, want := strings.Count(sql, "?"), len(args); got != want {
				t.Errorf("%s/%s: %d placeholders, %d args\n%s", family, name, got, want, sql)
			}
		}
	}
}

// TestJourneyExprForUnknownFamily asserts an unsupported family yields no
// expressions, which is what makes GetJourneyGraph return an empty graph.
func TestJourneyExprForUnknownFamily(t *testing.T) {
	if _, ok := journeyExprFor(opsys.Unknown); ok {
		t.Error("expected no journey expressions for an unknown family")
	}
}
