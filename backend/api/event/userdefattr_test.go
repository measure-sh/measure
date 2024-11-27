package event

import (
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toBool(value) = ?)"
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toBool(value) != ?)"
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toInt64(value) > ?)"
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toInt64(value) < ?)"
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toFloat64(value) < ?)"
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toFloat64(value) <= ?)"
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toFloat64(value) > ?)"
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
		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toFloat64(value) >= ?)"
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

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND toBool(value) = ?)"
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

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value = ?) OR (key = ? AND type = ? AND toBool(value) = ?)"

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

		expectedStmt := "SELECT id, name FROM users WHERE is_active = ? AND (key = ? AND type = ? AND value = ?) OR (key = ? AND type = ? AND toBool(value) = ?)"

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
