// Package autumn is a thin REST client for useautumn.com's API.
//
// Configure with Init() at startup, then use the package-level functions
// (GetOrCreateCustomer, Attach, Track, Check, OpenCustomerPortal, GetCustomer).
// Functions are exposed as package-level variables so tests can replace them.
package autumn

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("autumn-client")

// Package state. Set via Init.
var (
	secretKey  string
	apiURL     = "https://api.useautumn.com"
	apiVersion = "2.2.0"
	httpClient = &http.Client{Timeout: 30 * time.Second}
)

// Config carries the startup parameters.
type Config struct {
	SecretKey string
}

// Init wires up the package-level client. Call once at service startup.
// The Autumn API environment (test vs live) is determined by the secret key
// prefix (am_sk_test_… vs am_sk_live_…), so no URL override is needed.
func Init(cfg Config) {
	secretKey = cfg.SecretKey
}

// APIError represents a non-2xx response from Autumn.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("autumn API error: status=%d body=%s", e.StatusCode, e.Body)
}

// IsServerOrNetworkError reports whether err indicates Autumn is unreachable
// (5xx, timeout, connection failure) or a 4xx client/config bug.
// Fail-open call sites should branch on this so 4xx errors surface loudly
// instead of being swallowed under the outage umbrella. Matches Autumn's
// own SDKs, which only fail-open on 5xx/network.
func IsServerOrNetworkError(err error) bool {
	if err == nil {
		return false
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.StatusCode >= 500
	}
	return true
}

// do performs a request against the Autumn API and decodes the JSON response
// into out (if non-nil). Returns *APIError on non-2xx responses.
// opName is used as the span name so every Autumn call appears in traces.
func do(ctx context.Context, opName, method, path string, body any, out any) (err error) {
	ctx, span := tracer.Start(ctx, opName)
	defer span.End()
	span.SetAttributes(
		attribute.String("http.method", method),
		attribute.String("http.path", path),
	)
	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
		}
	}()

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("autumn: marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, apiURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("autumn: build request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+secretKey)
	req.Header.Set("x-api-version", apiVersion)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("autumn: do request: %w", err)
	}
	defer resp.Body.Close()
	span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("autumn: read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &APIError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}

	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("autumn: decode response: %w", err)
		}
	}

	return nil
}

// ----------------------------------------------------------------------------
// Exported function variables. Replace in tests to stub out API calls.
// ----------------------------------------------------------------------------

var (
	GetOrCreateCustomer = getOrCreateCustomer
	GetCustomer         = getCustomer
	Attach              = attach
	Update              = update
	OpenCustomerPortal  = openCustomerPortal
	Track               = track
	Check               = check
)

// ----------------------------------------------------------------------------
// Customers
// ----------------------------------------------------------------------------

func getOrCreateCustomer(ctx context.Context, id, email, name string) (*Customer, error) {
	req := createCustomerRequest{
		ID:    id,
		Email: email,
		Name:  name,
	}
	var out Customer
	if err := do(ctx, "autumn-get-or-create-customer", http.MethodPost, "/v1/customers", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func getCustomer(ctx context.Context, customerID string) (*Customer, error) {
	var out Customer
	if err := do(ctx, "autumn-get-customer", http.MethodGet, "/v1/customers/"+customerID, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ----------------------------------------------------------------------------
// Billing (attach, portal)
// ----------------------------------------------------------------------------

func attach(ctx context.Context, req AttachRequest) (*AttachResponse, error) {
	var out AttachResponse
	if err := do(ctx, "autumn-attach", http.MethodPost, "/v1/billing.attach", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func update(ctx context.Context, req UpdateRequest) (*UpdateResponse, error) {
	var out UpdateResponse
	if err := do(ctx, "autumn-update", http.MethodPost, "/v1/billing.update", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func openCustomerPortal(ctx context.Context, customerID, returnURL string) (string, error) {
	req := openCustomerPortalRequest{ReturnURL: returnURL}
	var out openCustomerPortalResponse
	path := "/v1/customers/" + customerID + "/billing_portal"
	if err := do(ctx, "autumn-open-customer-portal", http.MethodPost, path, req, &out); err != nil {
		return "", err
	}
	return out.URL, nil
}

// ----------------------------------------------------------------------------
// Balances (track, check)
// ----------------------------------------------------------------------------

func track(ctx context.Context, customerID, featureID string, value float64) error {
	req := trackRequest{
		CustomerID: customerID,
		FeatureID:  featureID,
		Value:      value,
	}
	return do(ctx, "autumn-track", http.MethodPost, "/v1/balances.track", req, nil)
}

func check(ctx context.Context, customerID, featureID string) (*CheckResponse, error) {
	req := checkRequest{
		CustomerID: customerID,
		FeatureID:  featureID,
	}
	var out CheckResponse
	if err := do(ctx, "autumn-check", http.MethodPost, "/v1/balances.check", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
