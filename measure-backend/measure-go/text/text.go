package text

import "strings"

// JoinNonEmptyStrings joins each non empty string
// value from the string slice using a delimiter and
// returns the joined string.
func JoinNonEmptyStrings(delim string, strs ...string) string {
	nonEmptyStrs := []string{}
	for _, str := range strs {
		if str != "" {
			nonEmptyStrs = append(nonEmptyStrs, str)
		}
	}
	return strings.Join(nonEmptyStrs, delim)
}
