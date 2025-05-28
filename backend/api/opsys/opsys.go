package opsys

import "strings"

const (
	// iOS operating system.
	IOS = "ios"
	// iPad operating system.
	IPad = "ipados"
	// Android operating system.
	Android = "android"
	// Represents the family
	// of all Apple operating
	// systems.
	AppleFamily = "apple"
	// Represents an unknown
	// operating system.
	Unknown = "unknown"
)

// ToFamily nomarlizes different apple
// operating systems to a single value
// for ease of use in conditions.
func ToFamily(osName string) string {
	// Convert OS name to lowercase
	// as older iOS SDK versions (<=0.1.0)
	// send os name as "iOS".
	switch strings.ToLower(osName) {
	case IOS, IPad:
		return AppleFamily
	case Android:
		return Android
	default:
		return Unknown
	}
}
