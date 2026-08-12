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
	BindKey:          bindTestKey,
	SuggestKeyValues: fetchTestKeySuggestions,
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

func fetchTestKeySuggestions(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
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

func TestEscapeLikeWildcards(t *testing.T) {
	if got := EscapeLikeWildcards(`100% _sure\`); got != `100\% \_sure\\` {
		t.Errorf("want the wildcards turned off, got %q", got)
	}
}
