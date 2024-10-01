package event

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
)

type attr_type int

const (
	attr_unknown attr_type = iota
	attr_string
	attr_number
	attr_bool
)

// type AttrNumber interface {
// 	int | float64
// }

// type AttrVal interface {
// 	string | bool | AttrNumber
// }

// type UDKey struct {
// 	Type int
// 	Val  string
// }

// type UDVal[T AttrVal] struct {
// 	Val T
// }

// type UDAttribute map[string]any

// type rawAttrs map[string]any

// UDAttribute defines User Defined Attributes designed
// to be attached to each event. An event can have multiple
// user defined attributes.
type UDAttribute struct {
	rawAttrs    map[string]any
	keyTypes    map[string]string
	keys        []string
	types       []string
	stringVals  []string
	boolVals    []bool
	int64Vals   []int
	float64Vals []float64
}

// UnmarshalJSON unmarshals bytes resembling user defined
// attributes to an internal representation.
func (u *UDAttribute) UnmarshalJSON(data []byte) (err error) {
	return json.Unmarshal(data, &u.rawAttrs)
}

// MarshalJSON marshals internal representation of user defined
// attributes to JSON.
func (u UDAttribute) MarshalJSON() (data []byte, err error) {
	return json.Marshal(u.rawAttrs)
}

// Validate validate the user defined attributes bag.
func (u *UDAttribute) Validate() (err error) {
	if u.rawAttrs == nil {
		return errors.New("user defined attribute must not be empty")
	}

	count := len(u.rawAttrs)

	if count > maxUseDefAttrsCount {
		return fmt.Errorf("user defined attributes must not exceed %d items", maxUseDefAttrsCount)
	}

	if u.keyTypes == nil {
		u.keyTypes = make(map[string]string)
	}

	index := -1

	for k, v := range u.rawAttrs {
		if len(k) > maxUseDefAttrsKeyChars {
			return fmt.Errorf("user defined attribute keys must not exceed %d characters", maxUseDefAttrsKeyChars)
		}

		index += 1

		switch value := v.(type) {
		case string:
			if len(v.(string)) > maxUseDefAttrsValChars {
				return fmt.Errorf("user defined attributes string values must not exceed %d characters", maxUseDefAttrsValChars)
			}
			u.keyTypes[k] = "string"
			u.types = append(u.types, "string")

			continue
		case bool:
			u.keyTypes[k] = "bool"
			u.types = append(u.types, "bool")
			continue
		case float64:
			if reflect.TypeOf(v).Kind() == reflect.Float64 {
				if v == float64(int(value)) {
					u.keyTypes[k] = "int64"
					u.types = append(u.types, "int64")
				} else {
					u.keyTypes[k] = "float64"
					u.types = append(u.types, "float64")
				}
			}
			continue
		default:
			return fmt.Errorf("user defined attribute values can be only string, number or boolean")
		}
	}

	return
}

func (u *UDAttribute) HasItems() bool {
	return len(u.rawAttrs) > 0
}

func (u UDAttribute) GetKeys() (keys []string) {
	return u.keys
}

func (u UDAttribute) GetTypes() (types []string) {
	return u.types
}

func (u UDAttribute) BuildArgs() (err error) {
	return
}
