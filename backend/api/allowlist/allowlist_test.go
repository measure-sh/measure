package allowlist

import (
	"reflect"
	"testing"
)

func TestExtractDomain(t *testing.T) {
	tests := []struct {
		email    string
		expected string
	}{
		{"user@example.com", "example.com"},
		{"user@subdomain.example.com", "subdomain.example.com"},
		{"user@example.co.uk", "example.co.uk"},
		{"user@example", ""},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			actual := extractDomain(tt.email)
			if actual != tt.expected {
				t.Errorf("extractDomain(%q) = %q, want %q", tt.email, actual, tt.expected)
			}
		})
	}
}

func TestParseList(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "simple list",
			input:    "one,two,three",
			expected: []string{"one", "two", "three"},
		},
		{
			name:     "list with spaces",
			input:    " one , two,  three ",
			expected: []string{"one", "two", "three"},
		},
		{
			name:     "list with empty items",
			input:    "one,,three",
			expected: []string{"one", "three"},
		},
		{
			name:     "single item",
			input:    "one",
			expected: []string{"one"},
		},
		{
			name:     "empty string",
			input:    "",
			expected: []string{},
		},
		{
			name:     "only commas",
			input:    ",,",
			expected: []string{},
		},
		{
			name:     "leading and trailing commas",
			input:    ",one,two,",
			expected: []string{"one", "two"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := parseList(tt.input)
			if !reflect.DeepEqual(actual, tt.expected) {
				t.Errorf("parseList(%q) = %v, want %v", tt.input, actual, tt.expected)
			}
		})
	}
}

func TestIsAllowed(t *testing.T) {
	tests := []struct {
		name     string
		list     *list
		identity string
		expected bool
	}{
		{
			name:     "empty allowlist",
			list:     &list{},
			identity: "user@example.com",
			expected: true,
		},
		{
			name:     "email in allowlist",
			list:     &list{emails: []string{"user@example.com"}},
			identity: "user@example.com",
			expected: true,
		},
		{
			name:     "email not in allowlist (case-sensitive)",
			list:     &list{emails: []string{"user@example.com"}},
			identity: "USER@EXAMPLE.COM",
			expected: false,
		},
		{
			name:     "domain in allowlist",
			list:     &list{domains: []string{"example.com"}},
			identity: "user@example.com",
			expected: true,
		},
		{
			name:     "domain not in allowlist (case-sensitive)",
			list:     &list{domains: []string{"example.com"}},
			identity: "user@EXAMPLE.COM",
			expected: false,
		},
		{
			name:     "user not in any allowlist",
			list:     &list{domains: []string{"another.com"}, emails: []string{"other@another.com"}},
			identity: "user@example.com",
			expected: false,
		},
		{
			name:     "empty identity string",
			list:     &list{emails: []string{"user@example.com"}},
			identity: "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.list.isAllowed(tt.identity); got != tt.expected {
				t.Errorf("isAllowed() for identity %q = %v, want %v", tt.identity, got, tt.expected)
			}
		})
	}
}
