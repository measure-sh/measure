package filter

import (
	"strings"
	"testing"
	"time"

	"backend/libs/udattr"

	"github.com/google/uuid"
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
		expectedKeyType := udattr.AttrBool
		expectedOp := udattr.OpEq
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
		expectedKeyType := udattr.AttrInt64
		expectedOp := udattr.OpGte
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

func TestAppFilterValidatePlotTimeGroup(t *testing.T) {
	now := time.Now().UTC()

	for _, group := range []string{
		PlotTimeGroupMinutes,
		PlotTimeGroupHours,
		PlotTimeGroupDays,
		PlotTimeGroupMonths,
	} {
		af := AppFilter{
			AppID:         uuid.New(),
			From:          now.Add(-time.Hour),
			To:            now,
			Limit:         1,
			PlotTimeGroup: group,
		}

		if err := af.Validate(); err != nil {
			t.Fatalf("expected plot_time_group=%q to be valid, got %v", group, err)
		}
	}

	af := AppFilter{
		AppID:         uuid.New(),
		From:          now.Add(-time.Hour),
		To:            now,
		Limit:         1,
		PlotTimeGroup: "weeks",
	}

	if err := af.Validate(); err == nil {
		t.Fatalf("expected invalid plot_time_group to fail validation")
	} else if !strings.Contains(err.Error(), "`plot_time_group` must be one of:") {
		t.Fatalf("unexpected validation error: %v", err)
	}
}

func TestSetDefaultPlotTimeGroup(t *testing.T) {
	af := &AppFilter{}
	af.SetDefaultPlotTimeGroup()

	if af.PlotTimeGroup != PlotTimeGroupDays {
		t.Fatalf("expected default plot_time_group %q, got %q", PlotTimeGroupDays, af.PlotTimeGroup)
	}
}

func TestHasPlotTimeGroup(t *testing.T) {
	af := AppFilter{}
	if af.HasPlotTimeGroup() {
		t.Fatalf("expected HasPlotTimeGroup=false for empty value")
	}

	af.PlotTimeGroup = PlotTimeGroupHours
	if !af.HasPlotTimeGroup() {
		t.Fatalf("expected HasPlotTimeGroup=true for non-empty value")
	}
}

func TestAppFilterValidatePlotTimeGroupWithOtherFilters(t *testing.T) {
	now := time.Now().UTC()
	af := AppFilter{
		AppID:         uuid.New(),
		From:          now.Add(-24 * time.Hour),
		To:            now,
		Limit:         10,
		PlotTimeGroup: PlotTimeGroupMonths,
		Versions:      []string{"1.0.0"},
		VersionCodes:  []string{"100"},
		OsNames:       []string{"Android"},
		OsVersions:    []string{"14"},
	}
	if err := af.Validate(); err != nil {
		t.Fatalf("expected validation success with mixed filters, got %v", err)
	}

	af.PlotTimeGroup = "invalid_group"
	if err := af.Validate(); err == nil {
		t.Fatalf("expected validation error for invalid plot_time_group with mixed filters")
	}
}
