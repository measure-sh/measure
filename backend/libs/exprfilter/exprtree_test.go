package exprfilter

import (
	"testing"
	"time"
)

func TestConditionTextValues(t *testing.T) {
	condition := Condition{
		KeyName:  "version_name",
		Operator: OperatorIn,
		Values: []Value{
			{Text: "1.2.0"},
			{Text: "1.1.0", Label: "1.1.0 (old)"},
		},
	}

	texts := condition.TextValues()
	if len(texts) != 2 || texts[0] != "1.2.0" || texts[1] != "1.1.0" {
		t.Errorf("want the values in the order picked, got %v", texts)
	}

	if condition.TextValue() != "1.2.0" {
		t.Errorf("want the first value, got %q", condition.TextValue())
	}

	empty := Condition{KeyName: "patch_id", Operator: OperatorIsSet}
	if empty.TextValue() != "" {
		t.Errorf("want an empty string for an operator taking no values, got %q", empty.TextValue())
	}
	if len(empty.TextValues()) != 0 {
		t.Errorf("want no values, got %v", empty.TextValues())
	}
}

func TestConditionReadsValuesInTheirType(t *testing.T) {
	t.Run("integers", func(t *testing.T) {
		size, err := leafExprTree("file_size", OperatorGt, "1024").Condition.IntegerValue()
		if err != nil {
			t.Fatalf("integer value: %v", err)
		}
		if size != 1024 {
			t.Errorf("want 1024, got %v", size)
		}

		if _, err := leafExprTree("file_size", OperatorGt, "10.5").Condition.IntegerValue(); err == nil {
			t.Error("want a fraction refused on an integer key")
		}
	})

	t.Run("numbers", func(t *testing.T) {
		duration, err := leafExprTree("duration", OperatorGt, "10.5").Condition.FloatValue()
		if err != nil {
			t.Fatalf("float value: %v", err)
		}
		if duration != 10.5 {
			t.Errorf("want 10.5, got %v", duration)
		}
	})

	t.Run("a time", func(t *testing.T) {
		at, err := leafExprTree("uploaded_at", OperatorBefore, "2026-08-08T09:14:33Z").Condition.TimeValue()
		if err != nil {
			t.Fatalf("time value: %v", err)
		}
		if !at.Equal(time.Date(2026, 8, 8, 9, 14, 33, 0, time.UTC)) {
			t.Errorf("want the written time, got %v", at)
		}
	})

	t.Run("true or false", func(t *testing.T) {
		yes, err := leafExprTree("is_debug", OperatorEq, "true").Condition.BoolValue()
		if err != nil {
			t.Fatalf("bool value: %v", err)
		}
		if !yes {
			t.Error("want true")
		}
	})

	t.Run("a value the type cannot hold names its key", func(t *testing.T) {
		_, err := leafExprTree("file_size", OperatorGt, "xyz").Condition.IntegerValue()
		if err == nil {
			t.Fatal("want words on an integer key refused")
		}
		if got := err.Error(); got != `Key "file_size" takes an integer, got "xyz"` {
			t.Errorf("want the key and the value named, got %q", got)
		}
	})
}

func TestIsGroup(t *testing.T) {
	group := &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{
		{Condition: &Condition{KeyName: "a", Operator: OperatorIsSet}},
	}}
	if !group.IsGroup() {
		t.Error("want a group")
	}

	leaf := &ExprTree{Condition: &Condition{KeyName: "a", Operator: OperatorIsSet}}
	if leaf.IsGroup() {
		t.Error("want a leaf")
	}
}
