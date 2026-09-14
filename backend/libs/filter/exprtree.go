// Package filter parses, validates and binds filter expressions: trees of
// conditions joined by and/or groups, addressed by stable key names. What a
// key means on a table comes from the entity that offers it.
package filter

import (
	"fmt"
	"strconv"
	"time"
)

// LogicalOperator joins the children of a group.
type LogicalOperator string

const (
	LogicalAnd LogicalOperator = "and"
	LogicalOr  LogicalOperator = "or"
)

func (logicalOperator LogicalOperator) String() string {
	return string(logicalOperator)
}

func (logicalOperator LogicalOperator) Valid() bool {
	return logicalOperator == LogicalAnd || logicalOperator == LogicalOr
}

// ExprTree is one node of a filter tree: either a group, carrying a logical
// operator and children, or a leaf, carrying a single condition. Exactly one
// of the two forms is populated.
type ExprTree struct {
	LogicalOperator LogicalOperator `json:"logical_operator,omitempty"`
	Children        []ExprTree      `json:"children,omitempty"`
	Condition       *Condition      `json:"condition,omitempty"`
}

func (exprTree *ExprTree) IsGroup() bool {
	return exprTree != nil && exprTree.Condition == nil
}

type Condition struct {
	KeyName      string   `json:"key_name"`
	Operator     Operator `json:"operator"`
	Values       []Value  `json:"values,omitempty"`
	TextPosition int      `json:"-"`
	TextEnd      int      `json:"-"`
}

func (condition Condition) TextValues() []string {
	texts := make([]string, len(condition.Values))
	for i := range condition.Values {
		texts[i] = condition.Values[i].Text
	}
	return texts
}

func (condition Condition) TextValue() string {
	if len(condition.Values) == 0 {
		return ""
	}
	return condition.Values[0].Text
}

func (condition Condition) IntegerValue() (int64, error) {
	number, err := strconv.ParseInt(condition.TextValue(), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("Key %q takes an integer, got %q", condition.KeyName, condition.TextValue())
	}
	return number, nil
}

func (condition Condition) FloatValue() (float64, error) {
	number, err := strconv.ParseFloat(condition.TextValue(), 64)
	if err != nil {
		return 0, fmt.Errorf("Key %q takes a number, got %q", condition.KeyName, condition.TextValue())
	}
	return number, nil
}

func (condition Condition) TimeValue() (time.Time, error) {
	at, err := time.Parse(time.RFC3339, condition.TextValue())
	if err != nil {
		return time.Time{}, fmt.Errorf("Key %q takes a time written as %s, got %q", condition.KeyName, time.RFC3339, condition.TextValue())
	}
	return at, nil
}

func (condition Condition) BoolValue() (bool, error) {
	yes, err := strconv.ParseBool(condition.TextValue())
	if err != nil {
		return false, fmt.Errorf("Key %q takes true or false, got %q", condition.KeyName, condition.TextValue())
	}
	return yes, nil
}

// Value is one filter value. Text is what the filter matches on. Label is a
// display spelling of the same value, such as "ProGuard" for "proguard", sent
// by the client for its own rendering and ignored here.
type Value struct {
	Text  string `json:"text"`
	Label string `json:"label,omitempty"`
}
