package exprfilter

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

func TestCustomKeyMapping(t *testing.T) {
	tests := []struct {
		valueType      ValueType
		suggestionMode ValueSuggestionMode
		enumValues     []string
	}{
		{ValueTypeString, ValueSuggestionModeSample, nil},
		{ValueTypeInt64, ValueSuggestionModeNone, nil},
		{ValueTypeFloat64, ValueSuggestionModeNone, nil},
		{ValueTypeBool, ValueSuggestionModeFullList, []string{"true", "false"}},
	}

	for _, test := range tests {
		t.Run(string(test.valueType), func(t *testing.T) {
			key := CustomKey("is_premium", test.valueType)

			if key.Name != "custom.is_premium" {
				t.Errorf("want the name prefixed, got %q", key.Name)
			}
			if key.Label != "is_premium" {
				t.Errorf("want the label unprefixed, got %q", key.Label)
			}
			if key.Description == "" {
				t.Error("want a description for the picker to draw")
			}
			if key.KeyGroup != KeyGroupCustom {
				t.Errorf("want the Custom group, got %q", key.KeyGroup)
			}
			if key.ValueType != test.valueType {
				t.Errorf("want value type %q, got %q", test.valueType, key.ValueType)
			}
			for _, operator := range AllowedOperatorsFor(test.valueType) {
				if !slices.Contains(key.Operators, operator) {
					t.Errorf("want the full operator set of %q, missing %q", test.valueType, operator)
				}
			}
			for _, operator := range []Operator{OperatorIsSet, OperatorIsNotSet} {
				if !slices.Contains(key.Operators, operator) {
					t.Errorf("want the presence operator %q on every custom key", operator)
				}
			}
			seen := map[Operator]int{}
			for _, operator := range key.Operators {
				seen[operator]++
			}
			for operator, count := range seen {
				if count > 1 {
					t.Errorf("want operator %q offered once, got %d times", operator, count)
				}
			}
			if key.ValueSuggestionMode != test.suggestionMode {
				t.Errorf("want suggestion mode %q, got %q", test.suggestionMode, key.ValueSuggestionMode)
			}
			if !slices.Equal(key.EnumValues, test.enumValues) {
				t.Errorf("want enum values %v, got %v", test.enumValues, key.EnumValues)
			}
		})
	}
}

func TestCustomKeyGroupIsInTheOrderTheFilterBarShows(t *testing.T) {
	if !slices.Contains(keyGroupOrder, KeyGroupCustom) {
		t.Error("want the Custom group in keyGroupOrder")
	}
}

func TestCollectCustomKeyNames(t *testing.T) {
	t.Run("an empty tree mentions nothing", func(t *testing.T) {
		if got := collectCustomKeyNames(nil); len(got) != 0 {
			t.Errorf("want no names, got %v", got)
		}
	})

	t.Run("keys without the prefix stay out", func(t *testing.T) {
		got := collectCustomKeyNames(leafExprTree("version_name", OperatorIn, "1.2.0"))
		if len(got) != 0 {
			t.Errorf("want no names, got %v", got)
		}
	})

	t.Run("one condition yields its name unprefixed", func(t *testing.T) {
		got := collectCustomKeyNames(leafExprTree("custom.plan", OperatorIn, "pro"))
		if !slices.Equal(got, []string{"plan"}) {
			t.Errorf("want [plan], got %v", got)
		}
	})

	t.Run("nested groups yield every name once", func(t *testing.T) {
		exprTree := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("custom.plan", OperatorIn, "pro"),
			*leafExprTree("version_name", OperatorIn, "1.2.0"),
			{LogicalOperator: LogicalOr, Children: []ExprTree{
				*leafExprTree("custom.is_premium", OperatorEq, "true"),
				*leafExprTree("custom.plan", OperatorNotIn, "free"),
			}},
		}}

		got := collectCustomKeyNames(exprTree)
		if !slices.Equal(got, []string{"plan", "is_premium"}) {
			t.Errorf("want [plan is_premium] in first-mention order, got %v", got)
		}
	})

	t.Run("the prefix alone names nothing", func(t *testing.T) {
		if got := collectCustomKeyNames(leafExprTree("custom.", OperatorIsSet)); len(got) != 0 {
			t.Errorf("want no names, got %v", got)
		}
	})
}

func TestResolveCustomKeysBindsEveryMentionedKey(t *testing.T) {
	keys := []Key{CustomKey("plan", ValueTypeString), CustomKey("retries", ValueTypeInt64)}

	binderCalls := 0
	entity := Entity{
		Name: "stub",
		Keys: []Key{versionName},
		FetchCustomKeysByName: func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, rawNames []string) ([]Key, error) {
			if !slices.Equal(rawNames, []string{"plan", "retries"}) {
				t.Errorf("want the mentioned names fetched, got %v", rawNames)
			}
			return keys, nil
		},
		BindCustomKeys: func(scope CustomKeyScope, boundKeys []Key) GroupKeyBinding {
			names := make([]string, len(boundKeys))
			for i, key := range boundKeys {
				names[i] = key.Name
			}
			if !slices.Equal(names, []string{"custom.plan", "custom.retries"}) {
				t.Errorf("want every fetched key handed to the binder, got %v", names)
			}
			return func(operator LogicalOperator, conditions []Condition) (*sqlf.Stmt, error) {
				binderCalls++
				conditionNames := make([]string, len(conditions))
				for i, condition := range conditions {
					conditionNames[i] = condition.KeyName
				}
				return sqlf.New("bound ?", strings.Join(conditionNames, ",")), nil
			}
		},
	}

	ef := &ExprFilter{
		AppID:  uuid.New(),
		TeamID: uuid.New(),
		Entity: entity,
		ExprTree: &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("custom.plan", OperatorIn, "pro"),
			*leafExprTree("custom.retries", OperatorGt, "9"),
		}},
	}

	if err := ef.ResolveCustomKeys(context.Background(), nil); err != nil {
		t.Fatalf("ResolveCustomKeys: %v", err)
	}
	if ef.customBinder == nil {
		t.Fatal("want the group binder installed on the filter")
	}
	byName := IndexKeysByName(ef.Entity.Keys)
	for _, key := range keys {
		if _, found := byName[key.Name]; !found {
			t.Errorf("want %q added to the request's key set", key.Name)
		}
	}

	predicate, err := ef.Predicate(nil)
	if err != nil {
		t.Fatalf("Predicate: %v", err)
	}
	defer predicate.Close()
	if binderCalls != 1 {
		t.Errorf("want both conditions bound in one binder call, got %d calls", binderCalls)
	}
	if got := predicate.String(); got != "((bound ?))" {
		t.Errorf("want the binder's fragment as the group's one child, got %q", got)
	}
	if got := predicate.Args()[0]; got != "custom.plan,custom.retries" {
		t.Errorf("want both conditions in the one call, got %v", got)
	}
}

func TestResolveCustomKeysWithoutCustomKeysResolvesNothing(t *testing.T) {
	exprTree := leafExprTree("custom.plan", OperatorIn, "pro")
	ef := &ExprFilter{AppID: uuid.New(), TeamID: uuid.New(), Entity: BuildsEntity, ExprTree: exprTree}

	// A nil connection proves nothing is read: a query would panic on it.
	if err := ef.ResolveCustomKeys(context.Background(), nil); err != nil {
		t.Fatalf("ResolveCustomKeys: %v", err)
	}
	if _, err := ef.Entity.BindKey(Condition{KeyName: "custom.plan", Operator: OperatorIn, Values: []Value{{Text: "pro"}}}); err == nil {
		t.Error("want the entity's binding unchanged, still refusing the custom key")
	}
}

func TestFindKeyWithoutCustomKeysReportsACustomKeyNotFound(t *testing.T) {
	// A nil connection proves the lookup reads nothing: a query would panic
	// on it.
	key, found, err := BuildsEntity.FindKey(context.Background(), nil, uuid.New(), uuid.New(), "custom.plan")
	if err != nil {
		t.Fatalf("FindKey: %v", err)
	}
	if found {
		t.Errorf("want the key reported not found, got %+v", key)
	}
}

func customCondition(keyName string, operator Operator, texts ...string) Condition {
	values := make([]Value, len(texts))
	for i, text := range texts {
		values[i] = Value{Text: text}
	}
	return Condition{KeyName: keyName, Operator: operator, Values: values}
}

func testCustomKeyScope() CustomKeyScope {
	return CustomKeyScope{
		TeamID: uuid.New(),
		AppID:  uuid.New(),
		From:   time.Now().UTC().Add(-time.Hour),
		To:     time.Now().UTC(),
	}
}

// bindCustomGroup writes the SQL for one batch of custom-key conditions,
// failing the test on a binding error.
func bindCustomGroup(t *testing.T, keys []Key, operator LogicalOperator, conditions []Condition) (string, []any) {
	t.Helper()
	return bindCustomGroupInScope(t, testCustomKeyScope(), keys, operator, conditions)
}

func bindCustomGroupInScope(t *testing.T, scope CustomKeyScope, keys []Key, operator LogicalOperator, conditions []Condition) (string, []any) {
	t.Helper()

	binding := SpansEntity.BindCustomKeys(scope, keys)

	stmt, err := binding(operator, conditions)
	if err != nil {
		t.Fatalf("bind %v: %v", conditions, err)
	}
	defer stmt.Close()

	// Close recycles the statement's argument slice, so the caller gets a copy.
	return stmt.String(), slices.Clone(stmt.Args())
}

// bindCustom writes the SQL for one condition on a custom key of the given
// value type, failing the test on a binding error.
func bindCustom(t *testing.T, valueType ValueType, operator Operator, texts ...string) (string, []any) {
	t.Helper()

	key := CustomKey("plan", valueType)
	return bindCustomGroup(t, []Key{key}, LogicalAnd, []Condition{customCondition(key.Name, operator, texts...)})
}

const customSubqueryScope = "select span_id from span_user_def_attrs where team_id = toUUID(?) and app_id = toUUID(?) and timestamp >= ? and timestamp <= ? and key = ? and type = ?"

const customPresenceScope = "select span_id from span_user_def_attrs where team_id = toUUID(?) and app_id = toUUID(?) and timestamp >= ? and timestamp <= ? and key = ?"

const customGroupedScope = "select span_id from span_user_def_attrs where team_id = toUUID(?) and app_id = toUUID(?) and timestamp >= ? and timestamp <= ? and key in ? group by span_id having "

func TestBindSpanCustomKeyWritesAMembershipSubquery(t *testing.T) {
	tests := []struct {
		name      string
		valueType ValueType
		operator  Operator
		texts     []string
		want      string
		wantArgs  int
	}{
		{
			name: "string in", valueType: ValueTypeString, operator: OperatorIn, texts: []string{"pro", "free"},
			want:     "span_id in (" + customSubqueryScope + " and value in ?)",
			wantArgs: 7,
		},
		{
			name: "string not_in negates the membership", valueType: ValueTypeString, operator: OperatorNotIn, texts: []string{"pro"},
			want:     "span_id not in (" + customSubqueryScope + " and value in ?)",
			wantArgs: 7,
		},
		{
			name: "string contains", valueType: ValueTypeString, operator: OperatorContains, texts: []string{"pro"},
			want:     "span_id in (" + customSubqueryScope + " and value ilike ?)",
			wantArgs: 7,
		},
		{
			name: "string not_contains negates the membership", valueType: ValueTypeString, operator: OperatorNotContains, texts: []string{"pro"},
			want:     "span_id not in (" + customSubqueryScope + " and value ilike ?)",
			wantArgs: 7,
		},
		{
			name: "string starts_with", valueType: ValueTypeString, operator: OperatorStartsWith, texts: []string{"pro"},
			want:     "span_id in (" + customSubqueryScope + " and value ilike ?)",
			wantArgs: 7,
		},
		{
			name: "string ends_with", valueType: ValueTypeString, operator: OperatorEndsWith, texts: []string{"pro"},
			want:     "span_id in (" + customSubqueryScope + " and value ilike ?)",
			wantArgs: 7,
		},
		{
			name: "string is_set", valueType: ValueTypeString, operator: OperatorIsSet,
			want:     "span_id in (" + customPresenceScope + ")",
			wantArgs: 5,
		},
		{
			name: "string is_not_set", valueType: ValueTypeString, operator: OperatorIsNotSet,
			want:     "span_id not in (" + customPresenceScope + ")",
			wantArgs: 5,
		},
		{
			name: "int64 gt casts the value", valueType: ValueTypeInt64, operator: OperatorGt, texts: []string{"9"},
			want:     "span_id in (" + customSubqueryScope + " and toInt64OrNull(value) > ?)",
			wantArgs: 7,
		},
		{
			name: "int64 neq negates the membership", valueType: ValueTypeInt64, operator: OperatorNeq, texts: []string{"9"},
			want:     "span_id not in (" + customSubqueryScope + " and toInt64OrNull(value) = ?)",
			wantArgs: 7,
		},
		{
			name: "int64 is_not_set", valueType: ValueTypeInt64, operator: OperatorIsNotSet,
			want:     "span_id not in (" + customPresenceScope + ")",
			wantArgs: 5,
		},
		{
			name: "float64 lte casts the value", valueType: ValueTypeFloat64, operator: OperatorLte, texts: []string{"1.5"},
			want:     "span_id in (" + customSubqueryScope + " and toFloat64OrNull(value) <= ?)",
			wantArgs: 7,
		},
		{
			name: "bool eq", valueType: ValueTypeBool, operator: OperatorEq, texts: []string{"true"},
			want:     "span_id in (" + customSubqueryScope + " and value = ?)",
			wantArgs: 7,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, args := bindCustom(t, test.valueType, test.operator, test.texts...)
			if got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
			if len(args) != test.wantArgs {
				t.Errorf("want %d bound arguments, got %d: %v", test.wantArgs, len(args), args)
			}
		})
	}
}

func TestBindSpanCustomKeyBindsTheRawNameAndStoredType(t *testing.T) {
	_, args := bindCustom(t, ValueTypeInt64, OperatorGt, "9")

	if got := args[4]; got != "plan" {
		t.Errorf("want the attribute name bound without its prefix, got %v", got)
	}
	if got := args[5]; got != "int64" {
		t.Errorf("want the stored type name bound, got %v", got)
	}
	if got := args[6]; got != int64(9) {
		t.Errorf("want the value bound as a number, got %v (%T)", got, got)
	}
}

func TestBindSpanCustomKeyNormalizesABoolValue(t *testing.T) {
	_, args := bindCustom(t, ValueTypeBool, OperatorEq, "1")
	if got := args[6]; got != "true" {
		t.Errorf("want the stored spelling bound, got %v", got)
	}
}

func TestBindSpanCustomKeyEscapesLikeWildcards(t *testing.T) {
	_, args := bindCustom(t, ValueTypeString, OperatorContains, "100%_a")
	if got := args[6]; got != `%100\%\_a%` {
		t.Errorf("want the wildcards turned off, got %v", got)
	}
}

func TestBindSpanCustomKeyRefusesAnOperatorTheTypeDoesNotOffer(t *testing.T) {
	key := CustomKey("retries", ValueTypeInt64)
	binding := SpansEntity.BindCustomKeys(testCustomKeyScope(), []Key{key})

	_, err := binding(LogicalAnd, []Condition{customCondition(key.Name, OperatorContains, "9")})
	if err == nil {
		t.Fatal("want a text operator on a number key refused")
	}
	if !strings.Contains(err.Error(), "custom.retries") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestBindCustomGroupCollapsesSiblingsIntoOneScan(t *testing.T) {
	keys := []Key{
		CustomKey("plan", ValueTypeString),
		CustomKey("retries", ValueTypeInt64),
		CustomKey("coupon", ValueTypeString),
	}

	tests := []struct {
		name       string
		operator   LogicalOperator
		conditions []Condition
		want       string
		wantArgs   int
	}{
		{
			name:     "and of two positives",
			operator: LogicalAnd,
			conditions: []Condition{
				customCondition("custom.plan", OperatorIn, "pro"),
				customCondition("custom.retries", OperatorGt, "9"),
			},
			want:     "span_id in (" + customGroupedScope + "countIf(key = ? and type = ? and value in ?) > 0 and countIf(key = ? and type = ? and toInt64OrNull(value) > ?) > 0)",
			wantArgs: 11,
		},
		{
			name:     "and of a positive and a negative",
			operator: LogicalAnd,
			conditions: []Condition{
				customCondition("custom.plan", OperatorIn, "pro"),
				customCondition("custom.coupon", OperatorNotIn, "WELCOME"),
			},
			want:     "span_id in (" + customGroupedScope + "countIf(key = ? and type = ? and value in ?) > 0 and countIf(key = ? and type = ? and value in ?) = 0)",
			wantArgs: 11,
		},
		{
			name:     "and of a positive and is_not_set drops the type from the presence term",
			operator: LogicalAnd,
			conditions: []Condition{
				customCondition("custom.plan", OperatorIn, "pro"),
				customCondition("custom.coupon", OperatorIsNotSet),
			},
			want:     "span_id in (" + customGroupedScope + "countIf(key = ? and type = ? and value in ?) > 0 and countIf(key = ?) = 0)",
			wantArgs: 9,
		},
		{
			name:     "and of negatives only excludes the ids with an offending row",
			operator: LogicalAnd,
			conditions: []Condition{
				customCondition("custom.plan", OperatorNotIn, "pro"),
				customCondition("custom.coupon", OperatorIsNotSet),
			},
			want:     "span_id not in (" + customGroupedScope + "countIf(key = ? and type = ? and value in ?) > 0 or countIf(key = ?) > 0)",
			wantArgs: 9,
		},
		{
			name:     "or of two positives",
			operator: LogicalOr,
			conditions: []Condition{
				customCondition("custom.plan", OperatorIn, "pro"),
				customCondition("custom.retries", OperatorGt, "9"),
			},
			want:     "span_id in (" + customGroupedScope + "countIf(key = ? and type = ? and value in ?) > 0 or countIf(key = ? and type = ? and toInt64OrNull(value) > ?) > 0)",
			wantArgs: 11,
		},
		{
			name:     "or with a negative keeps the negative's own subquery",
			operator: LogicalOr,
			conditions: []Condition{
				customCondition("custom.plan", OperatorIn, "pro"),
				customCondition("custom.coupon", OperatorIsNotSet),
			},
			want:     "span_id in (" + customSubqueryScope + " and value in ?) or span_id not in (" + customPresenceScope + ")",
			wantArgs: 12,
		},
		{
			name:     "or of two positives and a negative joins the shared scan to the negative's subquery",
			operator: LogicalOr,
			conditions: []Condition{
				customCondition("custom.plan", OperatorIn, "pro"),
				customCondition("custom.retries", OperatorGt, "9"),
				customCondition("custom.coupon", OperatorIsNotSet),
			},
			want:     "span_id in (" + customGroupedScope + "countIf(key = ? and type = ? and value in ?) > 0 or countIf(key = ? and type = ? and toInt64OrNull(value) > ?) > 0) or span_id not in (" + customPresenceScope + ")",
			wantArgs: 16,
		},
		{
			name:     "the same key twice makes two independent terms",
			operator: LogicalAnd,
			conditions: []Condition{
				customCondition("custom.retries", OperatorGt, "5"),
				customCondition("custom.retries", OperatorLt, "10"),
			},
			want:     "span_id in (" + customGroupedScope + "countIf(key = ? and type = ? and toInt64OrNull(value) > ?) > 0 and countIf(key = ? and type = ? and toInt64OrNull(value) < ?) > 0)",
			wantArgs: 11,
		},
		{
			name:       "a lone condition compares its rows directly",
			operator:   LogicalAnd,
			conditions: []Condition{customCondition("custom.plan", OperatorIn, "pro")},
			want:       "span_id in (" + customSubqueryScope + " and value in ?)",
			wantArgs:   7,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, args := bindCustomGroup(t, keys, test.operator, test.conditions)
			if got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
			if len(args) != test.wantArgs {
				t.Errorf("want %d bound arguments, got %d: %v", test.wantArgs, len(args), args)
			}
		})
	}
}

func TestBindCustomGroupBindsScopeThenKeysThenTerms(t *testing.T) {
	keys := []Key{CustomKey("plan", ValueTypeString), CustomKey("retries", ValueTypeInt64)}
	_, args := bindCustomGroup(t, keys, LogicalAnd, []Condition{
		customCondition("custom.plan", OperatorIn, "pro"),
		customCondition("custom.retries", OperatorGt, "9"),
	})

	rawNames, ok := args[4].([]string)
	if !ok || !slices.Equal(rawNames, []string{"plan", "retries"}) {
		t.Errorf("want the raw key names bound after the scope, got %v", args[4])
	}
	if args[5] != "plan" || args[6] != "string" {
		t.Errorf("want the first term's key and type next, got %v %v", args[5], args[6])
	}
	if values, ok := args[7].([]string); !ok || !slices.Equal(values, []string{"pro"}) {
		t.Errorf("want the first term's values next, got %v", args[7])
	}
	if args[8] != "retries" || args[9] != "int64" || args[10] != int64(9) {
		t.Errorf("want the second term's arguments last, got %v %v %v", args[8], args[9], args[10])
	}
}

func TestBindCustomGroupDedupesTheKeyList(t *testing.T) {
	keys := []Key{CustomKey("retries", ValueTypeInt64)}
	_, args := bindCustomGroup(t, keys, LogicalAnd, []Condition{
		customCondition("custom.retries", OperatorGt, "5"),
		customCondition("custom.retries", OperatorLt, "10"),
	})

	rawNames, ok := args[4].([]string)
	if !ok || !slices.Equal(rawNames, []string{"retries"}) {
		t.Errorf("want the key bound once, got %v", args[4])
	}
}

func TestCollectRootVersionConditions(t *testing.T) {
	assertLists := func(t *testing.T, label string, got, want [][]string) {
		t.Helper()
		if !slices.EqualFunc(got, want, slices.Equal) {
			t.Errorf("want %s %v, got %v", label, want, got)
		}
	}

	t.Run("a root leaf's in-list", func(t *testing.T) {
		names, codes := collectRootVersionConditions(leafExprTree("version_name", OperatorIn, "v1", "v2"))
		assertLists(t, "names", names, [][]string{{"v1", "v2"}})
		assertLists(t, "codes", codes, nil)
	})

	t.Run("direct children of a root and-group", func(t *testing.T) {
		names, codes := collectRootVersionConditions(&ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("version_name", OperatorIn, "v1"),
			*leafExprTree("custom.plan", OperatorIn, "pro"),
			*leafExprTree("version_code", OperatorIn, "7"),
		}})
		assertLists(t, "names", names, [][]string{{"v1"}})
		assertLists(t, "codes", codes, [][]string{{"7"}})
	})

	t.Run("each condition keeps its own list", func(t *testing.T) {
		names, _ := collectRootVersionConditions(&ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("version_name", OperatorIn, "v1"),
			*leafExprTree("version_name", OperatorIn, "v2", "v3"),
		}})
		assertLists(t, "names", names, [][]string{{"v1"}, {"v2", "v3"}})
	})

	t.Run("an or root bounds nothing", func(t *testing.T) {
		names, codes := collectRootVersionConditions(&ExprTree{LogicalOperator: LogicalOr, Children: []ExprTree{
			*leafExprTree("version_name", OperatorIn, "v1"),
			*leafExprTree("custom.plan", OperatorIn, "pro"),
		}})
		assertLists(t, "names", names, nil)
		assertLists(t, "codes", codes, nil)
	})

	t.Run("not_in bounds nothing", func(t *testing.T) {
		names, _ := collectRootVersionConditions(leafExprTree("version_name", OperatorNotIn, "v1"))
		assertLists(t, "names", names, nil)
	})

	t.Run("contains bounds nothing", func(t *testing.T) {
		names, _ := collectRootVersionConditions(leafExprTree("version_name", OperatorContains, "v"))
		assertLists(t, "names", names, nil)
	})

	t.Run("a nested group's condition is not collected", func(t *testing.T) {
		names, _ := collectRootVersionConditions(&ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("custom.plan", OperatorIn, "pro"),
			{LogicalOperator: LogicalOr, Children: []ExprTree{
				*leafExprTree("version_name", OperatorIn, "v1"),
				*leafExprTree("custom.retries", OperatorGt, "9"),
			}},
		}})
		assertLists(t, "names", names, nil)
	})

	t.Run("an empty tree", func(t *testing.T) {
		names, codes := collectRootVersionConditions(nil)
		assertLists(t, "names", names, nil)
		assertLists(t, "codes", codes, nil)
	})
}

func TestBindCustomGroupAppendsRootVersionConditionsToTheScan(t *testing.T) {
	keys := []Key{CustomKey("plan", ValueTypeString), CustomKey("retries", ValueTypeInt64)}
	twoConditions := []Condition{
		customCondition("custom.plan", OperatorIn, "pro"),
		customCondition("custom.retries", OperatorGt, "9"),
	}

	const scan = "select span_id from span_user_def_attrs where team_id = toUUID(?) and app_id = toUUID(?) and timestamp >= ? and timestamp <= ?"
	const havingTwo = " group by span_id having countIf(key = ? and type = ? and value in ?) > 0 and countIf(key = ? and type = ? and toInt64OrNull(value) > ?) > 0"

	tests := []struct {
		name         string
		versionNames [][]string
		versionCodes [][]string
		conditions   []Condition
		want         string
		wantArgs     int
	}{
		{
			name:         "version names narrow a grouped scan",
			versionNames: [][]string{{"v1"}},
			conditions:   twoConditions,
			want:         "span_id in (" + scan + " and tupleElement(app_version, 1) in ? and key in ?" + havingTwo + ")",
			wantArgs:     12,
		},
		{
			name:         "version names narrow a lone condition's scan",
			versionNames: [][]string{{"v1"}},
			conditions:   []Condition{customCondition("custom.plan", OperatorIn, "pro")},
			want:         "span_id in (" + scan + " and tupleElement(app_version, 1) in ? and key = ? and type = ? and value in ?)",
			wantArgs:     8,
		},
		{
			name:         "version codes push independently",
			versionCodes: [][]string{{"7"}},
			conditions:   twoConditions,
			want:         "span_id in (" + scan + " and tupleElement(app_version, 2) in ? and key in ?" + havingTwo + ")",
			wantArgs:     12,
		},
		{
			name:         "names and codes push together",
			versionNames: [][]string{{"v1"}},
			versionCodes: [][]string{{"7"}},
			conditions:   twoConditions,
			want:         "span_id in (" + scan + " and tupleElement(app_version, 1) in ? and tupleElement(app_version, 2) in ? and key in ?" + havingTwo + ")",
			wantArgs:     13,
		},
		{
			name:         "each condition keeps its own clause",
			versionNames: [][]string{{"v1"}, {"v2", "v3"}},
			conditions:   twoConditions,
			want:         "span_id in (" + scan + " and tupleElement(app_version, 1) in ? and tupleElement(app_version, 1) in ? and key in ?" + havingTwo + ")",
			wantArgs:     13,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			scope := testCustomKeyScope()
			scope.VersionNames = test.versionNames
			scope.VersionCodes = test.versionCodes

			got, args := bindCustomGroupInScope(t, scope, keys, LogicalAnd, test.conditions)
			if got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
			if len(args) != test.wantArgs {
				t.Errorf("want %d bound arguments, got %d: %v", test.wantArgs, len(args), args)
			}
		})
	}
}

func TestBindCustomGroupBindsVersionArgsAfterTheTimeRange(t *testing.T) {
	scope := testCustomKeyScope()
	scope.VersionNames = [][]string{{"v1"}}
	scope.VersionCodes = [][]string{{"7"}}
	keys := []Key{CustomKey("plan", ValueTypeString), CustomKey("retries", ValueTypeInt64)}

	_, args := bindCustomGroupInScope(t, scope, keys, LogicalAnd, []Condition{
		customCondition("custom.plan", OperatorIn, "pro"),
		customCondition("custom.retries", OperatorGt, "9"),
	})

	if names, ok := args[4].([]string); !ok || !slices.Equal(names, []string{"v1"}) {
		t.Errorf("want the version names after the time range, got %v", args[4])
	}
	if codes, ok := args[5].([]string); !ok || !slices.Equal(codes, []string{"7"}) {
		t.Errorf("want the version codes next, got %v", args[5])
	}
	if rawNames, ok := args[6].([]string); !ok || !slices.Equal(rawNames, []string{"plan", "retries"}) {
		t.Errorf("want the key list after the version clauses, got %v", args[6])
	}
	if len(args) != 13 || args[7] != "plan" {
		t.Errorf("want the having terms last in %d arguments, got %v", 13, args)
	}
}
