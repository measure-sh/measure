package filter

// JourneyOpts is the options
// for controlling the behavior
// of querying journey events.
type JourneyOpts struct {
	// Exceptions denotes to query
	// exception events.
	Exceptions bool

	// ANRs denotes to query
	// ANR events.
	ANRs bool

	// All denotes to query all
	// issue events.
	All bool
}
