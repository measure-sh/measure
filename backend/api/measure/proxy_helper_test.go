package measure

import (
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
			got, err := validateProxyPayload(tt.payload, tt.endpoint)
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
