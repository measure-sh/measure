package processor

import (
	"regexp"
	"strings"
)

var (
	uuidRe = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	sha1Re = regexp.MustCompile(`(?i)^[0-9a-f]{40}$`)
	md5Re  = regexp.MustCompile(`(?i)^[0-9a-f]{32}$`)
	dateRe = regexp.MustCompile(`\d{4}-[01]\d-[0-3]\dT`)
	hexRe  = regexp.MustCompile(`(?i)^0x[0-9a-f]+$`)
	intRe  = regexp.MustCompile(`\d{2,}`)
)

// NormalizePath splits a URL path by "/" and normalizes each
// segment, replacing dynamic values (UUIDs, hashes, dates,
// hex numbers, integers) with "*".
func NormalizePath(path string) string {
	segments := strings.Split(path, "/")
	for i, seg := range segments {
		if seg != "" {
			segments[i] = normalizeSegment(seg)
		}
	}
	return strings.Join(segments, "/")
}

// normalizeSegment checks a single path segment against
// known dynamic patterns and returns "*" if any match.
func normalizeSegment(seg string) string {
	if uuidRe.MatchString(seg) {
		return "*"
	}
	if sha1Re.MatchString(seg) {
		return "*"
	}
	if md5Re.MatchString(seg) {
		return "*"
	}
	if dateRe.MatchString(seg) {
		return "*"
	}
	if hexRe.MatchString(seg) {
		return "*"
	}
	if intRe.MatchString(seg) {
		return "*"
	}
	return seg
}
