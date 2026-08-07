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

// webpBytes is a minimal RIFF/WEBP header, enough for content detection.
var webpBytes = []byte("RIFF\x00\x00\x00\x00WEBPVP8 ")

// pngBytes is the png signature.
var pngBytes = []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}

func TestSniffBody(t *testing.T) {
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
			name:     "webp bytes",
			input:    webpBytes,
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
		{
			name:     "larger than sniff window",
			input:    gzipBytes(t, bytes.Repeat([]byte("a"), sniffLen*3)),
			expected: "gzip",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			// multipart.File is a ReadSeeker, mirror that here
			reader := bytes.NewReader(test.input)

			head, encoding, err := sniffBody(reader)
			if err != nil {
				t.Fatalf("failed to sniff body: %v", err)
			}

			if encoding != test.expected {
				t.Errorf("expected encoding %q, got %q", test.expected, encoding)
			}

			if len(head) > sniffLen {
				t.Errorf("expected head of at most %d bytes, got %d", sniffLen, len(head))
			}

			if !bytes.HasPrefix(test.input, head) {
				t.Error("head is not a prefix of the body")
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

// TestSniffBodyNonSeekable covers the degraded path, nothing is claimed & the
// body stays untouched.
func TestSniffBodyNonSeekable(t *testing.T) {
	gzipped := gzipBytes(t, []byte(`{"hello":"world"}`))
	// a bare Reader hides the Seek method
	body := struct{ io.Reader }{bytes.NewReader(gzipped)}

	head, encoding, err := sniffBody(body)
	if err != nil {
		t.Fatalf("failed to sniff body: %v", err)
	}

	if encoding != "" {
		t.Errorf("expected no encoding, got %q", encoding)
	}

	if len(head) != 0 {
		t.Errorf("expected no head, got %d bytes", len(head))
	}

	got, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("failed to read body: %v", err)
	}

	if !bytes.Equal(got, gzipped) {
		t.Errorf("expected body of %d bytes, got %d", len(gzipped), len(got))
	}
}

// TestContentTypeFor covers every attachment naming convention the SDKs have
// shipped. Released SDKs keep sending all of them, so each must resolve
// correctly regardless of how the file is named.
func TestContentTypeFor(t *testing.T) {
	gzippedJSON := gzipBytes(t, []byte(`{"hello":"world"}`))

	tests := []struct {
		name           string
		attachmentType string
		filename       string
		head           []byte
		expected       string
	}{
		// layout_snapshot_json, the type settles it, the bytes are gzip &
		// the name varies wildly across SDKs
		{
			name:           "android gzipped snapshot",
			attachmentType: "layout_snapshot_json",
			filename:       "snapshot.json.gz",
			head:           gzippedJSON,
			expected:       "application/json",
		},
		{
			name:           "ios bare uuid snapshot",
			attachmentType: "layout_snapshot_json",
			filename:       "fa496759-113e-4900-92ed-b3c422c8d7b5",
			head:           gzippedJSON,
			expected:       "application/json",
		},
		{
			name:           "future ios snapshot with extension",
			attachmentType: "layout_snapshot_json",
			filename:       "fa496759-113e-4900-92ed-b3c422c8d7b5.json.gz",
			head:           gzippedJSON,
			expected:       "application/json",
		},

		// screenshots, the name is a hint & the bytes are the fallback
		{
			name:           "android screenshot literal",
			attachmentType: "screenshot",
			filename:       "screenshot.webp",
			head:           webpBytes,
			expected:       "image/webp",
		},
		{
			name:           "ios uuid screenshot",
			attachmentType: "screenshot",
			filename:       "fa496759-113e-4900-92ed-b3c422c8d7b5.webp",
			head:           webpBytes,
			expected:       "image/webp",
		},
		{
			name:           "ios gallery screenshot literal",
			attachmentType: "screenshot",
			filename:       "galleryImage.webp",
			head:           webpBytes,
			expected:       "image/webp",
		},
		{
			name:           "bare uuid screenshot falls back to bytes",
			attachmentType: "screenshot",
			filename:       "93ce9654-844a-4e8f-ac1b-ca0fc479008c",
			head:           webpBytes,
			expected:       "image/webp",
		},
		{
			name:           "bare uuid png screenshot falls back to bytes",
			attachmentType: "screenshot",
			filename:       "93ce9654-844a-4e8f-ac1b-ca0fc479008c",
			head:           pngBytes,
			expected:       "image/png",
		},

		// layout_snapshot, svg on some SDKs & raster on others
		{
			name:           "android legacy svg snapshot",
			attachmentType: "layout_snapshot",
			filename:       "snapshot.svg",
			head:           []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`),
			expected:       "image/svg+xml",
		},
		{
			name:           "ios legacy svg snapshot",
			attachmentType: "layout_snapshot",
			filename:       "layoutSnapshot.svg",
			head:           []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`),
			expected:       "image/svg+xml",
		},
		{
			name:           "raster layout snapshot",
			attachmentType: "layout_snapshot",
			filename:       "layoutSnapshot.webp",
			head:           webpBytes,
			expected:       "image/webp",
		},

		// opaque payloads, always octet-stream
		{
			name:           "perfetto trace",
			attachmentType: "perfetto_trace",
			filename:       "profile_trigger-type-2_2026-07-13-18-52-49.perfetto-trace",
			head:           []byte{0x0a, 0x00, 0x00, 0x00},
			expected:       "application/octet-stream",
		},
		{
			name:           "heap dump",
			attachmentType: "heap_dump",
			filename:       "profile.hprof",
			head:           []byte("JAVA PROFILE 1.0.3"),
			expected:       "application/octet-stream",
		},
		{
			name:           "heap profile",
			attachmentType: "heap_profile",
			filename:       "profile.heapprofd",
			head:           []byte{0x0a, 0x00},
			expected:       "application/octet-stream",
		},

		// degraded inputs
		{
			name:           "unknown type with no name or bytes",
			attachmentType: "",
			filename:       "",
			head:           nil,
			expected:       "application/octet-stream",
		},
		{
			name:           "screenshot with no bytes to sniff",
			attachmentType: "screenshot",
			filename:       "93ce9654-844a-4e8f-ac1b-ca0fc479008c",
			head:           nil,
			expected:       "application/octet-stream",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := contentTypeFor(test.attachmentType, test.filename, test.head)

			// mime types may carry a charset param depending on host tables
			if got != test.expected && !bytes.HasPrefix([]byte(got), []byte(test.expected+";")) {
				t.Errorf("expected content type %q, got %q", test.expected, got)
			}
		})
	}
}
