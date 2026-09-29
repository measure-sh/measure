package event

// IssueInstance represents an entity
// for plotting crash or ANR instances.
type IssueInstance struct {
	DateTime          string   `json:"datetime"`
	Version           string   `json:"version"`
	Instances         *uint64  `json:"instances"`
	IssueFreeSessions *float64 `json:"issue_free_sessions"`
}

type AttributeValueCount struct {
	Value string `json:"value"`
	Count uint64 `json:"count"`
}

// OtherCount totals the instances of the values
// not listed in Values.
type AttributeDistribution struct {
	Values        []AttributeValueCount `json:"values"`
	OtherCount    uint64                `json:"other_count"`
	DistinctCount uint64                `json:"distinct_count"`
}

type IssueDistribution map[string]AttributeDistribution
