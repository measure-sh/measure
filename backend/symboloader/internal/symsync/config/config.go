package config

import (
	"context"
	"errors"
	"fmt"
	"os"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"github.com/BurntSushi/toml"
)

var ErrMissingBucket = errors.New("storage.bucket is required")
var ErrMissingCredentials = errors.New("google credentials not configured: set GOOGLE_APPLICATION_CREDENTIALS or auth.credentials_file")

const defaultReadmeURL = "https://raw.githubusercontent.com/CXTretar/iOS-System-Symbols-Supplement/main/README.md"

// Config is the top-level symboloader CLI configuration.
type Config struct {
	Source   SourceConfig   `toml:"source"`
	Auth     AuthConfig     `toml:"auth"`
	Storage  StorageConfig  `toml:"storage"`
	Sync     SyncConfig     `toml:"sync"`
	Cloning  CloningConfig  `toml:"cloning"`
}

// SourceConfig points to the upstream symbol archive listing.
type SourceConfig struct {
	// ReadmeURL is the raw GitHub URL to parse for Google Drive links.
	ReadmeURL string `toml:"readme_url"`
}

// AuthConfig holds credentials for Google APIs.
type AuthConfig struct {
	// CredentialsFile is the path to a Google Cloud service account JSON file.
	CredentialsFile string `toml:"credentials_file"`
}

// StorageConfig configures the destination bucket for processed symbols.
type StorageConfig struct {
	// Bucket is the GCS or S3-compatible bucket name.
	Bucket string `toml:"bucket"`

	// Region is the bucket region (required for S3-compatible stores).
	Region string `toml:"region"`

	// Endpoint is an optional custom endpoint for S3-compatible stores (e.g. minio).
	Endpoint string `toml:"endpoint"`

	// AccessKey for S3-compatible stores.
	AccessKey string `toml:"access_key"`

	// SecretKey for S3-compatible stores.
	SecretKey string `toml:"secret_key"`
}

// SyncConfig controls sync behavior.
type SyncConfig struct {
	// Versions lists the iOS versions to target.
	// Supports: specific ("26.0"), ranges ("18.x"), wildcard ("*"), or "latest".
	Versions []string `toml:"versions"`

	// Concurrency controls how many archives to process in parallel.
	Concurrency int `toml:"concurrency"`
}

// CloningConfig controls Google Drive cloning behavior for fetching symbols.
type CloningConfig struct {
	// DestinationFolder is the Google Drive folder name to clone into.
	// Defaults to "symboloader". Only used if DestinationFolderID is not set.
	DestinationFolder string `toml:"destination_folder"`

	// DestinationFolderID is the Google Drive folder ID to clone into.
	// If set, this takes priority over DestinationFolder.
	// The folder should be shared with the service account (Editor role).
	// If not set, the cloner will create a folder named DestinationFolder
	// in the service account's Drive root.
	DestinationFolderID string `toml:"destination_folder_id"`
}

// Load reads and decodes a TOML config file at the given path.
func Load(path string) (cfg *Config, err error) {
	cfg = &Config{}
	if _, err = toml.DecodeFile(path, cfg); err != nil {
		return nil, err
	}
	cfg.applyDefaults()
	return
}

// LoadOrDefault reads the config file if it exists, otherwise
// returns a config with sensible defaults. Useful for commands
// that only need the readme URL (e.g. --list).
func LoadOrDefault(path string) *Config {
	cfg, err := Load(path)
	if err != nil {
		cfg = &Config{}
		cfg.applyDefaults()
	}
	return cfg
}

// applyDefaults fills in zero-value fields with sensible defaults.
func (c *Config) applyDefaults() {
	if c.Source.ReadmeURL == "" {
		c.Source.ReadmeURL = defaultReadmeURL
	}
	if c.Sync.Concurrency < 1 {
		c.Sync.Concurrency = 1
	}
	if len(c.Sync.Versions) == 0 {
		c.Sync.Versions = []string{"latest"}
	}
	if c.Cloning.DestinationFolder == "" {
		c.Cloning.DestinationFolder = "symboloader"
	}
}

// Validate checks that required fields are present.
func (c *Config) Validate() error {
	if c.Storage.Bucket == "" {
		return ErrMissingBucket
	}
	return nil
}

// DriveCredentials resolves Google credentials for Drive API access.
// Resolution order:
// 1. auth.credentials_file from config (explicit file takes priority)
// 2. ADC (GOOGLE_APPLICATION_CREDENTIALS env var, gcloud creds, metadata server)
// 3. Error if neither works
//
// This handles all three deployment environments:
// - Self-host VM: user sets credentials_file or GOOGLE_APPLICATION_CREDENTIALS env var
// - Cloud Run: ADC reads service account from metadata server automatically
// - Development: ADC reads gcloud default credentials
func (a AuthConfig) DriveCredentials(ctx context.Context) (creds *google.Credentials, err error) {
	// Try explicit credentials_file first (user was intentional)
	if a.CredentialsFile != "" {
		var data []byte
		data, err = os.ReadFile(a.CredentialsFile)
		if err != nil {
			return
		}
		// Use CredentialsFromJSONWithType for secure validation of credential type
		return google.CredentialsFromJSONWithType(ctx, data, google.ServiceAccount, drive.DriveScope)
	}

	// Fall back to ADC: env var, gcloud, or metadata server
	creds, err = google.FindDefaultCredentials(ctx, drive.DriveScope)
	if err != nil {
		err = fmt.Errorf("%w: %w", ErrMissingCredentials, err)
	}
	return
}
