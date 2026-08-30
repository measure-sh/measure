package measure

import (
	"strings"
	"testing"
	"time"

	"backend/libs/filter"
	"backend/libs/opsys"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// TestJourneyStmtArgsAlign guards the placeholder/arg alignment of the three
// journey graph queries. Every fragment carries its own args, so a fragment
// edited without its args silently shifts every later bind.
func TestJourneyStmtArgsAlign(t *testing.T) {
	id := uuid.New()
	af := &filter.AppFilter{
		From:         time.Now().Add(-24 * time.Hour),
		To:           time.Now(),
		Versions:     []string{"1.0"},
		VersionCodes: []string{"100"},
	}

	for _, family := range []string{opsys.Android, opsys.AppleFamily} {
		a := App{TeamId: uuid.New(), ID: &id, OSNames: []string{family}}
		je, ok := journeyExprFor(family)
		if !ok {
			t.Fatalf("%s: no journey expressions", family)
		}

		builders := map[string]func(*filter.AppFilter, journeyExpr) *sqlf.Stmt{
			"nodes":  a.journeyNodesStmt,
			"edges":  a.journeyEdgesStmt,
			"issues": a.journeyIssuesStmt,
		}

		for name, build := range builders {
			stmt := build(af, je)
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
