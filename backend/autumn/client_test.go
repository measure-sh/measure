package autumn

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func setupTestServer(t *testing.T, handler http.HandlerFunc) func() {
	t.Helper()
	ts := httptest.NewServer(handler)
	origURL := apiURL
	origKey := secretKey
	apiURL = ts.URL
	secretKey = "test_secret"
	return func() {
		ts.Close()
		apiURL = origURL
		secretKey = origKey
	}
}

func TestGetOrCreateCustomer(t *testing.T) {
	cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/customers" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test_secret" {
			t.Errorf("missing auth header, got %q", got)
		}
		if got := r.Header.Get("x-api-version"); got != "2.2.0" {
			t.Errorf("missing api version, got %q", got)
		}

		body, _ := io.ReadAll(r.Body)
		var req createCustomerRequest
		if err := json.Unmarshal(body, &req); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if req.ID != "team_123" || req.Email != "a@b.com" {
			t.Errorf("unexpected body: %+v", req)
		}

		_ = json.NewEncoder(w).Encode(Customer{ID: "team_123", Email: "a@b.com"})
	})
	defer cleanup()

	cust, err := getOrCreateCustomer(context.Background(), "team_123", "a@b.com", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cust.ID != "team_123" {
		t.Errorf("unexpected customer: %+v", cust)
	}
}

func TestAttachReturnsPaymentURL(t *testing.T) {
	cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/billing.attach" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(AttachResponse{
			CustomerID: "team_123",
			PaymentURL: "https://checkout.stripe.com/xyz",
		})
	})
	defer cleanup()

	resp, err := attach(context.Background(), AttachRequest{
		CustomerID: "team_123",
		PlanID:     "pro",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.PaymentURL == "" {
		t.Errorf("expected payment URL, got empty")
	}
}

func TestUpdate(t *testing.T) {
	t.Run("cancel_end_of_cycle posts to billing.update", func(t *testing.T) {
		var gotBody UpdateRequest
		cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost || r.URL.Path != "/v1/billing.update" {
				t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			}
			body, _ := io.ReadAll(r.Body)
			if err := json.Unmarshal(body, &gotBody); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			_ = json.NewEncoder(w).Encode(UpdateResponse{CustomerID: "team_123"})
		})
		defer cleanup()

		resp, err := update(context.Background(), UpdateRequest{
			CustomerID:   "team_123",
			PlanID:       "pro",
			CancelAction: CancelEndOfCycle,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.CustomerID != "team_123" {
			t.Errorf("customer_id = %q, want team_123", resp.CustomerID)
		}
		if gotBody.CancelAction != "cancel_end_of_cycle" {
			t.Errorf("cancel_action = %q, want cancel_end_of_cycle", gotBody.CancelAction)
		}
		if gotBody.PlanID != "pro" {
			t.Errorf("plan_id = %q, want pro", gotBody.PlanID)
		}
	})

	t.Run("uncancel posts to billing.update", func(t *testing.T) {
		var gotBody UpdateRequest
		cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(body, &gotBody)
			_ = json.NewEncoder(w).Encode(UpdateResponse{CustomerID: "team_123"})
		})
		defer cleanup()

		_, err := update(context.Background(), UpdateRequest{
			CustomerID:   "team_123",
			PlanID:       "pro",
			CancelAction: Uncancel,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotBody.CancelAction != "uncancel" {
			t.Errorf("cancel_action = %q, want uncancel", gotBody.CancelAction)
		}
	})

	t.Run("API error surfaces as APIError", func(t *testing.T) {
		cleanup := setupTestServer(t, func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":"bad"}`))
		})
		defer cleanup()

		_, err := update(context.Background(), UpdateRequest{CustomerID: "team_123"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		apiErr, ok := err.(*APIError)
		if !ok {
			t.Fatalf("expected *APIError, got %T", err)
		}
		if apiErr.StatusCode != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", apiErr.StatusCode)
		}
	})
}

func TestTrackNonBlocking(t *testing.T) {
	cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/balances.track" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	})
	defer cleanup()

	if err := track(context.Background(), "team_123", "bytes", 1024.0); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCheckAllowed(t *testing.T) {
	cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/balances.check" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(CheckResponse{
			Allowed: true,
			Balance: Balance{FeatureID: "bytes", Remaining: 1000},
		})
	})
	defer cleanup()

	resp, err := check(context.Background(), "team_123", "bytes")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Allowed {
		t.Error("expected allowed=true")
	}
}

func TestOpenCustomerPortal(t *testing.T) {
	cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/customers/team_123/billing_portal" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(openCustomerPortalResponse{
			URL: "https://billing.stripe.com/portal/xyz",
		})
	})
	defer cleanup()

	url, err := openCustomerPortal(context.Background(), "team_123", "https://app.measure.sh/usage")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(url, "https://billing.") {
		t.Errorf("unexpected portal URL: %s", url)
	}
}

func TestAPIError(t *testing.T) {
	cleanup := setupTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid request"}`))
	})
	defer cleanup()

	_, err := getCustomer(context.Background(), "team_123")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusBadRequest {
		t.Errorf("unexpected status: %d", apiErr.StatusCode)
	}
}

func TestIsServerOrNetworkError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"400", &APIError{StatusCode: 400}, false},
		{"401", &APIError{StatusCode: 401}, false},
		{"404", &APIError{StatusCode: 404}, false},
		{"429", &APIError{StatusCode: 429}, false},
		{"500", &APIError{StatusCode: 500}, true},
		{"502", &APIError{StatusCode: 502}, true},
		{"503", &APIError{StatusCode: 503}, true},
		{"504", &APIError{StatusCode: 504}, true},
		{"wrapped 500", fmt.Errorf("outer: %w", &APIError{StatusCode: 500}), true},
		{"wrapped 400", fmt.Errorf("outer: %w", &APIError{StatusCode: 400}), false},
		{"non-HTTP network error", fmt.Errorf("dial tcp: connection refused"), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsServerOrNetworkError(tc.err); got != tc.want {
				t.Errorf("IsServerOrNetworkError(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}
