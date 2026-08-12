package exprfilter

import "errors"

var ErrKeyNotSupported = errors.New("Key not supported by this query")

// WalkExprTree walks a validated expression tree from leaves to root.
// convertCondition handles leaves; combineGroup combines each group's children.
// Children keep the order they came with, and the first error stops the walk.
func WalkExprTree[T any](
	exprTree *ExprTree,
	convertCondition func(Condition) (T, error),
	combineGroup func(operator LogicalOperator, children []T) (T, error),
) (T, error) {
	var zero T

	if exprTree == nil {
		return zero, errors.New("Filter expression is empty")
	}

	if !exprTree.IsGroup() {
		return convertCondition(*exprTree.Condition)
	}

	children := make([]T, 0, len(exprTree.Children))
	for i := range exprTree.Children {
		child, err := WalkExprTree(&exprTree.Children[i], convertCondition, combineGroup)
		if err != nil {
			return zero, err
		}
		children = append(children, child)
	}

	return combineGroup(exprTree.LogicalOperator, children)
}
