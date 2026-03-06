package set

// Set is a generic set interface
type Set[T any] interface {
	// Add adds element T to the set
	// if it doesn't exist.
	Add(element T)

	// Has checks if T is present
	// in the set.
	Has(element T) bool

	// Size returns the count
	// of items in the set.
	Size() int

	// Slice returns a slice of
	// T sorted by insertion order.
	Slice() []T
}
