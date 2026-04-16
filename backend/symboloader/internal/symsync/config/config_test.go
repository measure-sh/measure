package config

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadValid(t *testing.T) {
	cfg, err := Load(filepath.Join("testdata", "valid.toml"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Source.ReadmeURL != "https://raw.githubusercontent.com/CXTretar/iOS-System-Symbols-Supplement/main/README.md" {
		t.Errorf("unexpected readme_url: %s", cfg.Source.ReadmeURL)
	}
	if cfg.Storage.Bucket != "test-bucket" {
		t.Errorf("unexpected bucket: %s", cfg.Storage.Bucket)
	}
	if cfg.Storage.Endpoint != "http://127.0.0.1:9119" {
		t.Errorf("unexpected endpoint: %s", cfg.Storage.Endpoint)
	}
	if len(cfg.Sync.Versions) != 2 || cfg.Sync.Versions[0] != "26.0" {
		t.Errorf("unexpected versions: %v", cfg.Sync.Versions)
	}
	if cfg.Sync.Concurrency != 2 {
		t.Errorf("unexpected concurrency: %d", cfg.Sync.Concurrency)
	}
}

func TestLoadMinimalAppliesDefaults(t *testing.T) {
	cfg, err := Load(filepath.Join("testdata", "minimal.toml"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Source.ReadmeURL != defaultReadmeURL {
		t.Errorf("expected default readme_url, got: %s", cfg.Source.ReadmeURL)
	}
	if cfg.Sync.Concurrency != 1 {
		t.Errorf("expected default concurrency 1, got: %d", cfg.Sync.Concurrency)
	}
	if len(cfg.Sync.Versions) != 1 || cfg.Sync.Versions[0] != "latest" {
		t.Errorf("expected default versions [latest], got: %v", cfg.Sync.Versions)
	}
}

func TestValidateMissingBucket(t *testing.T) {
	cfg := &Config{}
	cfg.applyDefaults()

	if err := cfg.Validate(); !errors.Is(err, ErrMissingBucket) {
		t.Errorf("expected ErrMissingBucket, got: %v", err)
	}
}

func TestValidateSuccess(t *testing.T) {
	cfg := &Config{
		Storage: StorageConfig{Bucket: "bucket"},
	}
	cfg.applyDefaults()

	if err := cfg.Validate(); err != nil {
		t.Errorf("unexpected validation error: %v", err)
	}
}

func TestLoadMissingFile(t *testing.T) {
	_, err := Load("testdata/nonexistent.toml")
	if err == nil {
		t.Error("expected error for missing file")
	}
}

func TestDriveCredentialsConfigFileFirst(t *testing.T) {
	// Config file takes priority, even if GOOGLE_APPLICATION_CREDENTIALS is set
	old := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	defer os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", old)

	os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", "/some/valid/path.json")

	// Config file path takes priority
	auth := AuthConfig{CredentialsFile: "/nonexistent/sa.json"}
	_, err := auth.DriveCredentials(context.Background())

	// Should fail because it tries to read the config file, not the env var
	if !errors.Is(err, os.ErrNotExist) {
		t.Errorf("expected os.ErrNotExist from config file, got: %v", err)
	}
}

func TestDriveCredentialsConfigFile(t *testing.T) {
	old := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	defer os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", old)

	os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", "")

	// Test with non-existent file path
	auth := AuthConfig{CredentialsFile: "/nonexistent/sa.json"}
	_, err := auth.DriveCredentials(context.Background())

	if !errors.Is(err, os.ErrNotExist) {
		t.Errorf("expected os.ErrNotExist, got: %v", err)
	}
}

func TestDriveCredentialsFallsBackToADC(t *testing.T) {
	// When config file is not set, falls back to ADC (which may succeed or fail depending on env)
	old := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	defer os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", old)

	os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", "")

	auth := AuthConfig{}
	_, err := auth.DriveCredentials(context.Background())

	// Just verify the call doesn't panic and doesn't return both missing credentials and success
	// In a test environment with no real credentials, ADC will fail, wrapping ErrMissingCredentials
	// In a dev environment with gcloud creds, it might succeed
	// Both are acceptable for this test
	if err == nil {
		// ADC found credentials (e.g., gcloud or ambient)—this is fine
		return
	}
	// ADC failed—it should wrap ErrMissingCredentials
	if !errors.Is(err, ErrMissingCredentials) {
		t.Errorf("expected error to wrap ErrMissingCredentials, got: %v", err)
	}
}

func TestCloningConfigDefaults(t *testing.T) {
	cfg := &Config{}
	cfg.applyDefaults()

	if cfg.Cloning.DestinationFolder != "symboloader" {
		t.Errorf("expected default 'symboloader', got %q", cfg.Cloning.DestinationFolder)
	}
}

func TestCloningConfigCustom(t *testing.T) {
	cfg := &Config{
		Cloning: CloningConfig{DestinationFolder: "custom-folder"},
	}
	cfg.applyDefaults()

	if cfg.Cloning.DestinationFolder != "custom-folder" {
		t.Errorf("expected 'custom-folder', got %q", cfg.Cloning.DestinationFolder)
	}
}

func TestCloningConfigFolderID(t *testing.T) {
	cfg := &Config{
		Cloning: CloningConfig{
			DestinationFolder:   "default-folder",
			DestinationFolderID: "1ABC123xyz",
		},
	}
	cfg.applyDefaults()

	if cfg.Cloning.DestinationFolder != "default-folder" {
		t.Errorf("expected 'default-folder', got %q", cfg.Cloning.DestinationFolder)
	}
	if cfg.Cloning.DestinationFolderID != "1ABC123xyz" {
		t.Errorf("expected '1ABC123xyz', got %q", cfg.Cloning.DestinationFolderID)
	}
}
