package metrics

import "math"

// SessionAdoption represents computation result of an
// app's session adoption metrics.
type SessionAdoption struct {
	AllVersions     uint64  `json:"all_versions"`
	SelectedVersion uint64  `json:"selected_version"`
	Adoption        float64 `json:"adoption"`
	AdoptionNaN     bool    `json:"adoption_nan"`
}

// SetNaNs sets the NaN bit if adoption
// value is NaN.
func (sa *SessionAdoption) SetNaNs() {
	if math.IsNaN(sa.Adoption) {
		sa.AdoptionNaN = true
		sa.Adoption = 0
	}
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

// ANRFreeSesssion represents compute result of an app's
// ANR free sessions.
type ANRFreeSession struct {
	ANRFreeSessions float64 `json:"anr_free_sessions"`
	Delta           float64 `json:"delta"`
}

// PerceivedCrashFreeSesssion represents compute result of an app's
// perceived crash free sessions.
type PerceivedCrashFreeSesssion struct {
	CrashFreeSessions float64 `json:"perceived_crash_free_sessions"`
	Delta             float64 `json:"delta"`
}

// PerceivedANRFreeSesssion represents compute result of an app's
// perceived ANR free sessions.
type PerceivedANRFreeSession struct {
	ANRFreeSessions float64 `json:"perceived_anr_free_sessions"`
	Delta           float64 `json:"delta"`
}

// LaunchMetric represents compute result of an app's cold,
// warm and hot launch timings.
type LaunchMetric struct {
	ColdLaunchP95 float64 `json:"cold_launch_p95"`
	WarmLaunchP95 float64 `json:"warm_launch_p95"`
	HotLaunchP95  float64 `json:"hot_launch_p95"`
	ColdDelta     float64 `json:"cold_delta"`
	WarmDelta     float64 `json:"warm_delta"`
	HotDelta      float64 `json:"hot_delta"`
	ColdNaN       bool    `json:"cold_nan"`
	WarmNaN       bool    `json:"warm_nan"`
	HotNaN        bool    `json:"hot_nan"`
}

// SetNaNs sets the NaN bits if any cold,
// warm or hot values are NaN.
func (lm *LaunchMetric) SetNaNs() {
	if math.IsNaN(lm.ColdLaunchP95) {
		lm.ColdNaN = true
		lm.ColdLaunchP95 = 0
	}
	if math.IsNaN(lm.ColdDelta) {
		lm.ColdNaN = true
		lm.ColdDelta = 0
	}
	if math.IsNaN(lm.WarmLaunchP95) {
		lm.WarmNaN = true
		lm.WarmLaunchP95 = 0
	}
	if math.IsNaN(lm.WarmDelta) {
		lm.WarmNaN = true
		lm.WarmDelta = 0
	}
	if math.IsNaN(lm.HotLaunchP95) {
		lm.HotNaN = true
		lm.HotLaunchP95 = 0
	}
	if math.IsNaN(lm.HotDelta) {
		lm.HotNaN = true
		lm.HotDelta = 0
	}
}
