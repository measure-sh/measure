package config

import (
	"fmt"

	"github.com/BurntSushi/toml"
)

type App struct {
	Name   string `toml:"name"`
	ApiKey string `toml:"api-key"`
}

type Config struct {
	Apps    map[string]App    `toml:"apps"`
	Storage map[string]string `toml:"storage"`
}

// ValidateStorage validates all storage settings.
func (c *Config) ValidateStorage() (err error) {
	keys := []string{
		"postgres_dsn",
		"clickhouse_dsn",
		"attachments_s3_bucket",
		"attachments_s3_bucket_region",
		"attachments_access_key",
		"attachments_secret_access_key",
		"symbols_s3_bucket",
		"symbols_s3_bucket_region",
		"symbols_access_key",
		"symbols_secret_access_key",
	}

	for i := range keys {
		if c.Storage[keys[i]] == "" {
			err = fmt.Errorf("config error: value for %q is empty", keys[i])
			break
		}
	}

	return
}

// Init validates and returns the config
// after reading from the `config.toml` file.
func Init(loc string) (*Config, error) {
	var config Config
	_, err := toml.DecodeFile(loc, &config)
	if err != nil {
		return nil, err
	}

	if err := validate(&config); err != nil {
		return nil, err
	}

	return &config, nil
}

// validate validates the config to ensure
// the necessary data exists in the config.
func validate(config *Config) error {
	for key, val := range config.Apps {
		if val.ApiKey == "" {
			return fmt.Errorf("config error: app %q lacks an API key", key)
		}
	}

	return nil
}
