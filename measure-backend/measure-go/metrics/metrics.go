package metrics

// SessionAdoption represents computation result of an
// app's session adoption metrics.
type SessionAdoption struct {
	AllVersions     uint64  `json:"all_versions"`
	SelectedVersion uint64  `json:"selected_version"`
	Adoption        float64 `json:"adoption"`
}

// SizeMetric represents compute result of an app's
// build sizes.
type SizeMetric struct {
	AverageAppSize  float64 `json:"average_app_size"`
	SelectedAppSize uint64  `json:"selected_app_size"`
	Delta           float64 `json:"delta"`
}

// CrashFreeSesssion represents compute result of an app's
// crash free sessions.
type CrashFreeSession struct {
	CrashFreeSessions float64 `json:"crash_free_sessions"`
	Delta             float64 `json:"delta"`
}

