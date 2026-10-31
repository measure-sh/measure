// Package testhelpers provides test-only helpers for swapping the
// package-level turnstile.Verify function and configuration. Each helper
// saves the current value, installs the test's value, and restores the
// original on test cleanup.
//
// Import as:
//
//	import turnstiletest "backend/libs/turnstile/testhelpers"
package testhelpers

import (
	"context"
	"testing"

	"backend/libs/turnstile"
)

// PassingToken is the token the fake installed by Enable accepts.
const PassingToken = "turnstile-pass"

// MockVerify swaps turnstile.Verify for the duration of the test.
func MockVerify(t *testing.T, fn func(ctx context.Context, token string) (bool, error)) {
	t.Helper()
	orig := turnstile.Verify
	turnstile.Verify = fn
	t.Cleanup(func() { turnstile.Verify = orig })
}

// Enable sets a test secret so turnstile.Enabled reports true, and installs a
// fake that accepts only PassingToken, so no test reaches Cloudflare.
func Enable(t *testing.T) {
	t.Helper()
	turnstile.Init(turnstile.Config{SecretKey: "turnstile_test"})
	t.Cleanup(func() { turnstile.Init(turnstile.Config{}) })

	MockVerify(t, func(_ context.Context, token string) (bool, error) {
		return token == PassingToken, nil
	})
}
