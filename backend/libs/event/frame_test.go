package event

import (
	"testing"
)

func TestNormalizeAddress(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "spaces",
			input:    "   ",
			expected: "",
		},
		{
			name:     "already normalized",
			input:    "0x123abc",
			expected: "0x123abc",
		},
		{
			name:     "uppercase prefix",
			input:    "0X123abc",
			expected: "0x123abc",
		},
		{
			name:     "uppercase hex with prefix",
			input:    "0x123ABC",
			expected: "0x123abc",
		},
		{
			name:     "16 char hex string without prefix",
			input:    "0123456789abcdef",
			expected: "0x0123456789abcdef",
		},
		{
			name:     "16 char uppercase hex string without prefix",
			input:    "0123456789ABCDEF",
			expected: "0x0123456789abcdef",
		},
		{
			name:     "15 char string",
			input:    "123456789abcdef",
			expected: "123456789abcdef",
		},
		{
			name:     "non-hex 16 char string",
			input:    "0123456789abcdex",
			expected: "0123456789abcdex",
		},
		{
			name:     "random string",
			input:    "some_string",
			expected: "some_string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeAddress(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeAddress(%q) = %q; want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestIsHexString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "empty string",
			input:    "",
			expected: true,
		},
		{
			name:     "valid lowercase hex",
			input:    "0123456789abcdef",
			expected: true,
		},
		{
			name:     "valid uppercase hex",
			input:    "0123456789ABCDEF",
			expected: true,
		},
		{
			name:     "mixed case hex",
			input:    "0123456789AbCdEf",
			expected: true,
		},
		{
			name:     "invalid character 'x'",
			input:    "01234x",
			expected: false,
		},
		{
			name:     "invalid character 'g'",
			input:    "abcdefg",
			expected: false,
		},
		{
			name:     "spaces included",
			input:    "12 34",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isHexString(tt.input)
			if result != tt.expected {
				t.Errorf("isHexString(%q) = %v; want %v", tt.input, result, tt.expected)
			}
		})
	}
}
