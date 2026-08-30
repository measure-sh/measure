package exprfilter

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// A custom key is a user-defined attribute the app reported, offered as a
// filter key.

// CustomKeyPrefix marks a filter key as a user-defined attribute. The part
// after the prefix is the attribute name as the app reported it.
const CustomKeyPrefix = "custom."

// CustomKeyLimit caps how many user-defined attribute keys a key listing
// returns.
const CustomKeyLimit = 500

var customValueTypes = map[string]ValueType{
	string(ValueTypeString):  ValueTypeString,
	string(ValueTypeInt64):   ValueTypeInt64,
	string(ValueTypeFloat64): ValueTypeFloat64,
	string(ValueTypeBool):    ValueTypeBool,
}

// CustomKey is the filter key for one user-defined attribute.
func CustomKey(rawName string, valueType ValueType) Key {
	// Whether the attribute was set at all is independent of the value's
	// type, so every custom key offers the presence operators on top of its
	// type's own set.
	operators := slices.Clone(AllowedOperatorsFor(valueType))
	for _, operator := range []Operator{OperatorIsSet, OperatorIsNotSet} {
		if !slices.Contains(operators, operator) {
			operators = append(operators, operator)
		}
	}

	key := Key{
		Name:                CustomKeyPrefix + rawName,
		Label:               rawName,
		Description:         fmt.Sprintf("The user-defined attribute %q, set by the app.", rawName),
		KeyGroup:            KeyGroupCustom,
		ValueType:           valueType,
		Operators:           operators,
		ValueSuggestionMode: ValueSuggestionModeNone,
	}

	switch valueType {
	case ValueTypeString:
		key.ValueSuggestionMode = ValueSuggestionModeSample
	case ValueTypeBool:
		key.ValueSuggestionMode = ValueSuggestionModeFullList
		key.EnumValues = []string{"true", "false"}
	}

	return key
}

// FetchCustomKeys lists the keys an app's user-defined attributes add to the
// entity's fixed set, reporting whether the listing was cut off at limit.
func (e Entity) FetchCustomKeys(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, limit int) ([]Key, bool, error) {
	if e.CustomKeys == nil {
		return nil, false, nil
	}
	return e.CustomKeys.fetchKeys(ctx, pgPool, chPool, teamID, appID, limit)
}

// FetchCustomKeysByName reads the entity's custom keys with the given names,
// each name without the custom prefix. A name not present in user-defined
// attributes yields no key.
func (e Entity) FetchCustomKeysByName(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, rawNames []string) ([]Key, error) {
	if e.CustomKeys == nil {
		return nil, nil
	}
	return e.CustomKeys.fetchKeysByName(ctx, pgPool, chPool, teamID, appID, rawNames)
}

// BindCustomKeys builds the GroupKeyBinding for the given custom keys.
func (e Entity) BindCustomKeys(scope CustomKeyScope, keys []Key) GroupKeyBinding {
	if e.CustomKeys == nil {
		return nil
	}
	return e.CustomKeys.bindConditions(scope, keys)
}

// ListKeys returns the entity's fixed keys followed by the app's custom
// keys, reporting whether the custom set was cut off at CustomKeyLimit. Any
// names the caller passes that carry the custom prefix and did not make the
// listing are resolved by name and appended.
func (e Entity) ListKeys(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, names []string) ([]Key, bool, error) {
	return e.listKeys(ctx, pgPool, chPool, teamID, appID, names, CustomKeyLimit)
}

// listKeys is ListKeys with the custom-key listing cap as a parameter. The
// fixed Keys slice is package-level state, so the merge reallocates to leave
// it untouched.
func (e Entity) listKeys(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, names []string, limit int) ([]Key, bool, error) {
	if e.CustomKeys == nil {
		return e.Keys, false, nil
	}

	customKeys, truncated, err := e.CustomKeys.fetchKeys(ctx, pgPool, chPool, teamID, appID, limit)
	if err != nil {
		return nil, false, err
	}

	keys := append(slices.Clip(e.Keys), customKeys...)

	listed := IndexKeysByName(keys)
	missingRawNames := []string{}
	for _, name := range names {
		rawName, isCustom := strings.CutPrefix(name, CustomKeyPrefix)
		if !isCustom {
			continue
		}
		if _, found := listed[name]; found {
			continue
		}
		if !slices.Contains(missingRawNames, rawName) {
			missingRawNames = append(missingRawNames, rawName)
		}
	}
	if len(missingRawNames) > 0 {
		namedKeys, err := e.CustomKeys.fetchKeysByName(ctx, pgPool, chPool, teamID, appID, missingRawNames)
		if err != nil {
			return nil, false, err
		}
		keys = append(keys, namedKeys...)
	}

	return keys, truncated, nil
}

// FindKey resolves one key name to the entity's key definition, fixed or
// custom.
func (e Entity) FindKey(ctx context.Context, ch driver.Conn, teamID, appID uuid.UUID, name string) (Key, bool, error) {
	if key, found := IndexKeysByName(e.Keys)[name]; found {
		return key, true, nil
	}

	rawName, isCustom := strings.CutPrefix(name, CustomKeyPrefix)
	if !isCustom || e.CustomKeys == nil {
		return Key{}, false, nil
	}

	customKeys, err := e.CustomKeys.fetchKeysByName(ctx, nil, ch, teamID, appID, []string{rawName})
	if err != nil {
		return Key{}, false, err
	}
	if len(customKeys) != 1 {
		return Key{}, false, nil
	}
	return customKeys[0], true, nil
}

// collectCustomKeyNames lists the user-defined attribute names a filter tree
// mentions, without their prefix, each name once.
func collectCustomKeyNames(exprTree *ExprTree) []string {
	if exprTree == nil {
		return nil
	}

	seen := map[string]bool{}
	rawNames := []string{}

	var walk func(node *ExprTree)
	walk = func(node *ExprTree) {
		if node.Condition != nil {
			rawName, isCustom := strings.CutPrefix(node.Condition.KeyName, CustomKeyPrefix)
			if isCustom && rawName != "" && !seen[rawName] {
				seen[rawName] = true
				rawNames = append(rawNames, rawName)
			}
			return
		}
		for i := range node.Children {
			walk(&node.Children[i])
		}
	}
	walk(exprTree)

	return rawNames
}

// Only a condition at the root or a direct child of a root and-group bounds
// every matching row; or-groups, negation, and text matching do not.
func collectRootVersionConditions(exprTree *ExprTree) (versionNames, versionCodes [][]string) {
	if exprTree == nil {
		return nil, nil
	}

	rootConditions := []*Condition{}
	if exprTree.Condition != nil {
		rootConditions = append(rootConditions, exprTree.Condition)
	} else if exprTree.LogicalOperator == LogicalAnd {
		for i := range exprTree.Children {
			if child := &exprTree.Children[i]; child.Condition != nil {
				rootConditions = append(rootConditions, child.Condition)
			}
		}
	}

	for _, condition := range rootConditions {
		if condition.Operator != OperatorIn {
			continue
		}
		switch condition.KeyName {
		case versionName.Name:
			versionNames = append(versionNames, condition.TextValues())
		case versionCode.Name:
			versionCodes = append(versionCodes, condition.TextValues())
		}
	}

	return versionNames, versionCodes
}

// ResolveCustomKeys reads the custom keys in the filter expression,
// extends this request's copy of the entity with them for validation, and
// installs the group binder Predicate routes their conditions to. Keys not
// reported by the app are left out so validation reports them as unknown.
func (ef *ExprFilter) ResolveCustomKeys(ctx context.Context, chPool driver.Conn) error {
	rawNames := collectCustomKeyNames(ef.ExprTree)
	if len(rawNames) == 0 {
		return nil
	}

	if ef.Entity.CustomKeys == nil {
		return nil
	}

	keys, err := ef.Entity.CustomKeys.fetchKeysByName(ctx, nil, chPool, ef.TeamID, ef.AppID, rawNames)
	if err != nil {
		return err
	}

	// The entity is this request's own copy, but its Keys slice still shares
	// the package-level array, so the append must reallocate to leave that
	// array untouched.
	ef.Entity.Keys = append(slices.Clip(ef.Entity.Keys), keys...)

	versionNames, versionCodes := collectRootVersionConditions(ef.ExprTree)
	ef.customBinder = ef.Entity.CustomKeys.bindConditions(CustomKeyScope{
		TeamID:       ef.TeamID,
		AppID:        ef.AppID,
		From:         ef.From,
		To:           ef.To.Add(ef.Entity.MaxTimeBucketWidth),
		VersionNames: versionNames,
		VersionCodes: versionCodes,
	}, keys)
	return nil
}
