package pipeline

// Reporter receives progress events and renders them for the user.
// Future iterations will use bubbletea for rich TUI output.
type Reporter interface {
	Start(results <-chan FetchResult, total int) error
}
