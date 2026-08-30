package exprfilter

import (
	"fmt"
	"slices"
	"strings"

	"github.com/leporo/sqlf"
)

var comparisonSQL = map[Operator]string{
	OperatorEq:  "=",
	OperatorNeq: "!=",
	OperatorGt:  ">",
	OperatorGte: ">=",
	OperatorLt:  "<",
	OperatorLte: "<=",
}

// customConditionMatch describes which attribute rows satisfy a condition.
// For negated conditions, sql matches the offending rows and negated tells
// the caller to exclude their IDs.
type customConditionMatch struct {
	rawName string
	sql     string
	args    []any
	negated bool
}

// matchCustomCondition translates a custom-key condition into a row predicate.
// Values are stored as text, so numeric comparisons cast them to the key's type.
func matchCustomCondition(key Key, condition Condition) (customConditionMatch, error) {
	rawName := strings.TrimPrefix(key.Name, CustomKeyPrefix)
	storedType := string(key.ValueType)

	// An attribute rewritten under a new type keeps its old rows, so the
	// presence test matches on the key alone and ignores the type.
	presence := func(negated bool) (customConditionMatch, error) {
		return customConditionMatch{rawName: rawName, sql: "key = ?", args: []any{rawName}, negated: negated}, nil
	}
	// typed builds a predicate for a value-bearing condition, restricting rows
	// to the key's current stored type before applying the value comparison.
	typed := func(negated bool, valueComparison string, valueArgs ...any) (customConditionMatch, error) {
		return customConditionMatch{
			rawName: rawName,
			sql:     "key = ? and type = ?" + valueComparison,
			args:    append([]any{rawName, storedType}, valueArgs...),
			negated: negated,
		}, nil
	}

	switch condition.Operator {
	case OperatorIsSet:
		return presence(false)
	case OperatorIsNotSet:
		return presence(true)
	}

	switch key.ValueType {
	case ValueTypeString:
		switch condition.Operator {
		case OperatorIn:
			return typed(false, " and value in ?", condition.TextValues())
		case OperatorNotIn:
			return typed(true, " and value in ?", condition.TextValues())
		case OperatorContains:
			return typed(false, " and value ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%")
		case OperatorNotContains:
			return typed(true, " and value ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%")
		case OperatorStartsWith:
			return typed(false, " and value ilike ?", EscapeLikeWildcards(condition.TextValue())+"%")
		case OperatorEndsWith:
			return typed(false, " and value ilike ?", "%"+EscapeLikeWildcards(condition.TextValue()))
		}

	case ValueTypeInt64:
		if condition.Operator == OperatorNeq {
			number, err := condition.IntegerValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(true, " and toInt64OrNull(value) = ?", number)
		}
		if comparison, ok := comparisonSQL[condition.Operator]; ok {
			number, err := condition.IntegerValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(false, " and toInt64OrNull(value) "+comparison+" ?", number)
		}

	case ValueTypeFloat64:
		if condition.Operator == OperatorNeq {
			number, err := condition.FloatValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(true, " and toFloat64OrNull(value) = ?", number)
		}
		if comparison, ok := comparisonSQL[condition.Operator]; ok {
			number, err := condition.FloatValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(false, " and toFloat64OrNull(value) "+comparison+" ?", number)
		}

	case ValueTypeBool:
		if condition.Operator == OperatorEq {
			yes, err := condition.BoolValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			text := "false"
			if yes {
				text = "true"
			}
			return typed(false, " and value = ?", text)
		}
	}

	return customConditionMatch{}, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// customMembershipBinder holds the request-scoped context needed to build
// custom-key membership queries.
type customMembershipBinder struct {
	store      customKeyStore
	scope      CustomKeyScope
	keysByName map[string]Key
}

// customAttrScope limits attribute rows to the current team, app, and time range.
const customAttrScope = " where team_id = toUUID(?) and app_id = toUUID(?)" +
	" and timestamp >= ? and timestamp <= ?"

// scopeSQL is customAttrScope extended with the store's extra clause, so
// every membership subquery scans only the rows its entity owns.
func (b *customMembershipBinder) scopeSQL() string {
	if b.store.extraScope == "" {
		return customAttrScope
	}
	return customAttrScope + " and " + b.store.extraScope
}

// bindConditions creates a GroupKeyBinding for one request's conditions on
// the store's custom keys. Multiple conditions are evaluated with countIf
// over one grouped query instead of generating a separate subquery for each
// condition.
func (s customKeyStore) bindConditions(scope CustomKeyScope, keys []Key) GroupKeyBinding {
	binder := &customMembershipBinder{
		store:      s,
		scope:      scope,
		keysByName: IndexKeysByName(keys),
	}
	return binder.bind
}

// bind is the GroupKeyBinding for one request's custom keys.
func (b *customMembershipBinder) bind(operator LogicalOperator, conditions []Condition) (*sqlf.Stmt, error) {
	matches := make([]customConditionMatch, len(conditions))
	for i, condition := range conditions {
		key, found := b.keysByName[condition.KeyName]
		if !found {
			return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
		}
		match, err := matchCustomCondition(key, condition)
		if err != nil {
			return nil, err
		}
		matches[i] = match
	}

	if len(matches) == 1 {
		text, args := b.single(matches[0])
		return sqlf.New(text, args...), nil
	}
	if operator == LogicalAnd {
		return b.allOf(matches), nil
	}
	return b.anyOf(matches), nil
}

// allOf builds the membership query for AND conditions.
// Positive conditions require a matching row; negated conditions require
// zero matching (offending) rows.
func (b *customMembershipBinder) allOf(matches []customConditionMatch) *sqlf.Stmt {
	anyPositive := slices.ContainsFunc(matches, func(match customConditionMatch) bool {
		return !match.negated
	})

	if anyPositive {
		// With at least one positive condition, every matching ID must appear in the
		// grouped result. Negated conditions can therefore be expressed as zero
		// offending rows.
		having, havingArgs := countIfHaving(matches, " and ", func(match customConditionMatch) string {
			if match.negated {
				return " = 0"
			}
			return " > 0"
		})
		text, args := b.grouped("in", matches, having, havingArgs)
		return sqlf.New(text, args...)
	}

	// When every condition is negated, find IDs that violate any condition and
	// exclude them. IDs with no attribute rows never enter the subquery and
	// therefore remain matched.
	having, havingArgs := countIfHaving(matches, " or ", func(customConditionMatch) string {
		return " > 0"
	})
	text, args := b.grouped("not in", matches, having, havingArgs)
	return sqlf.New(text, args...)
}

// anyOf builds the membership query for OR conditions.
// Positive conditions can share a grouped query; negated conditions stay
// as separate NOT IN branches.
func (b *customMembershipBinder) anyOf(matches []customConditionMatch) *sqlf.Stmt {
	// Separate positive and negated conditions because they have different
	// membership semantics when combined with OR.
	positives := []customConditionMatch{}
	for _, match := range matches {
		if !match.negated {
			positives = append(positives, match)
		}
	}

	var text strings.Builder
	args := []any{}
	appendPart := func(partText string, partArgs []any) {
		if text.Len() > 0 {
			text.WriteString(" or ")
		}
		text.WriteString(partText)
		args = append(args, partArgs...)
	}

	// Multiple positive conditions can share one grouped query.
	if len(positives) >= 2 {
		having, havingArgs := countIfHaving(positives, " or ", func(customConditionMatch) string {
			return " > 0"
		})
		appendPart(b.grouped("in", positives, having, havingArgs))
	} else if len(positives) == 1 {
		// A single positive condition does not need GROUP BY/HAVING.
		appendPart(b.single(positives[0]))
	}

	// Keep negated conditions as NOT IN branches. A grouped attribute query
	// cannot represent IDs with no attribute rows, which must still satisfy
	// a negated condition.
	for _, match := range matches {
		if match.negated {
			appendPart(b.single(match))
		}
	}

	return sqlf.New(text.String(), args...)
}

// versionConditions writes the scope's version lists as subquery conditions to
// reduce the rows scanned.
func (b *customMembershipBinder) versionConditions() (string, []any) {
	var text strings.Builder
	args := []any{}
	for _, names := range b.scope.VersionNames {
		text.WriteString(" and tupleElement(app_version, 1) in ?")
		args = append(args, names)
	}
	for _, codes := range b.scope.VersionCodes {
		text.WriteString(" and tupleElement(app_version, 2) in ?")
		args = append(args, codes)
	}
	return text.String(), args
}

// single builds the membership query for one condition.
// Negated conditions use NOT IN so IDs without the attribute also match.
func (b *customMembershipBinder) single(match customConditionMatch) (string, []any) {
	operator := "in"
	if match.negated {
		operator = "not in"
	}
	versionSQL, versionArgs := b.versionConditions()
	text := b.store.idColumn + " " + operator + " (" +
		"select " + b.store.idColumn + " from " + b.store.table +
		b.scopeSQL() +
		versionSQL +
		" and " + match.sql +
		")"
	args := make([]any, 0, 4+len(versionArgs)+len(match.args))
	args = append(args, b.scope.TeamID, b.scope.AppID, b.scope.From, b.scope.To)
	args = append(args, versionArgs...)
	args = append(args, match.args...)
	return text, args
}

// grouped builds a membership query that evaluates multiple conditions in
// one grouped scan. The caller supplies the countIf-based HAVING expression.
func (b *customMembershipBinder) grouped(operator string, matches []customConditionMatch, having string, havingArgs []any) (string, []any) {
	rawNames := []string{}
	for _, match := range matches {
		if !slices.Contains(rawNames, match.rawName) {
			rawNames = append(rawNames, match.rawName)
		}
	}

	versionSQL, versionArgs := b.versionConditions()
	text := b.store.idColumn + " " + operator + " (" +
		"select " + b.store.idColumn + " from " + b.store.table +
		b.scopeSQL() +
		versionSQL +
		" and key in ?" +
		" group by " + b.store.idColumn +
		" having " + having +
		")"
	args := make([]any, 0, 5+len(versionArgs)+len(havingArgs))
	args = append(args, b.scope.TeamID, b.scope.AppID, b.scope.From, b.scope.To)
	args = append(args, versionArgs...)
	args = append(args, rawNames)
	args = append(args, havingArgs...)
	return text, args
}

// countIfHaving builds the HAVING expression from one countIf per condition.
// The suffix determines whether a condition requires matches (> 0) or no
// offending matches (= 0).
func countIfHaving(matches []customConditionMatch, joiner string, suffix func(customConditionMatch) string) (string, []any) {
	var having strings.Builder
	args := []any{}
	for i, match := range matches {
		if i > 0 {
			having.WriteString(joiner)
		}
		having.WriteString("countIf(")
		having.WriteString(match.sql)
		having.WriteString(")")
		having.WriteString(suffix(match))
		args = append(args, match.args...)
	}
	return having.String(), args
}
