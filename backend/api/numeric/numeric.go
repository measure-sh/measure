package numeric

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
