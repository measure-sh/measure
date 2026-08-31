package exprfilter

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// columnKeyBinding turns one condition into a boolean SQL expression against
// the given column expression. Overrides take this form instead of KeyBinding
// so the column always comes from the table's own column map, and one
// overrides map can be rebound against any table that has the key.
type columnKeyBinding func(column string, condition Condition) (*sqlf.Stmt, error)

// bindKeysToColumns builds a KeyBinding that compares each key against the
// column expression the mapping names for it, answering the full set of text
// operators. Which of them a key actually accepts is decided by the key's
// Operators list during validation, so a condition reaching the binding is
// already known to be allowed. overrides replaces the comparison for keys
// whose values cannot be compared against their column as they are, such as
// enum names a column stores as integer codes.
func bindKeysToColumns(columns map[string]string, overrides map[string]columnKeyBinding) KeyBinding {
	return func(condition Condition) (*sqlf.Stmt, error) {
		column, ok := columns[condition.KeyName]
		if !ok {
			return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
		}

		if override, overridden := overrides[condition.KeyName]; overridden {
			return override(column, condition)
		}

		switch condition.Operator {
		case OperatorIn:
			return sqlf.New(column+" in ?", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New(column+" not in ?", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New(column+" ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorNotContains:
			return sqlf.New(column+" not ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorStartsWith:
			return sqlf.New(column+" ilike ?", EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorEndsWith:
			return sqlf.New(column+" ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())), nil
		}

		return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
	}
}

// bindUUIDKey binds conditions for a UUID column. Empty values are stored as
// uuid.Nil; is_set and is_not_set compare against uuid.Nil.
func bindUUIDKey(column string, condition Condition) (*sqlf.Stmt, error) {
	switch condition.Operator {
	case OperatorIn, OperatorNotIn:
		bound := make([]uuid.UUID, 0, len(condition.Values))
		for _, text := range condition.TextValues() {
			id, err := uuid.Parse(text)
			if err != nil {
				return nil, fmt.Errorf("Key %q takes uuid values, got %q", condition.KeyName, text)
			}
			bound = append(bound, id)
		}
		if condition.Operator == OperatorNotIn {
			return sqlf.New(column+" not in ?", bound), nil
		}
		return sqlf.New(column+" in ?", bound), nil
	case OperatorIsSet:
		return sqlf.New(column+" <> ?", uuid.Nil), nil
	case OperatorIsNotSet:
		return sqlf.New(column+" = ?", uuid.Nil), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// bindEnumKeyToCodes builds the columnKeyBinding for an enum key whose column
// stores integer codes: each value name a condition carries is translated
// through the mapping before comparison, and a name outside it is refused.
func bindEnumKeyToCodes[Code int8 | uint8](codes map[string]Code) columnKeyBinding {
	return func(column string, condition Condition) (*sqlf.Stmt, error) {
		bound := make([]Code, 0, len(condition.Values))
		for _, name := range condition.TextValues() {
			code, ok := codes[name]
			if !ok {
				return nil, fmt.Errorf("Key %q has no value %q", condition.KeyName, name)
			}
			bound = append(bound, code)
		}

		switch condition.Operator {
		case OperatorIn:
			return sqlf.New(column+" in ?", bound), nil
		case OperatorNotIn:
			return sqlf.New(column+" not in ?", bound), nil
		}

		return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
	}
}
