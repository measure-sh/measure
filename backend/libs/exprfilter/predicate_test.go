package exprfilter

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

var testEntity = Entity{
	Name: "test",
	Keys: []Key{
		{Name: "version_name", ValueType: ValueTypeString, Operators: AllowedOperatorsFor(ValueTypeString), ValueSuggestionMode: ValueSuggestionModeSample},
		{Name: "patch_id", ValueType: ValueTypeUUID, Operators: AllowedOperatorsFor(ValueTypeUUID), ValueSuggestionMode: ValueSuggestionModeSample},
		{Name: "file_size", ValueType: ValueTypeInt32, Operators: AllowedOperatorsFor(ValueTypeInt32), ValueSuggestionMode: ValueSuggestionModeNone},
	},
	BindKey:               bindTestKey,
	SuggestFixedKeyValues: fetchTestKeySuggestions,
}

func bindTestKey(condition Condition) (*sqlf.Stmt, error) {
	switch condition.KeyName {
	case "version_name":
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("version_name = any(?)", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New("version_name ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		}

	case "patch_id":
		switch condition.Operator {
		case OperatorIsSet:
			return sqlf.New("patch_id::text <> '" + uuid.Nil.String() + "'"), nil
		}

	case "file_size":
		switch condition.Operator {
		case OperatorGt:
			number, err := condition.IntegerValue()
			if err != nil {
				return nil, err
			}
			return sqlf.New("file_size > ?", number), nil
		}

	default:
		return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
	}

	return nil, fmt.Errorf("key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

func fetchTestKeySuggestions(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	return ValueList{}, nil
}

// testFilters is a request already parsed and validated, the state
// Predicate expects.
func testFilters(exprTree *ExprTree) *ExprFilter {
	return &ExprFilter{
		AppID:    uuid.New(),
		Entity:   testEntity,
		ExprTree: exprTree,
	}
}

func TestPredicate(t *testing.T) {
	tests := []struct {
		name     string
		exprTree *ExprTree
		want     string
		wantArgs int
	}{
		{
			name:     "one condition is what its entity wrote",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0"),
			want:     "version_name = any(?)",
			wantArgs: 1,
		},
		{
			name:     "a list is one bound argument rather than one each",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0", "1.1.9"),
			want:     "version_name = any(?)",
			wantArgs: 1,
		},
		{
			name:     "matching a fragment",
			exprTree: leafExprTree("version_name", OperatorContains, "beta"),
			want:     "version_name ilike ?",
			wantArgs: 1,
		},
		{
			name:     "an operator taking no values binds nothing",
			exprTree: leafExprTree("patch_id", OperatorIsSet),
			want:     "patch_id::text <> '00000000-0000-0000-0000-000000000000'",
			wantArgs: 0,
		},
		{
			name:     "comparing a number",
			exprTree: leafExprTree("file_size", OperatorGt, "1024"),
			want:     "file_size > ?",
			wantArgs: 1,
		},
		{
			name: "a group joins its children with its own operator",
			exprTree: &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
				*leafExprTree("file_size", OperatorGt, "1000"),
				*leafExprTree("version_name", OperatorIn, "1.2.0"),
			}},
			want:     "((file_size > ?) and (version_name = any(?)))",
			wantArgs: 2,
		},
		{
			name: "a group inside a group keeps its own meaning",
			exprTree: &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
				*leafExprTree("version_name", OperatorIn, "1.2.0"),
				{LogicalOperator: LogicalOr, Children: []ExprTree{
					*leafExprTree("patch_id", OperatorIsSet),
					*leafExprTree("file_size", OperatorGt, "10"),
				}},
			}},
			want: "((version_name = any(?)) and (((patch_id::text <> '00000000-0000-0000-0000-000000000000') or (file_size > ?))))",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			predicate, err := testFilters(test.exprTree).Predicate(nil)
			if err != nil {
				t.Fatalf("Predicate failed: %v", err)
			}
			defer predicate.Close()

			if got := predicate.String(); got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
			if test.wantArgs > 0 && len(predicate.Args()) != test.wantArgs {
				t.Errorf("want %d arguments, got %d: %v", test.wantArgs, len(predicate.Args()), predicate.Args())
			}
		})
	}
}

// The predicate is joined with AND, so without grouping this becomes
// "app_id = ? AND a OR b" and matches rows outside the requested app.
func TestPredicateWrapsAGroupAgainstWhatItIsJoinedTo(t *testing.T) {
	exprTree := &ExprTree{LogicalOperator: LogicalOr, Children: []ExprTree{
		*leafExprTree("version_name", OperatorIn, "1.2.0"),
		*leafExprTree("patch_id", OperatorIsSet),
	}}

	predicate, err := testFilters(exprTree).Predicate(nil)
	if err != nil {
		t.Fatalf("Predicate failed: %v", err)
	}
	defer predicate.Close()

	written := predicate.String()
	if !strings.HasPrefix(written, "(") || !strings.HasSuffix(written, ")") {
		t.Errorf("want the whole group wrapped, got %s", written)
	}

	query := sqlf.PostgreSQL.From("rows").Select("*").Where("app_id = ?", "an-app")
	defer query.Close()
	query.Where(written, predicate.Args()...)

	if !strings.Contains(query.String(), "WHERE app_id = $1 AND ((") {
		t.Errorf("want the group joined whole, got %s", query.String())
	}
}

func TestPredicateRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := testFilters(leafExprTree("mapping_type", OperatorIn, "dsym")).Predicate(nil)
	if err == nil {
		t.Fatal("expected a key the entity does not have to be refused")
	}
	if !strings.Contains(err.Error(), "mapping_type") {
		t.Errorf("expected the key to be named, got %q", err.Error())
	}
}

func TestPredicateTakesAnOverrideForOneKey(t *testing.T) {
	exprTree := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
		*leafExprTree("version_name", OperatorIn, "1.2.0"),
		*leafExprTree("patch_id", OperatorIsSet),
	}}

	predicate, err := testFilters(exprTree).Predicate(map[string]KeyBinding{
		"version_name": func(condition Condition) (*sqlf.Stmt, error) {
			return sqlf.New("b.version_name = any(?)", condition.TextValues()), nil
		},
	})
	if err != nil {
		t.Fatalf("Predicate failed: %v", err)
	}
	defer predicate.Close()

	written := predicate.String()
	if !strings.Contains(written, "b.version_name = any(?)") {
		t.Errorf("want the override's SQL for the key it names, got %s", written)
	}
	if !strings.Contains(written, "patch_id::text <>") {
		t.Errorf("want the entity still writing the other key, got %s", written)
	}
}

// fakeCustomBinder records each call and returns a marker fragment naming the
// conditions it received.
type fakeCustomBinder struct {
	calls []struct {
		operator LogicalOperator
		keyNames []string
	}
}

func (b *fakeCustomBinder) bind(operator LogicalOperator, conditions []Condition) (*sqlf.Stmt, error) {
	keyNames := make([]string, len(conditions))
	for i, condition := range conditions {
		keyNames[i] = condition.KeyName
	}
	b.calls = append(b.calls, struct {
		operator LogicalOperator
		keyNames []string
	}{operator, keyNames})
	return sqlf.New("custom ?", strings.Join(keyNames, ",")), nil
}

func TestPredicateBatchesAGroupsCustomConditions(t *testing.T) {
	t.Run("a mixed group appends the batch after the other children", func(t *testing.T) {
		exprTree := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("custom.plan", OperatorIn, "pro"),
			*leafExprTree("version_name", OperatorIn, "1.2.0"),
			*leafExprTree("custom.retries", OperatorGt, "9"),
		}}
		binder := &fakeCustomBinder{}
		ef := testFilters(exprTree)
		ef.customBinder = binder.bind

		predicate, err := ef.Predicate(nil)
		if err != nil {
			t.Fatalf("Predicate: %v", err)
		}
		defer predicate.Close()

		want := "((version_name = any(?)) and (custom ?))"
		if got := predicate.String(); got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
		if len(binder.calls) != 1 || binder.calls[0].operator != LogicalAnd {
			t.Fatalf("want one binder call with the group's operator, got %+v", binder.calls)
		}
		if got := binder.calls[0].keyNames; len(got) != 2 || got[0] != "custom.plan" || got[1] != "custom.retries" {
			t.Errorf("want both custom conditions batched in order, got %v", got)
		}
		args := predicate.Args()
		if len(args) != 2 || args[1] != "custom.plan,custom.retries" {
			t.Errorf("want the batch's arguments after the other children's, got %v", args)
		}
	})

	t.Run("a nested group gets its own binder call", func(t *testing.T) {
		exprTree := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
			*leafExprTree("custom.plan", OperatorIn, "pro"),
			{LogicalOperator: LogicalOr, Children: []ExprTree{
				*leafExprTree("custom.coupon", OperatorIsSet),
				*leafExprTree("custom.retries", OperatorGt, "9"),
			}},
		}}
		binder := &fakeCustomBinder{}
		ef := testFilters(exprTree)
		ef.customBinder = binder.bind

		predicate, err := ef.Predicate(nil)
		if err != nil {
			t.Fatalf("Predicate: %v", err)
		}
		defer predicate.Close()

		want := "((((custom ?))) and (custom ?))"
		if got := predicate.String(); got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
		if len(binder.calls) != 2 {
			t.Fatalf("want one binder call per group, got %+v", binder.calls)
		}
		if binder.calls[0].operator != LogicalOr || len(binder.calls[0].keyNames) != 2 {
			t.Errorf("want the nested group's conditions bound under or, got %+v", binder.calls[0])
		}
		if binder.calls[1].operator != LogicalAnd || len(binder.calls[1].keyNames) != 1 {
			t.Errorf("want the outer group's condition bound under and, got %+v", binder.calls[1])
		}
	})

	t.Run("a custom-only group is the batch alone", func(t *testing.T) {
		exprTree := &ExprTree{LogicalOperator: LogicalOr, Children: []ExprTree{
			*leafExprTree("custom.plan", OperatorIn, "pro"),
			*leafExprTree("custom.retries", OperatorGt, "9"),
		}}
		binder := &fakeCustomBinder{}
		ef := testFilters(exprTree)
		ef.customBinder = binder.bind

		predicate, err := ef.Predicate(nil)
		if err != nil {
			t.Fatalf("Predicate: %v", err)
		}
		defer predicate.Close()

		if got := predicate.String(); got != "((custom ?))" {
			t.Errorf("want the batch as the group's one child, got %s", got)
		}
		if len(binder.calls) != 1 || binder.calls[0].operator != LogicalOr {
			t.Fatalf("want one binder call with the group's operator, got %+v", binder.calls)
		}
	})

	t.Run("a custom leaf at the root is a singleton binder call", func(t *testing.T) {
		binder := &fakeCustomBinder{}
		ef := testFilters(leafExprTree("custom.plan", OperatorIn, "pro"))
		ef.customBinder = binder.bind

		predicate, err := ef.Predicate(nil)
		if err != nil {
			t.Fatalf("Predicate: %v", err)
		}
		defer predicate.Close()

		if got := predicate.String(); got != "custom ?" {
			t.Errorf("want the binder's fragment unwrapped, got %s", got)
		}
		if len(binder.calls) != 1 || len(binder.calls[0].keyNames) != 1 {
			t.Fatalf("want one binder call with the one condition, got %+v", binder.calls)
		}
	})
}

func TestEscapeLikeWildcards(t *testing.T) {
	if got := EscapeLikeWildcards(`100% _sure\`); got != `100\% \_sure\\` {
		t.Errorf("want the wildcards turned off, got %q", got)
	}
}
