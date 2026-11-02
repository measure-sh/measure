// Package turnstile verifies Cloudflare Turnstile tokens. Call Init at
// startup.
package turnstile

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	secretKey  string
	verifyURL  = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	httpClient = &http.Client{Timeout: 10 * time.Second}
)

type Config struct {
	// SecretKey is the widget's secret key from the Cloudflare dashboard.
	SecretKey string
}

func Init(cfg Config) {
	secretKey = cfg.SecretKey
}

// Enabled reports whether tokens can be checked.
func Enabled() bool {
	return secretKey != ""
}

// verify reports whether Cloudflare accepts the token. A token can only be
// verified once.
func verify(ctx context.Context, token string) (bool, error) {
	if token == "" {
		return false, nil
	}

	form := url.Values{"secret": {secretKey}, "response": {token}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, verifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return false, fmt.Errorf("turnstile: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("turnstile: do request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("turnstile: read response body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("turnstile: status=%d body=%s", resp.StatusCode, body)
	}

	var result struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return false, fmt.Errorf("turnstile: decode response: %w", err)
	}

	// A bad secret is a server error, not a failed check.
	for _, code := range result.ErrorCodes {
		if code == "missing-input-secret" || code == "invalid-input-secret" {
			return false, fmt.Errorf("turnstile: %s", code)
		}
	}
	return result.Success, nil
}

var Verify = verify
