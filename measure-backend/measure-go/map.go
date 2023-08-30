package main

import (
	"fmt"
	"strings"
)

func mapToString(m map[string]string) string {
	var result []string
	for key, value := range m {
		result = append(result, fmt.Sprintf("'%s': '%s'", key, value))
	}
	return "{" + strings.Join(result, ", ") + "}"
}
