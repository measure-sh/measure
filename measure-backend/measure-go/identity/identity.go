package identity

import "github.com/google/uuid"

func Dedup(s []uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]struct{}, len(s))
	j := 0
	for _, v := range s {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		s[j] = v
		j++
	}

	return s[:j]
}
