// Package testhelpers provides test-only mock helpers for swapping the
// package-level autumn.X function variables. Each helper saves the current
// value, installs the test's fn, and restores the original on test cleanup.
//
// Tests use these instead of redefining the same five-line shim in every
// module. Import as:
//
//	import autumntest "backend/autumn/testhelpers"
//
//	autumntest.MockCheck(t, func(ctx context.Context, cid, feat string) (*autumn.CheckResponse, error) {
//	    return &autumn.CheckResponse{Allowed: true}, nil
//	})
package testhelpers

import (
	"context"
	"testing"

	"backend/autumn"
)

// MockCheck swaps autumn.Check for the duration of the test.
func MockCheck(t *testing.T, fn func(ctx context.Context, customerID, featureID string) (*autumn.CheckResponse, error)) {
	t.Helper()
	orig := autumn.Check
	autumn.Check = fn
	t.Cleanup(func() { autumn.Check = orig })
}

// MockTrack swaps autumn.Track for the duration of the test.
func MockTrack(t *testing.T, fn func(ctx context.Context, customerID, featureID string, value float64) error) {
	t.Helper()
	orig := autumn.Track
	autumn.Track = fn
	t.Cleanup(func() { autumn.Track = orig })
}

// MockAttach swaps autumn.Attach for the duration of the test.
func MockAttach(t *testing.T, fn func(ctx context.Context, req autumn.AttachRequest) (*autumn.AttachResponse, error)) {
	t.Helper()
	orig := autumn.Attach
	autumn.Attach = fn
	t.Cleanup(func() { autumn.Attach = orig })
}

// MockUpdate swaps autumn.Update for the duration of the test.
func MockUpdate(t *testing.T, fn func(ctx context.Context, req autumn.UpdateRequest) (*autumn.UpdateResponse, error)) {
	t.Helper()
	orig := autumn.Update
	autumn.Update = fn
	t.Cleanup(func() { autumn.Update = orig })
}

// MockGetCustomer swaps autumn.GetCustomer for the duration of the test.
func MockGetCustomer(t *testing.T, fn func(ctx context.Context, customerID string) (*autumn.Customer, error)) {
	t.Helper()
	orig := autumn.GetCustomer
	autumn.GetCustomer = fn
	t.Cleanup(func() { autumn.GetCustomer = orig })
}

// MockGetOrCreateCustomer swaps autumn.GetOrCreateCustomer for the duration of the test.
func MockGetOrCreateCustomer(t *testing.T, fn func(ctx context.Context, id, email, name string) (*autumn.Customer, error)) {
	t.Helper()
	orig := autumn.GetOrCreateCustomer
	autumn.GetOrCreateCustomer = fn
	t.Cleanup(func() { autumn.GetOrCreateCustomer = orig })
}

// MockOpenCustomerPortal swaps autumn.OpenCustomerPortal for the duration of the test.
func MockOpenCustomerPortal(t *testing.T, fn func(ctx context.Context, customerID, returnURL string) (string, error)) {
	t.Helper()
	orig := autumn.OpenCustomerPortal
	autumn.OpenCustomerPortal = fn
	t.Cleanup(func() { autumn.OpenCustomerPortal = orig })
}
