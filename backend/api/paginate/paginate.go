package paginate

import (
	"backend/api/filter"
)

type PaginationID interface {
	GetId() string
}

// PaginateGroups accepts slice of interface GroupID and computes and
// returns a subset slice along with pagination meta, like next and previous.
func Paginate[T PaginationID](groups []T, af *filter.AppFilter) (sliced []T, next bool, previous bool) {
	sliced = groups
	next = false
	previous = false

	length := len(groups)

	// no change if slice is empty
	if length == 0 {
		return
	}

	start := 0
	for i := range groups {
		if groups[i].GetId() == af.KeyID {
			if af.Limit > 0 {
				start = i + 1
			} else {
				start = i
			}
			break
		}
	}

	end := start + af.Limit

	if af.Limit > 0 {
		if end > len(groups) {
			end = len(groups)
		}
		if end < len(groups) {
			next = true
		}
		if start > 0 {
			previous = true
		}
		if start >= length {
			start = 0
			end = 0
		}
		sliced = groups[start:end]
	} else if af.Limit < 0 {
		if end < 0 {
			end = 0
		}
		if end < len(groups) {
			next = true
		}
		if end > 0 {
			previous = true
		}
		sliced = groups[end:start]
	}

	return
}
