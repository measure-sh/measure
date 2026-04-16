package pipeline

import "context"

// Janitor cleans up resources created during the sync process,
// such as cloned Google Drive folders and local temporary files.
type Janitor interface {
	Cleanup(ctx context.Context, folders []ClonedFolder) error
}
