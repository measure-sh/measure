package udattr

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

// attrKeyPattern defines the regular
// expression pattern for validating
// attribute keys.
const attrKeyPattern = "^[a-zA-Z0-9_-]+$"

const (
	maxUserDefAttrsCount     = 100
	maxUserDefAttrsKeyChars  = 256
	maxUserDefAttrsValsChars = 256
)

const (
	AttrUnknown AttrType = iota
	AttrString
	AttrInt64
	AttrFloat64
	AttrBool
)

type AttrType int

// String returns a string representation of the
// attribute type.
func (a AttrType) String() string {
	switch a {
	default:
		return "unknown"
	case AttrString:
		return "string"
	case AttrInt64:
		return "int64"
	case AttrFloat64:
		return "float64"
	case AttrBool:
		return "bool"
	}
}

// UDAttribute represents user defined
// attributes in a convenient & usable
// structure.
//
// User Defined Attributes are related
// to events or spans.
type UDAttribute struct {
	rawAttrs map[string]any
	keyTypes map[string]AttrType
}

// Empty returns true if user defined
// attributes does not contain any keys
// or attributes.
func (u UDAttribute) Empty() bool {
	return len(u.rawAttrs) == 0 && len(u.keyTypes) == 0
}

// MarshalJSON marshals UDAttribute type of user
// defined attributes to JSON.
func (u UDAttribute) MarshalJSON() (data []byte, err error) {
	// copy to avoid mutating the receiver
	attrs := make(map[string]any, len(u.rawAttrs))
	maps.Copy(attrs, u.rawAttrs)

	for key, keytype := range u.keyTypes {
		raw, ok := attrs[key]
		if !ok {
			continue
		}

		switch keytype {
		case AttrBool:
			switch v := raw.(type) {
			case bool:
				// already the correct type from JSON unmarshal
			case string:
				parsed, parseErr := strconv.ParseBool(v)
				if parseErr != nil {
					return nil, fmt.Errorf("attribute %q: %w", key, parseErr)
				}
				attrs[key] = parsed
			default:
				return nil, fmt.Errorf("expected attribute %q to be bool or string, got %T", key, raw)
			}

		case AttrInt64:
			switch v := raw.(type) {
			case float64:
				attrs[key] = int64(v)
			case int64:
				// already the correct type
			case string:
				parsed, parseErr := strconv.ParseInt(v, 10, 64)
				if parseErr != nil {
					if numErr, ok := parseErr.(*strconv.NumError); ok && numErr.Err == strconv.ErrRange {
						// overflow: keep as string
						continue
					}
					return nil, fmt.Errorf("attribute %q: %w", key, parseErr)
				}
				attrs[key] = parsed
			default:
				return nil, fmt.Errorf("expected attribute %q to be number or string, got %T", key, raw)
			}

		case AttrFloat64:
			switch v := raw.(type) {
			case float64:
				// already the correct type from JSON unmarshal
			case string:
				parsed, parseErr := strconv.ParseFloat(v, 64)
				if parseErr != nil {
					return nil, fmt.Errorf("attribute %q: %w", key, parseErr)
				}
				attrs[key] = parsed
			default:
				return nil, fmt.Errorf("expected attribute %q to be number or string, got %T", key, raw)
			}

		case AttrString:
			// already a string, nothing to do
		}
	}

	return json.Marshal(attrs)
}

// UnmarshalJSON unmarshalls bytes resembling user defined
// attributes to UDAttribute type.
func (u *UDAttribute) UnmarshalJSON(data []byte) (err error) {
	return json.Unmarshal(data, &u.rawAttrs)
}

// Validate validates user defined attributes bag.
func (u *UDAttribute) Validate() (err error) {
	if u.rawAttrs == nil {
		return errors.New("user defined attributes must not be empty")
	}

	re := regexp.MustCompile(attrKeyPattern)

	count := len(u.rawAttrs)

	if count > maxUserDefAttrsCount {
		return fmt.Errorf("user defined attributes must not exceed %d items", maxUserDefAttrsCount)
	}

	if u.keyTypes == nil {
		u.keyTypes = make(map[string]AttrType)
	}

	for k, v := range u.rawAttrs {
		if len(k) > maxUserDefAttrsKeyChars {
			return fmt.Errorf("user defined attribute keys must not exceed %d characters", maxUserDefAttrsKeyChars)
		}

		if !re.MatchString(k) {
			return fmt.Errorf("user defined attribute keys must only contain alphabets, numbers, hyphens and underscores")
		}

		switch value := v.(type) {
		case string:
			if len(value) > maxUserDefAttrsValsChars {
				return fmt.Errorf("user defined attributes string values must not exceed %d characters", maxUserDefAttrsValsChars)
			}

			u.keyTypes[k] = AttrString
			continue
		case bool:
			u.keyTypes[k] = AttrBool
		case float64:
			if reflect.TypeOf(v).Kind() == reflect.Float64 {
				if v == float64(int64(value)) {
					if value < math.MinInt64 || value > math.MaxInt64 {
						return fmt.Errorf(`value of user defined attribute %q should be within int64 range >%d <%d`, k, math.MinInt64, math.MaxInt64)
					}
					u.keyTypes[k] = AttrInt64
				} else {
					if value > math.MaxFloat64 {
						return fmt.Errorf(`value of user defined attribute %q should be within float64 range <%f`, k, math.MaxFloat64)
					}
					u.keyTypes[k] = AttrFloat64
				}
			}
			continue
		default:
			return fmt.Errorf("user defined attribute values can be only string, number or boolean")
		}
	}

	return
}

// HasItems returns true if user defined
// attribute is not empty.
func (u *UDAttribute) HasItems() bool {
	return len(u.rawAttrs) > 0
}

// Parameterize provides user defined attributes in a
// compatible data structure that database query engines
// can directly consume.
func (u *UDAttribute) Parameterize() (attr map[string]string) {
	attr = map[string]string{}

	for k, v := range u.rawAttrs {
		var val string
		switch v := v.(type) {
		case bool:
			val = strconv.FormatBool(v)
		case float64:
			if intVal, ok := convertToInt64Safely(v); ok {
				val = strconv.FormatInt(intVal, 10)
			} else {
				val = strconv.FormatFloat(v, 'g', -1, 64)
			}
		case int64:
			// usually, this case won't hit
			// because numbers parsed from JSON
			// will always be float64
			// but let's handle it just in case
			val = strconv.FormatInt(v, 10)
		case string:
			// escape any single quote, if any
			// if not escaped, ClickHouse insert will
			// throw errors.
			v = strings.ReplaceAll(v, "'", "\\'")
			val = v
		}

		attr[k] = fmt.Sprintf("('%s', '%s')", u.keyTypes[k].String(), val)
	}

	return
}

// Scan scans and stores user defined attribute
// data coming from a database query result.
func (u *UDAttribute) Scan(attrMap map[string][]any) {
	for key, tuple := range attrMap {
		intType := tuple[0]
		if u.keyTypes == nil {
			u.keyTypes = make(map[string]AttrType)
		}
		if u.rawAttrs == nil {
			u.rawAttrs = make(map[string]any)
		}
		attrType := intType.(string)
		switch attrType {
		case AttrBool.String():
			u.keyTypes[key] = AttrBool
		case AttrString.String():
			u.keyTypes[key] = AttrString
			if value, ok := tuple[1].(string); ok {
				// unescape single quotes if any
				tuple[1] = strings.ReplaceAll(value, "\\'", "'")
			}
		case AttrInt64.String():
			u.keyTypes[key] = AttrInt64
		case AttrFloat64.String():
			u.keyTypes[key] = AttrFloat64
		}
		u.rawAttrs[key] = tuple[1]
	}
}

// convertToInt64Safely converts float64 value to int64
// in an architecture agnostic way while handling upper
// and lower bounds of int64 type.
func convertToInt64Safely(value float64) (int64, bool) {
	// float64 value should be within int64 range
	if value < float64(math.MinInt64) || value > float64(math.MaxInt64) {
		return 0, false
	}

	// convert to int64 if an exact integer
	if value == math.Trunc(value) {
		intVal := int64(value)

		// detect and saturate on overflow
		//
		// on amd64/x86 systems, converting a float64 -> int64
		// may cause integer overflow. due to this, a value of
		// math.MaxInt64 may be converted to math.MinInt64. that
		// would be terribly terribly wrong. so, we detect if
		// this kind of overflow happens and saturate it to the
		// upper bound of int64 ourselves.
		//
		// aarch64/arm64 systems on the other hand are more
		// "modern" in nature. they always saturate on overflow
		// instead of rotating to the extreme lower bound.
		//
		// read more about this:
		// 1. https://www.forrestthewoods.com/blog/perfect_prevention_of_int_overflows/
		// 2. https://frama-c.com/2013/10/09/Overflow-float-integer.html
		// 3. https://learn.arm.com/learning-paths/cross-platform/integer-vs-floats/integer-float-conversions/
		// 4. https://go.dev/ref/spec#Conversions
		// 5. https://github.com/golang/go/issues/45588
		if value > 0 && intVal < 0 {
			intVal = math.MaxInt64
		}

		return intVal, true
	}

	// can't be converted
	// not an exact integer
	return 0, false
}
