package config

import (
	"github.com/BurntSushi/toml"
	"github.com/go-faster/errors"
)

type App struct {
	ApiKey string `toml:"api-key"`
}

type Config struct {
	Apps map[string]App `toml:"apps"`
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

func validate(config *Config) error {
	for key, val := range config.Apps {
		if val.ApiKey == "" {
			return errors.Errorf("config error: app %q lacks an API key", key)
		}
	}

	return nil
}
