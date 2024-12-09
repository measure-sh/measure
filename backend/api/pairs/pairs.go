package pairs

import (
	"errors"

	"github.com/ClickHouse/clickhouse-go/v2"
)

// Pairs is a tuple-like data structure
// for working with values that always
// appear in pairs.
type Pairs[T, U any] struct {
	first  []T
	second []U
}

// NewPairs creates a new Pairs from first and
// second slices.
func NewPairs[T, U any](first []T, second []U) (*Pairs[T, U], error) {
	if len(first) != len(second) {
		return nil, errors.New("pairs must have same length")
	}

	return &Pairs[T, U]{
		first:  first,
		second: second,
	}, nil
}

// Add adds a new pair element to an existing
// pairs.
func (p *Pairs[T, U]) Add(first T, second U) {
	p.first = append(p.first, first)
	p.second = append(p.second, second)
}

// Parameterize represents Pairs in a slice of clickhouse.GroupSet
// for direct use in SQL queries.
func (p Pairs[T, U]) Parameterize() (tuples []clickhouse.GroupSet) {
	if len(p.first) == 0 {
		return
	}

	for i := 0; i < len(p.first); i++ {
		tuple := clickhouse.GroupSet{Value: []any{p.first[i], p.second[i]}}
		tuples = append(tuples, tuple)
	}

	return
}
