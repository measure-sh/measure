package exprfilter

import (
	"errors"
	"strings"
	"testing"
)

func testKeys() map[string]Key {
	return IndexKeysByName([]Key{
		{Name: "version_name", ValueType: ValueTypeString, Operators: AllowedOperatorsFor(ValueTypeString), ValueSuggestionMode: ValueSuggestionModeSample},
		{Name: "mapping_type", ValueType: ValueTypeEnum, Operators: AllowedOperatorsFor(ValueTypeEnum), ValueSuggestionMode: ValueSuggestionModeSample},
		{Name: "patch_id", ValueType: ValueTypeUUID, Operators: AllowedOperatorsFor(ValueTypeUUID), ValueSuggestionMode: ValueSuggestionModeSample},
		{Name: "file_size", ValueType: ValueTypeInt32, Operators: AllowedOperatorsFor(ValueTypeInt32), ValueSuggestionMode: ValueSuggestionModeNone},
		{Name: "mapping_kind", ValueType: ValueTypeEnum, Operators: AllowedOperatorsFor(ValueTypeEnum), ValueSuggestionMode: ValueSuggestionModeFullList, EnumValues: []string{"proguard", "dsym"}},
		{Name: "uploaded_at", ValueType: ValueTypeDatetime, Operators: AllowedOperatorsFor(ValueTypeDatetime), ValueSuggestionMode: ValueSuggestionModeNone},
		{Name: "is_debug", ValueType: ValueTypeBool, Operators: AllowedOperatorsFor(ValueTypeBool), ValueSuggestionMode: ValueSuggestionModeNone},
		// A key offering fewer operators than its type allows.
		{Name: "narrow_name", ValueType: ValueTypeString, Operators: []Operator{OperatorIn}, ValueSuggestionMode: ValueSuggestionModeSample},
		// A key declaring no operators, which falls back to its type's.
		{Name: "loose_name", ValueType: ValueTypeString, ValueSuggestionMode: ValueSuggestionModeSample},
	})
}

func leafExprTree(keyName string, operator Operator, texts ...string) *ExprTree {
	values := make([]Value, len(texts))
	for i, text := range texts {
		values[i] = Value{Text: text}
	}
	return &ExprTree{Condition: &Condition{KeyName: keyName, Operator: operator, Values: values}}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name     string
		exprTree *ExprTree
		wantErr  string
	}{
		{
			name:     "a list operator with one value",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0"),
		},
		{
			name:     "a list operator with several values",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0", "1.1.0"),
		},
		{
			name:     "an operator taking no values",
			exprTree: leafExprTree("patch_id", OperatorIsSet),
		},
		{
			name:     "a comparison on a number",
			exprTree: leafExprTree("file_size", OperatorGt, "1024"),
		},
		{
			name:     "a key narrowing its own operators",
			exprTree: leafExprTree("narrow_name", OperatorIn, "1.2.0"),
		},
		{
			name:     "a key falling back to its type's operators",
			exprTree: leafExprTree("loose_name", OperatorContains, "1.2"),
		},
		{
			name: "groups nested inside groups",
			exprTree: &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
				*leafExprTree("mapping_type", OperatorIn, "proguard"),
				{LogicalOperator: LogicalOr, Children: []ExprTree{
					*leafExprTree("version_name", OperatorIn, "1.2.0"),
					*leafExprTree("patch_id", OperatorIsSet),
				}},
			}},
		},
		{
			name:     "nothing at all",
			exprTree: nil,
			wantErr:  "empty",
		},
		{
			name:     "a key the entity does not have",
			exprTree: leafExprTree("device_cohort", OperatorIn, "beta"),
			wantErr:  "device_cohort",
		},
		{
			name:     "an operator that does not exist",
			exprTree: leafExprTree("version_name", Operator("sounds_like"), "1.2.0"),
			wantErr:  "Unknown operator",
		},
		{
			name:     "an operator the key's type does not offer",
			exprTree: leafExprTree("mapping_type", OperatorContains, "pro"),
			wantErr:  "not offered by key",
		},
		{
			name:     "an operator the key itself withheld",
			exprTree: leafExprTree("narrow_name", OperatorContains, "1.2"),
			wantErr:  "not offered by key",
		},
		{
			name:     "a list operator with no values",
			exprTree: leafExprTree("version_name", OperatorIn),
			wantErr:  "at least 1 value",
		},
		{
			name:     "a single-value operator with two values",
			exprTree: leafExprTree("file_size", OperatorGt, "1024", "2048"),
			wantErr:  "exactly 1 value",
		},
		{
			name:     "a no-value operator carrying one",
			exprTree: leafExprTree("patch_id", OperatorIsSet, "3f0e7c3e"),
			wantErr:  "exactly 0 value",
		},
		{
			name:     "a value that is empty",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0", ""),
			wantErr:  "empty value",
		},
		{
			name:     "a group with an unknown operator",
			exprTree: &ExprTree{LogicalOperator: LogicalOperator("xor"), Children: []ExprTree{*leafExprTree("patch_id", OperatorIsSet)}},
			wantErr:  "must be \"and\" or \"or\"",
		},
		{
			name:     "a group with no children",
			exprTree: &ExprTree{LogicalOperator: LogicalAnd},
			wantErr:  "no conditions",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateFilterExpr(test.exprTree, testKeys())

			if test.wantErr == "" {
				if err != nil {
					t.Fatalf("want no error, got %v", err)
				}
				return
			}

			if err == nil {
				t.Fatalf("want an error holding %q, got none", test.wantErr)
			}
			if !strings.Contains(err.Error(), test.wantErr) {
				t.Errorf("want an error holding %q, got %q", test.wantErr, err)
			}
		})
	}
}

func TestValidateValueTypes(t *testing.T) {
	tests := []struct {
		name     string
		exprTree *ExprTree
		wantErr  string
	}{
		{
			name:     "an integer key takes an integer",
			exprTree: leafExprTree("file_size", OperatorGt, "1024"),
		},
		{
			name:     "an integer key takes the ends of its range",
			exprTree: leafExprTree("file_size", OperatorGt, "2147483647"),
		},
		{
			name:     "an integer key refuses words",
			exprTree: leafExprTree("file_size", OperatorEq, "xyz"),
			wantErr:  `Key "file_size" takes an integer, got "xyz"`,
		},
		{
			name:     "an integer key refuses a fraction",
			exprTree: leafExprTree("file_size", OperatorLt, "10.5"),
			wantErr:  `Key "file_size" takes an integer, got "10.5"`,
		},
		{
			name:     "an integer key refuses a number wider than its column",
			exprTree: leafExprTree("file_size", OperatorGt, "3000000000"),
			wantErr:  `Key "file_size" takes an integer between -2147483648 and 2147483647, got "3000000000"`,
		},
		{
			name:     "an integer key refuses a number too wide to read at all",
			exprTree: leafExprTree("file_size", OperatorGt, "50000000000000000000000000000000000000"),
			wantErr:  `Key "file_size" takes an integer between -2147483648 and 2147483647, got "50000000000000000000000000000000000000"`,
		},
		{
			name:     "an integer key refuses exponent notation",
			exprTree: leafExprTree("file_size", OperatorGt, "5e37"),
			wantErr:  `Key "file_size" takes an integer, got "5e37"`,
		},
		{
			name:     "an id key takes a uuid",
			exprTree: leafExprTree("patch_id", OperatorIn, "3f0e7c3e-9c31-4d9d-9a4e-2f6a3d0f5b21"),
		},
		{
			name:     "an id key refuses anything else",
			exprTree: leafExprTree("patch_id", OperatorIn, "patch-3"),
			wantErr:  `Key "patch_id" takes an id, got "patch-3"`,
		},
		{
			name:     "a fixed set takes one of its values",
			exprTree: leafExprTree("mapping_kind", OperatorIn, "dsym"),
		},
		{
			name:     "a fixed set refuses a value it does not have",
			exprTree: leafExprTree("mapping_kind", OperatorIn, "sourcemap"),
			wantErr:  `Key "mapping_kind" has no value "sourcemap"`,
		},
		{
			name:     "a time key takes a written time",
			exprTree: leafExprTree("uploaded_at", OperatorBefore, "2026-08-08T09:14:33Z"),
		},
		{
			name:     "a time key refuses a date on its own",
			exprTree: leafExprTree("uploaded_at", OperatorAfter, "2026-08-08"),
			wantErr:  "takes a time written as",
		},
		{
			name:     "a text key takes anything",
			exprTree: leafExprTree("version_name", OperatorIn, "1.2.0-SNAPSHOT.debug"),
		},
		{
			name:     "matching a fragment takes anything the type would refuse",
			exprTree: leafExprTree("version_name", OperatorStartsWith, "1."),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateFilterExpr(test.exprTree, testKeys())

			if test.wantErr == "" {
				if err != nil {
					t.Fatalf("expected no error, got %v", err)
				}
				return
			}

			if err == nil {
				t.Fatalf("expected error containing %q, got none", test.wantErr)
			}
			if !strings.Contains(err.Error(), test.wantErr) {
				t.Errorf("expected error containing %q, got %q", test.wantErr, err.Error())
			}
		})
	}
}

func TestIssueSpanSlicesTheFilterExprItCameFrom(t *testing.T) {
	const filter = `version_name:in:1.2.0 AND file_size:eq:[xyz]`

	exprTree, err := ParseFilterExpr(filter)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}

	err = ValidateFilterExpr(exprTree, testKeys())
	var invalid *ValidationError
	if !errors.As(err, &invalid) || len(invalid.Issues) != 1 {
		t.Fatalf("want the one bad condition, got %v", err)
	}

	issue := invalid.Issues[0]
	if issue.Span == nil {
		t.Fatal("want a span over the condition")
	}
	if got := filter[issue.Span.Start:issue.Span.End]; got != "file_size:eq:[xyz]" {
		t.Errorf("want the span over the whole condition, got %q", got)
	}
}

func TestIssueAboutTheWholeFilterHasNoSpan(t *testing.T) {
	err := ValidateFilterExpr(&ExprTree{LogicalOperator: LogicalAnd}, testKeys())

	var invalid *ValidationError
	if !errors.As(err, &invalid) || len(invalid.Issues) != 1 {
		t.Fatalf("want one issue, got %v", err)
	}
	if issue := invalid.Issues[0]; issue.Span != nil {
		t.Errorf("want no span, got %d to %d", issue.Span.Start, issue.Span.End)
	}
}

func TestValidateReportsEveryIssue(t *testing.T) {
	exprTree, err := ParseFilterExpr("apps_versions:in:1.2.1 AND file_size:eq:xyz AND version_name:in:1.2.0")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}

	err = ValidateFilterExpr(exprTree, testKeys())
	if err == nil {
		t.Fatal("expected the filter to be refused")
	}

	var invalid *ValidationError
	if !errors.As(err, &invalid) {
		t.Fatalf("expected a *ValidationError, got %T", err)
	}
	if len(invalid.Issues) != 2 {
		t.Fatalf("expected both bad conditions, got %d: %+v", len(invalid.Issues), invalid.Issues)
	}

	first := invalid.Issues[0]
	if first.Span == nil || first.Span.Start != 0 {
		t.Errorf("expected the first condition to start at 0, got %+v", first.Span)
	}
	if !strings.Contains(first.Message, "Unknown key") {
		t.Errorf("expected a message about the key, got %q", first.Message)
	}

	second := invalid.Issues[1]
	if second.Span == nil || second.Span.Start != 27 {
		t.Errorf("expected the second condition to start at 27, got %+v", second.Span)
	}
	if !strings.Contains(second.Message, "takes an integer") {
		t.Errorf("expected a message about the value, got %q", second.Message)
	}

	if !strings.Contains(err.Error(), "(+1 more)") {
		t.Errorf("expected the summary to count the rest, got %q", err.Error())
	}

}

func TestValidateRefusesAFilterNamingAKeyTheEntityDoesNotHave(t *testing.T) {
	err := ValidateFilterExpr(leafExprTree("device_cohort", OperatorIn, "beta"), testKeys())
	if err == nil || !strings.Contains(err.Error(), "device_cohort") {
		t.Errorf("want the key named in the refusal, got %v", err)
	}
}

func TestValidateBounds(t *testing.T) {
	t.Run("groups nesting past the depth limit", func(t *testing.T) {
		exprTree := leafExprTree("patch_id", OperatorIsSet)
		for range MaxDepth {
			exprTree = &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{*exprTree}}
		}

		err := ValidateFilterExpr(exprTree, testKeys())
		if err == nil || !strings.Contains(err.Error(), "nest deeper") {
			t.Errorf("want a depth error, got %v", err)
		}
	})

	t.Run("more conditions than allowed", func(t *testing.T) {
		children := make([]ExprTree, MaxConditions+1)
		for i := range children {
			children[i] = *leafExprTree("patch_id", OperatorIsSet)
		}

		err := ValidateFilterExpr(&ExprTree{LogicalOperator: LogicalAnd, Children: children}, testKeys())
		if err == nil || !strings.Contains(err.Error(), "more than") {
			t.Errorf("want a condition count error, got %v", err)
		}
	})

	t.Run("conditions right up to the limit", func(t *testing.T) {
		children := make([]ExprTree, MaxConditions)
		for i := range children {
			children[i] = *leafExprTree("patch_id", OperatorIsSet)
		}

		if err := ValidateFilterExpr(&ExprTree{LogicalOperator: LogicalAnd, Children: children}, testKeys()); err != nil {
			t.Errorf("want the limit itself to pass, got %v", err)
		}
	})

	t.Run("more values than allowed on one condition", func(t *testing.T) {
		texts := make([]string, MaxValuesPerCondition+1)
		for i := range texts {
			texts[i] = "1.2.0"
		}

		err := ValidateFilterExpr(leafExprTree("version_name", OperatorIn, texts...), testKeys())
		if err == nil || !strings.Contains(err.Error(), "more than") {
			t.Errorf("want a value count error, got %v", err)
		}
	})
}

func TestAllowedOperatorsFor(t *testing.T) {
	t.Run("an enum offers only membership", func(t *testing.T) {
		operators := AllowedOperatorsFor(ValueTypeEnum)
		if len(operators) != 2 || operators[0] != OperatorIn || operators[1] != OperatorNotIn {
			t.Errorf("want in and not_in, got %v", operators)
		}
	})

	t.Run("the returned list is a copy", func(t *testing.T) {
		first := AllowedOperatorsFor(ValueTypeString)
		first[0] = Operator("tampered")

		if AllowedOperatorsFor(ValueTypeString)[0] != OperatorIn {
			t.Error("want the operator table to survive a caller editing what it got")
		}
	})

	t.Run("an unknown type offers nothing", func(t *testing.T) {
		if operators := AllowedOperatorsFor(ValueType("colour")); len(operators) != 0 {
			t.Errorf("want no operators, got %v", operators)
		}
	})
}
