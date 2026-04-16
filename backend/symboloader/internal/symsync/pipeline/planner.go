package pipeline

import "context"

// Action describes a single unit of work in the download plan.
type Action struct {
	Target Target

	// Skip is true if this target already exists in the manifest
	// and does not need to be re-downloaded.
	Skip   bool
	Reason string // why it was skipped (e.g., "already synced")
}

// Plan is the set of actions to execute.
type Plan struct {
	Actions []Action
}

// DownloadCount returns the number of actions that are not skipped.
func (p *Plan) DownloadCount() int {
	n := 0
	for _, a := range p.Actions {
		if !a.Skip {
			n++
		}
	}
	return n
}

// Planner computes the download plan by comparing desired targets
// against the current manifest state.
type Planner interface {
	Plan(ctx context.Context, targets []Target) (*Plan, error)
}
