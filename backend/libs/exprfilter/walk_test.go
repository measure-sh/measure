package exprfilter

import (
	"errors"
	"fmt"
	"strings"
	"testing"
)

// renderText turns a tree into a readable string, standing in for the SQL a
// real entity would build.
func renderText(exprTree *ExprTree) (string, error) {
	return WalkExprTree(exprTree,
		func(condition Condition) (string, error) {
			if condition.KeyName == "unsupported" {
				return "", ErrKeyNotSupported
			}
			if len(condition.Values) == 0 {
				return fmt.Sprintf("%s %s", condition.KeyName, condition.Operator), nil
			}
			return fmt.Sprintf("%s %s [%s]", condition.KeyName, condition.Operator, strings.Join(condition.TextValues(), " ")), nil
		},
		func(operator LogicalOperator, children []string) (string, error) {
			return "(" + strings.Join(children, " "+operator.String()+" ") + ")", nil
		})
}

func TestWalkExprTree(t *testing.T) {
	tests := []struct {
		name     string
		exprTree *ExprTree
		want     string
	}{
		{
			name:     "one condition needs no group",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0"),
			want:     "version_name in [1.2.0]",
		},
		{
			name:     "a condition keeps its values in the order picked",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0", "1.1.0"),
			want:     "version_name in [1.2.0 1.1.0]",
		},
		{
			name: "a group is joined by its own operator",
			exprTree: &ExprTree{LogicalOperator: LogicalOr, Children: []ExprTree{
				*leafExprTree("version_name", OperatorIn, "1.2.0"),
				*leafExprTree("patch_id", OperatorIsSet),
			}},
			want: "(version_name in [1.2.0] or patch_id is_set)",
		},
		{
			name: "a nested group keeps its own operator inside its parent's",
			exprTree: &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
				*leafExprTree("mapping_type", OperatorIn, "proguard"),
				{LogicalOperator: LogicalOr, Children: []ExprTree{
					*leafExprTree("version_name", OperatorIn, "1.2.0"),
					*leafExprTree("patch_id", OperatorIsSet),
				}},
			}},
			want: "(mapping_type in [proguard] and (version_name in [1.2.0] or patch_id is_set))",
		},
		{
			name: "children keep the order they were written in",
			exprTree: &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
				*leafExprTree("a", OperatorIsSet),
				*leafExprTree("b", OperatorIsSet),
				*leafExprTree("c", OperatorIsSet),
			}},
			want: "(a is_set and b is_set and c is_set)",
		},
		{
			name:     "a group of one is still handed to the group function",
			exprTree: &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{*leafExprTree("a", OperatorIsSet)}},
			want:     "(a is_set)",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := renderText(test.exprTree)
			if err != nil {
				t.Fatalf("walk: %v", err)
			}
			if got != test.want {
				t.Errorf("want %q, got %q", test.want, got)
			}
		})
	}
}

func TestWalkExprTreeStopsAtTheFirstError(t *testing.T) {
	t.Run("a key the query cannot answer", func(t *testing.T) {
		exprTree := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("version_name", OperatorIn, "1.2.0"),
			*leafExprTree("unsupported", OperatorIsSet),
		}}

		_, err := renderText(exprTree)
		if !errors.Is(err, ErrKeyNotSupported) {
			t.Errorf("want ErrKeyNotSupported, got %v", err)
		}
	})

	t.Run("later conditions are not visited", func(t *testing.T) {
		visited := []string{}
		exprTree := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("first", OperatorIsSet),
			*leafExprTree("second", OperatorIsSet),
			*leafExprTree("third", OperatorIsSet),
		}}

		_, err := WalkExprTree(exprTree,
			func(condition Condition) (string, error) {
				visited = append(visited, condition.KeyName)
				if condition.KeyName == "second" {
					return "", errors.New("no")
				}
				return condition.KeyName, nil
			},
			func(operator LogicalOperator, children []string) (string, error) {
				return strings.Join(children, ","), nil
			})

		if err == nil {
			t.Fatal("want the condition's error to come back")
		}
		if len(visited) != 2 || visited[0] != "first" || visited[1] != "second" {
			t.Errorf("want the walk to stop at the failing condition, visited %v", visited)
		}
	})

	t.Run("an error from the group function", func(t *testing.T) {
		exprTree := &ExprTree{LogicalOperator: LogicalOr, Children: []ExprTree{*leafExprTree("a", OperatorIsSet)}}

		_, err := WalkExprTree(exprTree,
			func(condition Condition) (string, error) { return condition.KeyName, nil },
			func(operator LogicalOperator, children []string) (string, error) {
				return "", fmt.Errorf("this query cannot answer an %s", operator)
			})

		if err == nil || !strings.Contains(err.Error(), "cannot answer an or") {
			t.Errorf("want the group function's error, got %v", err)
		}
	})

	t.Run("no expression at all", func(t *testing.T) {
		_, err := renderText(nil)
		if err == nil || !strings.Contains(err.Error(), "empty") {
			t.Errorf("want an empty-expression error, got %v", err)
		}
	})
}

// A caller can fold the tree into any type, not just a rendered expression.
// This test uses a small shape summary instead.
func TestWalkExprTreeProducesWhateverTheCallerWorksIn(t *testing.T) {
	type shape struct {
		conditions int
		hasOr      bool
	}

	exprTree := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
		*leafExprTree("mapping_type", OperatorIn, "proguard"),
		{LogicalOperator: LogicalOr, Children: []ExprTree{
			*leafExprTree("version_name", OperatorIn, "1.2.0"),
			*leafExprTree("patch_id", OperatorIsSet),
		}},
	}}

	got, err := WalkExprTree(exprTree,
		func(condition Condition) (shape, error) {
			return shape{conditions: 1}, nil
		},
		func(operator LogicalOperator, children []shape) (shape, error) {
			combined := shape{hasOr: operator == LogicalOr}
			for _, child := range children {
				combined.conditions += child.conditions
				combined.hasOr = combined.hasOr || child.hasOr
			}
			return combined, nil
		})

	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	if got.conditions != 3 {
		t.Errorf("want 3 conditions, got %d", got.conditions)
	}
	if !got.hasOr {
		t.Error("want the walk to surface that an or is in the tree")
	}
}
