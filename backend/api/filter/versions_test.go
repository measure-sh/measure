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

func TestSemverSortByVersionDesc(t *testing.T) {
	// empty versions should neither sort
	// nor return error.
	{
		empty := Versions{
			names: []string{},
			codes: []string{},
		}

		err := empty.SemverSortByVersionDesc()

		if err != nil {
			t.Errorf("Expected %v, but got %v", nil, err)
		}

		if len(empty.names) != 0 {
			t.Errorf("Expected empty names, but got %v", empty.names)
		}

		if len(empty.codes) != 0 {
			t.Errorf("Expected empty codes, but got %v", empty.codes)
		}
	}

	// invalid semver versions should always return error.
	{
		invalid := Versions{
			names: []string{
				"1.2.3",
				"x.1.y",
			},
			codes: []string{
				"1",
				"2",
			},
		}

		err := invalid.SemverSortByVersionDesc()

		if err == nil {
			t.Errorf("Expected non nil err, but got %v", err)
		}
	}

	// unsorted versions should sort in descending order
	// keeping codes in lock-step.
	{
		desc := Versions{
			names: []string{
				"1.2.3",
				"4.5.6",
				"1.0.0-alpha.beta",
				"1.0.0-rc.1",
			},
			codes: []string{
				"98",
				"2",
				"234",
				"99238",
			},
		}

		expected := Versions{
			names: []string{
				"4.5.6",
				"1.2.3",
				"1.0.0-rc.1",
				"1.0.0-alpha.beta",
			},
			codes: []string{
				"2",
				"98",
				"99238",
				"234",
			},
		}

		err := desc.SemverSortByVersionDesc()

		if err != nil {
			t.Errorf("Expected nil err, but got %v", err)
		}

		if !reflect.DeepEqual(expected.Versions(), desc.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), desc.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), desc.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), desc.Codes())
		}
	}

	// duplicate semver versions should sort in descending
	// order keeping codes in lock-step.
	{
		duplicates := Versions{
			names: []string{
				"1.2.3",
				"4.5.6",
				"1.2.3",
				"7.8.9",
				"1.2.3",
				"1.2.3",
			},
			codes: []string{
				"9",
				"32",
				"8",
				"0",
				"7",
				"10",
			},
		}

		expected := Versions{
			names: []string{
				"7.8.9",
				"4.5.6",
				"1.2.3",
				"1.2.3",
				"1.2.3",
				"1.2.3",
			},
			codes: []string{
				"0",
				"32",
				"10",
				"9",
				"8",
				"7",
			},
		}

		err := duplicates.SemverSortByVersionDesc()

		if err != nil {
			t.Errorf("Expected nil err, but got %v", err)
		}

		if !reflect.DeepEqual(expected.Versions(), duplicates.Versions()) {
			t.Errorf("Expected %v, but got %v", expected.Versions(), duplicates.Versions())
		}

		if !reflect.DeepEqual(expected.Codes(), duplicates.Codes()) {
			t.Errorf("Expected %v, but got %v", expected.Codes(), duplicates.Codes())
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
