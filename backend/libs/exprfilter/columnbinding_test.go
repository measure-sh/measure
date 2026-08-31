package exprfilter

import (
	"slices"
	"testing"

	"github.com/google/uuid"
)

// TestColumnBindingSQL asserts the exact SQL each text operator produces for
// a column-mapped key.
func TestColumnBindingSQL(t *testing.T) {
	tests := []struct {
		name     string
		entity   Entity
		keyName  string
		operator Operator
		text     string
		wantSQL  string
		wantArg  any
	}{
		{
			name:   "spans contains reads the attribute-prefixed column",
			entity: SpansEntity, keyName: "device_name", operator: OperatorContains, text: "pix",
			wantSQL: "attribute.device_name ilike ?", wantArg: "%pix%",
		},
		{
			name:   "bug report not_contains negates the match",
			entity: BugReportsEntity, keyName: "bug_report_description", operator: OperatorNotContains, text: "crash",
			wantSQL: "description not ilike ?", wantArg: "%crash%",
		},
		{
			name:   "bug report ends_with anchors the end",
			entity: BugReportsEntity, keyName: "bug_report_description", operator: OperatorEndsWith, text: "crash",
			wantSQL: "description ilike ?", wantArg: "%crash",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			stmt, err := test.entity.BindKey(Condition{
				KeyName:  test.keyName,
				Operator: test.operator,
				Values:   []Value{{Text: test.text}},
			})
			if err != nil {
				t.Fatalf("bind %s %s: %v", test.keyName, test.operator, err)
			}
			defer stmt.Close()

			if got := stmt.String(); got != test.wantSQL {
				t.Errorf("\n got %s\nwant %s", got, test.wantSQL)
			}
			if args := stmt.Args(); len(args) != 1 || args[0] != test.wantArg {
				t.Errorf("want the one argument %#v, got %#v", test.wantArg, args)
			}
		})
	}
}

// TestUUIDKeyBinding asserts the SQL generated for the spans patch_id key.
// The column stores a native UUID, with uuid.Nil meaning no patch.
func TestUUIDKeyBinding(t *testing.T) {
	t.Run("in binds the parsed uuids", func(t *testing.T) {
		one := uuid.New()
		two := uuid.New()
		stmt, err := SpansEntity.BindKey(Condition{
			KeyName:  "patch_id",
			Operator: OperatorIn,
			Values:   []Value{{Text: one.String()}, {Text: two.String()}},
		})
		if err != nil {
			t.Fatalf("bind patch_id in: %v", err)
		}
		defer stmt.Close()

		if got := stmt.String(); got != "attribute.patch_id in ?" {
			t.Errorf("want the attribute column compared, got %q", got)
		}
		args := stmt.Args()
		if len(args) != 1 {
			t.Fatalf("want one bound argument, got %v", args)
		}
		if got, ok := args[0].([]uuid.UUID); !ok || !slices.Equal(got, []uuid.UUID{one, two}) {
			t.Errorf("want the parsed uuids bound, got %v", args[0])
		}
	})

	t.Run("not_in negates the comparison", func(t *testing.T) {
		id := uuid.New()
		stmt, err := SpansEntity.BindKey(Condition{
			KeyName:  "patch_id",
			Operator: OperatorNotIn,
			Values:   []Value{{Text: id.String()}},
		})
		if err != nil {
			t.Fatalf("bind patch_id not_in: %v", err)
		}
		defer stmt.Close()

		if got := stmt.String(); got != "attribute.patch_id not in ?" {
			t.Errorf("want the column excluded, got %q", got)
		}
	})

	t.Run("is_set and is_not_set bind the nil uuid", func(t *testing.T) {
		isSet, err := SpansEntity.BindKey(Condition{KeyName: "patch_id", Operator: OperatorIsSet})
		if err != nil {
			t.Fatalf("bind patch_id is_set: %v", err)
		}
		defer isSet.Close()
		if got := isSet.String(); got != "attribute.patch_id <> ?" {
			t.Errorf("want the column tested against a bound value, got %q", got)
		}
		if args := isSet.Args(); len(args) != 1 || args[0] != uuid.Nil {
			t.Errorf("want the nil uuid bound, got %v", args)
		}

		isNotSet, err := SpansEntity.BindKey(Condition{KeyName: "patch_id", Operator: OperatorIsNotSet})
		if err != nil {
			t.Fatalf("bind patch_id is_not_set: %v", err)
		}
		defer isNotSet.Close()
		if got := isNotSet.String(); got != "attribute.patch_id = ?" {
			t.Errorf("want the column tested against a bound value, got %q", got)
		}
		if args := isNotSet.Args(); len(args) != 1 || args[0] != uuid.Nil {
			t.Errorf("want the nil uuid bound, got %v", args)
		}
	})

	t.Run("a value that is not a uuid is refused", func(t *testing.T) {
		if _, err := SpansEntity.BindKey(Condition{
			KeyName:  "patch_id",
			Operator: OperatorIn,
			Values:   []Value{{Text: "not-a-uuid"}},
		}); err == nil {
			t.Error("want a value that does not parse as a uuid refused")
		}
	})
}
