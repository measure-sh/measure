package pipeline

import (
	"testing"
)

func TestExtractFolderID(t *testing.T) {
	tests := []struct {
		url       string
		expectID  string
		expectErr bool
	}{
		{
			url:      "https://drive.google.com/drive/folders/1_abc123def456",
			expectID: "1_abc123def456",
		},
		{
			url:      "https://drive.google.com/drive/u/0/folders/2_xyz789uvw012",
			expectID: "2_xyz789uvw012",
		},
		{
			url:      "https://drive.google.com/drive/u/5/folders/folder-id-with-dash",
			expectID: "folder-id-with-dash",
		},
		{
			url:       "https://drive.google.com/drive/file/d/some-file-id",
			expectErr: true,
		},
		{
			url:       "not-a-url",
			expectErr: true,
		},
		{
			url:       "",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		id, err := extractFolderID(tt.url)
		if tt.expectErr {
			if err == nil {
				t.Errorf("extractFolderID(%q): expected error, got id=%q", tt.url, id)
			}
		} else {
			if err != nil {
				t.Errorf("extractFolderID(%q): unexpected error: %v", tt.url, err)
			}
			if id != tt.expectID {
				t.Errorf("extractFolderID(%q): expected id=%q, got %q", tt.url, tt.expectID, id)
			}
		}
	}
}

func TestEscapeDriveQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "simple",
			expected: "simple",
		},
		{
			input:    "with'quote",
			expected: "with\\'quote",
		},
		{
			input:    `with"doublequote`,
			expected: `with\"doublequote`,
		},
		{
			input:    `with\backslash`,
			expected: `with\\backslash`,
		},
		{
			input:    `complex'test"with\all`,
			expected: `complex\'test\"with\\all`,
		},
	}

	for _, tt := range tests {
		result := escapeDriveQuery(tt.input)
		if result != tt.expected {
			t.Errorf("escapeDriveQuery(%q): expected %q, got %q", tt.input, tt.expected, result)
		}
	}
}
