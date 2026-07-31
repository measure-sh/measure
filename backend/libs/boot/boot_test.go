package boot

import (
	"context"
	"testing"
	"time"
)

// TestConnectValkeyUnreachable checks that an unreachable valkey ends in an
// error after the timeout, never a nil client with a nil error.
func TestConnectValkeyUnreachable(t *testing.T) {
	start := time.Now()
	client, err := ConnectValkey(context.Background(), "127.0.0.1", 1, "test", 2*time.Second)
	if err == nil {
		t.Fatal("expected error for unreachable valkey")
	}
	if client != nil {
		t.Fatal("expected nil client on failure")
	}
	if elapsed := time.Since(start); elapsed < time.Second {
		t.Fatalf("returned after %v, expected retries until the timeout", elapsed)
	}
}
