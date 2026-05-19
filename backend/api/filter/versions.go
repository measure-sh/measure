package filter

import (
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/blang/semver/v4"
)

// numericRe matches a dot-separated numeric segment
// (e.g. "1", "1.2", "10.20.30").
var numericRe = regexp.MustCompile(`^([0-9]+\.?){1,3}$`)

// Versions represents a list of
// (version, code) pairs.
type Versions struct {
	names, codes []string
}

// Add adds a version name and code pair
// to versions.
func (v *Versions) Add(name, code string) {
	v.names = append(v.names, name)
	v.codes = append(v.codes, code)
}

// Sort sorts the (name, code) pairs in place according to these rules:
//
// Case A — names are valid semver, all codes are numeric:
//
//	sort descending numerically by code, then descending by semver name.
//
// Case B — names are not valid semver:
//
//	B.1 all names and codes are numeric: sort descending numerically by code, then descending by name.
//	B.2 names are non-numeric, codes are numeric: sort descending numerically by code, then descending alphabetically by name.
//	B.3 any code is non-numeric: sort descending alphabetically by code, then descending by name.
//
// When names are valid semver but codes are not all numeric, B.3 applies.
func (v *Versions) Sort() {
	n := len(v.names)
	if n <= 1 {
		return
	}

	idx := make([]int, n)
	for i := range idx {
		idx[i] = i
	}

	switch {
	case v.IsValidSemver() && allNumeric(v.codes):
		// Case A
		sort.SliceStable(idx, func(i, j int) bool {
			cmp := compareNumeric(v.codes[idx[i]], v.codes[idx[j]])
			if cmp != 0 {
				return cmp > 0
			}
			si, _ := semver.Parse(v.names[idx[i]])
			sj, _ := semver.Parse(v.names[idx[j]])
			return si.GT(sj)
		})

	case !v.IsValidSemver() && allNumeric(v.names) && allNumeric(v.codes):
		// Case B.1
		sort.SliceStable(idx, func(i, j int) bool {
			cmp := compareNumeric(v.codes[idx[i]], v.codes[idx[j]])
			if cmp != 0 {
				return cmp > 0
			}
			return compareNumeric(v.names[idx[i]], v.names[idx[j]]) > 0
		})

	case !v.IsValidSemver() && !allNumeric(v.names) && allNumeric(v.codes):
		// Case B.2
		sort.SliceStable(idx, func(i, j int) bool {
			cmp := compareNumeric(v.codes[idx[i]], v.codes[idx[j]])
			if cmp != 0 {
				return cmp > 0
			}
			return v.names[idx[i]] > v.names[idx[j]]
		})

	default:
		// Case B.3 (and A with non-numeric codes as fallback)
		sort.SliceStable(idx, func(i, j int) bool {
			ci, cj := v.codes[idx[i]], v.codes[idx[j]]
			if ci != cj {
				return ci > cj
			}
			return v.names[idx[i]] > v.names[idx[j]]
		})
	}

	newNames := make([]string, n)
	newCodes := make([]string, n)
	for i, k := range idx {
		newNames[i] = v.names[k]
		newCodes[i] = v.codes[k]
	}
	v.names = newNames
	v.codes = newCodes
}

// Versions gets the version names.
func (v Versions) Versions() []string {
	return v.names
}

// Codes gets the version codes.
func (v Versions) Codes() []string {
	return v.codes
}

// HasVersions returns true if at least
// 1 (version, code) pair exists.
func (v Versions) HasVersions() bool {
	return len(v.names) > 0
}

// IsValidSemver determines if all version names
// adhere to semver specification.
func (v Versions) IsValidSemver() bool {
	if len(v.names) < 1 {
		return false
	}

	for _, name := range v.names {
		if _, err := semver.Parse(name); err != nil {
			return false
		}
	}
	return true
}

// allNumeric reports whether every string in strs consists solely of
// dot-separated numeric segments (e.g. "1", "1.2", "10.20.30").
// Returns true for an empty slice.
func allNumeric(strs []string) bool {
	for _, s := range strs {
		if !numericRe.MatchString(s) {
			return false
		}
	}
	return true
}

// compareNumeric compares two numeric strings component-by-component.
// Returns -1, 0, or 1.
func compareNumeric(a, b string) int {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	n := max(len(pa), len(pb))
	for i := range n {
		var na, nb int
		if i < len(pa) {
			na, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			nb, _ = strconv.Atoi(pb[i])
		}
		if na != nb {
			if na > nb {
				return 1
			}
			return -1
		}
	}
	return 0
}

// exclude figures out the set of excluded versions
// from sets of all versions and sets of selected
// versions.
func exclude(allV, allC, selV, selC []string) (versions Versions) {
	selCount := make(map[string]int)
	for i := range selV {
		key := selV[i] + "\x00" + selC[i]
		selCount[key]++
	}

	for i := range allV {
		key := allV[i] + "\x00" + allC[i]
		if selCount[key] > 0 {
			selCount[key]--
			continue
		}
		versions.Add(allV[i], allC[i])
	}

	return
}
