package measure

import (
	"fmt"

	"backend/libs/exprfilter"
)

// playMemoryThresholdsMB is Google Play Console's own "excessive memory
// usage" ceiling: the 90th percentile of Anon RSS + Swap an app is allowed
// to reach, by device RAM tier and process state (foreground /
// user_perceived_service / background). Values are in MiB.
// https://support.google.com/googleplay/android-developer/answer/17492799
//
// Cached has no published ceiling — the OS can evict it at will, so Play
// treats it as debug-only. The 0-4gb and 16gb+ tiers fall outside Play's
// published table (which starts at 4gb and stops at 16gb) and also have no
// ceiling here; don't extrapolate one.
var playMemoryThresholdsMB = map[string]map[MemoryScope]float64{
	"4gb": {
		MemoryScopeForeground:           2048,
		MemoryScopeUserPerceivedService: 1024,
		MemoryScopeBackground:           1024,
	},
	"6gb": {
		MemoryScopeForeground:           2304,
		MemoryScopeUserPerceivedService: 1280,
		MemoryScopeBackground:           1280,
	},
	"8gb": {
		MemoryScopeForeground:           2304,
		MemoryScopeUserPerceivedService: 1536,
		MemoryScopeBackground:           1536,
	},
	"12gb": {
		MemoryScopeForeground:           3328,
		MemoryScopeUserPerceivedService: 1792,
		MemoryScopeBackground:           1792,
	},
	"16gb": {
		MemoryScopeForeground:           4352,
		MemoryScopeUserPerceivedService: 2048,
		MemoryScopeBackground:           2048,
	},
}

var ramTierDisplayLabel = map[string]string{
	"0-4gb": "0–4 GB",
	"4gb":   "4 GB",
	"6gb":   "6 GB",
	"8gb":   "8 GB",
	"12gb":  "12 GB",
	"16gb":  "16 GB",
	"16gb+": "16 GB+",
}

var memoryScopeDisplayLabel = map[MemoryScope]string{
	MemoryScopeForeground:           "Foreground",
	MemoryScopeUserPerceivedService: "User-perceived service",
	MemoryScopeBackground:           "Background",
	MemoryScopeCached:               "Cached",
}

// singleSelectedRAMTier reads ef's already-parsed filter tree for exactly
// one `session_ram_tier in [<tier>]` clause. Returns "" on anything
// ambiguous — no clause, more than one clause (e.g. inside an OR), not_in,
// or more than one value — since guessing a tier to show a threshold
// against would be misleading.
func singleSelectedRAMTier(ef *exprfilter.ExprFilter) string {
	if !ef.HasFilterExpr() {
		return ""
	}

	conditions, err := exprfilter.WalkExprTree(
		ef.ExprTree,
		func(c exprfilter.Condition) ([]exprfilter.Condition, error) {
			if c.KeyName == "session_ram_tier" {
				return []exprfilter.Condition{c}, nil
			}
			return nil, nil
		},
		func(_ exprfilter.LogicalOperator, children [][]exprfilter.Condition) ([]exprfilter.Condition, error) {
			var all []exprfilter.Condition
			for _, group := range children {
				all = append(all, group...)
			}
			return all, nil
		},
	)
	if err != nil || len(conditions) != 1 {
		return ""
	}

	condition := conditions[0]
	if condition.Operator != exprfilter.OperatorIn {
		return ""
	}
	values := condition.TextValues()
	if len(values) != 1 {
		return ""
	}

	return values[0]
}

// MemoryThreshold returns Play Console's own excessive-memory ceiling, in
// MB, for ef's currently-selected RAM tier and scope, and a display label
// for it. ok is false when the combination is ambiguous or Play doesn't
// publish a number for it: iOS (no Play-vitals equivalent), scope "" (All)
// or MemoryScopeCached (no published ceiling), an unfiltered or
// multi-valued RAM tier, or a tier outside Play's published range.
func MemoryThreshold(ef *exprfilter.ExprFilter, ios bool, scope MemoryScope) (mb float64, label string, ok bool) {
	if ios || scope == MemoryScopeAny || scope == MemoryScopeCached {
		return
	}

	tier := singleSelectedRAMTier(ef)
	if tier == "" {
		return
	}

	byScope, found := playMemoryThresholdsMB[tier]
	if !found {
		return
	}
	mb, found = byScope[scope]
	if !found {
		return
	}

	tierLabel := ramTierDisplayLabel[tier]
	if tierLabel == "" {
		tierLabel = tier
	}

	label = fmt.Sprintf("Play threshold (%s, %s)", tierLabel, memoryScopeDisplayLabel[scope])
	ok = true
	return
}

// MemoryThresholdEntry is one process state's Play threshold, for the
// summary cards (one per state) to draw a matching status badge against.
type MemoryThresholdEntry struct {
	ProcessState MemoryScope `json:"process_state"`
	MB           float64     `json:"mb"`
	Label        string      `json:"label"`
}

// MemoryThresholdsByScope returns MemoryThreshold's result for every
// process state Play publishes a ceiling for, skipping any that don't
// resolve (ambiguous or unfiltered RAM tier, iOS, ...).
func MemoryThresholdsByScope(ef *exprfilter.ExprFilter, ios bool) []MemoryThresholdEntry {
	entries := make([]MemoryThresholdEntry, 0, len(thresholdableMemoryScopes))
	for _, scope := range thresholdableMemoryScopes {
		if mb, label, ok := MemoryThreshold(ef, ios, scope); ok {
			entries = append(entries, MemoryThresholdEntry{ProcessState: scope, MB: mb, Label: label})
		}
	}
	return entries
}
