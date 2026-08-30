package exprfilter

import (
	"testing"
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
