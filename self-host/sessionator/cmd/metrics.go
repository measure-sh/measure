package cmd

// Metrics stores certain metrics used by the program
// to keep track of progress of ingestion operations.
type Metrics struct {
	AppCount     int
	SessionCount int
	BuildCount   int
}
