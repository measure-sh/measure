package cmd

// Metrics stores certain metrics used by the program
// to keep track of progress of ingestion operations.
type Metrics struct {
	AppCount   int
	EventCount int
	BuildCount int
}

// bumpBuild bumps the build count of
// Metrics.
func (m *Metrics) bumpBuild() {
	m.BuildCount = m.BuildCount + 1
}

// bumpEvent bumps the event count of
// Metrics.
func (m *Metrics) bumpEvent() {
	m.EventCount = m.EventCount + 1
}

// bumpApp bumps the app count
// Metrics.
func (m *Metrics) bumpApp() {
	m.AppCount = m.AppCount + 1
}
