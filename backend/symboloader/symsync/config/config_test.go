package config

import (
	"context"
	"errors"
	"os"
	"testing"
)

func TestDriveCredentials(t *testing.T) {
	old := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	defer os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", old)

	os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", "")

	_, err := DriveCredentials(context.Background())

	if err == nil {
		return
	}
	if !errors.Is(err, ErrMissingCredentials) {
		t.Errorf("expected error to wrap ErrMissingCredentials, got: %v", err)
	}
}
