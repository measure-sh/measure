package session

// SessionInstance represents an entity
// for plotting session instances.
type SessionInstance struct {
	DateTime  string  `json:"datetime"`
	Version   string  `json:"version"`
	Instances *uint64 `json:"instances"`
}
