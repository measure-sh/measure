// Package testhelpers replaces the turnstile client in tests and restores it
// on cleanup.
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

// Enable makes turnstile.Enabled report true, with a fake that accepts only
// PassingToken.
func Enable(t *testing.T) {
	t.Helper()
	turnstile.Init(turnstile.Config{SecretKey: "turnstile_test"})
	t.Cleanup(func() { turnstile.Init(turnstile.Config{}) })

	MockVerify(t, func(_ context.Context, token string) (bool, error) {
		return token == PassingToken, nil
	})
}
