// Package exprfilter parses, validates and walks filter expressions: trees
// of conditions joined by and/or groups, addressed by stable key names.
//
// The package writes no SQL of its own. Every part of a predicate comes from a
// entity, which knows which tables a key is read from and what it means
// there.
package exprfilter

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

// String returns the operator as it reads in SQL.
func (logicalOperator LogicalOperator) String() string {
	return string(logicalOperator)
}

// Valid reports whether logicalOperator is a known logical operator.
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

// IsGroup reports whether exprTree is a group rather than a condition.
func (exprTree *ExprTree) IsGroup() bool {
	return exprTree != nil && exprTree.Condition == nil
}

// Condition compares one key against a set of values.
type Condition struct {
	KeyName      string   `json:"key_name"`
	Operator     Operator `json:"operator"`
	Values       []Value  `json:"values,omitempty"`
	TextPosition int      `json:"-"`
	TextEnd      int      `json:"-"`
}

// TextValues returns the values as text, in the order they were written.
func (condition Condition) TextValues() []string {
	texts := make([]string, len(condition.Values))
	for i := range condition.Values {
		texts[i] = condition.Values[i].Text
	}
	return texts
}

// TextValue returns the single value of a condition whose operator takes one.
// It returns the empty string only for an operator that takes none.
func (condition Condition) TextValue() string {
	if len(condition.Values) == 0 {
		return ""
	}
	return condition.Values[0].Text
}

// IntegerValue returns the single value of a condition on an integer key.
func (condition Condition) IntegerValue() (int64, error) {
	number, err := strconv.ParseInt(condition.TextValue(), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("Key %q takes an integer, got %q", condition.KeyName, condition.TextValue())
	}
	return number, nil
}

// FloatValue returns the single value of a condition on a number key.
func (condition Condition) FloatValue() (float64, error) {
	number, err := strconv.ParseFloat(condition.TextValue(), 64)
	if err != nil {
		return 0, fmt.Errorf("Key %q takes a number, got %q", condition.KeyName, condition.TextValue())
	}
	return number, nil
}

// TimeValue returns the single value of a condition on a time key.
func (condition Condition) TimeValue() (time.Time, error) {
	at, err := time.Parse(time.RFC3339, condition.TextValue())
	if err != nil {
		return time.Time{}, fmt.Errorf("Key %q takes a time written as %s, got %q", condition.KeyName, time.RFC3339, condition.TextValue())
	}
	return at, nil
}

// BoolValue returns the single value of a condition on a true-or-false key.
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
