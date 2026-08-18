package numeric

import (
	"math"
	"strconv"
	"strings"
)

// AbsInt returns the absolute
// value of int n.
//
// Go's math.Abs() function
// expects float64 type.
// This function follows a
// simpler approach without
// resorting to convert types.
func AbsInt(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

// RoundTwoDecimalsFloat64 rounds the precision
// part of a float64 value to 2 decimals.
func RoundTwoDecimalsFloat64(x float64) float64 {
	return math.Ceil(x*100) / 100
}

func FormatKMB(n int64) string {
	sign := ""
	v := float64(n)

	if v < 0 {
		sign = "-"
		v = -v
	}

	var divisor float64
	var suffix string

	switch {
	case v >= 1e9:
		divisor, suffix = 1e9, "B"
	case v >= 1e6:
		divisor, suffix = 1e6, "M"
	case v >= 1e3:
		divisor, suffix = 1e3, "K"
	default:
		return strconv.FormatInt(n, 10)
	}

	rounded := math.Round(v/divisor*100) / 100

	// Promote after rounding, e.g. 999.999K → 1M.
	if rounded >= 1000 {
		switch suffix {
		case "K":
			rounded, suffix = rounded/1000, "M"
		case "M":
			rounded, suffix = rounded/1000, "B"
		}
	}

	s := strconv.FormatFloat(rounded, 'f', 2, 64)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")

	return sign + s + suffix
}
