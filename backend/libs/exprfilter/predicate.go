package exprfilter

import (
	"strings"

	"github.com/leporo/sqlf"
)

// KeyBinding says how a key maps to actual data: it turns one filter condition
// into a boolean SQL expression, with the values to bind. An override written
// for a single key needs to handle every operator that key offers.
type KeyBinding func(condition Condition) (*sqlf.Stmt, error)

// Predicate turns the filter into a boolean SQL expression and its bind values.
// The caller can use it in a WHERE, HAVING, or any other SQL clause:
//
//	predicate, err := ef.Predicate(nil)
//	defer predicate.Close()
//	stmt.Where(predicate.String(), predicate.Args()...)
//
// keyBindingOverrides replaces the key binding for specific keys. Pass nil
// when the entity's own binding should write every condition.
func (ef *ExprFilter) Predicate(keyBindingOverrides map[string]KeyBinding) (*sqlf.Stmt, error) {
	bindLeaf := func(condition Condition) (*sqlf.Stmt, error) {
		if keyBinding, overridden := keyBindingOverrides[condition.KeyName]; overridden {
			return keyBinding(condition)
		}
		return ef.Entity.BindKey(condition)
	}

	// Wrap each child to preserve nested group semantics, then wrap the
	// group itself so it stays intact when joined to the surrounding query.
	// Without the outer pair, "app_id = ? and a or b" becomes
	// "(app_id = ? and a) or b", which can match another app's rows.
	joinGroup := func(operator LogicalOperator, children []*sqlf.Stmt) (*sqlf.Stmt, error) {
		var text strings.Builder
		args := []any{}

		text.WriteString("(")
		for i, child := range children {
			if i > 0 {
				text.WriteString(" ")
				text.WriteString(operator.String())
				text.WriteString(" ")
			}
			text.WriteString("(")
			text.WriteString(child.String())
			text.WriteString(")")
			args = append(args, child.Args()...)
		}
		text.WriteString(")")

		return sqlf.New(text.String(), args...), nil
	}

	return WalkExprTree(ef.ExprTree, bindLeaf, joinGroup)
}

// EscapeLikeWildcards escapes the wildcards of a LIKE pattern, so a search for
// a percent sign matches a percent sign and not every row.
func EscapeLikeWildcards(text string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(text)
}
