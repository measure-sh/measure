package cmd

import "testing"

func TestResolveUploadPath(t *testing.T) {
	root := "/tmp/session-data"

	// valid relative paths resolve under root
	got, err := resolveUploadPath(root, "app/1.0/blobs/abc")
	if err != nil || got != "/tmp/session-data/app/1.0/blobs/abc" {
		t.Fatalf("valid path: got %q, err %v", got, err)
	}

	// traversal and absolute paths are rejected
	for _, bad := range []string{"../etc/passwd", "/etc/passwd", "app/../../etc"} {
		if _, err := resolveUploadPath(root, bad); err == nil {
			t.Fatalf("expected %q to be rejected", bad)
		}
	}
}

func TestSafePathComponent(t *testing.T) {
	// legit app ids & versions pass
	for _, ok := range []string{"sh.measure.sample", "1.0.0", "100", "com.example"} {
		if !safePathComponent(ok) {
			t.Fatalf("expected %q to be accepted", ok)
		}
	}

	// separators, traversal & empty are rejected
	for _, bad := range []string{"", "..", "../etc", "a/b", `a\b`, "..\\x"} {
		if safePathComponent(bad) {
			t.Fatalf("expected %q to be rejected", bad)
		}
	}
}
