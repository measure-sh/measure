package ingest

import (
	"backend/libs/option"
	"errors"
	"time"
)

var (
	// MaxPastOffset is the acceptable window
	// in the past to allow ingestion.
	MaxPastOffset = 3 * 30 * 24 * time.Hour

	// MaxFutureOffset is the acceptable window
	// in the future to allow ingestion.
	MaxFutureOffset = 3 * 30 * 24 * time.Hour
)

var (
	ErrTooFarInPast   = errors.New("timestamp too far in the past")
	ErrTooFarInFuture = errors.New("timestamp too far in the future")
)

// validationConfig represents configuration
// for validating events.
type validationConfig struct {
	EnforceTimeWindow bool
}

type ValidationOptions = option.Option[validationConfig]

// WithEnforceTimeWindow controls enforcement of validation
// of a timestamp to fall in a valid time window.
func WithEnforceTimeWindow(enforce bool) ValidationOptions {
	return func(c *validationConfig) { c.EnforceTimeWindow = enforce }
}

var defaultValidationConfig = validationConfig{
	EnforceTimeWindow: false,
}

// NewValidationConfig creates an instance of validation configuration
// for validating events.
func NewValidationConfig(opts ...ValidationOptions) *validationConfig {
	return option.New(defaultValidationConfig, opts...)
}

// ValidateTimeWindow validates if timestamp is within the allowed
// time window.
func ValidateTimeWindow(ts time.Time, now time.Time) error {
	lower := now.Add(-MaxPastOffset)
	upper := now.Add(MaxFutureOffset)

	if ts.Before(lower) {
		return ErrTooFarInPast
	} else if ts.After(upper) {
		return ErrTooFarInFuture
	}

	return nil
}
