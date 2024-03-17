package cmd

// Metrics stores certain metrics used by the program
// to keep track of progress of ingestion operations.
type Metrics struct {
	AppCount     int
	SessionCount int
	BuildCount   int
}

// bumpBuild bumps the build count of
// Metrics.
func (m *Metrics) bumpBuild() {
	m.BuildCount = m.BuildCount + 1
}

// bumpSession bumps the session count of
// Metrics.
func (m *Metrics) bumpSession() {
	m.SessionCount = m.SessionCount + 1
}

// bumpApp bumps the app count
// Metrics.
func (m *Metrics) bumpApp() {
	m.AppCount = m.AppCount + 1
}
