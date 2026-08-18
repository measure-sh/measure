package numeric

import (
	"math"
	"testing"
)

func TestFormatKMB(t *testing.T) {
	cases := []struct {
		name string
		in   int64
		want string
	}{
		{"zero", 0, "0"},
		{"single digit", 1, "1"},
		{"just below the first suffix", 999, "999"},

		{"exactly a thousand", 1_000, "1K"},
		{"one decimal place needed", 1_100, "1.1K"},
		{"two decimal places needed", 1_050, "1.05K"},
		{"half a thousand", 1_500, "1.5K"},
		{"rounded down to two places", 1_234, "1.23K"},
		{"rounded up past the suffix boundary", 1_999, "2K"},
		{"five figures", 12_345, "12.35K"},
		{"just below a million promotes to the next suffix", 999_999, "1M"},

		{"exactly a million", 1_000_000, "1M"},
		{"half a million", 1_500_000, "1.5M"},
		{"eight figures", 12_345_678, "12.35M"},
		{"just below a billion promotes to the next suffix", 999_999_999, "1B"},

		{"exactly a billion", 1_000_000_000, "1B"},
		{"two and a half billion", 2_500_000_000, "2.5B"},
		{"eleven figures", 12_345_678_901, "12.35B"},
		{"largest int64", math.MaxInt64, "9223372036.85B"},

		{"negative single digit", -1, "-1"},
		{"negative just below the first suffix", -999, "-999"},
		{"negative thousand", -1_000, "-1K"},
		{"negative million", -1_500_000, "-1.5M"},
		{"smallest int64", math.MinInt64, "-9223372036.85B"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := FormatKMB(c.in); got != c.want {
				t.Errorf("FormatKMB(%d) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}
