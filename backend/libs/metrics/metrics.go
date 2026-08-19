package metrics

import (
	"math"
)

// SessionAdoption represents computation result of an
// app's session adoption metrics.
type SessionAdoption struct {
	AllVersions     uint64  `json:"all_versions"`
	SelectedVersion uint64  `json:"selected_version"`
	Adoption        float64 `json:"adoption"`
	NoData          bool    `json:"no_data"`
}

// SizeMetric represents compute result of an app's
// build sizes.
type SizeMetric struct {
	AverageAppSize  float64 `json:"average_app_size"`
	SelectedAppSize uint64  `json:"selected_app_size"`
	Delta           float64 `json:"delta"`
	NoData          bool    `json:"no_data"`
}

// CrashFreeSesssion represents compute result of an app's
// crash free sessions.
type CrashFreeSession struct {
	CrashFreeSessions           float64 `json:"crash_free_sessions"`
	UnselectedCrashFreeSessions float64 `json:"unselected_crash_free_sessions"`
	NoData                      bool    `json:"no_data"`
	UnselectedNoData            bool    `json:"unselected_no_data"`
}

// ANRFreeSesssion represents compute result of an app's
// ANR free sessions.
type ANRFreeSession struct {
	ANRFreeSessions           float64 `json:"anr_free_sessions"`
	UnselectedANRFreeSessions float64 `json:"unselected_anr_free_sessions"`
	NoData                    bool    `json:"no_data"`
	UnselectedNoData          bool    `json:"unselected_no_data"`
}

// PerceivedCrashFreeSesssion represents compute result of an app's
// perceived crash free sessions.
type PerceivedCrashFreeSession struct {
	CrashFreeSessions           float64 `json:"perceived_crash_free_sessions"`
	UnselectedCrashFreeSessions float64 `json:"unselected_perceived_crash_free_sessions"`
	NoData                      bool    `json:"no_data"`
	UnselectedNoData            bool    `json:"unselected_no_data"`
}

// PerceivedANRFreeSesssion represents compute result of an app's
// perceived ANR free sessions.
type PerceivedANRFreeSession struct {
	ANRFreeSessions           float64 `json:"perceived_anr_free_sessions"`
	UnselectedANRFreeSessions float64 `json:"unselected_perceived_anr_free_sessions"`
	NoData                    bool    `json:"no_data"`
	UnselectedNoData          bool    `json:"unselected_no_data"`
}

// LaunchMetric represents compute result of an app's cold,
// warm and hot launch timings.
type LaunchMetric struct {
	// ColdLaunchP95 is the computed p95 cold launch.
	ColdLaunchP95 float64 `json:"cold_launch_p95"`

	// WarmLaunchP95 is the computed p95 warm launch.
	WarmLaunchP95 float64 `json:"warm_launch_p95"`

	// HotLaunchP95 is the computed p95 hot launch.
	HotLaunchP95 float64 `json:"hot_launch_p95"`

	// UnselectedColdLaunchP95 is the computed p95 cold launch
	// of the app versions not matched by the filter.
	UnselectedColdLaunchP95 float64 `json:"unselected_cold_launch_p95"`

	// UnselectedWarmLaunchP95 is the computed p95 warm launch
	// of the app versions not matched by the filter.
	UnselectedWarmLaunchP95 float64 `json:"unselected_warm_launch_p95"`

	// UnselectedHotLaunchP95 is the computed p95 hot launch
	// of the app versions not matched by the filter.
	UnselectedHotLaunchP95 float64 `json:"unselected_hot_launch_p95"`

	// ColdNoData is true if there was no data to compute
	// the p95 cold launch; ColdLaunchP95 is then a placeholder zero.
	ColdNoData bool `json:"cold_no_data"`

	// WarmNoData is true if there was no data to compute
	// the p95 warm launch; WarmLaunchP95 is then a placeholder zero.
	WarmNoData bool `json:"warm_no_data"`

	// HotNoData is true if there was no data to compute
	// the p95 hot launch; HotLaunchP95 is then a placeholder zero.
	HotNoData bool `json:"hot_no_data"`

	// UnselectedColdNoData is true if there was no data to compute
	// the p95 cold launch of the unselected app versions;
	// UnselectedColdLaunchP95 is then a placeholder zero.
	UnselectedColdNoData bool `json:"unselected_cold_no_data"`

	// UnselectedWarmNoData is true if there was no data to compute
	// the p95 warm launch of the unselected app versions;
	// UnselectedWarmLaunchP95 is then a placeholder zero.
	UnselectedWarmNoData bool `json:"unselected_warm_no_data"`

	// UnselectedHotNoData is true if there was no data to compute
	// the p95 hot launch of the unselected app versions;
	// UnselectedHotLaunchP95 is then a placeholder zero.
	UnselectedHotNoData bool `json:"unselected_hot_no_data"`
}

// SetNoData detects an adoption value that came out as NaN,
// which happens when there were no sessions to compute the
// percentage from, and records it as the no-data flag while
// zeroing the value.
func (sa *SessionAdoption) SetNoData() {
	if math.IsNaN(sa.Adoption) {
		sa.NoData = true
		sa.Adoption = 0
	}
}

// SetNoData marks the size metric as having no data. Callers
// invoke it when the size computation could not run, so it sets
// the flag unconditionally.
func (sm *SizeMetric) SetNoData() {
	sm.NoData = true
}

// SetNoData detects crash free session values that came out
// as NaN, which happens when there were no sessions to compute
// the percentage from, and records them as no-data flags while
// zeroing the values.
func (cfs *CrashFreeSession) SetNoData() {
	if math.IsNaN(cfs.CrashFreeSessions) {
		cfs.NoData = true
		cfs.CrashFreeSessions = 0
	}

	if math.IsNaN(cfs.UnselectedCrashFreeSessions) {
		cfs.UnselectedNoData = true
		cfs.UnselectedCrashFreeSessions = 0
	}
}

// SetNoData detects ANR free session values that came out
// as NaN, which happens when there were no sessions to compute
// the percentage from, and records them as no-data flags while
// zeroing the values.
func (afs *ANRFreeSession) SetNoData() {
	if math.IsNaN(afs.ANRFreeSessions) {
		afs.NoData = true
		afs.ANRFreeSessions = 0
	}

	if math.IsNaN(afs.UnselectedANRFreeSessions) {
		afs.UnselectedNoData = true
		afs.UnselectedANRFreeSessions = 0
	}
}

// SetNoData detects perceived crash free session values that
// came out as NaN, which happens when there were no sessions
// to compute the percentage from, and records them as no-data
// flags while zeroing the values.
func (pcfs *PerceivedCrashFreeSession) SetNoData() {
	if math.IsNaN(pcfs.CrashFreeSessions) {
		pcfs.NoData = true
		pcfs.CrashFreeSessions = 0
	}

	if math.IsNaN(pcfs.UnselectedCrashFreeSessions) {
		pcfs.UnselectedNoData = true
		pcfs.UnselectedCrashFreeSessions = 0
	}
}

// SetNoData detects perceived ANR free session values that
// came out as NaN, which happens when there were no sessions
// to compute the percentage from, and records them as no-data
// flags while zeroing the values.
func (pafs *PerceivedANRFreeSession) SetNoData() {
	if math.IsNaN(pafs.ANRFreeSessions) {
		pafs.NoData = true
		pafs.ANRFreeSessions = 0
	}

	if math.IsNaN(pafs.UnselectedANRFreeSessions) {
		pafs.UnselectedNoData = true
		pafs.UnselectedANRFreeSessions = 0
	}
}

// SetNoData detects launch p95 values that came out as NaN,
// which happens when there were no launch timings to compute
// the quantile from, and records them as no-data flags while
// zeroing the values.
func (lm *LaunchMetric) SetNoData() {
	if math.IsNaN(lm.ColdLaunchP95) {
		lm.ColdNoData = true
		lm.ColdLaunchP95 = 0
	}
	if math.IsNaN(lm.UnselectedColdLaunchP95) {
		lm.UnselectedColdNoData = true
		lm.UnselectedColdLaunchP95 = 0
	}
	if math.IsNaN(lm.WarmLaunchP95) {
		lm.WarmNoData = true
		lm.WarmLaunchP95 = 0
	}
	if math.IsNaN(lm.UnselectedWarmLaunchP95) {
		lm.UnselectedWarmNoData = true
		lm.UnselectedWarmLaunchP95 = 0
	}
	if math.IsNaN(lm.HotLaunchP95) {
		lm.HotNoData = true
		lm.HotLaunchP95 = 0
	}
	if math.IsNaN(lm.UnselectedHotLaunchP95) {
		lm.UnselectedHotNoData = true
		lm.UnselectedHotLaunchP95 = 0
	}
}
