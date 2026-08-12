package exprfilter

import (
	"fmt"
	"slices"
)

// Operator is what a condition does with its values.
type Operator string

const (
	// OperatorIn and OperatorNotIn take a list of values. The filter bar labels
	// them "is" and "is not".
	OperatorIn    Operator = "in"
	OperatorNotIn Operator = "not_in"

	// Text operators take exactly one value.
	OperatorContains    Operator = "contains"
	OperatorNotContains Operator = "not_contains"
	OperatorStartsWith  Operator = "starts_with"
	OperatorEndsWith    Operator = "ends_with"

	// Comparisons take exactly one value.
	OperatorEq  Operator = "eq"
	OperatorNeq Operator = "neq"
	OperatorGt  Operator = "gt"
	OperatorGte Operator = "gte"
	OperatorLt  Operator = "lt"
	OperatorLte Operator = "lte"

	// Presence operators take no values. What counts as unset is the
	// entity's choice: an empty string for one column, the nil UUID for
	// another.
	OperatorIsSet    Operator = "is_set"
	OperatorIsNotSet Operator = "is_not_set"

	// Time operators. OperatorBetween takes two values, the others one.
	OperatorBefore  Operator = "before"
	OperatorAfter   Operator = "after"
	OperatorBetween Operator = "between"
)

// ValueType is the kind of value a key holds. It decides which operators the
// key may offer.
type ValueType string

const (
	ValueTypeString   ValueType = "string"
	ValueTypeEnum     ValueType = "enum"
	ValueTypeUUID     ValueType = "uuid"
	ValueTypeBool     ValueType = "bool"
	ValueTypeDatetime ValueType = "datetime"
	ValueTypeInt32    ValueType = "int32"
	ValueTypeInt64    ValueType = "int64"
	ValueTypeUInt32   ValueType = "uint32"
	ValueTypeFloat64  ValueType = "float64"
)

var numericOperators = []Operator{
	OperatorEq, OperatorNeq, OperatorGt, OperatorGte, OperatorLt, OperatorLte,
	OperatorIsSet, OperatorIsNotSet,
}

var operatorsByValueType = map[ValueType][]Operator{
	ValueTypeString: {
		OperatorIn, OperatorNotIn,
		OperatorContains, OperatorNotContains, OperatorStartsWith, OperatorEndsWith,
		OperatorIsSet, OperatorIsNotSet,
	},
	ValueTypeEnum:     {OperatorIn, OperatorNotIn},
	ValueTypeUUID:     {OperatorIn, OperatorNotIn, OperatorIsSet, OperatorIsNotSet},
	ValueTypeInt32:    numericOperators,
	ValueTypeInt64:    numericOperators,
	ValueTypeUInt32:   numericOperators,
	ValueTypeFloat64:  numericOperators,
	ValueTypeBool:     {OperatorEq},
	ValueTypeDatetime: {OperatorBefore, OperatorAfter, OperatorBetween},
}

func AllowedOperatorsFor(valueType ValueType) []Operator {
	operators := operatorsByValueType[valueType]
	out := make([]Operator, len(operators))
	copy(out, operators)
	return out
}

// arity is how many values an operator takes. A high of -1 means any number of
// values at or above low.
type arity struct {
	low, high int
}

var arityByOperator = map[Operator]arity{
	OperatorIn:          {1, -1},
	OperatorNotIn:       {1, -1},
	OperatorContains:    {1, 1},
	OperatorNotContains: {1, 1},
	OperatorStartsWith:  {1, 1},
	OperatorEndsWith:    {1, 1},
	OperatorEq:          {1, 1},
	OperatorNeq:         {1, 1},
	OperatorGt:          {1, 1},
	OperatorGte:         {1, 1},
	OperatorLt:          {1, 1},
	OperatorLte:         {1, 1},
	OperatorIsSet:       {0, 0},
	OperatorIsNotSet:    {0, 0},
	OperatorBefore:      {1, 1},
	OperatorAfter:       {1, 1},
	OperatorBetween:     {2, 2},
}

// textMatchOperators compare a fragment of the text a value is written as
// rather than the value itself, so their values skip the value type check.
var textMatchOperators = []Operator{OperatorContains, OperatorNotContains, OperatorStartsWith, OperatorEndsWith}

func isTextMatch(operator Operator) bool {
	return slices.Contains(textMatchOperators, operator)
}

func (operator Operator) Valid() bool {
	_, ok := arityByOperator[operator]
	return ok
}

func checkArity(operator Operator, count int) error {
	a, ok := arityByOperator[operator]
	if !ok {
		return fmt.Errorf("unknown operator %q", operator)
	}

	switch {
	case a.high < 0 && count < a.low:
		return fmt.Errorf("operator %q needs at least %d value(s), got %d", operator, a.low, count)
	case a.high >= 0 && (count < a.low || count > a.high):
		if a.low == a.high {
			return fmt.Errorf("operator %q needs exactly %d value(s), got %d", operator, a.low, count)
		}
		return fmt.Errorf("operator %q needs between %d and %d values, got %d", operator, a.low, a.high, count)
	}

	return nil
}
