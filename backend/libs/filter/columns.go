package filter

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

var ErrKeyNotSupported = errors.New("Key not supported by this query")

type columnKind int

const (
	columnText columnKind = iota // zero value, so a literal {expr: "x"} is a text column
	columnUUID
	columnTextArray
	columnUUIDArray
	columnEnumCodes
	columnPredicates
)

// column says how one key reads on one table.
type column struct {
	expr string
	kind columnKind

	// The integer the column stores each value name as.
	codes map[string]int

	// The boolean SQL each value name stands for, when the key has no column
	// of its own.
	predicates map[string]string
}

// The zero value is no dialect, so every column set names the one it is
// written for.
type dialect int

const (
	_ dialect = iota
	dialectClickHouse
	dialectPostgres
)

var listSyntax = map[dialect]struct{ in, notIn string }{
	dialectClickHouse: {in: " in ?", notIn: " not in ?"},
	dialectPostgres:   {in: " = any(?)", notIn: " <> all(?)"},
}

// Casts a uuid column to text; the column expression replaces %s.
var uuidAsText = map[dialect]string{
	dialectClickHouse: "toString(%s)",
	dialectPostgres:   "%s::text",
}

// Columns is how an entity's keys read on one table.
type Columns struct {
	dialect dialect
	byKey   map[string]column
}

// bindColumn turns one condition into a boolean SQL expression with the
// values to bind.
func bindColumn(columns *Columns, condition Condition) (*sqlf.Stmt, error) {
	col, ok := columns.byKey[condition.KeyName]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
	}

	switch col.kind {
	case columnText:
		return bindTextColumn(columns.dialect, col, condition)
	case columnUUID:
		switch columns.dialect {
		case dialectClickHouse:
			return bindClickHouseUUIDColumn(col, condition)
		case dialectPostgres:
			return bindPostgresUUIDColumn(col, condition)
		}
	case columnTextArray:
		return bindTextArrayColumn(col, condition)
	case columnUUIDArray:
		return bindUUIDArrayColumn(col, condition)
	case columnEnumCodes:
		return bindEnumCodesColumn(columns.dialect, col, condition)
	case columnPredicates:
		return bindPredicatesColumn(col, condition)
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// Every text operator is answered here; which of them a key offers was
// checked during validation.
func bindTextColumn(dialect dialect, col column, condition Condition) (*sqlf.Stmt, error) {
	switch condition.Operator {
	case OperatorIn:
		return sqlf.New(col.expr+listSyntax[dialect].in, condition.TextValues()), nil
	case OperatorNotIn:
		return sqlf.New(col.expr+listSyntax[dialect].notIn, condition.TextValues()), nil
	case OperatorContains:
		return sqlf.New(col.expr+" ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
	case OperatorNotContains:
		return sqlf.New(col.expr+" not ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
	case OperatorStartsWith:
		return sqlf.New(col.expr+" ilike ?", EscapeLikeWildcards(condition.TextValue())+"%"), nil
	case OperatorEndsWith:
		return sqlf.New(col.expr+" ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

func parseUUIDValues(condition Condition) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, 0, len(condition.Values))
	for _, text := range condition.TextValues() {
		id, err := uuid.Parse(text)
		if err != nil {
			return nil, fmt.Errorf("Key %q takes uuid values, got %q", condition.KeyName, text)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// An unset uuid column holds the nil uuid.
func bindClickHouseUUIDColumn(col column, condition Condition) (*sqlf.Stmt, error) {
	switch condition.Operator {
	case OperatorIn:
		ids, err := parseUUIDValues(condition)
		if err != nil {
			return nil, err
		}
		return sqlf.New(col.expr+listSyntax[dialectClickHouse].in, ids), nil
	case OperatorNotIn:
		ids, err := parseUUIDValues(condition)
		if err != nil {
			return nil, err
		}
		return sqlf.New(col.expr+listSyntax[dialectClickHouse].notIn, ids), nil
	case OperatorIsSet:
		return sqlf.New(col.expr+" <> ?", uuid.Nil), nil
	case OperatorIsNotSet:
		return sqlf.New(col.expr+" = ?", uuid.Nil), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// The Postgres driver runs in the simple protocol and cannot bind a slice of
// uuids, so the column is compared as text against the uuids in canonical
// form. An unset uuid column holds the nil uuid.
func bindPostgresUUIDColumn(col column, condition Condition) (*sqlf.Stmt, error) {
	expr := fmt.Sprintf(uuidAsText[dialectPostgres], col.expr)
	switch condition.Operator {
	case OperatorIn, OperatorNotIn:
		ids, err := parseUUIDValues(condition)
		if err != nil {
			return nil, err
		}
		texts := make([]string, len(ids))
		for i, id := range ids {
			texts[i] = id.String()
		}
		if condition.Operator == OperatorNotIn {
			return sqlf.New(expr+listSyntax[dialectPostgres].notIn, texts), nil
		}
		return sqlf.New(expr+listSyntax[dialectPostgres].in, texts), nil
	case OperatorIsSet:
		return sqlf.New(expr+" <> ?", uuid.Nil.String()), nil
	case OperatorIsNotSet:
		return sqlf.New(expr+" = ?", uuid.Nil.String()), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

func bindTextArrayColumn(col column, condition Condition) (*sqlf.Stmt, error) {
	switch condition.Operator {
	case OperatorIn:
		return sqlf.New("hasAny("+col.expr+", ?)", condition.TextValues()), nil
	case OperatorNotIn:
		return sqlf.New("not hasAny("+col.expr+", ?)", condition.TextValues()), nil
	}

	text := EscapeLikeWildcards(condition.TextValue())
	var pattern string
	switch condition.Operator {
	case OperatorContains, OperatorNotContains:
		pattern = "%" + text + "%"
	case OperatorStartsWith:
		pattern = text + "%"
	case OperatorEndsWith:
		pattern = "%" + text
	default:
		return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
	}

	anyMatch := "arrayExists(value -> value ilike ?, " + col.expr + ")"
	if condition.Operator == OperatorNotContains {
		return sqlf.New("not "+anyMatch, pattern), nil
	}
	return sqlf.New(anyMatch, pattern), nil
}

// Bound uuids arrive as text, so they are cast before the array functions
// compare them.
func bindUUIDArrayColumn(col column, condition Condition) (*sqlf.Stmt, error) {
	switch condition.Operator {
	case OperatorIn, OperatorNotIn:
		ids, err := parseUUIDValues(condition)
		if err != nil {
			return nil, err
		}
		if condition.Operator == OperatorNotIn {
			return sqlf.New("not hasAny("+col.expr+", cast(?, 'Array(UUID)'))", ids), nil
		}
		return sqlf.New("hasAny("+col.expr+", cast(?, 'Array(UUID)'))", ids), nil
	case OperatorIsSet:
		return sqlf.New("arrayExists(value -> value <> toUUID(?), "+col.expr+")", uuid.Nil), nil
	case OperatorIsNotSet:
		return sqlf.New("has("+col.expr+", toUUID(?))", uuid.Nil), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

func bindEnumCodesColumn(dialect dialect, col column, condition Condition) (*sqlf.Stmt, error) {
	bound := make([]int, 0, len(condition.Values))
	for _, name := range condition.TextValues() {
		code, ok := col.codes[name]
		if !ok {
			return nil, fmt.Errorf("Key %q has no value %q", condition.KeyName, name)
		}
		bound = append(bound, code)
	}

	switch condition.Operator {
	case OperatorIn:
		return sqlf.New(col.expr+listSyntax[dialect].in, bound), nil
	case OperatorNotIn:
		return sqlf.New(col.expr+listSyntax[dialect].notIn, bound), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

func bindPredicatesColumn(col column, condition Condition) (*sqlf.Stmt, error) {
	names := condition.TextValues()
	exprs := make([]string, 0, len(names))
	for _, name := range names {
		predicate, ok := col.predicates[name]
		if !ok {
			return nil, fmt.Errorf("Key %q has no value %q", condition.KeyName, name)
		}
		exprs = append(exprs, predicate)
	}

	anyMatch := "(" + strings.Join(exprs, " or ") + ")"
	switch condition.Operator {
	case OperatorIn, OperatorEq:
		return sqlf.New(anyMatch), nil
	case OperatorNotIn:
		return sqlf.New("not " + anyMatch), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}
