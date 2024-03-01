package text

import "strings"

// JoinNonEmptyStrings joins each non empty string
// value from variadic parameters using a delimiter
// before returning the joined string.
func JoinNonEmptyStrings(delim string, strs ...string) string {
	nonEmptyStrs := []string{}
	for _, str := range strs {
		if str != "" {
			nonEmptyStrs = append(nonEmptyStrs, str)
		}
	}
	return strings.Join(nonEmptyStrs, delim)
}

// TrimFixedString trims null characters from
// right side of the string and returns the
// trimmed string.
func TrimFixedString(s string) string {
	return strings.TrimRight(s, "\x00")
}
