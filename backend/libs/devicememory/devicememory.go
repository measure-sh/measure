package devicememory

import "fmt"

const kbPerGB uint64 = 1024 * 1024

// Tier is a range of device memory in GB.
type Tier struct {
	Name  string
	Lower uint64
	Upper uint64
}

// Tiers are the device memory tiers in
// ascending order.
//
// Sandbox uses the same tiers, so any
// change must also reflect in:
// frontend/dashboard/app/sandbox/device_memory.ts
var Tiers = []Tier{
	{Name: "0-4gb", Lower: 1, Upper: 4},
	{Name: "5-6gb", Lower: 5, Upper: 6},
	{Name: "7-8gb", Lower: 7, Upper: 8},
	{Name: "9-12gb", Lower: 9, Upper: 12},
	{Name: "13-16gb", Lower: 13, Upper: 16},
	{Name: "17-32gb", Lower: 17, Upper: 32},
	{Name: "33gb+", Lower: 33, Upper: 0},
}

// Unknown is the tier for devices with no reported memory.
const Unknown = "unknown"

// Names returns the tier names in order, with Unknown last.
func Names() []string {
	names := make([]string, 0, len(Tiers)+1)
	for _, tier := range Tiers {
		names = append(names, tier.Name)
	}
	return append(names, Unknown)
}

// Predicates returns a SQL condition for each
// tier name, Unknown included. expr is the SQL
// that reads device memory in KiB.
func Predicates(expr string) map[string]string {
	gb := fmt.Sprintf("ceil(%s / %d)", expr, kbPerGB)
	predicates := make(map[string]string, len(Tiers)+1)
	for _, tier := range Tiers {
		if tier.Upper == 0 {
			predicates[tier.Name] = fmt.Sprintf("%s >= %d", gb, tier.Lower)
			continue
		}
		predicates[tier.Name] = fmt.Sprintf("%s between %d and %d", gb, tier.Lower, tier.Upper)
	}
	predicates[Unknown] = fmt.Sprintf("%s = 0", expr)
	return predicates
}
