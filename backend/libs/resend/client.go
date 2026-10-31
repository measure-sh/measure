// Package resend is a client for the contacts API of resend.com, which holds
// the mailing list.
//
// Call Init at startup. Subscribe, Unsubscribe and ContactSubscribed are
// variables rather than plain funcs, so tests can swap in a fake and never
// reach the real Resend API.
package resend

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("resend-client")

var (
	apiKey     string
	segmentID  string
	apiURL     = "https://api.resend.com"
	httpClient = &http.Client{Timeout: 10 * time.Second}
)

// Config carries the startup parameters.
type Config struct {
	APIKey string
	// SegmentID is the mailing list segment that Broadcasts are sent to.
	SegmentID string
	// APIURL replaces the default Resend API address when set.
	APIURL string
}

// Init wires up the package-level client. Call once at service startup.
func Init(cfg Config) {
	apiKey = cfg.APIKey
	segmentID = cfg.SegmentID
	if cfg.APIURL != "" {
		apiURL = cfg.APIURL
	}
}

// Enabled reports whether contacts can be written to Resend.
func Enabled() bool {
	return apiKey != "" && segmentID != ""
}

// APIError represents a non-2xx response from Resend.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("resend API error: status=%d body=%s", e.StatusCode, e.Body)
}

func statusIs(err error, codes ...int) bool {
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		return false
	}
	for _, c := range codes {
		if apiErr.StatusCode == c {
			return true
		}
	}
	return false
}

func do(ctx context.Context, opName, method, path string, body any, out any) (err error) {
	ctx, span := tracer.Start(ctx, opName)
	defer span.End()
	span.SetAttributes(attribute.String("http.method", method))
	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
		}
	}()

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("resend: marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, apiURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("resend: build request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("resend: do request: %w", err)
	}
	defer resp.Body.Close()
	span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("resend: read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &APIError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}

	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("resend: decode response: %w", err)
		}
	}

	return nil
}

// The email is escaped so characters like + or / can't change the path.
func contactPath(email string) string {
	return "/contacts/" + url.PathEscape(email)
}

// subscribe creates the contact in the mailing list segment, or marks an
// existing contact subscribed and adds it to the segment.
func subscribe(ctx context.Context, email, firstName string) error {
	err := do(ctx, "resend.CreateContact", http.MethodPost, "/contacts", map[string]any{
		"email":        email,
		"first_name":   firstName,
		"unsubscribed": false,
		"segments":     []map[string]string{{"id": segmentID}},
	}, nil)
	if err == nil {
		return nil
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode >= 500 || apiErr.StatusCode == http.StatusTooManyRequests {
		return err
	}

	// A 4xx on create usually means the contact exists.
	if err := do(ctx, "resend.UpdateContact", http.MethodPatch, contactPath(email), map[string]any{
		"unsubscribed": false,
	}, nil); err != nil {
		return err
	}

	// Resend doesn't document the status for a contact already in the
	// segment, so 409 and 422 count as done.
	err = do(ctx, "resend.AddContactToSegment", http.MethodPost,
		contactPath(email)+"/segments/"+url.PathEscape(segmentID), nil, nil)
	if statusIs(err, http.StatusConflict, http.StatusUnprocessableEntity) {
		return nil
	}
	return err
}

// unsubscribe marks the contact unsubscribed rather than deleting it, so
// Resend keeps refusing to send to it.
func unsubscribe(ctx context.Context, email string) error {
	err := do(ctx, "resend.UpdateContact", http.MethodPatch, contactPath(email), map[string]any{
		"unsubscribed": true,
	}, nil)
	if statusIs(err, http.StatusNotFound) {
		return nil
	}
	return err
}

// contactSubscribed reports whether the contact exists and is not
// unsubscribed.
func contactSubscribed(ctx context.Context, email string) (bool, error) {
	var contact struct {
		Unsubscribed bool `json:"unsubscribed"`
	}
	err := do(ctx, "resend.GetContact", http.MethodGet, contactPath(email), nil, &contact)
	if statusIs(err, http.StatusNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return !contact.Unsubscribed, nil
}

var (
	Subscribe         = subscribe
	Unsubscribe       = unsubscribe
	ContactSubscribed = contactSubscribed
)
