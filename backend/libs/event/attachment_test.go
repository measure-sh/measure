package event

import (
	"bytes"
	"compress/gzip"
	"io"
	"testing"
)

// gzipBytes compresses b so tests assert against a real gzip stream.
func gzipBytes(t *testing.T, b []byte) []byte {
	t.Helper()

	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(b); err != nil {
		t.Fatalf("failed to write gzip: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("failed to close gzip writer: %v", err)
	}

	return buf.Bytes()
}

func TestSniffEncoding(t *testing.T) {
	gzipped := gzipBytes(t, []byte(`{"hello":"world"}`))

	tests := []struct {
		name     string
		input    []byte
		expected string
	}{
		{
			name:     "gzip stream",
			input:    gzipped,
			expected: "gzip",
		},
		{
			name:     "plain json",
			input:    []byte(`{"hello":"world"}`),
			expected: "",
		},
		{
			name:     "png bytes",
			input:    []byte{0x89, 0x50, 0x4e, 0x47},
			expected: "",
		},
		{
			name:     "shorter than magic",
			input:    []byte{0x1f},
			expected: "",
		},
		{
			name:     "empty",
			input:    []byte{},
			expected: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			// multipart.File is a ReadSeeker, mirror that here
			reader := bytes.NewReader(test.input)

			encoding, err := sniffEncoding(reader)
			if err != nil {
				t.Fatalf("failed to sniff encoding: %v", err)
			}

			if encoding != test.expected {
				t.Errorf("expected encoding %q, got %q", test.expected, encoding)
			}

			// the body must be rewound, uploads read it from the start
			got, err := io.ReadAll(reader)
			if err != nil {
				t.Fatalf("failed to read body: %v", err)
			}

			if !bytes.Equal(got, test.input) {
				t.Errorf("expected body of %d bytes, got %d", len(test.input), len(got))
			}
		})
	}
}

// TestSniffEncodingNonSeekable covers the degraded path, no encoding is
// claimed & the body stays untouched.
func TestSniffEncodingNonSeekable(t *testing.T) {
	gzipped := gzipBytes(t, []byte(`{"hello":"world"}`))
	// a bare Reader hides the Seek method
	body := struct{ io.Reader }{bytes.NewReader(gzipped)}

	encoding, err := sniffEncoding(body)
	if err != nil {
		t.Fatalf("failed to sniff encoding: %v", err)
	}

	if encoding != "" {
		t.Errorf("expected no encoding, got %q", encoding)
	}

	got, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("failed to read body: %v", err)
	}

	if !bytes.Equal(got, gzipped) {
		t.Errorf("expected body of %d bytes, got %d", len(gzipped), len(got))
	}
}

func TestContentTypeOf(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "gzipped json",
			input:    "snapshot.json.gz",
			expected: "application/json",
		},
		{
			name:     "plain json",
			input:    "snapshot.json",
			expected: "application/json",
		},
		{
			name:     "webp screenshot",
			input:    "screenshot.webp",
			expected: "image/webp",
		},
		{
			name:     "svg layout snapshot",
			input:    "snapshot.svg",
			expected: "image/svg+xml",
		},
		{
			name:     "no extension",
			input:    "0191f3f9-8e0a-7000-8000-000000000000",
			expected: "application/octet-stream",
		},
		{
			name:     "unregistered extension",
			input:    "trace.perfetto",
			expected: "application/octet-stream",
		},
		{
			name:     "empty",
			input:    "",
			expected: "application/octet-stream",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := contentTypeOf(test.input)

			// mime types may carry a charset param depending on host tables
			if got != test.expected && !bytes.HasPrefix([]byte(got), []byte(test.expected+";")) {
				t.Errorf("expected content type %q, got %q", test.expected, got)
			}
		})
	}
}
