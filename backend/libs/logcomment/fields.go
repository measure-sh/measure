package logcomment

import (
	"errors"
	"sort"
	"strings"
)

// Fields represents the log comment
// field set.
type Fields struct {
	m map[string]string
}

// New creates a field set with fixed capacity.
func New(capacity int) *Fields {
	return &Fields{m: make(map[string]string, capacity)}
}

// isValidKey validates the field's key
//
// condition: [A-Za-z0-9_]+
func isValidKey(s string) bool {
	if len(s) == 0 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !(c >= 'a' && c <= 'z' ||
			c >= 'A' && c <= 'Z' ||
			c >= '0' && c <= '9' ||
			c == '_') {
			return false
		}
	}
	return true
}

// isValidValue validates the field's value
//
// condition: no space, no '='
func isValidValue(s string) bool {
	if len(s) == 0 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] == ' ' || s[i] == '=' {
			return false
		}
	}
	return true
}

var (
	ErrInvalidKey   = errors.New("invalid key")
	ErrInvalidValue = errors.New("invalid value")
)

// Put inserts or overwrites a field's key=value.
func (f *Fields) Put(key, value string) error {
	if !isValidKey(key) {
		return ErrInvalidKey
	}
	if !isValidValue(value) {
		return ErrInvalidValue
	}
	f.m[key] = value
	return nil
}

// MustPut puts the field's key & value or panics on invalid input.
func (f *Fields) MustPut(key, value string) *Fields {
	if err := f.Put(key, value); err != nil {
		panic(err)
	}
	return f
}

// Get gets the field's value for key.
func (f *Fields) Get(key string) (string, bool) {
	v, ok := f.m[key]
	return v, ok
}

// String serializes fields in fastest form (non-deterministic order).
func (f *Fields) String() string {
	if len(f.m) == 0 {
		return ""
	}

	var b strings.Builder
	b.Grow(len(f.m) * 16)
	first := true

	for k, v := range f.m {
		if !first {
			b.WriteByte(' ')
		}
		first = false
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(v)
	}
	return b.String()
}

// StringSorted serializes fields with sorted keys for stable output.
func (f *Fields) StringSorted() string {
	if len(f.m) == 0 {
		return ""
	}

	keys := make([]string, 0, len(f.m))
	for k := range f.m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	b.Grow(len(keys) * 16)
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(' ')
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(f.m[k])
	}
	return b.String()
}

// Parse parses "k=v k=v" with minimal allocation.
func Parse(s string, capacity int) (*Fields, error) {
	f := New(capacity)
	n := len(s)
	i := 0

	for i < n {
		// skip spaces
		for i < n && s[i] == ' ' {
			i++
		}
		if i >= n {
			break
		}

		// parse key
		start := i
		for i < n && s[i] != '=' {
			i++
		}
		if i == start || i >= n {
			return nil, ErrInvalidKey
		}
		key := s[start:i]

		// skip '='
		i++

		// parse value
		start = i
		for i < n && s[i] != ' ' {
			i++
		}
		if i == start {
			return nil, ErrInvalidValue
		}
		val := s[start:i]

		if err := f.Put(key, val); err != nil {
			return nil, err
		}
	}
	return f, nil
}
