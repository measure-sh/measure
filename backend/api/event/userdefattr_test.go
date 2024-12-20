package event

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/leporo/sqlf"
)

func TestEmpty(t *testing.T) {
	exprEmpty := UDExpression{}
	exprNotEmpty := UDExpression{
		Cmp: UDComparison{
			Key:   "us_resident",
			Type:  AttrBool,
			Op:    OpEq,
			Value: "true",
		},
	}
	cmpEmpty := UDComparison{}

	{
		expected := true
		got := exprEmpty.Empty()

		if expected != got {
			t.Errorf("Expected empty expression to be %v, got %v", expected, got)
		}
	}

	{
		expected := false
		got := exprNotEmpty.Empty()

		if expected != got {
			t.Errorf("Expected empty expression to be %v, got %v", expected, got)
		}
	}

	{
		expected := true
		got := cmpEmpty.Empty()

		if expected != got {
			t.Errorf("Expected empty comparison to be %v, got %v", expected, got)
		}
	}
}

func TestLeaf(t *testing.T) {
	exprEmpty := UDExpression{}
	exprNotEmpty := UDExpression{
		Cmp: UDComparison{
			Key:   "us_resident",
			Type:  AttrBool,
			Op:    OpEq,
			Value: "true",
		},
	}
	exprSingleAnd := UDExpression{
		And: []UDExpression{
			{
				Cmp: UDComparison{
					Key:   "us_resident",
					Type:  AttrBool,
					Op:    OpEq,
					Value: "true",
				},
			},
			{
				Cmp: UDComparison{
					Key:   "ca_resident",
					Type:  AttrBool,
					Op:    OpEq,
					Value: "true",
				},
			},
		},
	}

	{
		expected := false
		got := exprEmpty.Leaf()

		if expected != got {
			t.Errorf("Expected leaf expression to be %v, got %v", expected, got)
		}
	}

	{
		expected := true
		got := exprNotEmpty.Leaf()

		if expected != got {
			t.Errorf("Expected leaf expression to be %v, got %v", expected, got)
		}
	}

	{
		expected := false
		got := exprSingleAnd.Leaf()

		if expected != got {
			t.Errorf("Expected leaf expression to be %v, got %v", expected, got)
		}
	}
}

func TestDegree(t *testing.T) {
	exprEmpty := UDExpression{}
	exprSingleAnd := UDExpression{
		And: []UDExpression{
			{
				Cmp: UDComparison{
					Key:   "us_resident",
					Type:  AttrBool,
					Op:    OpEq,
					Value: "true",
				},
			},
			{
				Cmp: UDComparison{
					Key:   "ca_resident",
					Type:  AttrBool,
					Op:    OpEq,
					Value: "true",
				},
			},
		},
	}
	exprSingleCmp := UDExpression{
		Cmp: UDComparison{
			Key:   "credit_balance",
			Type:  AttrInt64,
			Op:    OpGte,
			Value: "1000",
		},
	}

	{
		expected := 1
		got := exprEmpty.Degree()

		if expected != got {
			t.Errorf("Expected %v degree, got %v", expected, got)
		}
	}

	{
		expected := 2
		got := exprSingleAnd.Degree()

		if expected != got {
			t.Errorf("Expected %v degree, got %v", expected, got)
		}
	}

	{
		expected := 1
		got := exprSingleCmp.Degree()

		if expected != got {
			t.Errorf("Expected %v degree, got %v", expected, got)
		}
	}
}

func TestAugmentComparison(t *testing.T) {
	cmpEmpty := UDComparison{}
	cmpBoolEq := UDComparison{
		Key:   "us_resident",
		Type:  AttrBool,
		Op:    OpEq,
		Value: "true",
	}
	cmpBoolNeq := UDComparison{
		Key:   "us_resident",
		Type:  AttrBool,
		Op:    OpNeq,
		Value: "false",
	}
	cmpInt64Gt := UDComparison{
		Key:   "credit_balance",
		Type:  AttrInt64,
		Op:    OpGt,
		Value: "1000",
	}
	cmpInt64Lt := UDComparison{
		Key:   "credit_balance",
		Type:  AttrInt64,
		Op:    OpLt,
		Value: "1000",
	}
	cmpFloat64Lt := UDComparison{
		Key:   "invested_amount",
		Type:  AttrFloat64,
		Op:    OpLt,
		Value: "1000.00",
	}
	cmpFloat64Lte := UDComparison{
		Key:   "invested_amount",
		Type:  AttrFloat64,
		Op:    OpLte,
		Value: "1000.00",
	}
	cmpFloat64Gt := UDComparison{
		Key:   "invested_amount",
		Type:  AttrFloat64,
		Op:    OpGt,
		Value: "999.99",
	}
	cmpFloat64Gte := UDComparison{
		Key:   "invested_amount",
		Type:  AttrFloat64,
		Op:    OpGte,
		Value: "1000.00",
	}
	cmpStringContains := UDComparison{
		Key:   "preference",
		Type:  AttrString,
		Op:    OpContains,
		Value: "spicy",
	}
	cmpStringStartsWith := UDComparison{
		Key:   "name",
		Type:  AttrString,
		Op:    OpStartsWith,
		Value: "Dr",
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpEmpty.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ?"
		expectedArgs := []any{true}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %v args, got %v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpBoolEq.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value = ?)"
		expectedArgs := []any{true, "us_resident", "bool", "true"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpBoolNeq.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value != ?)"
		expectedArgs := []any{true, "us_resident", "bool", "false"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpInt64Gt.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value > ?)"
		expectedArgs := []any{true, "credit_balance", "int64", "1000"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpInt64Lt.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value < ?)"
		expectedArgs := []any{true, "credit_balance", "int64", "1000"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpFloat64Lt.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value < ?)"
		expectedArgs := []any{true, "invested_amount", "float64", "1000.00"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpFloat64Lte.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value <= ?)"
		expectedArgs := []any{true, "invested_amount", "float64", "1000.00"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpFloat64Gt.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value > ?)"
		expectedArgs := []any{true, "invested_amount", "float64", "999.99"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpFloat64Gte.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value >= ?)"
		expectedArgs := []any{true, "invested_amount", "float64", "1000.00"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpStringContains.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value ilike %?%)"
		expectedArgs := []any{true, "preference", "string", "spicy"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}
		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()

		cmpStringStartsWith.Augment(stmt)
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value ilike ?%)"
		expectedArgs := []any{true, "name", "string", "Dr"}
		gotStmt := stmt.String()
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}
}

func TestAugmentExpression(t *testing.T) {
	exprEmpty := UDExpression{}
	exprNotEmpty := UDExpression{
		Cmp: UDComparison{
			Key:   "us_resident",
			Type:  AttrBool,
			Op:    OpEq,
			Value: "true",
		},
	}
	exprEscaped := UDExpression{
		Cmp: UDComparison{
			Key:   "username",
			Type:  AttrString,
			Op:    OpContains,
			Value: "ali%ce",
		},
	}
	exprAnd := UDExpression{
		And: []UDExpression{
			{
				Cmp: UDComparison{
					Key:   "username",
					Type:  AttrString,
					Op:    OpEq,
					Value: "alice",
				},
			},
			{
				Cmp: UDComparison{
					Key:   "premium_user",
					Type:  AttrBool,
					Op:    OpEq,
					Value: "true",
				},
			},
		},
	}
	exprOr := UDExpression{
		Or: []UDExpression{
			{
				Cmp: UDComparison{
					Key:   "username",
					Type:  AttrString,
					Op:    OpEq,
					Value: "alice",
				},
			},
			{
				Cmp: UDComparison{
					Key:   "premium_user",
					Type:  AttrBool,
					Op:    OpEq,
					Value: "true",
				},
			},
		},
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()
		exprEmpty.Augment(stmt)

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ?"
		gotStmt := stmt.String()
		expectedArgs := []any{true}
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()
		exprNotEmpty.Augment(stmt)

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value = ?)"
		gotStmt := stmt.String()
		expectedArgs := []any{true, "us_resident", "bool", "true"}
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()
		exprEscaped.Augment(stmt)

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value ilike %?%)"
		gotStmt := stmt.String()
		expectedArgs := []any{true, "username", "string", "ali\\%ce"}
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()
		exprAnd.Augment(stmt)

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value = ?) OR (key = ? AND type = ? AND value = ?)"

		gotStmt := stmt.String()
		expectedArgs := []any{true, "username", "string", "alice", "premium_user", "bool", "true"}
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}

	{
		stmt := sqlf.From("users").
			Select("id").
			Select("name").
			Where("is_active = ?", true)

		defer stmt.Close()
		exprOr.Augment(stmt)

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value = ?) OR (key = ? AND type = ? AND value = ?)"

		gotStmt := stmt.String()
		expectedArgs := []any{true, "username", "string", "alice", "premium_user", "bool", "true"}
		gotArgs := stmt.Args()

		if expectedStmt != gotStmt {
			t.Errorf("Expected %q sql statement, got %q", expectedStmt, gotStmt)
		}

		if !reflect.DeepEqual(expectedArgs, gotArgs) {
			t.Errorf("Expected %+#v args, got %+#v", expectedArgs, gotArgs)
		}
	}
}

func TestParameterize(t *testing.T) {
	udAttr := UDAttribute{
		rawAttrs: map[string]any{
			"max_int32":                float64(2147483647),
			"min_int32":                float64(-2147483648),
			"max_int64":                float64(9223372036854775807),
			"min_int64":                float64(-9223372036854775808),
			"max_float64":              float64(1.7976931348623157e+308),
			"min_float64":              float64(5e-324),
			"max_safe_integer":         float64(9007199254740991),
			"min_safe_integer":         float64(-9007199254740991),
			"regular_negative_float64": float64(-3.141519),
			"regular_positive_float64": float64(3.141519),
			"regular_negative_int64":   float64(-4200),
			"regular_positive_int64":   float64(4200),
			"zero_float64":             float64(0.0),
			"zero_int64":               float64(0),
			"regular_bool":             true,
			"regular_string":           "lorem ipsum",
		},
		keyTypes: map[string]AttrType{
			"max_int32":                AttrInt64,
			"min_int32":                AttrInt64,
			"max_int64":                AttrInt64,
			"min_int64":                AttrInt64,
			"max_float64":              AttrFloat64,
			"min_float64":              AttrFloat64,
			"max_safe_integer":         AttrInt64,
			"min_safe_integer":         AttrInt64,
			"regular_negative_float64": AttrFloat64,
			"regular_positive_float64": AttrFloat64,
			"regular_negative_int64":   AttrInt64,
			"regular_positive_int64":   AttrInt64,
			"zero_float64":             AttrInt64,
			"zero_int64":               AttrInt64,
			"regular_bool":             AttrBool,
			"regular_string":           AttrString,
		},
	}

	expected := map[string]string{
		"max_int32":                fmt.Sprintf(`('%s', '2147483647')`, AttrInt64.String()),
		"min_int32":                fmt.Sprintf(`('%s', '-2147483648')`, AttrInt64.String()),
		"max_int64":                fmt.Sprintf(`('%s', '9223372036854775807')`, AttrInt64.String()),
		"min_int64":                fmt.Sprintf(`('%s', '-9223372036854775808')`, AttrInt64.String()),
		"max_float64":              fmt.Sprintf(`('%s', '1.7976931348623157e+308')`, AttrFloat64.String()),
		"min_float64":              fmt.Sprintf(`('%s', '5e-324')`, AttrFloat64.String()),
		"max_safe_integer":         fmt.Sprintf(`('%s', '9007199254740991')`, AttrInt64.String()),
		"min_safe_integer":         fmt.Sprintf(`('%s', '-9007199254740991')`, AttrInt64.String()),
		"regular_negative_float64": fmt.Sprintf(`('%s', '-3.141519')`, AttrFloat64.String()),
		"regular_positive_float64": fmt.Sprintf(`('%s', '3.141519')`, AttrFloat64.String()),
		"regular_negative_int64":   fmt.Sprintf(`('%s', '-4200')`, AttrInt64.String()),
		"regular_positive_int64":   fmt.Sprintf(`('%s', '4200')`, AttrInt64.String()),
		"zero_float64":             fmt.Sprintf(`('%s', '0')`, AttrInt64.String()),
		"zero_int64":               fmt.Sprintf(`('%s', '0')`, AttrInt64.String()),
		"regular_bool":             fmt.Sprintf(`('%s', 'true')`, AttrBool.String()),
		"regular_string":           fmt.Sprintf(`('%s', 'lorem ipsum')`, AttrString.String()),
	}
	got := udAttr.Parameterize()

	if !reflect.DeepEqual(expected, got) {
		t.Errorf("Expected %+#v args, got %+#v", expected, got)
	}
}

func TestScan(t *testing.T) {
	attrMap := map[string][]any{
		"max_int32":                {AttrInt64.String(), 2147483647},
		"min_int32":                {AttrInt64.String(), -2147483648},
		"max_int64":                {AttrInt64.String(), 9223372036854775807},
		"min_int64":                {AttrInt64.String(), -9223372036854775808},
		"max_float64":              {AttrFloat64.String(), 1.7976931348623157e+308},
		"min_float64":              {AttrFloat64.String(), 5e-324},
		"max_safe_integer":         {AttrInt64.String(), 9007199254740991},
		"min_safe_integer":         {AttrInt64.String(), -9007199254740991},
		"regular_negative_float64": {AttrFloat64.String(), -3.141519},
		"regular_positive_float64": {AttrFloat64.String(), 3.141519},
		"regular_negative_int64":   {AttrInt64.String(), -4200},
		"regular_positive_int64":   {AttrInt64.String(), 4200},
		"zero_float64":             {AttrInt64.String(), 0},
		"zero_int64":               {AttrInt64.String(), 0},
		"regular_bool":             {AttrBool.String(), true},
		"regular_string":           {AttrString.String(), "lorem ipsum"},
	}
	var udAttr UDAttribute

	expectedKeyTypes := map[string]AttrType{
		"max_int32":                AttrInt64,
		"min_int32":                AttrInt64,
		"max_int64":                AttrInt64,
		"min_int64":                AttrInt64,
		"max_float64":              AttrFloat64,
		"min_float64":              AttrFloat64,
		"max_safe_integer":         AttrInt64,
		"min_safe_integer":         AttrInt64,
		"regular_negative_float64": AttrFloat64,
		"regular_positive_float64": AttrFloat64,
		"regular_negative_int64":   AttrInt64,
		"regular_positive_int64":   AttrInt64,
		"zero_float64":             AttrInt64,
		"zero_int64":               AttrInt64,
		"regular_bool":             AttrBool,
		"regular_string":           AttrString,
	}
	expectedRawAttrs := map[string]any{
		"max_int32":                2147483647,
		"min_int32":                -2147483648,
		"max_int64":                9223372036854775807,
		"min_int64":                -9223372036854775808,
		"max_float64":              1.7976931348623157e+308,
		"min_float64":              5e-324,
		"max_safe_integer":         9007199254740991,
		"min_safe_integer":         -9007199254740991,
		"regular_negative_float64": -3.141519,
		"regular_positive_float64": 3.141519,
		"regular_negative_int64":   -4200,
		"regular_positive_int64":   4200,
		"zero_float64":             0,
		"zero_int64":               0,
		"regular_bool":             true,
		"regular_string":           "lorem ipsum",
	}

	udAttr.Scan(attrMap)

	if !reflect.DeepEqual(expectedKeyTypes, udAttr.keyTypes) {
		t.Errorf("Expected %+#v args, got %+#v", expectedKeyTypes, udAttr.keyTypes)
	}

	if !reflect.DeepEqual(expectedRawAttrs, udAttr.rawAttrs) {
		t.Errorf("Expected %+#v args, got %+#v", expectedRawAttrs, udAttr.rawAttrs)
	}
}

func TestValidate(t *testing.T) {
	{
		udAttrEmpty := UDAttribute{}
		err := udAttrEmpty.Validate()
		if err == nil {
			t.Errorf("Expected an error, but got nil")
		}
	}
	{
		udAttrCount := UDAttribute{
			rawAttrs: map[string]any{},
		}

		for i := range maxUserDefAttrsCount + 10 {
			key := fmt.Sprintf("key-%d", i)
			value := fmt.Sprintf("value-%d", i)
			udAttrCount.rawAttrs[key] = value
		}

		err := udAttrCount.Validate()
		if err == nil {
			t.Errorf("Expected an error, but got nil")
		}
	}
	{
		udAttrHugeKey := UDAttribute{
			rawAttrs: map[string]any{
				"apple-banana-cherry-dog-42-elephant-frog-giraffe-87-honey-iguana-jump-kite-lion-monkey-nest-orange-99-penguin-queen-rabbit-snake-tiger-umbrella-violet-whale-xray-yak-zebra-12345-balloon-cactus-daisy-forest-galaxy-hippo-jungle-koala-ladder-77-mountain-ocean-polar": "some value",
			},
		}

		err := udAttrHugeKey.Validate()
		if err == nil {
			t.Errorf("Expected an error, but got nil")
		}
	}
	{
		udAttrInvalidKey := UDAttribute{
			rawAttrs: map[string]any{
				"key contains spaces": "some value",
			},
		}

		err := udAttrInvalidKey.Validate()
		if err == nil {
			t.Errorf("Expected an error, but got nil")
		}
	}
	{
		udAttrHugeValue := UDAttribute{
			rawAttrs: map[string]any{
				"some-key": "apple-banana-cherry-dog-42-elephant-frog-giraffe-87-honey-iguana-jump-kite-lion-monkey-nest-orange-99-penguin-queen-rabbit-snake-tiger-umbrella-violet-whale-xray-yak-zebra-12345-balloon-cactus-daisy-forest-galaxy-hippo-jungle-koala-ladder-77-mountain-ocean-polar",
			},
		}

		err := udAttrHugeValue.Validate()
		if err == nil {
			t.Errorf("Expected an error, but got nil")
		}
	}
}
