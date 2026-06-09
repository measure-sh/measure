// Package secret resolves sensitive config from an env var or a "<NAME>_FILE" file.
// Order is env-var-first then file, by design:
//
//  1. <NAME>      — plain env var (Measure Cloud: Cloud Run secretKeyRef → env var)
//  2. <NAME>_FILE — path to a file holding the value (self-host Docker secrets,
//     mounted at /run/secrets/<name>)
//
// When <NAME> is set the file branch is never consulted, so Cloud is unaffected.
package secret

import (
	"fmt"
	"os"
	"strings"
)

// FromEnvOrFile prefers the plain env var, falling back to name+"_FILE".
// Returns "" with no error when neither is set; the caller decides if that's fatal.
func FromEnvOrFile(name string) (value string, err error) {
	if value = strings.TrimSpace(os.Getenv(name)); value != "" {
		return value, nil
	}

	fileVar := name + "_FILE"
	path := os.Getenv(fileVar)
	if path == "" {
		return "", nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", fileVar, err)
	}

	return strings.TrimSpace(string(data)), nil
}
