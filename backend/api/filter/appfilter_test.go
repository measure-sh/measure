package filter

import (
	"backend/api/event"
	"testing"
)

func TestParseRawUDExpression(t *testing.T) {
	afOne := &AppFilter{
		UDExpressionRaw: `{"and":[{"cmp":{"key":"paid_user","type":"bool","op":"eq","value":"true"}},{"cmp":{"key":"credit_balance","type":"int64","op":"gte","value":"1000"}}]}`,
	}

	afOne.parseUDExpression()

	// assert expression exists
	if afOne.UDExpression == nil {
		t.Error("Expected parsed user defined expression, got nil")
	}

	// assert count of expressions
	{
		expectedAndLen := 2
		gotAndLen := len(afOne.UDExpression.And)

		if expectedAndLen != gotAndLen {
			t.Errorf("Expected %d And expressions, got %d", expectedAndLen, gotAndLen)
		}
	}

	// assert expression structure and type
	// for item 0
	{
		expectedKeyName := "paid_user"
		expectedKeyType := event.AttrBool
		expectedOp := event.OpEq
		expectedValue := "true"
		gotKeyName := afOne.UDExpression.And[0].Cmp.Key
		gotKeyType := afOne.UDExpression.And[0].Cmp.Type
		gotOp := afOne.UDExpression.And[0].Cmp.Op
		gotValue := afOne.UDExpression.And[0].Cmp.Value

		if expectedKeyName != gotKeyName {
			t.Errorf("Expected %v key name, got %v", expectedKeyName, gotKeyName)
		}

		if expectedKeyType != gotKeyType {
			t.Errorf("Expected %v key type, got %v", expectedKeyType, gotKeyType)
		}

		if expectedOp != gotOp {
			t.Errorf("Expected %v operator, got %v", expectedOp, gotOp)
		}

		if expectedValue != gotValue {
			t.Errorf("Expected %v value, got %v", expectedValue, gotValue)
		}
	}

	// assert expression structure and type
	// for item 1
	{
		expectedKeyName := "credit_balance"
		expectedKeyType := event.AttrInt64
		expectedOp := event.OpGte
		expectedValue := "1000"
		gotKeyName := afOne.UDExpression.And[1].Cmp.Key
		gotKeyType := afOne.UDExpression.And[1].Cmp.Type
		gotOp := afOne.UDExpression.And[1].Cmp.Op
		gotValue := afOne.UDExpression.And[1].Cmp.Value

		if expectedKeyName != gotKeyName {
			t.Errorf("Expected %v key name, got %v", expectedKeyName, gotKeyName)
		}

		if expectedKeyType != gotKeyType {
			t.Errorf("Expected %v key type, got %v", expectedKeyType, gotKeyType)
		}

		if expectedOp != gotOp {
			t.Errorf("Expected %v operator, got %v", expectedOp, gotOp)
		}

		if expectedValue != gotValue {
			t.Errorf("Expected %v value, got %v", expectedValue, gotValue)
		}
	}
}
