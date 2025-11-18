// Package ambient provides utilities for storing and retrieving request-scoped
// contextual information in Go applications, such as team IDs using the standard
// context package. It emphasizes type safety with unexported struct keys to
// prevent collisions across packages.
//
// This package is designed for ambient data like tracing IDs or tenant info in
// HTTP handlers or goroutines. It wraps context.WithValue for domain-specific
// accessors, promoting immutability and error handling.
//
// Key Principles:
// - Use unexported struct{} types for keys (comparable, zero-sized).
// - Getters return (value, error) for explicit failure handling.
// - Avoid for core function params; prefer explicit arguments per Go docs.
//
// # Usage
//
// Import the package:
//
//	import "path/to/ambient"
//
// Attach a value:
//
//	ctx = ambient.WithTeamID(ctx, uuid.MustParse("123e4567-e89b-12d3-a456-426614174000"))
//
// Retrieve safely:
//
//	id, err := ambient.TeamID(ctx)
//	if err != nil {
//	    // Handle error (e.g., log or return).
//	}
//
// # Thread Safety
//
// All functions are goroutine-safe, as they rely on the immutable context.Context
// from the standard library. Values are read-only post-attachment.
//
// # Testing
//
// Use context.Background() in tests:
//
//	func TestTeamID(t *testing.T) {
//	    ctx := context.Background()
//	    ctx = WithTeamID(ctx, uuid.New())
//	    id, err := TeamID(ctx)
//	    if err != nil {
//	        t.Fatalf("unexpected error: %v", err)
//	    }
//	    if id == uuid.Nil {
//	        t.Error("expected non-nil UUID")
//	    }
//	}
//
// # Caveats
//
// - Performance: Value lookup is O(n) on context depth; keep chains shallow.
// - Alternatives: For many keys, consider a custom struct embedding context.Context.
// - Go Version: Compatible with Go 1.7+ (context package introduction).
//
// See godoc.org for rendered output or run `go doc ambient` locally.
package ambient
