package filter

import (
	"math/rand/v2"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		name string
		a    string
		b    string
		want int
	}{
		{"semver minor bump", "1.2.0", "1.3.0", -1},
		{"semver equal", "1.2.0", "1.2.0", 0},
		{"numeric build code", "99", "120", -1},
		{"multi-segment build number", "2024.9.21.1", "2024.9.21.2", -1},
		{"missing segment equals zero", "1.2", "1.2.0", 0},
		{"leading zeros", "1.02", "1.2", 0},
		{"double-digit segment beats single-digit", "1.9.0", "1.10.0", -1},
		{"release beats prerelease", "1.2.0-rc.1", "1.2.0", -1},
		{"patch suffixes compare as strings", "1.2.0-patch.9", "1.2.0-patch.10", 1},
		{"numeric prefix beats non-numeric", "beta", "0.1", -1},
		{"non-numeric strings compare lexically", "alpha", "beta", -1},
		{"empty string is lowest", "", "0", -1},
		{"empty string equals itself", "", "", 0},
		{"huge segment beats small segment", "99999999999999999999999999999999999999", "9", 1},
		{"huge segment ties with itself", "99999999999999999999999999999999999999", "99999999999999999999999999999999999999", 0},
		{"trailing dot has a remainder", "1.2.", "1.2.0", -1},
		{"double dot stops the prefix early", "1..2", "1.2", -1},
		{"unicode garbage compares lexically", "日本語", "abc", 1},
		{"whitespace compares lexically", " 1.2.0", "1.2.0", -1},
		{"dots only has no numeric prefix", "...", "...", 0},
		{"dots only loses to a number", "...", "1", -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := compareVersions(tt.a, tt.b); got != tt.want {
				t.Errorf("compareVersions(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
			if got := compareVersions(tt.b, tt.a); got != -tt.want {
				t.Errorf("compareVersions(%q, %q) = %d, want %d", tt.b, tt.a, got, -tt.want)
			}
		})
	}
}

func TestSortVersionValues(t *testing.T) {
	values := []Value{
		{Text: "1.1.0"},
		{Text: "2.0.0"},
		{Text: "1.10.0"},
		{Text: "1.2.0"},
		{Text: "1.1.0"},
		{Text: "beta"},
	}
	sortVersionValues(values)

	want := []string{"2.0.0", "1.10.0", "1.2.0", "1.1.0", "1.1.0", "beta"}
	got := make([]string, len(values))
	for i, v := range values {
		got[i] = v.Text
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("sortVersionValues() = %v, want %v", got, want)
		}
	}
}

var junkVersions = []string{
	"",
	".",
	"...",
	"1.2.",
	"1..2",
	".1.2",
	"日本語",
	" 1.2.0",
	"1.2.0-patch.9",
	"1.2.0-patch.10",
	"00000000000000000000000000000000000000001",
	"-",
	"1-2-3",
}

func TestVersionOrderProperties(t *testing.T) {
	const alphabet = "0123456789.-abcZ "
	rng := rand.New(rand.NewPCG(1, 2))

	randomString := func() string {
		n := rng.IntN(9)
		b := make([]byte, n)
		for i := range b {
			b[i] = alphabet[rng.IntN(len(alphabet))]
		}
		return string(b)
	}

	values := make([]string, 0, 3000+len(junkVersions))
	values = append(values, junkVersions...)
	for range 3000 {
		values = append(values, randomString())
	}

	for range 5000 {
		a := values[rng.IntN(len(values))]
		b := values[rng.IntN(len(values))]

		if compareVersions(a, a) != 0 {
			t.Fatalf("compareVersions(%q, %q) != 0", a, a)
		}

		ab := compareVersions(a, b)
		ba := compareVersions(b, a)
		if ab != -ba {
			t.Fatalf("compareVersions(%q, %q) = %d, compareVersions(%q, %q) = %d, want opposite signs", a, b, ab, b, a, ba)
		}
	}

	sign := func(n int) int {
		switch {
		case n < 0:
			return -1
		case n > 0:
			return 1
		default:
			return 0
		}
	}

	for range 5000 {
		a := values[rng.IntN(len(values))]
		b := values[rng.IntN(len(values))]
		c := values[rng.IntN(len(values))]

		ab := sign(compareVersions(a, b))
		bc := sign(compareVersions(b, c))
		ac := sign(compareVersions(a, c))

		if ab <= 0 && bc <= 0 && ac > 0 {
			t.Fatalf("transitivity broken: a=%q b=%q c=%q ab=%d bc=%d ac=%d", a, b, c, ab, bc, ac)
		}
	}
}

func FuzzCompareVersions(f *testing.F) {
	for _, a := range junkVersions {
		for _, b := range junkVersions {
			f.Add(a, b)
		}
	}

	f.Fuzz(func(t *testing.T, a, b string) {
		ab := compareVersions(a, b)
		ba := compareVersions(b, a)
		if ab != -ba {
			t.Fatalf("compareVersions(%q, %q) = %d, compareVersions(%q, %q) = %d, want opposite signs", a, b, ab, b, a, ba)
		}
		if compareVersions(a, a) != 0 {
			t.Fatalf("compareVersions(%q, %q) != 0", a, a)
		}
	})
}
