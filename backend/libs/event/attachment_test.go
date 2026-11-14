package event

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"net/url"
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
			name:           "gzipped snapshot resolves by type not extension",
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
			name:           "flutter gallery jpeg screenshot",
			attachmentType: "screenshot",
			filename:       "93ce9654-844a-4e8f-ac1b-ca0fc479008c.jpg",
			head:           []byte{0xff, 0xd8, 0xff, 0xe0},
			expected:       "image/jpeg",
		},
		{
			name:           "flutter gallery png screenshot",
			attachmentType: "screenshot",
			filename:       "93ce9654-844a-4e8f-ac1b-ca0fc479008c.png",
			head:           pngBytes,
			expected:       "image/png",
		},
		{
			// a synthetic extension, real ones like .heic resolve only on
			// hosts whose mime files define them
			name:           "unregistered extension falls back to bytes",
			attachmentType: "screenshot",
			filename:       "93ce9654-844a-4e8f-ac1b-ca0fc479008c.msrunknown",
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
			filename:       "profile.perfetto-trace",
			head:           []byte{0x0a, 0x00, 0x00, 0x00},
			expected:       "application/octet-stream",
		},
		{
			name:           "perfetto java heap dump",
			attachmentType: "perfetto_java_heap_dump",
			filename:       "profile.perfetto-java-heap-dump",
			head:           []byte{0x0a, 0x00, 0x00, 0x00},
			expected:       "application/octet-stream",
		},
		{
			name:           "perfetto heap profile",
			attachmentType: "perfetto_heap_profile",
			filename:       "profile.perfetto-heap-profile",
			head:           []byte{0x0a, 0x00},
			expected:       "application/octet-stream",
		},
		{
			name:           "perfetto stack sample",
			attachmentType: "perfetto_stack_sample",
			filename:       "profile.perfetto-stack-sample",
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

func TestResponseOverrides(t *testing.T) {
	tests := []struct {
		name            string
		attachmentType  string
		filename        string
		proxied         bool
		wantDisposition string
		wantType        string
	}{
		{"screenshot png", "screenshot", "a.png", false, "inline; filename=a.png", "image/png"},
		{"screenshot upper ext", "screenshot", "a.JPG", false, "inline; filename=a.JPG", "image/jpeg"},
		{"screenshot webp", "screenshot", "a.webp", true, "inline; filename=a.webp", "image/webp"},
		{"layout snapshot gif", "layout_snapshot", "a.gif", false, "inline; filename=a.gif", "image/gif"},
		{"svg proxied", "layout_snapshot", "a.svg", true, "inline; filename=a.svg", "image/svg+xml"},
		{"svg direct", "layout_snapshot", "a.svg", false, "attachment; filename=a.svg", ""},
		{"bare uuid screenshot", "screenshot", "fa496759-113e-4900-92ed-b3c422c8d7b5", true, "attachment; filename=fa496759-113e-4900-92ed-b3c422c8d7b5", ""},
		{"layout json", "layout_snapshot_json", "a.json.gz", true, "attachment; filename=a.json.gz", "application/json"},
		{"perfetto", "perfetto_trace", "a.perfetto-trace", false, "attachment; filename=a.perfetto-trace", "application/octet-stream"},
		{"png name on non image type", "perfetto_trace", "a.png", true, "attachment; filename=a.png", "application/octet-stream"},
		{"non image type without fixed type", "other", "a.bin", true, "attachment; filename=a.bin", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &Attachment{Type: tt.attachmentType, Name: tt.filename}
			disposition, contentType := a.responseOverrides(tt.proxied)
			if disposition != tt.wantDisposition {
				t.Errorf("disposition = %q, want %q", disposition, tt.wantDisposition)
			}
			if contentType != tt.wantType {
				t.Errorf("contentType = %q, want %q", contentType, tt.wantType)
			}
		})
	}
}

func TestPreSignURLResponseOverrides(t *testing.T) {
	const origin = "https://measure.test"

	tests := []struct {
		name             string
		attachmentType   string
		filename         string
		attachmentOrigin string
		wantDisposition  string
		wantType         string
	}{
		{"direct png", "screenshot", "a.png", "https://files.test", "inline; filename=a.png", "image/png"},
		{"proxied png", "screenshot", "a.png", "", "inline; filename=a.png", "image/png"},
		{"direct svg", "layout_snapshot", "a.svg", "https://files.test", "attachment; filename=a.svg", ""},
		{"proxied svg", "layout_snapshot", "a.svg", "", "inline; filename=a.svg", "image/svg+xml"},
		{"direct layout json", "layout_snapshot_json", "a.json.gz", "https://files.test", "attachment; filename=a.json.gz", "application/json"},
		{"proxied layout json", "layout_snapshot_json", "a.json.gz", "", "attachment; filename=a.json.gz", "application/json"},
		{"direct perfetto", "perfetto_trace", "a.perfetto-trace", "https://files.test", "attachment; filename=a.perfetto-trace", "application/octet-stream"},
		{"proxied bare uuid screenshot", "screenshot", "fa496759-113e-4900-92ed-b3c422c8d7b5", "", "attachment; filename=fa496759-113e-4900-92ed-b3c422c8d7b5", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &Attachment{Type: tt.attachmentType, Name: tt.filename, Key: "bucket-key/" + tt.filename}
			err := a.PreSignURL(context.Background(), PreSignConfig{
				AWSEndpoint:                "http://minio.test:9000",
				AttachmentsBucket:          "attachments",
				AttachmentsBucketRegion:    "us-east-1",
				AttachmentsAccessKey:       "key",
				AttachmentsSecretAccessKey: "secret",
				AttachmentOrigin:           tt.attachmentOrigin,
				Origin:                     origin,
			})
			if err != nil {
				t.Fatalf("PreSignURL: %v", err)
			}

			signed := mustParse(t, a.Location)
			if tt.attachmentOrigin == "" {
				signed = mustParse(t, signed.Query().Get("payload"))
			}

			query := signed.Query()
			if got := query.Get("response-content-disposition"); got != tt.wantDisposition {
				t.Errorf("response-content-disposition = %q, want %q", got, tt.wantDisposition)
			}
			if got := query.Get("response-content-type"); got != tt.wantType {
				t.Errorf("response-content-type = %q, want %q", got, tt.wantType)
			}
		})
	}
}

// mustParse parses a URL or fails the test.
func mustParse(t *testing.T, raw string) *url.URL {
	t.Helper()

	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse %q: %v", raw, err)
	}
	return u
}
