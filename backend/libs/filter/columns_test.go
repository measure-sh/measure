package filter

import (
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

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
			stmt, err := bindColumn(test.entity.Columns, Condition{
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

func TestColumnBindingUsesPostgresListSyntaxOnAPostgresColumns(t *testing.T) {
	in, err := bindColumn(buildsColumns, Condition{
		KeyName:  "version_name",
		Operator: OperatorIn,
		Values:   []Value{{Text: "1.2.0"}},
	})
	if err != nil {
		t.Fatalf("bind version_name in: %v", err)
	}
	defer in.Close()
	if got := in.String(); got != "version_name = any(?)" {
		t.Errorf("want Postgres's list syntax, got %q", got)
	}

	notIn, err := bindColumn(buildsColumns, Condition{
		KeyName:  "version_name",
		Operator: OperatorNotIn,
		Values:   []Value{{Text: "1.2.0"}},
	})
	if err != nil {
		t.Fatalf("bind version_name not_in: %v", err)
	}
	defer notIn.Close()
	if got := notIn.String(); got != "version_name <> all(?)" {
		t.Errorf("want Postgres's list syntax, got %q", got)
	}
}

func TestUUIDKeyBinding(t *testing.T) {
	t.Run("in binds the parsed uuids", func(t *testing.T) {
		one := uuid.New()
		two := uuid.New()
		stmt, err := bindColumn(SpansEntity.Columns, Condition{
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
		stmt, err := bindColumn(SpansEntity.Columns, Condition{
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
		isSet, err := bindColumn(SpansEntity.Columns, Condition{KeyName: "patch_id", Operator: OperatorIsSet})
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

		isNotSet, err := bindColumn(SpansEntity.Columns, Condition{KeyName: "patch_id", Operator: OperatorIsNotSet})
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
		if _, err := bindColumn(SpansEntity.Columns, Condition{
			KeyName:  "patch_id",
			Operator: OperatorIn,
			Values:   []Value{{Text: "not-a-uuid"}},
		}); err == nil {
			t.Error("want a value that does not parse as a uuid refused")
		}
	})
}

func TestUUIDColumnBindingComparesAsTextOnAPostgresColumns(t *testing.T) {
	id := uuid.New()

	in, err := bindColumn(buildsColumns, Condition{
		KeyName:  "patch_id",
		Operator: OperatorIn,
		Values:   []Value{{Text: id.String()}},
	})
	if err != nil {
		t.Fatalf("bind patch_id in: %v", err)
	}
	defer in.Close()
	if got := in.String(); got != "patch_id::text = any(?)" {
		t.Errorf("want the column compared as text, got %q", got)
	}
	if got, ok := in.Args()[0].([]string); !ok || !slices.Equal(got, []string{id.String()}) {
		t.Errorf("want the uuid bound as text, got %v", in.Args()[0])
	}

	notIn, err := bindColumn(buildsColumns, Condition{
		KeyName:  "patch_id",
		Operator: OperatorNotIn,
		Values:   []Value{{Text: id.String()}},
	})
	if err != nil {
		t.Fatalf("bind patch_id not_in: %v", err)
	}
	defer notIn.Close()
	if got := notIn.String(); got != "patch_id::text <> all(?)" {
		t.Errorf("want the column compared as text, got %q", got)
	}

	isSet, err := bindColumn(buildsColumns, Condition{KeyName: "patch_id", Operator: OperatorIsSet})
	if err != nil {
		t.Fatalf("bind patch_id is_set: %v", err)
	}
	defer isSet.Close()
	if got := isSet.String(); got != "patch_id::text <> ?" {
		t.Errorf("want the column tested against a bound value, got %q", got)
	}
	if args := isSet.Args(); len(args) != 1 || args[0] != uuid.Nil.String() {
		t.Errorf("want the nil uuid bound as text, got %v", args)
	}

	isNotSet, err := bindColumn(buildsColumns, Condition{KeyName: "patch_id", Operator: OperatorIsNotSet})
	if err != nil {
		t.Fatalf("bind patch_id is_not_set: %v", err)
	}
	defer isNotSet.Close()
	if got := isNotSet.String(); got != "patch_id::text = ?" {
		t.Errorf("want the column tested against a bound value, got %q", got)
	}
	if args := isNotSet.Args(); len(args) != 1 || args[0] != uuid.Nil.String() {
		t.Errorf("want the nil uuid bound as text, got %v", args)
	}
}

func TestArrayColumnBindingSQL(t *testing.T) {
	tests := []struct {
		name     string
		keyName  string
		operator Operator
		texts    []string
		wantSQL  string
		wantArgs []any
	}{
		{
			name: "in keeps a bucket holding any of the values", keyName: "network_type",
			operator: OperatorIn, texts: []string{"wifi", "cellular"},
			wantSQL: "hasAny(network_types, ?)", wantArgs: []any{[]string{"wifi", "cellular"}},
		},
		{
			name: "not_in drops a bucket holding any of the values", keyName: "network_type",
			operator: OperatorNotIn, texts: []string{"wifi"},
			wantSQL: "not hasAny(network_types, ?)", wantArgs: []any{[]string{"wifi"}},
		},
		{
			name: "contains matches any value in the bucket", keyName: "device_name",
			operator: OperatorContains, texts: []string{"pix"},
			wantSQL: "arrayExists(value -> value ilike ?, device_names)", wantArgs: []any{"%pix%"},
		},
		{
			name: "starts_with anchors the start", keyName: "device_name",
			operator: OperatorStartsWith, texts: []string{"pix"},
			wantSQL: "arrayExists(value -> value ilike ?, device_names)", wantArgs: []any{"pix%"},
		},
		{
			name: "a wildcard in the typed text is escaped", keyName: "device_name",
			operator: OperatorContains, texts: []string{"50%"},
			wantSQL: "arrayExists(value -> value ilike ?, device_names)", wantArgs: []any{`%50\%%`},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			values := make([]Value, len(test.texts))
			for i, text := range test.texts {
				values[i] = Value{Text: text}
			}

			stmt, err := bindColumn(NetworkMetricsColumns, Condition{
				KeyName:  test.keyName,
				Operator: test.operator,
				Values:   values,
			})
			if err != nil {
				t.Fatalf("bind %s %s: %v", test.keyName, test.operator, err)
			}
			defer stmt.Close()

			if got := stmt.String(); got != test.wantSQL {
				t.Errorf("\n got %s\nwant %s", got, test.wantSQL)
			}
			args := stmt.Args()
			if len(args) != len(test.wantArgs) {
				t.Fatalf("want %d arguments, got %#v", len(test.wantArgs), args)
			}
			for i, want := range test.wantArgs {
				if texts, ok := want.([]string); ok {
					if got, ok := args[i].([]string); !ok || !slices.Equal(got, texts) {
						t.Errorf("argument %d = %#v, want %#v", i, args[i], want)
					}
					continue
				}
				if args[i] != want {
					t.Errorf("argument %d = %#v, want %#v", i, args[i], want)
				}
			}
		})
	}
}

func TestUUIDArrayKeyBinding(t *testing.T) {
	bind := func(condition Condition) (*sqlf.Stmt, error) { return bindColumn(NetworkMetricsColumns, condition) }

	t.Run("in binds the parsed uuids", func(t *testing.T) {
		one := uuid.New()
		stmt, err := bind(Condition{
			KeyName:  "patch_id",
			Operator: OperatorIn,
			Values:   []Value{{Text: one.String()}},
		})
		if err != nil {
			t.Fatalf("bind patch_id in: %v", err)
		}
		defer stmt.Close()

		if got := stmt.String(); got != "hasAny(patch_ids, cast(?, 'Array(UUID)'))" {
			t.Errorf("want the patch id array compared, got %q", got)
		}
		if got, ok := stmt.Args()[0].([]uuid.UUID); !ok || !slices.Equal(got, []uuid.UUID{one}) {
			t.Errorf("want the parsed uuid bound, got %v", stmt.Args()[0])
		}
	})

	t.Run("is_set and is_not_set compare against the nil uuid", func(t *testing.T) {
		isSet, err := bind(Condition{KeyName: "patch_id", Operator: OperatorIsSet})
		if err != nil {
			t.Fatalf("bind patch_id is_set: %v", err)
		}
		defer isSet.Close()
		if got := isSet.String(); got != "arrayExists(value -> value <> toUUID(?), patch_ids)" {
			t.Errorf("want a patched request looked for, got %q", got)
		}
		if args := isSet.Args(); len(args) != 1 || args[0] != uuid.Nil {
			t.Errorf("want the nil uuid bound, got %v", args)
		}

		isNotSet, err := bind(Condition{KeyName: "patch_id", Operator: OperatorIsNotSet})
		if err != nil {
			t.Fatalf("bind patch_id is_not_set: %v", err)
		}
		defer isNotSet.Close()
		if got := isNotSet.String(); got != "has(patch_ids, toUUID(?))" {
			t.Errorf("want an unpatched request looked for, got %q", got)
		}
		if args := isNotSet.Args(); len(args) != 1 || args[0] != uuid.Nil {
			t.Errorf("want the nil uuid bound, got %v", args)
		}
	})

	t.Run("a value that is not a uuid is refused", func(t *testing.T) {
		if _, err := bind(Condition{
			KeyName:  "patch_id",
			Operator: OperatorIn,
			Values:   []Value{{Text: "not-a-uuid"}},
		}); err == nil {
			t.Error("want a value that does not parse as a uuid refused")
		}
	})
}

func TestBindColumnRefusesAKeyNotInTheMap(t *testing.T) {
	_, err := bindColumn(SpansEntity.Columns, Condition{
		KeyName:  "not_a_key",
		Operator: OperatorIn,
		Values:   []Value{{Text: "x"}},
	})
	if err == nil {
		t.Fatal("want a key not in the columns map refused")
	}
	if got := err.Error(); got != `Key not supported by this query: "not_a_key"` {
		t.Errorf("want the key named after ErrKeyNotSupported, got %q", got)
	}
}
