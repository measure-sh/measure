package timeline

import (
	"slices"
	"time"
)

// ThreadGrouper defines capabilities to group
// events by thread.
type ThreadGrouper interface {
	GetThreadName() string
	GetTimestamp() time.Time
}

// Threads is the shape for events grouped by
// threads as expected for session timeline.
type Threads map[string][]ThreadGrouper

// Organize organizes a slice of event by event
// type to the appropriate thread group.
func (t Threads) Organize(eventType string, items map[string][]ThreadGrouper) {
	for key := range items {
		t[key] = append(t[key], items[key]...)
	}
}

// Sort stable sorts each thread's slice of events in ascending
// order of each event's timestamp.
func (t *Threads) Sort() {
	for key := range *t {
		threads := *t
		items := threads[key]
		slices.SortStableFunc(items, func(i, j ThreadGrouper) int {
			iTime := i.GetTimestamp()
			jTime := j.GetTimestamp()
			if iTime.Before(jTime) {
				return -1
			}
			if iTime.After(jTime) {
				return 1
			}
			return 0
		})
	}
}

// GroupByThreads groups events by the thread name
// as needed for session timeline.
func GroupByThreads(events []ThreadGrouper) (result map[string][]ThreadGrouper) {
	result = make(map[string][]ThreadGrouper)
	for i := range events {
		result[events[i].GetThreadName()] = append(result[events[i].GetThreadName()], events[i])
	}
	return
}
