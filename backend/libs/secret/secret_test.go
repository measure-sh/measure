package secret

import (
	"os"
	"path/filepath"
	"testing"
)

const (
	testEnv  = "MSR_TEST_SECRET"
	testFile = testEnv + "_FILE"
)

// writeTempFile writes content to a fresh file and returns its path.
func writeTempFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "secret")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	return path
}

func TestFromEnvOrFile(t *testing.T) {
	t.Run("prefers env var over file", func(t *testing.T) {
		t.Setenv(testEnv, "from-env")
		t.Setenv(testFile, writeTempFile(t, "from-file"))

		got, err := FromEnvOrFile(testEnv)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "from-env" {
			t.Errorf("expected %q, got %q", "from-env", got)
		}
	})

	t.Run("trims surrounding whitespace from env var", func(t *testing.T) {
		t.Setenv(testEnv, "  spaced-value\n")

		got, err := FromEnvOrFile(testEnv)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "spaced-value" {
			t.Errorf("expected %q, got %q", "spaced-value", got)
		}
	})

	t.Run("falls back to file when env var is empty", func(t *testing.T) {
		t.Setenv(testEnv, "")
		t.Setenv(testFile, writeTempFile(t, "  file-value\n"))

		got, err := FromEnvOrFile(testEnv)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "file-value" {
			t.Errorf("expected %q, got %q", "file-value", got)
		}
	})

	t.Run("returns empty when neither env var nor file is set", func(t *testing.T) {
		t.Setenv(testEnv, "")
		t.Setenv(testFile, "")

		got, err := FromEnvOrFile(testEnv)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "" {
			t.Errorf("expected empty string, got %q", got)
		}
	})

	t.Run("returns error when file cannot be read", func(t *testing.T) {
		t.Setenv(testEnv, "")
		t.Setenv(testFile, filepath.Join(t.TempDir(), "does-not-exist"))

		got, err := FromEnvOrFile(testEnv)
		if err == nil {
			t.Fatal("expected an error, got nil")
		}
		if got != "" {
			t.Errorf("expected empty string on error, got %q", got)
		}
	})
}
