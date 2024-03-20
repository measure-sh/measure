package metrics

// AdoptionMetric represents compute result of an
// app's adoption metrics.
type AdoptionMetric struct {
	AllAppVersions     uint64  `json:"all_app_versions"`
	SelectedAppVersion uint64  `json:"selected_app_version"`
	Adoption           float64 `json:"adoption"`
}

// SizeMetric represents compute result of an app's
// build sizes.
type SizeMetric struct {
	AverageAppSize  float64 `json:"average_app_size"`
	SelectedAppSize uint64  `json:"selected_app_size"`
	Delta           float64 `json:"delta"`
}
