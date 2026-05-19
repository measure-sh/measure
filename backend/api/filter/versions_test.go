package filter

import (
	"reflect"
	"testing"
)

func TestIsValidSemver(t *testing.T) {
	// empty versions are not valid semver.
	{
		empty := Versions{
			names: []string{},
			codes: []string{},
		}

		expected := false
		got := empty.IsValidSemver()

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// invalid versions are not valid semver.
	{
		invalid := Versions{
			names: []string{
				"1.2.3",
				"4.5.6.7",
			},
			codes: []string{
				"1",
				"2",
			},
		}

		expected := false
		got := invalid.IsValidSemver()

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// valid semver versions should report
	// as valid.
	{
		valid := Versions{
			names: []string{
				"1.2.3",
				"4.5.6",
				"1.0.0-alpha.beta",
				"1.0.0-rc.1",
			},
			codes: []string{
				"1",
				"2",
			},
		}

		expected := true
		got := valid.IsValidSemver()

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestExclude(t *testing.T) {
	// no selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"4.5.6",
		}
		selCodes := []string{
			"7",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{
				"1.0.1",
				"1.0.1",
				"1.0.2",
			},
			codes: []string{
				"0",
				"1",
				"2",
			},
		}

		if !reflect.DeepEqual(expected.Versions(), got.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), got.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), got.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), got.Codes())
		}
	}

	// at least 1 selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"1.0.1",
		}
		selCodes := []string{
			"1",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{
				"1.0.1",
				"1.0.2",
			},
			codes: []string{
				"0",
				"2",
			},
		}

		if !reflect.DeepEqual(expected.Versions(), got.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), got.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), got.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), got.Codes())
		}
	}

	// more than 1 selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"1.0.1",
			"1.0.2",
		}
		selCodes := []string{
			"1",
			"2",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{
				"1.0.1",
			},
			codes: []string{
				"0",
			},
		}

		if !reflect.DeepEqual(expected.Versions(), got.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), got.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), got.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), got.Codes())
		}
	}

	// all selected versions match
	{
		allVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		allCodes := []string{
			"0",
			"1",
			"2",
		}

		selVersions := []string{
			"1.0.1",
			"1.0.1",
			"1.0.2",
		}
		selCodes := []string{
			"0",
			"1",
			"2",
		}

		got := exclude(allVersions, allCodes, selVersions, selCodes)
		expected := Versions{
			names: []string{},
			codes: []string{},
		}

		if len(got.Versions()) > 0 {
			t.Errorf("Expected %d length, but got %d length", len(expected.Versions()), len(got.Versions()))
		}

		if len(got.Codes()) > 0 {
			t.Errorf("Expected %d length, but got %d length", len(expected.Codes()), len(got.Codes()))
		}
	}
}

func TestAllNumeric(t *testing.T) {
	// empty slice should return true.
	{
		expected := true
		got := allNumeric([]string{})

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// single numeric segment should return true.
	{
		expected := true
		got := allNumeric([]string{"1", "42", "100"})

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// zero preceded numbers should return true.
	{
		expected := true
		got := allNumeric([]string{"1", "042", "100"})

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// dot-separated numeric segments should return true.
	{
		expected := true
		got := allNumeric([]string{"1.2", "1.0.0", "10.20.30"})

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// alphabetic strings should return false.
	{
		expected := false
		got := allNumeric([]string{"1.2.3", "abc"})

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// semver pre-release strings should return false.
	{
		expected := false
		got := allNumeric([]string{"1.0.0-alpha", "1.0.0-rc.1"})

		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestCompareNumeric(t *testing.T) {
	// equal versions should return 0.
	{
		if got := compareNumeric("1.2.3", "1.2.3"); got != 0 {
			t.Errorf("Expected 0, but got %v", got)
		}
	}

	// greater major version should return 1.
	{
		if got := compareNumeric("2.0.0", "1.9.9"); got != 1 {
			t.Errorf("Expected 1, but got %v", got)
		}
	}

	// lesser major version should return -1.
	{
		if got := compareNumeric("1.0.0", "2.0.0"); got != -1 {
			t.Errorf("Expected -1, but got %v", got)
		}
	}

	// greater minor version should return 1.
	{
		if got := compareNumeric("1.3.0", "1.2.9"); got != 1 {
			t.Errorf("Expected 1, but got %v", got)
		}
	}

	// greater patch version should return 1.
	{
		if got := compareNumeric("1.2.4", "1.2.3"); got != 1 {
			t.Errorf("Expected 1, but got %v", got)
		}
	}

	// missing segment should be treated as 0.
	{
		if got := compareNumeric("1.2", "1.2.0"); got != 0 {
			t.Errorf("Expected 0, but got %v", got)
		}
	}

	// longer version with higher trailing segment should return 1.
	{
		if got := compareNumeric("1.2.0.1", "1.2.0"); got != 1 {
			t.Errorf("Expected 1, but got %v", got)
		}
	}
}

func TestSort(t *testing.T) {
	// empty slice should be a no-op.
	{
		v := Versions{names: []string{}, codes: []string{}}
		v.Sort()
		if len(v.names) != 0 || len(v.codes) != 0 {
			t.Errorf("Expected empty, but got names=%v codes=%v", v.names, v.codes)
		}
	}

	// single entry should be a no-op.
	{
		v := Versions{names: []string{"1.2.3"}, codes: []string{"42"}}
		v.Sort()
		if v.names[0] != "1.2.3" || v.codes[0] != "42" {
			t.Errorf("Expected unchanged, but got names=%v codes=%v", v.names, v.codes)
		}
	}

	// Case A: valid semver names + numeric codes — sort descending by code,
	// then by semver name on tie.
	{
		v := Versions{
			names: []string{"1.0.0", "2.0.0", "1.5.0", "3.0.0"},
			codes: []string{"10", "30", "10", "20"},
		}
		v.Sort()

		expectedNames := []string{"2.0.0", "3.0.0", "1.5.0", "1.0.0"}
		expectedCodes := []string{"30", "20", "10", "10"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case A names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case A codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case A: valid semver names + dotted numeric codes (e.g. "1.2.3" style
	// build codes) — compareNumeric orders segments individually so "1.10.0"
	// beats "1.9.0".
	{
		v := Versions{
			names: []string{"1.0.0", "2.0.0", "3.0.0", "1.5.0"},
			codes: []string{"1.9.0", "1.10.0", "1.9.0", "2.0.0"},
		}
		v.Sort()

		expectedNames := []string{"1.5.0", "2.0.0", "3.0.0", "1.0.0"}
		expectedCodes := []string{"2.0.0", "1.10.0", "1.9.0", "1.9.0"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case A dotted codes names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case A dotted codes codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case A: valid semver names + three-segment dotted numeric codes
	// (e.g. "10.20.30") — numeric comparison treats each segment independently.
	{
		v := Versions{
			names: []string{"1.0.0", "2.0.0", "3.0.0"},
			codes: []string{"10.20.30", "10.9.99", "10.20.30"},
		}
		v.Sort()

		expectedNames := []string{"3.0.0", "1.0.0", "2.0.0"}
		expectedCodes := []string{"10.20.30", "10.20.30", "10.9.99"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case A three-segment codes names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case A three-segment codes codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case A: code tie broken by semver descending (pre-release < release).
	{
		v := Versions{
			names: []string{"1.0.0-alpha", "1.0.0", "1.0.0-rc.1"},
			codes: []string{"5", "5", "5"},
		}
		v.Sort()

		expectedNames := []string{"1.0.0", "1.0.0-rc.1", "1.0.0-alpha"}
		expectedCodes := []string{"5", "5", "5"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case A pre-release tie names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case A pre-release tie codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case A: names and codes kept in lock-step after sort.
	{
		v := Versions{
			names: []string{"1.0.0", "2.0.0", "3.0.0"},
			codes: []string{"1", "3", "2"},
		}
		v.Sort()

		expectedNames := []string{"2.0.0", "3.0.0", "1.0.0"}
		expectedCodes := []string{"3", "2", "1"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case A lock-step names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case A lock-step codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case B.1: non-semver numeric names + numeric codes — sort descending
	// numerically by code, then by name on tie.
	{
		v := Versions{
			names: []string{"10", "9", "10", "2"},
			codes: []string{"3", "1", "3", "5"},
		}
		v.Sort()

		expectedNames := []string{"2", "10", "10", "9"}
		expectedCodes := []string{"5", "3", "3", "1"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case B.1 names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case B.1 codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case B.1: dotted numeric names (e.g. Android-style version codes) —
	// numeric comparison treats "1.10" as greater than "1.9".
	{
		v := Versions{
			names: []string{"1.0", "2.0", "1.10"},
			codes: []string{"100", "200", "100"},
		}
		v.Sort()

		expectedNames := []string{"2.0", "1.10", "1.0"}
		expectedCodes := []string{"200", "100", "100"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case B.1 dotted names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case B.1 dotted codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case B.2: non-semver non-numeric names + numeric codes — sort descending
	// numerically by code, tie broken descending alphabetically by name.
	{
		v := Versions{
			names: []string{"beta", "alpha", "gamma"},
			codes: []string{"30", "10", "30"},
		}
		v.Sort()

		expectedNames := []string{"gamma", "beta", "alpha"}
		expectedCodes := []string{"30", "30", "10"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case B.2 names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case B.2 codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case B.2: numeric code ordering is numeric, not lexicographic —
	// code "9" must rank below "10".
	{
		v := Versions{
			names: []string{"stable", "canary"},
			codes: []string{"9", "10"},
		}
		v.Sort()

		expectedNames := []string{"canary", "stable"}
		expectedCodes := []string{"10", "9"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case B.2 numeric ordering names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case B.2 numeric ordering codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case B.2: tie on code broken descending alphabetically by name.
	{
		v := Versions{
			names: []string{"nightly", "beta", "alpha", "nightly"},
			codes: []string{"9", "10", "10", "11"},
		}
		v.Sort()

		expectedNames := []string{"nightly", "beta", "alpha", "nightly"}
		expectedCodes := []string{"11", "10", "10", "9"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case B.2 tie by name names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case B.2 tie by name codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case B.3: valid semver names but non-numeric codes fall through to
	// alphabetic sort.
	{
		v := Versions{
			names: []string{"1.0.0", "2.0.0", "3.0.0"},
			codes: []string{"build-c", "build-a", "build-b"},
		}
		v.Sort()

		expectedNames := []string{"1.0.0", "3.0.0", "2.0.0"}
		expectedCodes := []string{"build-c", "build-b", "build-a"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case B.3 semver+non-numeric codes names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case B.3 semver+non-numeric codes codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}

	// Case B.3: non-numeric codes with equal code values — tie broken by name
	// descending alphabetically.
	{
		v := Versions{
			names: []string{"apple", "cherry", "banana"},
			codes: []string{"v1", "v1", "v1"},
		}
		v.Sort()

		expectedNames := []string{"cherry", "banana", "apple"}
		expectedCodes := []string{"v1", "v1", "v1"}

		if !reflect.DeepEqual(v.names, expectedNames) {
			t.Errorf("Case B.3 tie by name names: expected %v, got %v", expectedNames, v.names)
		}
		if !reflect.DeepEqual(v.codes, expectedCodes) {
			t.Errorf("Case B.3 tie by name codes: expected %v, got %v", expectedCodes, v.codes)
		}
	}
}
