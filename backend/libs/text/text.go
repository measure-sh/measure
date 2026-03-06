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

// SplitTrimEmpty trims the string then splits
// using the delimeter then trims each item then
// skips if the any item is empty string and
// returns a new slice of processed strings.
func SplitTrimEmpty(str, del string) (result []string) {
	items := strings.Split(strings.TrimSpace(str), del)
	for i := range items {
		items[i] = strings.TrimSpace(items[i])
		if items[i] == "" {
			continue
		}
		result = append(result, items[i])
	}
	return
}
