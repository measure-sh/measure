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

// crashFreeRate runs the same division GetIssueFreeMetrics does, so the cases
// below round a real float64 result rather than a folded constant.
func crashFreeRate(issues, sessions uint64) float64 {
	return (1 - (float64(issues) / float64(sessions))) * 100
}

func TestRoundTwoDecimalsFloat64(t *testing.T) {
	cases := []struct {
		name string
		in   float64
		want float64
	}{
		{"zero", 0, 0},
		{"already at two decimals", 88.89, 88.89},
		{"third decimal rounds down", 1.234, 1.23},
		{"third decimal rounds up", 99.996, 100},
		{"scaling by 100 overshoots", 0.07, 0.07},
		{"negative", -1.236, -1.24},

		{"41 crashes in 100 sessions", crashFreeRate(41, 100), 59},
		{"23 crashes in 10000 sessions", crashFreeRate(23, 10000), 99.77},
		{"3 crashes in 50000 sessions", crashFreeRate(3, 50000), 99.99},
		{"1 crash in 10001 sessions", crashFreeRate(1, 10001), 99.99},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := RoundTwoDecimalsFloat64(c.in); got != c.want {
				t.Errorf("RoundTwoDecimalsFloat64(%v) = %v, want %v", c.in, got, c.want)
			}
		})
	}
}
