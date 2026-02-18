package event

// IssueInstance represents an entity
// for plotting crash or ANR instances.
type IssueInstance struct {
	DateTime          string   `json:"datetime"`
	Version           string   `json:"version"`
	Instances         *uint64  `json:"instances"`
	IssueFreeSessions *float64 `json:"issue_free_sessions"`
}

// IssueDistribution represents an entity
// for plotting attribute distribution of crash
// or ANR instances.
type IssueDistribution struct {
	AppVersion  map[string]uint64 `json:"app_version"`
	OSVersion   map[string]uint64 `json:"os_version"`
	Country     map[string]uint64 `json:"country"`
	NetworkType map[string]uint64 `json:"network_type"`
	Locale      map[string]uint64 `json:"locale"`
	Device      map[string]uint64 `json:"device"`
}
