package event

// CrashInstance represents an entity
// for plotting crash instances.
type CrashInstance struct {
	DateTime  string  `json:"datetime"`
	Version   string  `json:"version"`
	Instances *uint64 `json:"instances"`
}
