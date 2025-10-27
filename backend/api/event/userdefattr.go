package event

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/leporo/sqlf"
)

// attrKeyPattern defines the regular
// expression pattern for validating
// attribute keys.
const attrKeyPattern = "^[a-zA-Z0-9_-]+$"

// maxAllowedDegree defines the maximum
// nesting depth a recursive nested
// expression is allowed.
const maxAllowedDegree = 2

const (
	AttrUnknown AttrType = iota
	AttrString
	AttrInt64
	AttrFloat64
	AttrBool
)

type AttrType int

// String returns a string representation of the
// attribute type.
func (a AttrType) String() string {
	switch a {
	default:
		return "unknown"
	case AttrString:
		return "string"
	case AttrInt64:
		return "int64"
	case AttrFloat64:
		return "float64"
	case AttrBool:
		return "bool"
	}
}

func (a *AttrType) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}

	s = strings.ToLower(s)

	switch s {
	case AttrString.String():
		*a = AttrString
	case AttrInt64.String():
		*a = AttrInt64
	case AttrFloat64.String():
		*a = AttrFloat64
	case AttrBool.String():
		*a = AttrBool
	default:
		return fmt.Errorf("invalid attribute type: %s", s)
	}

	return nil
}

const (
	OpEq AttrOp = iota
	OpNeq
	OpContains
	OpStartsWith
	OpGt
	OpLt
	OpGte
	OpLte
)

type AttrOp int

// String returns a string representation of the
// attribute operator.
func (o AttrOp) String() string {
	switch o {
	default:
		return "unknown"
	case OpEq:
		return "eq"
	case OpNeq:
		return "neq"
	case OpContains:
		return "contains"
	case OpStartsWith:
		return "startsWith"
	case OpGt:
		return "gt"
	case OpLt:
		return "lt"
	case OpGte:
		return "gte"
	case OpLte:
		return "lte"
	}
}

// Sql returns the SQL compatible
// operator to be consumed directly
// in a SQL query.
func (o AttrOp) Sql() string {
	switch o {
	default:
		return "="
	case OpEq:
		return "="
	case OpNeq:
		return "!="
	case OpContains:
		return "ilike"
	case OpStartsWith:
		return "ilike"
	case OpGt:
		return ">"
	case OpLt:
		return "<"
	case OpGte:
		return ">="
	case OpLte:
		return "<="
	}
}

// getValidOperators provides a slice of valid attribute
// operators for the requested attribute type.
func getValidOperators(ty AttrType) (ops []AttrOp) {
	switch ty {
	case AttrBool:
		ops = []AttrOp{OpEq, OpNeq}
	case AttrString:
		ops = []AttrOp{OpEq, OpNeq, OpContains, OpStartsWith}
	case AttrInt64, AttrFloat64:
		ops = []AttrOp{OpEq, OpNeq, OpGt, OpGte, OpLt, OpLte}
	}
	return
}

func (o *AttrOp) UnmarshalJSON(b []byte) error {
	// extract the value inside double quotes
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}

	switch s {
	case OpEq.String():
		*o = OpEq
	case OpNeq.String():
		*o = OpNeq
	case OpContains.String():
		*o = OpContains
	case OpStartsWith.String():
		*o = OpStartsWith
	case OpGt.String():
		*o = OpGt
	case OpLt.String():
		*o = OpLt
	case OpGte.String():
		*o = OpGte
	case OpLte.String():
		*o = OpLte
	}

	return nil
}

// UDKeyType represents a single pair
// of user defined attribute key and
// its type.
type UDKeyType struct {
	Key  string `json:"key"`
	Type string `json:"type"`
}

// UDExpression represents a self-referential
// composite expression used for querying with
// user defined attributes.
type UDExpression struct {
	And []UDExpression `json:"and,omitempty"`
	Or  []UDExpression `json:"or,omitempty"`
	Cmp UDComparison   `json:"cmp,omitempty"`
}

// Degree computes the maximum nesting depth
// of a recursive user defined expression.
func (u *UDExpression) Degree() (degree int) {
	type stackItem struct {
		expr   *UDExpression
		degree int
	}

	stack := []stackItem{{expr: u, degree: 1}}
	maxDegree := 1

	// process expressions until stack
	// is empty
	for len(stack) > 0 {
		// pop last item from stack
		n := len(stack) - 1
		current := stack[n]
		stack = stack[:n]

		if current.degree > maxDegree {
			maxDegree = current.degree
		}

		// add all AND expressions to the stack
		for _, andExpr := range current.expr.And {
			stack = append(stack, stackItem{
				expr:   &andExpr,
				degree: current.degree + 1,
			})
		}

		// add all OR expressions to the stack
		for _, orExpr := range current.expr.Or {
			stack = append(stack, stackItem{
				expr:   &orExpr,
				degree: current.degree + 1,
			})
		}
	}

	degree = maxDegree

	return
}

// Empty returns true if the user defined
// expression does not contain any usable
// and meaningful values.
func (e *UDExpression) Empty() bool {
	return len(e.And) == 0 && len(e.Or) == 0 && e.Cmp.Empty()
}

// Left returns true if the expression does
// not contain any further `And` or `Or`
// expressions.
func (u *UDExpression) Leaf() bool {
	return len(u.And) == 0 && len(u.Or) == 0 && !u.Cmp.Empty()
}

// HasAnd returns true if expression contains
// at least 1 `And` expression.
func (u *UDExpression) HasAnd() bool {
	return len(u.And) > 0
}

// HasOr returns true if expression contains
// at least 1 `Or` expression.
func (u *UDExpression) HasOr() bool {
	return len(u.Or) > 0
}

// Validate validates the user defined expression
// and returns error if not valid.
func (u *UDExpression) Validate() (err error) {
	// should not be empty
	if u.Empty() {
		err = errors.New("user defined expression cannot be empty")
	}

	// should not contain `and` and `or` both
	// expression at the same time
	if u.HasAnd() && u.HasOr() {
		err = errors.New("user defined expression cannot contain both `and` and `or` expressions")
	}

	// should not exceed maximum allowed nesting
	// level
	if u.Degree() > maxAllowedDegree {
		err = fmt.Errorf("user defined expression exceeds maximum allowed degree of %d. a degree is the maximum depth of nesting of the expression.", maxAllowedDegree)
	}

	// validate each comparison expression
	comparisons := u.getComparisons()
	for _, cmp := range comparisons {
		if err = cmp.Validate(); err != nil {
			return
		}
	}

	return
}

// Augment augments the sql statement with fully
// qualified `where` expressions.
func (u *UDExpression) Augment(stmt *sqlf.Stmt) {
	if u.HasAnd() {
		for i, andExpr := range u.And {
			if i > 0 {
				stmt.Clause("OR")
			}
			andExpr.Augment(stmt)
		}
	} else if u.HasOr() {
		for i, orExpr := range u.Or {
			if i > 0 {
				stmt.Clause("OR")
			}
			orExpr.Augment(stmt)
		}
	} else if !u.Cmp.Empty() {
		u.Cmp.Augment(stmt)
	}
}

// getComparisons extracts all comparison expressions
// from the a user defined expression.
func (u *UDExpression) getComparisons() (cmps []UDComparison) {
	stack := []UDExpression{*u}

	// process expressions until stack is empty
	for len(stack) > 0 {
		n := len(stack) - 1
		current := stack[n]
		stack = stack[:n]

		// if expression has a comparison, add it
		if !current.Cmp.Empty() {
			cmps = append(cmps, current.Cmp)
		}

		// add all AND expressions
		for i := len(current.And) - 1; i >= 0; i -= 1 {
			stack = append(stack, current.And[i])
		}

		// add all OR expressions
		for i := len(current.Or) - 1; i >= 0; i -= 1 {
			stack = append(stack, current.Or[i])
		}
	}

	return
}

// UDComparison represnts comparison
// expressions.
type UDComparison struct {
	Key   string   `json:"key"`
	Type  AttrType `json:"type"`
	Op    AttrOp   `json:"op"`
	Value string   `json:"value"`
}

// Empty returns true if comparison expression
// lacks a usable key.
func (c UDComparison) Empty() bool {
	return c.Key == ""
}

// EscapedValue provides the escaped string
// for use in LIKE or ILIKE SQL expressions.
func (c UDComparison) EscapedValue() string {
	return strings.ReplaceAll(c.Value, "%", "\\%")
}

// Augment augments the sql statement with fully
// qualified sql expressions.
func (c *UDComparison) Augment(stmt *sqlf.Stmt) {
	if c.Empty() {
		fmt.Printf("warning: not augmenting user defined comparison to statement %q because comparison expression is empty", stmt.String())
		return
	}

	opSymbol := c.Op.Sql()
	danglingExpr := hasExprClause(stmt)
	exprFunc := stmt.Where

	if danglingExpr {
		exprFunc = stmt.Expr
	}

	switch c.Op {
	case OpEq, OpNeq, OpGt, OpGte, OpLt, OpLte:
		exprFunc(fmt.Sprintf("(key = ? AND type = ? AND value %s ?)", opSymbol), c.Key, c.Type.String(), c.Value)
	case OpContains:
		exprFunc(fmt.Sprintf("(key = ? AND type = ? AND value %s %%?%%)", opSymbol), c.Key, c.Type.String(), c.EscapedValue())
	case OpStartsWith:
		exprFunc(fmt.Sprintf("(key = ? AND type = ? AND value %s ?%%)", opSymbol), c.Key, c.Type.String(), c.EscapedValue())
	}
}

// endsWithAnd returns true if the statement
// ends with a dangling "AND" keyword.
func endsWithAnd(stmt *sqlf.Stmt) bool {
	return strings.HasSuffix(strings.ToLower(stmt.String()), "and")
}

// endsWithOr returns true if the statement
// ends with a dangling "OR" keyword.
func endsWithOr(stmt *sqlf.Stmt) bool {
	return strings.HasSuffix(strings.ToLower(stmt.String()), "or")
}

// hasExprClause returns true if the statement
// ends with either a dangling "AND" or "OR"
// keyword.
func hasExprClause(stmt *sqlf.Stmt) bool {
	return endsWithAnd(stmt) || endsWithOr(stmt)
}

// Validate validates the user defined comparison
// and returns error if not valid.
func (c *UDComparison) Validate() (err error) {
	validOps := getValidOperators(c.Type)
	if !slices.Contains(validOps, c.Op) {
		err = fmt.Errorf("%q operator is not valid for type: %q", c.Op.String(), c.Type)
	}
	return
}

// UDAttribute represents user defined
// attributes in a convenient & usable
// structure.
//
// User Defined Attributes are related
// to events or spans.
type UDAttribute struct {
	rawAttrs map[string]any
	keyTypes map[string]AttrType
}

// Empty returns true if user defined
// attributes does not contain any keys
// or attributes.
func (u UDAttribute) Empty() bool {
	return len(u.rawAttrs) == 0 && len(u.keyTypes) == 0
}

// MarshalJSON marshals UDAttribute type of user
// defined attributes to JSON.
func (u UDAttribute) MarshalJSON() (data []byte, err error) {
	for key, keytype := range u.keyTypes {
		switch keytype {
		case AttrBool:
			strval := u.rawAttrs[key].(string)
			value, err := strconv.ParseBool(strval)
			if err != nil {
				return nil, err
			}
			u.rawAttrs[key] = value
		case AttrInt64:
			strval := u.rawAttrs[key].(string)
			value, err := strconv.ParseInt(strval, 10, 64)
			if err != nil {
				return nil, err
			}

			// if value lies outside the bounds
			// of int64, then parse as string
			if value >= math.MaxInt64 || value <= math.MinInt64 {
				u.rawAttrs[key] = strval
			} else {
				u.rawAttrs[key] = value
			}
		case AttrFloat64:
			strval := u.rawAttrs[key].(string)
			value, err := strconv.ParseFloat(strval, 64)
			if err != nil {
				return nil, err
			}
			u.rawAttrs[key] = value
		case AttrString:
			u.rawAttrs[key] = u.rawAttrs[key].(string)
		}
	}
	return json.Marshal(u.rawAttrs)
}

// UnmarshalJSON unmarshalls bytes resembling user defined
// attributes to UDAttribute type.
func (u *UDAttribute) UnmarshalJSON(data []byte) (err error) {
	return json.Unmarshal(data, &u.rawAttrs)
}

// Validate validates user defined attributes bag.
func (u *UDAttribute) Validate() (err error) {
	if u.rawAttrs == nil {
		return errors.New("user defined attributes must not be empty")
	}

	re := regexp.MustCompile(attrKeyPattern)

	count := len(u.rawAttrs)

	if count > maxUserDefAttrsCount {
		return fmt.Errorf("user defined attributes must not exceed %d items", maxUserDefAttrsCount)
	}

	if u.keyTypes == nil {
		u.keyTypes = make(map[string]AttrType)
	}

	for k, v := range u.rawAttrs {
		if len(k) > maxUserDefAttrsKeyChars {
			return fmt.Errorf("user defined attribute keys must not exceed %d characters", maxUserDefAttrsKeyChars)
		}

		if !re.MatchString(k) {
			return fmt.Errorf("user defined attribute keys must only contain alphabets, numbers, hyphens and underscores")
		}

		switch value := v.(type) {
		case string:
			if len(value) > maxUserDefAttrsValsChars {
				return fmt.Errorf("user defined attributes string values must not exceed %d characters", maxUserDefAttrsValsChars)
			}

			u.keyTypes[k] = AttrString
			continue
		case bool:
			u.keyTypes[k] = AttrBool
		case float64:
			if reflect.TypeOf(v).Kind() == reflect.Float64 {
				if v == float64(int64(value)) {
					if value < math.MinInt64 || value > math.MaxInt64 {
						return fmt.Errorf(`value of user defined attribute %q should be within int64 range >%d <%d`, k, math.MinInt64, math.MaxInt64)
					}
					u.keyTypes[k] = AttrInt64
				} else {
					if value > math.MaxFloat64 {
						return fmt.Errorf(`value of user defined attribute %q should be within float64 range <%f`, k, math.MaxFloat64)
					}
					u.keyTypes[k] = AttrFloat64
				}
			}
			continue
		default:
			return fmt.Errorf("user defined attribute values can be only string, number or boolean")
		}
	}

	return
}

// HasItems returns true if user defined
// attribute is not empty.
func (u *UDAttribute) HasItems() bool {
	return len(u.rawAttrs) > 0
}

// Parameterize provides user defined attributes in a
// compatible data structure that database query engines
// can directly consume.
func (u *UDAttribute) Parameterize() (attr map[string]string) {
	attr = map[string]string{}

	val := ""

	for k, v := range u.rawAttrs {
		switch v := v.(type) {
		case bool:
			val = strconv.FormatBool(v)
		case float64:
			if intVal, ok := convertToInt64Safely(v); ok {
				val = strconv.FormatInt(intVal, 10)
			} else {
				val = strconv.FormatFloat(v, 'g', -1, 64)
			}
		case int64:
			// usually, this case won't hit
			// because numbers parsed from JSON
			// will always be float64
			// but let's handle it just in case
			val = strconv.FormatInt(v, 10)
		case string:
			// escape any single quote, if any
			// if not escaped, ClickHouse insert will
			// throw errors.
			v = strings.ReplaceAll(v, "'", "\\'")
			val = v
		}

		attr[k] = fmt.Sprintf("('%s', '%s')", u.keyTypes[k].String(), val)
	}

	return
}

// Scan scans and stores user defined attribute
// data coming from a database query result.
func (u *UDAttribute) Scan(attrMap map[string][]any) {
	for key, tuple := range attrMap {
		intType := tuple[0]
		if u.keyTypes == nil {
			u.keyTypes = make(map[string]AttrType)
		}
		if u.rawAttrs == nil {
			u.rawAttrs = make(map[string]any)
		}
		attrType := intType.(string)
		switch attrType {
		case AttrBool.String():
			u.keyTypes[key] = AttrBool
		case AttrString.String():
			u.keyTypes[key] = AttrString
			if value, ok := tuple[1].(string); ok {
				// unescape single quotes if any
				tuple[1] = strings.ReplaceAll(value, "\\'", "'")
			}
		case AttrInt64.String():
			u.keyTypes[key] = AttrInt64
		case AttrFloat64.String():
			u.keyTypes[key] = AttrFloat64
		}
		u.rawAttrs[key] = tuple[1]
	}
}

// GetUDAttrsOpMap provides a type wise list of operators
// for each type of user defined attribute keys.
func GetUDAttrsOpMap() (opmap map[string][]string) {
	opmap = map[string][]string{
		AttrBool.String(): {OpEq.String(), OpNeq.String()},
		AttrString.String(): {
			OpEq.String(),
			OpNeq.String(),
			OpContains.String(),
			OpStartsWith.String(),
		},
		AttrInt64.String(): {
			OpEq.String(),
			OpNeq.String(),
			OpGt.String(),
			OpLt.String(),
			OpGte.String(),
			OpLte.String(),
		},
		AttrFloat64.String(): {
			OpEq.String(),
			OpNeq.String(),
			OpGt.String(),
			OpLt.String(),
			OpGte.String(),
			OpLte.String(),
		},
	}

	return
}

// convertToInt64Safely converts float64 value to int64
// in an architecture agnostic way while handling upper
// and lower bounds of int64 type.
func convertToInt64Safely(value float64) (int64, bool) {
	// float64 value should be within int64 range
	if value < float64(math.MinInt64) || value > float64(math.MaxInt64) {
		return 0, false
	}

	// convert to int64 if an exact integer
	if value == math.Trunc(value) {
		intVal := int64(value)

		// detect and saturate on overflow
		//
		// on amd64/x86 systems, converting a float64 -> int64
		// may cause integer overflow. due to this, a value of
		// math.MaxInt64 may be converted to math.MinInt64. that
		// would be terribly terribly wrong. so, we detect if
		// this kind of overflow happens and saturate it to the
		// upper bound of int64 ourselves.
		//
		// aarch64/arm64 systems on the other hand are more
		// "modern" in nature. they always saturate on overflow
		// instead of rotating to the extreme lower bound.
		//
		// read more about this:
		// 1. https://www.forrestthewoods.com/blog/perfect_prevention_of_int_overflows/
		// 2. https://frama-c.com/2013/10/09/Overflow-float-integer.html
		// 3. https://learn.arm.com/learning-paths/cross-platform/integer-vs-floats/integer-float-conversions/
		// 4. https://go.dev/ref/spec#Conversions
		// 5. https://github.com/golang/go/issues/45588
		if value > 0 && intVal < 0 {
			intVal = math.MaxInt64
		}

		return intVal, true
	}

	// can't be converted
	// not an exact integer
	return 0, false
}
