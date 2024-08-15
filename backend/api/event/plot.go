package event

// IssueInstance represents an entity
// for plotting crash or ANR instances.
type IssueInstance struct {
	DateTime          string   `json:"datetime"`
	Version           string   `json:"version"`
	Instances         *uint64  `json:"instances"`
	IssueFreeSessions *float64 `json:"issue_free_sessions"`
}
