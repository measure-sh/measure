package filter

import (
	"errors"
	"strings"

	"github.com/leporo/sqlf"
)

// customGroupBinder binds the custom-key conditions of one filter group at
// once, so sibling conditions share one scan of the attribute table.
type customGroupBinder func(operator LogicalOperator, conditions []Condition) (*sqlf.Stmt, error)

// Predicate turns the filter into a boolean SQL expression and its bind values.
// The caller can use it in a WHERE, HAVING, or any other SQL clause:
//
//	predicate, err := flt.Predicate(nil)
//	defer predicate.Close()
//	stmt.Where(predicate.String(), predicate.Args()...)
//
// A nil columns binds against the entity's own table; a query against a
// rollup or another table passes that table's Columns.
func (flt *Filter) Predicate(columns *Columns) (*sqlf.Stmt, error) {
	if flt.ExprTree == nil {
		return nil, errors.New("Filter expression is empty")
	}
	if columns == nil {
		columns = flt.Entity.Columns
	}

	var bindCustom customGroupBinder
	if flt.Entity.CustomKeySource != nil {
		binder := &customBinder{
			source:     *flt.Entity.CustomKeySource,
			scope:      flt.customKeyScope(),
			keysByName: IndexKeysByName(flt.Entity.Keys),
		}
		bindCustom = binder.bind
	}

	return bindNode(flt.ExprTree, columns, bindCustom)
}

// The custom-key children of a group are bound together after its other
// children, so they share one scan of the attribute table; position inside
// an and/or group carries no meaning.
func bindNode(node *ExprTree, columns *Columns, bindCustom customGroupBinder) (*sqlf.Stmt, error) {
	if !node.IsGroup() {
		condition := *node.Condition
		if bindCustom != nil && strings.HasPrefix(condition.KeyName, CustomKeyPrefix) {
			return bindCustom(LogicalAnd, []Condition{condition})
		}
		return bindColumn(columns, condition)
	}

	children := make([]*sqlf.Stmt, 0, len(node.Children))
	customBatch := []Condition{}
	for i := range node.Children {
		child := &node.Children[i]
		if child.Condition != nil && bindCustom != nil && strings.HasPrefix(child.Condition.KeyName, CustomKeyPrefix) {
			customBatch = append(customBatch, *child.Condition)
			continue
		}
		converted, err := bindNode(child, columns, bindCustom)
		if err != nil {
			return nil, err
		}
		children = append(children, converted)
	}
	if len(customBatch) > 0 {
		converted, err := bindCustom(node.LogicalOperator, customBatch)
		if err != nil {
			return nil, err
		}
		children = append(children, converted)
	}

	return joinGroup(node.LogicalOperator, children), nil
}

// Each child and the group itself are wrapped in parentheses so the group
// stays intact when joined to the surrounding query. Without the outer pair,
// "app_id = ? and a or b" becomes "(app_id = ? and a) or b", which can match
// another app's rows.
func joinGroup(operator LogicalOperator, children []*sqlf.Stmt) *sqlf.Stmt {
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

	return sqlf.New(text.String(), args...)
}

// EscapeLikeWildcards escapes the wildcards of a LIKE pattern, so a search for
// a percent sign matches a percent sign and not every row.
func EscapeLikeWildcards(text string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(text)
}
