package filter

import (
	"sort"

	"github.com/blang/semver/v4"
)

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

// SemverSortByVersionDesc sorts version names in
// descending semver order keeping version code in
// lock-step with version name.
// Assumes version name is valid semver.
func (v *Versions) SemverSortByVersionDesc() (err error) {
	if len(v.names) < 1 {
		return
	}

	type pair struct {
		ver  semver.Version
		name string
		code string
	}

	pairs := make([]pair, len(v.names))

	for i, name := range v.names {
		semver, err := semver.Parse(name)
		if err != nil {
			return err
		}
		pairs[i] = pair{
			ver:  semver,
			name: name,
			code: v.codes[i],
		}
	}

	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].ver.GT(pairs[j].ver)
	})

	sortedNames := make([]string, len(pairs))
	sortedCodes := make([]string, len(pairs))

	for i, p := range pairs {
		sortedNames[i] = p.name
		sortedCodes[i] = p.code
	}

	v.names = sortedNames
	v.codes = sortedCodes

	return
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

// HasVersions returns true if at least
// 1 (version, code) pair exists.
func (v Versions) HasVersions() bool {
	return len(v.names) > 0
}

// Versions gets the version names.
func (v Versions) Versions() []string {
	return v.names
}

// Codes gets the version codes.
func (v Versions) Codes() []string {
	return v.codes
}
