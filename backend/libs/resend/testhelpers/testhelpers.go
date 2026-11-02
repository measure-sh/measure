// Package testhelpers replaces the resend client in tests and restores it on
// cleanup.
//
// Import as:
//
//	import resendtest "backend/libs/resend/testhelpers"
package testhelpers

import (
	"context"
	"errors"
	"testing"

	"backend/libs/resend"
)

// MockSubscribe swaps resend.Subscribe for the duration of the test.
func MockSubscribe(t *testing.T, fn func(ctx context.Context, email, firstName string) error) {
	t.Helper()
	orig := resend.Subscribe
	resend.Subscribe = fn
	t.Cleanup(func() { resend.Subscribe = orig })
}

// MockUnsubscribe swaps resend.Unsubscribe for the duration of the test.
func MockUnsubscribe(t *testing.T, fn func(ctx context.Context, email string) error) {
	t.Helper()
	orig := resend.Unsubscribe
	resend.Unsubscribe = fn
	t.Cleanup(func() { resend.Unsubscribe = orig })
}

// Enable makes resend.Enabled report true. Any call the test does not mock
// fails the test.
func Enable(t *testing.T) {
	t.Helper()
	resend.Init(resend.Config{APIKey: "re_test", SegmentID: "seg_test"})
	t.Cleanup(func() { resend.Init(resend.Config{}) })

	MockSubscribe(t, func(_ context.Context, email, _ string) error {
		t.Errorf("unexpected Resend subscribe for %q, mock it with MockSubscribe", email)
		return errors.New("unexpected Resend call")
	})
	MockUnsubscribe(t, func(_ context.Context, email string) error {
		t.Errorf("unexpected Resend unsubscribe for %q, mock it with MockUnsubscribe", email)
		return errors.New("unexpected Resend call")
	})
}
