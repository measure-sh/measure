package filter

// The sizes a filter must stay within. The byte limit keeps the URL the
// filter travels in short enough to carry, and the parser refuses a longer
// one before reading it. The other three bound what the query the filter
// builds costs: how deep validation recurses, how many predicates the query
// grows, and how many arguments one predicate binds. The byte limit is too
// loose to bound any of those, because 4 KB holds several hundred conditions.
//
// These are copied into
// frontend/dashboard/app/components/filter_bar/limits.ts and must be kept in sync.
const (
	MaxFilterBytes        = 4 << 10
	MaxDepth              = 4
	MaxConditions         = 32
	MaxValuesPerCondition = 200
)
