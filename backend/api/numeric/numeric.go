package numeric

import "math"

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
