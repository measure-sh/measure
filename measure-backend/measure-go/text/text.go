package text

import "strings"

func JoinNonEmptyStrings(delim string, strs ...string) string {
	nonEmptyStrs := []string{}
	for _, str := range strs {
		if str != "" {
			nonEmptyStrs = append(nonEmptyStrs, str)
		}
	}
	return strings.Join(nonEmptyStrs, delim)
}
