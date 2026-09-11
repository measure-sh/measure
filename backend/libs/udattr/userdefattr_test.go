package udattr

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
)

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
			"regular_bool_true":        true,
			"regular_bool_false":       false,
			"regular_string":           "lorem ipsum",
			"single_quote":             "lorem 'ipsum",
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
			"regular_bool_true":        AttrBool,
			"regular_bool_false":       AttrBool,
			"regular_string":           AttrString,
			"single_quote":             AttrString,
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
		"regular_bool_true":        fmt.Sprintf(`('%s', 'true')`, AttrBool.String()),
		"regular_bool_false":       fmt.Sprintf(`('%s', 'false')`, AttrBool.String()),
		"regular_string":           fmt.Sprintf(`('%s', 'lorem ipsum')`, AttrString.String()),
		"single_quote":             fmt.Sprintf(`('%s', 'lorem \'ipsum')`, AttrString.String()),
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
		"single_quote":             {AttrString.String(), "lorem \\'ipsum"},
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
		"single_quote":             AttrString,
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
		"single_quote":             "lorem 'ipsum",
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

func TestMarshalJSON(t *testing.T) {
	// Native typed values from JSON unmarshal — the bug scenario reported:
	// bool/float64 values arrive as their native Go types, not strings.
	{
		ud := UDAttribute{
			rawAttrs: map[string]any{
				"app_startup_first_viewcontroller": true,
				"retry_count":                      float64(3),
				"load_time_ms":                     float64(1.5),
				"label":                            "home",
			},
			keyTypes: map[string]AttrType{
				"app_startup_first_viewcontroller": AttrBool,
				"retry_count":                      AttrInt64,
				"load_time_ms":                     AttrFloat64,
				"label":                            AttrString,
			},
		}

		data, err := json.Marshal(ud)
		if err != nil {
			t.Fatalf("unexpected error marshalling native typed attrs: %v", err)
		}

		var got map[string]any
		if err := json.Unmarshal(data, &got); err != nil {
			t.Fatalf("unexpected error unmarshalling result: %v", err)
		}

		if v, ok := got["app_startup_first_viewcontroller"].(bool); !ok || v != true {
			t.Errorf("expected app_startup_first_viewcontroller=true (bool), got %T(%v)", got["app_startup_first_viewcontroller"], got["app_startup_first_viewcontroller"])
		}
		if v, ok := got["retry_count"].(float64); !ok || v != 3 {
			t.Errorf("expected retry_count=3, got %T(%v)", got["retry_count"], got["retry_count"])
		}
		if v, ok := got["load_time_ms"].(float64); !ok || v != 1.5 {
			t.Errorf("expected load_time_ms=1.5, got %T(%v)", got["load_time_ms"], got["load_time_ms"])
		}
		if v, ok := got["label"].(string); !ok || v != "home" {
			t.Errorf("expected label=\"home\", got %T(%v)", got["label"], got["label"])
		}
	}

	// Validate then marshal — exercises the full round-trip as it happens in production.
	{
		ud := UDAttribute{
			rawAttrs: map[string]any{
				"is_premium": true,
				"score":      float64(42),
				"ratio":      float64(0.75),
				"tier":       "gold",
			},
		}

		if err := ud.Validate(); err != nil {
			t.Fatalf("unexpected validation error: %v", err)
		}

		data, err := json.Marshal(ud)
		if err != nil {
			t.Fatalf("unexpected error marshalling after validate: %v", err)
		}

		var got map[string]any
		if err := json.Unmarshal(data, &got); err != nil {
			t.Fatalf("unexpected error unmarshalling result: %v", err)
		}

		if v, ok := got["is_premium"].(bool); !ok || v != true {
			t.Errorf("expected is_premium=true (bool), got %T(%v)", got["is_premium"], got["is_premium"])
		}
		if v, ok := got["score"].(float64); !ok || v != 42 {
			t.Errorf("expected score=42, got %T(%v)", got["score"], got["score"])
		}
		if v, ok := got["ratio"].(float64); !ok || v != 0.75 {
			t.Errorf("expected ratio=0.75, got %T(%v)", got["ratio"], got["ratio"])
		}
		if v, ok := got["tier"].(string); !ok || v != "gold" {
			t.Errorf("expected tier=\"gold\", got %T(%v)", got["tier"], got["tier"])
		}
	}

	// Int64 overflow: value too large for int64 should be kept as a string.
	{
		ud := UDAttribute{
			rawAttrs: map[string]any{
				"big_number": "99999999999999999999",
			},
			keyTypes: map[string]AttrType{
				"big_number": AttrInt64,
			},
		}

		data, err := json.Marshal(ud)
		if err != nil {
			t.Fatalf("unexpected error marshalling int64 overflow: %v", err)
		}

		var got map[string]any
		if err := json.Unmarshal(data, &got); err != nil {
			t.Fatalf("unexpected error unmarshalling result: %v", err)
		}

		if _, ok := got["big_number"].(string); !ok {
			t.Errorf("expected big_number to be kept as string on overflow, got %T(%v)", got["big_number"], got["big_number"])
		}
	}
}
