package exprfilter

import (
	"errors"
	"strings"

	"github.com/leporo/sqlf"
)

// KeyBinding says how a key maps to actual data: it turns one filter condition
// into a boolean SQL expression, with the values to bind. An override written
// for a single key needs to handle every operator that key offers.
type KeyBinding func(condition Condition) (*sqlf.Stmt, error)

// GroupKeyBinding turns the custom-key conditions of one filter group into a
// single boolean SQL expression, with the values to bind. Binding a group at
// once lets sibling conditions share one scan of the attribute table.
type GroupKeyBinding func(operator LogicalOperator, conditions []Condition) (*sqlf.Stmt, error)

// Predicate turns the filter into a boolean SQL expression and its bind values.
// The caller can use it in a WHERE, HAVING, or any other SQL clause:
//
//	predicate, err := ef.Predicate(nil)
//	defer predicate.Close()
//	stmt.Where(predicate.String(), predicate.Args()...)
//
// keyBindingOverrides replaces the key binding for specific keys; every other
// key binds through the entity.
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

	isCustom := func(condition Condition) bool {
		return ef.customBinder != nil && strings.HasPrefix(condition.KeyName, CustomKeyPrefix)
	}

	var walk func(node *ExprTree) (*sqlf.Stmt, error)
	walk = func(node *ExprTree) (*sqlf.Stmt, error) {
		if !node.IsGroup() {
			if isCustom(*node.Condition) {
				return ef.customBinder(LogicalAnd, []Condition{*node.Condition})
			}
			return bindLeaf(*node.Condition)
		}

		// The batch's fragment goes after the group's other children; position
		// inside an and/or group carries no meaning.
		children := make([]*sqlf.Stmt, 0, len(node.Children))
		customBatch := []Condition{}
		for i := range node.Children {
			child := &node.Children[i]
			if child.Condition != nil && isCustom(*child.Condition) {
				customBatch = append(customBatch, *child.Condition)
				continue
			}
			converted, err := walk(child)
			if err != nil {
				return nil, err
			}
			children = append(children, converted)
		}
		if len(customBatch) > 0 {
			converted, err := ef.customBinder(node.LogicalOperator, customBatch)
			if err != nil {
				return nil, err
			}
			children = append(children, converted)
		}

		return joinGroup(node.LogicalOperator, children)
	}

	if ef.ExprTree == nil {
		return nil, errors.New("Filter expression is empty")
	}
	return walk(ef.ExprTree)
}

// EscapeLikeWildcards escapes the wildcards of a LIKE pattern, so a search for
// a percent sign matches a percent sign and not every row.
func EscapeLikeWildcards(text string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(text)
}
