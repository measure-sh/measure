package exprfilter

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// TextSpan bounds a stretch of the filter expression, counted in characters
// from zero, with End one past the last character.
type TextSpan struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

// FilterExprIssue is one thing wrong with a filter. Span is where in the filter
// expression it is. For issues affecting the whole filter like a limit, it is null.
type FilterExprIssue struct {
	Message string    `json:"message"`
	Span    *TextSpan `json:"span,omitempty"`
}

type ValidationError struct {
	Issues []FilterExprIssue
}

func (e *ValidationError) Error() string {
	if len(e.Issues) == 0 {
		return "filter cannot be used"
	}
	if len(e.Issues) == 1 {
		return e.Issues[0].Message
	}
	return fmt.Sprintf("%s (+%d more)", e.Issues[0].Message, len(e.Issues)-1)
}

func ValidateFilterExpr(exprTree *ExprTree, keysByName map[string]Key) error {
	if exprTree == nil {
		return &ValidationError{Issues: []FilterExprIssue{{Message: "Filter expression is empty"}}}
	}

	found := &ValidationError{}
	conditions := 0
	if err := validateNode(exprTree, keysByName, 1, &conditions, found); err != nil {
		found.Issues = append(found.Issues, FilterExprIssue{Message: err.Error()})
	}

	if len(found.Issues) > 0 {
		return found
	}
	return nil
}

// validateNode returns an error only when the walk cannot continue: the tree
// is too deep, or a group is malformed. Condition errors are collected so the
// walk can report multiple problems at once.
func validateNode(exprTree *ExprTree, keysByName map[string]Key, depth int, conditions *int, found *ValidationError) error {
	if depth > MaxDepth {
		return fmt.Errorf("Filter groups nest deeper than %d levels", MaxDepth)
	}

	if exprTree.IsGroup() {
		if !exprTree.LogicalOperator.Valid() {
			return fmt.Errorf("Filter group operator must be %q or %q, got %q", LogicalAnd, LogicalOr, exprTree.LogicalOperator)
		}
		if len(exprTree.Children) == 0 {
			return fmt.Errorf("Filter group %q has no conditions", exprTree.LogicalOperator)
		}
		for i := range exprTree.Children {
			if err := validateNode(&exprTree.Children[i], keysByName, depth+1, conditions, found); err != nil {
				return err
			}
		}
		return nil
	}

	*conditions++
	if *conditions > MaxConditions {
		return fmt.Errorf("Filter holds more than %d conditions", MaxConditions)
	}

	if err := validateCondition(*exprTree.Condition, keysByName); err != nil {
		found.Issues = append(found.Issues, FilterExprIssue{
			Message: err.Error(),
			Span: &TextSpan{
				Start: exprTree.Condition.TextPosition,
				End:   exprTree.Condition.TextEnd,
			},
		})
	}

	return nil
}

func validateCondition(condition Condition, keysByName map[string]Key) error {
	key, ok := keysByName[condition.KeyName]
	if !ok {
		return fmt.Errorf("Unknown key: %q", condition.KeyName)
	}

	if !condition.Operator.Valid() {
		return fmt.Errorf("Unknown operator %q on key %q", condition.Operator, condition.KeyName)
	}

	// Prefer the key's operators when specified; otherwise use those allowed
	// by its value type.
	allowed := key.Operators
	if len(allowed) == 0 {
		allowed = AllowedOperatorsFor(key.ValueType)
	}
	if !slices.Contains(allowed, condition.Operator) {
		return fmt.Errorf("Operator %q is not offered by key %q", condition.Operator, condition.KeyName)
	}

	if len(condition.Values) > MaxValuesPerCondition {
		return fmt.Errorf("Key %q carries more than %d values", condition.KeyName, MaxValuesPerCondition)
	}

	if err := checkArity(condition.Operator, len(condition.Values)); err != nil {
		return fmt.Errorf("Key %q: %w", condition.KeyName, err)
	}

	// Empty values indicate an incomplete condition and should not be evaluated.
	for _, value := range condition.Values {
		if value.Text == "" {
			return fmt.Errorf("Key %q carries an empty value", condition.KeyName)
		}
		if err := checkValueType(key, condition.Operator, value); err != nil {
			return err
		}
	}

	return nil
}

// checkValueType verifies that a value is valid for the key's type.
func checkValueType(key Key, operator Operator, value Value) error {
	if isTextMatch(operator) {
		return nil
	}

	switch key.ValueType {
	case ValueTypeInt32:
		return checkInteger(key, value.Text, math.MinInt32, math.MaxInt32)
	case ValueTypeInt64:
		return checkInteger(key, value.Text, math.MinInt64, math.MaxInt64)
	case ValueTypeUInt32:
		return checkInteger(key, value.Text, 0, math.MaxUint32)
	case ValueTypeFloat64:
		if _, err := strconv.ParseFloat(value.Text, 64); err != nil {
			return fmt.Errorf("Key %q takes a number, got %q", key.Name, value.Text)
		}
	case ValueTypeBool:
		if _, err := strconv.ParseBool(value.Text); err != nil {
			return fmt.Errorf("Key %q takes true or false, got %q", key.Name, value.Text)
		}
	case ValueTypeUUID:
		if _, err := uuid.Parse(value.Text); err != nil {
			return fmt.Errorf("Key %q takes an id, got %q", key.Name, value.Text)
		}
	case ValueTypeDatetime:
		if _, err := time.Parse(time.RFC3339, value.Text); err != nil {
			return fmt.Errorf("Key %q takes a time written as %s, got %q", key.Name, time.RFC3339, value.Text)
		}
	case ValueTypeEnum:
		if len(key.EnumValues) > 0 && !slices.Contains(key.EnumValues, value.Text) {
			return fmt.Errorf("Key %q has no value %q", key.Name, value.Text)
		}
	}

	return nil
}

func checkInteger(key Key, text string, low, high int64) error {
	number, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		if errors.Is(err, strconv.ErrRange) {
			return outsideRange(key, text, low, high)
		}
		return fmt.Errorf("Key %q takes an integer, got %q", key.Name, text)
	}
	if number < low || number > high {
		return outsideRange(key, text, low, high)
	}
	return nil
}

func outsideRange(key Key, text string, low, high int64) error {
	return fmt.Errorf("Key %q takes an integer between %d and %d, got %q", key.Name, low, high, text)
}
