package objstore

import (
	"net/http"
	"testing"
)

func TestValidateProxyPayload(t *testing.T) {
	tests := []struct {
		name     string
		payload  string
		endpoint string
		wantHost string
		wantErr  bool
	}{
		{
			name:     "valid full url matching endpoint",
			payload:  "http://minio:9000/bucket/key?X-Amz-Signature=abc",
			endpoint: "http://minio:9000",
			wantHost: "minio:9000",
		},
		{
			name:     "valid path-only payload gets endpoint prepended",
			payload:  "/bucket/key?X-Amz-Signature=abc",
			endpoint: "http://minio:9000",
			wantHost: "minio:9000",
		},
		{
			name:     "empty endpoint rejected",
			payload:  "http://169.254.169.254/latest/meta-data/",
			endpoint: "",
			wantErr:  true,
		},
		{
			name:     "ssrf via subdomain prefix bypass rejected",
			payload:  "http://minio:9000.attacker.com/evil",
			endpoint: "http://minio:9000",
			wantErr:  true,
		},
		{
			name:     "ssrf to arbitrary host rejected",
			payload:  "http://evil.com/steal",
			endpoint: "http://minio:9000",
			wantErr:  true,
		},
		{
			name:     "ssrf to imds rejected",
			payload:  "http://169.254.169.254/latest/meta-data/",
			endpoint: "http://minio:9000",
			wantErr:  true,
		},
		{
			name:     "different port rejected",
			payload:  "http://minio:8080/bucket/key",
			endpoint: "http://minio:9000",
			wantErr:  true,
		},
		{
			name:     "scheme mismatch with same host rejected",
			payload:  "https://minio:9000/bucket/key",
			endpoint: "http://minio:9000",
			wantErr:  true,
		},
		{
			name:     "endpoint with trailing slash",
			payload:  "http://minio:9000/bucket/key?sig=abc",
			endpoint: "http://minio:9000/",
			wantHost: "minio:9000",
		},
		{
			name:     "endpoint without port",
			payload:  "http://minio/bucket/key",
			endpoint: "http://minio",
			wantHost: "minio",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateProxyPayload(tt.payload, tt.endpoint)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil with URL %v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.Host != tt.wantHost {
				t.Errorf("host = %q, want %q", got.Host, tt.wantHost)
			}
		})
	}
}

func TestHardenAttachmentResponse(t *testing.T) {
	tests := []struct {
		name            string
		contentType     string
		disposition     string
		wantDisposition string
	}{
		{name: "png", contentType: "image/png", wantDisposition: "inline"},
		{name: "jpeg", contentType: "image/jpeg", wantDisposition: "inline"},
		{name: "webp", contentType: "image/webp", wantDisposition: "inline"},
		{name: "gif", contentType: "image/gif", wantDisposition: "inline"},
		{name: "upper case image type", contentType: "IMAGE/PNG", wantDisposition: "inline"},
		{name: "image then html list", contentType: "image/png, text/html", wantDisposition: "attachment"},
		{name: "svg", contentType: "image/svg+xml", wantDisposition: "inline"},
		{name: "image type with params", contentType: "image/png; foo=bar", wantDisposition: "inline"},
		{name: "html", contentType: "text/html; charset=utf-8", wantDisposition: "attachment"},
		{name: "xml", contentType: "text/xml", wantDisposition: "attachment"},
		{name: "octet-stream", contentType: "application/octet-stream", wantDisposition: "attachment"},
		{name: "json", contentType: "application/json", wantDisposition: "attachment"},
		{name: "empty type", contentType: "", wantDisposition: "attachment"},
		{name: "unparseable type", contentType: ";;;", wantDisposition: "attachment"},
		{name: "upstream inline html", contentType: "text/html", disposition: "inline", wantDisposition: "attachment"},
		{name: "filename kept on inline", contentType: "image/png", disposition: `attachment; filename="a.png"`, wantDisposition: `inline; filename=a.png`},
		{name: "filename kept on attachment", contentType: "text/html", disposition: `inline; filename="a b.html"`, wantDisposition: `attachment; filename="a b.html"`},
		{name: "unparseable upstream disposition", contentType: "image/png", disposition: ";;;", wantDisposition: "inline"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{Header: http.Header{}}
			if tt.contentType != "" {
				resp.Header.Set("Content-Type", tt.contentType)
			}
			if tt.disposition != "" {
				resp.Header.Set("Content-Disposition", tt.disposition)
			}

			HardenAttachmentResponse(resp)

			if got := resp.Header.Get("Content-Disposition"); got != tt.wantDisposition {
				t.Errorf("Content-Disposition = %q, want %q", got, tt.wantDisposition)
			}
			if got := resp.Header.Get("Content-Security-Policy"); got != attachmentCSP {
				t.Errorf("Content-Security-Policy = %q, want %q", got, attachmentCSP)
			}
			if got := resp.Header.Get("X-Content-Type-Options"); got != "nosniff" {
				t.Errorf("X-Content-Type-Options = %q, want nosniff", got)
			}
		})
	}
}

func TestAttachmentDisposition(t *testing.T) {
	tests := []struct {
		name string
		kind string
		in   string
		want string
	}{
		{name: "plain", kind: "attachment", in: "a.png", want: "attachment; filename=a.png"},
		{name: "crlf stripped", kind: "attachment", in: "a\r\nSet-Cookie: x=1.png", want: `attachment; filename="aSet-Cookie: x=1.png"`},
		{name: "quotes escaped", kind: "attachment", in: `a"b.png`, want: `attachment; filename="a\"b.png"`},
		{name: "backslash mapped", kind: "attachment", in: `a\b.png`, want: "attachment; filename=a_b.png"},
		{name: "slash path mapped", kind: "attachment", in: "../../etc/passwd", want: "attachment; filename=.._.._etc_passwd"},
		{name: "non-ascii", kind: "inline", in: "snap\u00e9.png", want: "inline; filename*=utf-8''snap%C3%A9.png"},
		{name: "empty", kind: "attachment", in: "", want: "attachment"},
		{name: "dot", kind: "inline", in: ".", want: "inline"},
		{name: "dot dot", kind: "inline", in: "..", want: "inline"},
		{name: "control only", kind: "attachment", in: "\r\n", want: "attachment"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := AttachmentDisposition(tt.kind, tt.in); got != tt.want {
				t.Errorf("AttachmentDisposition(%q, %q) = %q, want %q", tt.kind, tt.in, got, tt.want)
			}
		})
	}
}
