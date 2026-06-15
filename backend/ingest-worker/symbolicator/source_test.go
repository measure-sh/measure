package symbolicator

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNewS3SourceApple(t *testing.T) {
	source := NewS3SourceApple("my-id", "my-bucket", "my-region", "my-origin", "my-access-key", "my-secret-key")

	{
		bytes, _ := json.Marshal(source)

		expected := `{"id":"my-id","type":"s3","bucket":"my-bucket","prefix":"","region":["my-region","my-origin"],"access_key":"my-access-key","secret_key":"my-secret-key","filters":{"filetypes":["mach_debug"],"path_patterns":[]},"layout":{"type":"unified","casing":"lowercase"}}`
		got := string(bytes)

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestNewS3SourceAndroid(t *testing.T) {
	source := NewS3SourceAndroid("my-id", "my-bucket", "my-region", "my-origin", "my-access-key", "my-secret-key")

	{
		bytes, _ := json.Marshal(source)

		expected := `{"id":"my-id","type":"s3","bucket":"my-bucket","prefix":"","region":["my-region","my-origin"],"access_key":"my-access-key","secret_key":"my-secret-key","filters":{"filetypes":["proguard","elf_debug"],"path_patterns":[]},"layout":{"type":"unified","casing":"lowercase"}}`
		got := string(bytes)

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestNewGCSSourceApple(t *testing.T) {
	source := NewGCSSourceApple("my-id", "my-bucket", "my-bearer-token")

	{
		bytes, _ := json.Marshal(source)

		expected := `{"id":"my-id","type":"gcs","bucket":"my-bucket","prefix":"","bearer_token":"my-bearer-token","filters":{"filetypes":["mach_debug"],"path_patterns":[]},"layout":{"type":"unified","casing":"lowercase"}}`
		got := string(bytes)

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestNewSentrySource(t *testing.T) {
	source := NewSentrySource("my-id", "http://symboloader:8083/symbols", "my-token")

	{
		bytes, _ := json.Marshal(source)

		expected := `{"id":"my-id","type":"sentry","url":"http://symboloader:8083/symbols","token":"my-token"}`
		got := string(bytes)

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestSourceRedactSecrets(t *testing.T) {
	// A Source can carry any of these secrets regardless of the
	// constructor that built it, so redactSecrets must mask them all.
	source := Source{
		ID:          "my-id",
		Type:        "s3",
		Bucket:      "my-bucket",
		AccessKey:   "my-access-key",
		SecretKey:   "my-secret-key",
		PrivateKey:  "my-private-key",
		BearerToken: "my-bearer-token",
		Token:       "my-token",
	}

	redacted := source.redactSecrets()

	{
		bytes, _ := json.Marshal(redacted)
		got := string(bytes)

		for _, secret := range []string{"my-secret-key", "my-private-key", "my-bearer-token", "my-token"} {
			if strings.Contains(got, secret) {
				t.Errorf("redacted source leaks %q: %v", secret, got)
			}
		}

		// non-secret fields, including the access key ID (an identifier,
		// not a secret), are preserved so logs stay useful
		for _, keep := range []string{"my-id", "my-bucket", "my-access-key"} {
			if !strings.Contains(got, keep) {
				t.Errorf("redacted source dropped %q: %v", keep, got)
			}
		}
	}

	// value receiver: the original must be left untouched
	if source.SecretKey != "my-secret-key" {
		t.Errorf("redactSecrets mutated the original source: %v", source.SecretKey)
	}
}

func TestRedactSourcesAppleAndAndroid(t *testing.T) {
	// Apple and Android S3 sources land in the same []Source slice that
	// the native request logs (see event.go), so redactSources must mask
	// secrets for every element regardless of platform.
	sources := []Source{
		NewS3SourceApple("apple-id", "apple-bucket", "region", "origin", "apple-access-key", "apple-secret-key"),
		NewS3SourceAndroid("android-id", "android-bucket", "region", "origin", "android-access-key", "android-secret-key"),
	}

	redacted := redactSources(sources)

	bytes, _ := json.Marshal(redacted)
	got := string(bytes)

	for _, secret := range []string{"apple-secret-key", "android-secret-key"} {
		if strings.Contains(got, secret) {
			t.Errorf("redactSources leaks %q: %v", secret, got)
		}
	}

	// access key IDs are identifiers, not secrets, so they stay visible
	for _, keep := range []string{"apple-access-key", "android-access-key"} {
		if !strings.Contains(got, keep) {
			t.Errorf("redactSources dropped %q: %v", keep, got)
		}
	}

	// originals are untouched so the real request still authenticates
	if sources[0].SecretKey != "apple-secret-key" {
		t.Errorf("redactSources mutated the original Apple source: %v", sources[0].SecretKey)
	}
}

func TestSentrySourceRedactSecrets(t *testing.T) {
	source := NewSentrySource("my-id", "http://symboloader:8083/symbols", "my-token")

	redacted := source.redactSecrets()

	{
		bytes, _ := json.Marshal(redacted)

		expected := `{"id":"my-id","type":"sentry","url":"http://symboloader:8083/symbols","token":"[redacted]"}`
		got := string(bytes)

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	if source.Token != "my-token" {
		t.Errorf("redactSecrets mutated the original source: %v", source.Token)
	}
}

func TestRedactSourcesPreservesEmptyAndNil(t *testing.T) {
	if redactSources(nil) != nil {
		t.Error("redactSources(nil) should return nil")
	}
	if redactSentrySources(nil) != nil {
		t.Error("redactSentrySources(nil) should return nil")
	}

	// an unset secret stays empty rather than being masked
	if got := maskSecret(""); got != "" {
		t.Errorf("maskSecret(\"\") should stay empty, got %q", got)
	}
}
