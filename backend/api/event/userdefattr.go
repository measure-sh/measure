package event

import (
	"encoding/json"
	"errors"
	"fmt"
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
const attrKeyPattern = "^[a-z0-9_-]+$"

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
	fmt.Println("comparisons", comparisons)
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
		stmt.Where("(")
		for i, andExpr := range u.And {
			if i > 0 {
				stmt.Where("and")
			}
			andExpr.Augment(stmt)
		}
		stmt.Where(")")
	} else if u.HasOr() {
		stmt.Where("(")
		for i, orExpr := range u.Or {
			if i > 0 {
				stmt.Where("or")
			}
			orExpr.Augment(stmt)
		}
		stmt.Where(")")
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

// Augment augments the sql statement with fully
// qualified sql expressions.
func (c *UDComparison) Augment(stmt *sqlf.Stmt) {
	if c.Empty() {
		fmt.Printf("warning: not augmenting user defined comparison to statement %q because comparison expression is empty", stmt.String())
		return
	}

	opSymbol := c.Op.Sql()

	// TODO: Figure out type casting of non-string values
	// TODO: Figure out escaping % characters for `ilike` operator
	switch c.Op {
	case OpEq, OpNeq, OpGt, OpGte, OpLt, OpLte:
		stmt.Where(fmt.Sprintf("key = ? and type = ? and value %s ?", opSymbol), c.Key, c.Type.String(), c.Value)
	case OpContains:
		stmt.Where(fmt.Sprintf("key = ? and type = ? and value %s %%?%%", opSymbol), c.Key, c.Type.String(), c.Value)
	case OpStartsWith:
		stmt.Where(fmt.Sprintf("key = ? and type = ? and value %s ?%%", opSymbol), c.Key, c.Type.String(), c.Value)
	}
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
// attributes.
//
// User Defined Attributes are used in
// various entities like event or span.
type UDAttribute struct {
	rawAttrs map[string]any
	keyTypes map[string]AttrType
}

// MarshalJSON marshals UDAttribute type of user
// defined attributes to JSON.
func (u UDAttribute) MarshalJSON() (data []byte, err error) {
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
			return fmt.Errorf("user defined attribute keys must only contain lowercase alphabets, numbers, hyphens and underscores")
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
				if v == float64(int(value)) {
					u.keyTypes[k] = AttrInt64
				} else {
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

func (u *UDAttribute) Parameterize() (attr map[string]any) {
	attr = map[string]any{}

	val := ""

	for k, v := range u.rawAttrs {
		switch v := v.(type) {
		case bool:
			val = strconv.FormatBool(v)
		case float64:
			val = strconv.FormatFloat(v, 'g', -1, 64)
		case int64:
			val = strconv.FormatInt(v, 10)
		case string:
			val = v
		}

		attr[k] = fmt.Sprintf("('%s', '%s')", u.keyTypes[k].String(), val)
	}

	return
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
