package event

import "strings"

type anrSubjectRule struct {
	prefix string
	suffix string
	label  string
	target bool
}

// anrSubjectRules holds one rule per TimeoutKind in AOSP's TimeoutRecord,
// matching the wording its callers build. Order matters: the no focused
// window rule precedes the general input rule, which would claim it.
var anrSubjectRules = []anrSubjectRule{
	{
		prefix: "Input dispatching timed out (Application does not have a focused window",
		label:  "Input dispatching timed out, no focused window",
	},
	{
		prefix: "Input dispatching timed out",
		label:  "Input dispatching timed out",
		target: true,
	},
	{
		prefix: "Broadcast of",
		label:  "Broadcast of Intent",
		target: true,
	},
	{
		prefix: "executing service",
		label:  "Executing service",
		target: true,
	},
	{
		prefix: "Context.startForegroundService() did not then call Service.startForeground()",
		label:  "Foreground service did not call startForeground()",
		target: true,
	},
	{
		prefix: "A foreground service of FOREGROUND_SERVICE_TYPE_SHORT_SERVICE did not stop within a timeout",
		label:  "Short foreground service did not stop",
		target: true,
	},
	{
		prefix: "ContentProvider not responding",
		label:  "ContentProvider not responding",
	},
	{
		prefix: "No response to onStartJob",
		label:  "No response to onStartJob",
		target: true,
	},
	{
		prefix: "No response to onStopJob",
		label:  "No response to onStopJob",
		target: true,
	},
	{
		prefix: "Timed out while trying to bind",
		label:  "Timed out while trying to bind",
		target: true,
	},
	{
		prefix: "required notification not provided",
		label:  "Required notification not provided",
		target: true,
	},
	{
		prefix: "Process ",
		suffix: "failed to complete startup",
		label:  "Process failed to complete startup",
	},
	// The rest of this subject is text the app itself wrote. An app naming
	// a user or a request in it would get a new group on every ANR.
	{
		prefix: "App requested:",
		label:  "App requested",
	},
}

// ANRReason names the deadline an ANR's subject reports, dropping the
// detail that differs between occurrences: identity hashes, how long the
// system waited, the flags on an intent.
//
// An unrecognized subject has no reason. The reason takes part in the
// fingerprint, so guessing at one would group every occurrence alone.
func ANRReason(subject string) string {
	subject = strings.TrimRight(strings.TrimSpace(subject), ". ")
	if subject == "" {
		return ""
	}

	for _, rule := range anrSubjectRules {
		if !strings.HasPrefix(subject, rule.prefix) || !strings.HasSuffix(subject, rule.suffix) {
			continue
		}
		if !rule.target {
			return rule.label
		}
		if target := findTarget(subject[len(rule.prefix):]); target != "" {
			return rule.label + " (" + target + ")"
		}

		return rule.label
	}

	return ""
}

// findTarget picks what the deadline expired against: the component the
// subject names, or the action of an implicit broadcast that names none.
func findTarget(rest string) string {
	action := ""

	for _, field := range strings.Fields(rest) {
		token := field
		if key, value, keyed := strings.Cut(field, "="); keyed {
			if key == "act" && action == "" {
				action = strings.Trim(value, "{}(),")
			}
			token = value
		}
		token = strings.Trim(token, "{}(),")
		// Unwrap the "ComponentInfo{" and "ServiceRecord{" the platform
		// prints components inside.
		if i := strings.LastIndexAny(token, "{("); i >= 0 {
			token = token[i+1:]
		}
		if component, ok := asComponent(token); ok {
			return component
		}
	}

	return action
}

// asComponent reads a package/class pair, shortening it the way Android
// does to "sh.measure.app/.MainActivity". The dotted package requirement
// rejects the identity hashes printed beside components, like a job's
// "#u0a172/1".
func asComponent(token string) (component string, ok bool) {
	pkg, class, found := strings.Cut(token, "/")
	if !found || !strings.Contains(pkg, ".") {
		return "", false
	}

	return pkg + "/" + strings.TrimPrefix(class, pkg), true
}
