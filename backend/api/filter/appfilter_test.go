package filter

import (
	"backend/api/event"
	"reflect"
	"testing"
)

func TestParseRawUDExpression(t *testing.T) {
	afOne := &AppFilter{
		UDExpressionRaw: `{"and":[{"cmp":{"key":"paid_user","type":"bool","op":"eq","value":"true"}},{"cmp":{"key":"credit_balance","type":"int64","op":"gte","value":"1000"}}]}`,
	}

	_ = afOne.parseUDExpression()

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

func TestExclude(t *testing.T) {
	// no selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"4.5.6",
		}
		selCodes := []string{
			"7",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{
				"1.0.1",
				"1.0.1",
				"1.0.2",
			},
			codes: []string{
				"0",
				"1",
				"2",
			},
		}

		if !reflect.DeepEqual(expected.Versions(), got.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), got.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), got.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), got.Codes())
		}
	}

	// at least 1 selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"1.0.1",
		}
		selCodes := []string{
			"1",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{
				"1.0.1",
				"1.0.2",
			},
			codes: []string{
				"0",
				"2",
			},
		}

		if !reflect.DeepEqual(expected.Versions(), got.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), got.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), got.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), got.Codes())
		}
	}

	// more than 1 selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"1.0.1",
			"1.0.2",
		}
		selCodes := []string{
			"1",
			"2",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{
				"1.0.1",
			},
			codes: []string{
				"0",
			},
		}

		if !reflect.DeepEqual(expected.Versions(), got.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), got.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), got.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), got.Codes())
		}
	}

	// all selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		selCodes := []string{
			"0",
			"1",
			"2",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{},
			codes: []string{},
		}

		if len(got.Versions()) > 0 {
			t.Errorf("Expected %d length, but got %d length", len(expected.Versions()), len(got.Versions()))
		}

		if len(got.Codes()) > 0 {
			t.Errorf("Expected %d length, but got %d length", len(expected.Codes()), len(got.Codes()))
		}
	}
}

func TestIsValidSemver(t *testing.T) {
	// empty versions are not valid semver.
	{
		empty := Versions{
			names: []string{},
			codes: []string{},
		}

		expected := false
		got := empty.IsValidSemver()

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// invalid versions are not valid semver.
	{
		invalid := Versions{
			names: []string{
				"1.2.3",
				"4.5.6.7",
			},
			codes: []string{
				"1",
				"2",
			},
		}

		expected := false
		got := invalid.IsValidSemver()

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// valid semver versions should report
	// as valid.
	{
		valid := Versions{
			names: []string{
				"1.2.3",
				"4.5.6",
				"1.0.0-alpha.beta",
				"1.0.0-rc.1",
			},
			codes: []string{
				"1",
				"2",
			},
		}

		expected := true
		got := valid.IsValidSemver()

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestSemverSortByVersionDesc(t *testing.T) {
	// empty versions should neither sort
	// nor return error.
	{
		empty := Versions{
			names: []string{},
			codes: []string{},
		}

		err := empty.SemverSortByVersionDesc()

		if err != nil {
			t.Errorf("Expected %v, but got %v", nil, err)
		}

		if len(empty.names) != 0 {
			t.Errorf("Expected empty names, but got %v", empty.names)
		}

		if len(empty.codes) != 0 {
			t.Errorf("Expected empty codes, but got %v", empty.codes)
		}
	}

	// invalid semver versions should always return error.
	{
		invalid := Versions{
			names: []string{
				"1.2.3",
				"x.1.y",
			},
			codes: []string{
				"1",
				"2",
			},
		}

		err := invalid.SemverSortByVersionDesc()

		if err == nil {
			t.Errorf("Expected non nil err, but got %v", err)
		}
	}

	// unsorted versions should sort in descending order
	// keeping codes in lock-step.
	{
		desc := Versions{
			names: []string{
				"1.2.3",
				"4.5.6",
				"1.0.0-alpha.beta",
				"1.0.0-rc.1",
			},
			codes: []string{
				"98",
				"2",
				"234",
				"99238",
			},
		}

		expected := Versions{
			names: []string{
				"4.5.6",
				"1.2.3",
				"1.0.0-rc.1",
				"1.0.0-alpha.beta",
			},
			codes: []string{
				"2",
				"98",
				"99238",
				"234",
			},
		}

		err := desc.SemverSortByVersionDesc()

		if err != nil {
			t.Errorf("Expected nil err, but got %v", err)
		}

		if !reflect.DeepEqual(expected.Versions(), desc.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), desc.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), desc.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), desc.Codes())
		}
	}

	// duplicate semver versions should sort in descending
	// order keeping codes in lock-step.
	{
		duplicates := Versions{
			names: []string{
				"1.2.3",
				"4.5.6",
				"1.2.3",
				"7.8.9",
				"1.2.3",
			},
			codes: []string{
				"9",
				"32",
				"8",
				"0",
				"7",
			},
		}

		expected := Versions{
			names: []string{
				"7.8.9",
				"4.5.6",
				"1.2.3",
				"1.2.3",
				"1.2.3",
			},
			codes: []string{
				"0",
				"32",
				"9",
				"8",
				"7",
			},
		}

		err := duplicates.SemverSortByVersionDesc()

		if err != nil {
			t.Errorf("Expected nil err, but got %v", err)
		}

		if !reflect.DeepEqual(expected.Versions(), duplicates.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), duplicates.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), duplicates.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), duplicates.Codes())
		}
	}
}
