package symbolicator

import (
	"encoding/json"
	"testing"
)

func TestNewS3SourceApple(t *testing.T) {
	source := NewS3SourceApple("my-id", "my-bucket", "my-region", "my-origin", "my-access-key", "my-secret-key")

	{
		bytes, _ := json.Marshal(source)

		expected := `{"id":"my-id","type":"s3","bucket":"my-bucket","prefix":"","region":["my-region","my-origin"],"path_style":true,"access_key":"my-access-key","secret_key":"my-secret-key","filters":{"filetypes":["mach_debug"],"path_patterns":[]},"layout":{"type":"unified","casing":"lowercase"}}`
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

		expected := `{"id":"my-id","type":"s3","bucket":"my-bucket","prefix":"","region":["my-region","my-origin"],"path_style":true,"access_key":"my-access-key","secret_key":"my-secret-key","filters":{"filetypes":["proguard","elf_debug"],"path_patterns":[]},"layout":{"type":"unified","casing":"lowercase"}}`
		got := string(bytes)

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestNewGCSSourceApple(t *testing.T) {
	source := NewGCSSourceApple("my-id", "my-bucket", "my-private-key", "my-client-email")

	{
		bytes, _ := json.Marshal(source)

		expected := `{"id":"my-id","type":"gcs","bucket":"my-bucket","prefix":"","private_key":"my-private-key","client_email":"my-client-email","filters":{"filetypes":["mach_debug"],"path_patterns":[]},"layout":{"type":"unified","casing":"lowercase"}}`
		got := string(bytes)

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}
