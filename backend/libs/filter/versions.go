package filter

import (
	"sort"
	"strings"
)

func isVersionKey(keyName string) bool {
	switch keyName {
	case versionName.Name, versionCode.Name, patchVersion.Name:
		return true
	default:
		return false
	}
}

func sortVersionValues(values []Value) {
	sort.SliceStable(values, func(i, j int) bool {
		return compareVersions(values[i].Text, values[j].Text) > 0
	})
}

// A version is free text typed by a build tool or a person, so every string
// has to get a position: numeric prefixes rank above free text, a release
// above its own prereleases, and anything else compares as a plain string.
func compareVersions(a, b string) int {
	aNums, aRest, aHasNum := splitVersionPrefix(a)
	bNums, bRest, bHasNum := splitVersionPrefix(b)

	if aHasNum != bHasNum {
		if aHasNum {
			return 1
		}
		return -1
	}

	if !aHasNum {
		return strings.Compare(a, b)
	}

	if c := compareSegments(aNums, bNums); c != 0 {
		return c
	}

	if (aRest == "") != (bRest == "") {
		if aRest == "" {
			return 1
		}
		return -1
	}

	return strings.Compare(aRest, bRest)
}

func splitVersionPrefix(s string) (segments []string, rest string, hasPrefix bool) {
	i := 0
	n := len(s)

	if i >= n || s[i] < '0' || s[i] > '9' {
		return nil, s, false
	}

	start := i
	for i < n && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	segments = append(segments, s[start:i])

	for i < n && s[i] == '.' {
		digitsStart := i + 1
		j := digitsStart
		for j < n && s[j] >= '0' && s[j] <= '9' {
			j++
		}
		if j == digitsStart {
			break
		}
		segments = append(segments, s[digitsStart:j])
		i = j
	}

	return segments, s[i:], true
}

func compareSegments(a, b []string) int {
	n := max(len(a), len(b))
	for i := range n {
		as, bs := "0", "0"
		if i < len(a) {
			as = a[i]
		}
		if i < len(b) {
			bs = b[i]
		}
		if c := compareDigitStrings(as, bs); c != 0 {
			return c
		}
	}
	return 0
}

// Segments are compared as digit strings because a build number can be
// longer than any integer type holds.
func compareDigitStrings(a, b string) int {
	a = trimLeadingZeros(a)
	b = trimLeadingZeros(b)

	if len(a) != len(b) {
		if len(a) < len(b) {
			return -1
		}
		return 1
	}

	return strings.Compare(a, b)
}

func trimLeadingZeros(s string) string {
	i := 0
	for i < len(s)-1 && s[i] == '0' {
		i++
	}
	return s[i:]
}
