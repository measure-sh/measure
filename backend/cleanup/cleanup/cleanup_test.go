package cleanup

import (
	"go/ast"
	"go/parser"
	"go/token"
	"testing"
)

// sqlf's Close is not idempotent. It nils the statement buffer then hands it
// to bytebufferpool, so a second Close faults on the nil buffer. Closing a
// statement both with a defer & explicitly on an error branch is exactly that
// double Close, since a defer inside a loop body does not run per iteration,
// it piles up & fires at function return.
func TestNoDeferredAndExplicitClose(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "cleanup.go", nil, 0)
	if err != nil {
		t.Fatalf("failed to parse cleanup.go: %v", err)
	}

	var funcs int

	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil {
			continue
		}

		funcs++

		deferred := map[string]bool{}
		explicit := map[string]bool{}

		ast.Inspect(fn.Body, func(n ast.Node) bool {
			// a defer inside a nested func literal has its own scope
			if _, ok := n.(*ast.FuncLit); ok {
				return false
			}

			switch stmt := n.(type) {
			case *ast.DeferStmt:
				if name, ok := closeTarget(stmt.Call); ok {
					deferred[name] = true
				}
			case *ast.ExprStmt:
				call, ok := stmt.X.(*ast.CallExpr)
				if !ok {
					return true
				}
				if name, ok := closeTarget(call); ok {
					explicit[name] = true
				}
			}

			return true
		})

		for name := range deferred {
			if explicit[name] {
				t.Errorf("%s: %s is closed by both a defer & an explicit call, sqlf Close is not idempotent", fn.Name.Name, name)
			}
		}
	}

	if funcs == 0 {
		t.Fatal("found no functions in cleanup.go, the check is not looking at what it thinks it is")
	}
}

// closeTarget returns the receiver name of an x.Close() call.
func closeTarget(call *ast.CallExpr) (name string, ok bool) {
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok || sel.Sel.Name != "Close" {
		return "", false
	}

	ident, ok := sel.X.(*ast.Ident)
	if !ok {
		return "", false
	}

	return ident.Name, true
}
