package replay

// ThreadGrouper defines capabilities to group
// events by thread.
type ThreadGrouper interface {
	GetThreadName() string
}

// Threads is the shape for events grouped by
// threads as expected for session replay.
type Threads map[string]map[string][]any

// Organize organizes a slice of event by event
// type to the appropriate thread group.
func (t Threads) Organize(eventType string, items map[string][]any) {
	for key := range items {
		value, ok := t[key]
		if ok {
			value[eventType] = items[key]
		} else {
			group := make(map[string][]any)
			group[eventType] = items[key]
			t[key] = group
		}
	}
}

// GroupByThreads groups events by the thread name
// as needed for session replay.
func GroupByThreads(events []ThreadGrouper) (result map[string][]any) {
	result = make(map[string][]any)
	for i := range events {
		result[events[i].GetThreadName()] = append(result[events[i].GetThreadName()], events[i])
	}
	return
}
