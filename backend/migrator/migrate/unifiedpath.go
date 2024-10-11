package migrate

import (
	"strings"
)

func buildUnifiedPath(debugId, suffix string) (unified string) {
	parts := []string{}
	parts = append(parts, debugId[:2], strings.Replace(debugId[2:], "-", "", 4), suffix)

	unified = strings.Join(parts, "/")

	return
}
