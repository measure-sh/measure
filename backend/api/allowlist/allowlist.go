package allowlist

import (
	"fmt"
	"os"
	"slices"
	"strings"
)

type list struct {
	domains []string
	emails  []string
}

// isEmpty determines if the list does not
// contain valid identities.
func (l *list) isEmpty() bool {
	return len(l.domains) == 0 && len(l.emails) == 0
}

// isAllowed checks if certain identity is allowed
// or not.
func (l *list) isAllowed(identity string) bool {
	if identity == "" {
		return false
	}

	// Allow if the list is empty
	if l.isEmpty() {
		return true
	}

	// Allow if the identity matches email allowlist
	if slices.Contains(l.emails, identity) {
		return true
	}

	// Allow if the identity matches domain allowlist
	if slices.Contains(l.domains, extractDomain(identity)) {
		return true
	}

	return false
}

// allowlist contains valid lists of
// domains and emails.
var allowlist *list

// Init sets up authentication allowlisting
//
// Call this method at server start time.
func Init() (err error) {
	rawDomains := os.Getenv("DOMAIN_ALLOWLIST")
	rawEmails := os.Getenv("EMAIL_ALLOWLIST")

	allowlist = &list{}

	if len(rawDomains) == 0 && len(rawEmails) == 0 {
		fmt.Printf("No auth allowlist found. Will not allowlist.\n")
		return nil
	}

	if len(rawDomains) > 0 {
		fmt.Printf("Initializing domain allowlist\n")

		allowlist.domains = parseList(rawDomains)

		if len(allowlist.domains) == 0 {
			return fmt.Errorf("invalid domain allowlist")
		}

		fmt.Printf("Initialized %d allowlisted domains\n", len(allowlist.domains))
	}

	if len(rawEmails) > 0 {
		fmt.Printf("Initializing email allowlist\n")

		allowlist.emails = parseList(rawEmails)

		if len(allowlist.emails) == 0 {
			return fmt.Errorf("invalid email allowlist")
		}

		fmt.Printf("Initialized %d allowlisted emails\n", len(allowlist.emails))
	}

	return nil
}

// IsAllowed determines if the identity is
// allowed.
func IsAllowed(identity string) bool {
	return allowlist.isAllowed(identity)
}

// extractDomain gets the domain out of an email
//
// Considers a domain valid if:
// - email contains an '@' character
// - domain contains a '.' character
//
// If a valid domain cannot be extracted, an
// empty string is returned, which will never
// match and hence authentication is blocked.
func extractDomain(email string) string {
	if !strings.Contains(email, "@") {
		return ""
	}

	domain := strings.Split(email, "@")[1]

	if !strings.Contains(domain, ".") {
		return ""
	}

	return domain
}

// parseList parses a raw comma delimited string
// into a list of strings.
func parseList(rawList string) []string {
	// Always return a non-nil slice
	result := []string{}

	for item := range strings.SplitSeq(rawList, ",") {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
