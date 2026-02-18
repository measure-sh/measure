package config

import "time"

var (
	// MaxPastOffset is the acceptable window
	// in the past to allow ingestion.
	MaxPastOffset = 3 * 30 * 24 * time.Hour

	// MaxFutureOffset is the acceptable window
	// in the future to allow ingestion.
	MaxFutureOffset = 3 * 30 * 24 * time.Hour
)
