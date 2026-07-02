//go:build integration

package agent

import (
	"context"
	"errors"
	"testing"
	"time"

	"backend/libs/autumn"
	autumntest "backend/libs/autumn/testhelpers"

	"github.com/google/uuid"
)

// TestTrackAgentTokens checks the usage reported to Autumn: input/output exclude
// the cache and reasoning pools (Autumn prices those separately), the pools are
// sent on their own, and the model id is OpenRouter-namespaced.
func TestTrackAgentTokens(t *testing.T) {
	got := make(chan autumn.TrackTokensRequest, 1)
	orig := autumn.TrackTokens
	autumn.TrackTokens = func(_ context.Context, req autumn.TrackTokensRequest) error {
		got <- req
		return nil
	}
	t.Cleanup(func() { autumn.TrackTokens = orig })

	trackAgentTokens(deps, "cust_123", "deepseek/deepseek-v3", tokenUsage{
		prompt: 1000, completion: 200, reasoning: 50, cacheRead: 600, cacheWrite: 100,
	})

	select {
	case req := <-got:
		if req.CustomerID != "cust_123" {
			t.Errorf("customer = %q, want cust_123", req.CustomerID)
		}
		if req.ModelID != "openrouter/deepseek/deepseek-v3" {
			t.Errorf("model = %q, want openrouter-prefixed", req.ModelID)
		}
		if req.InputTokens != 300 { // 1000 - 600 cache read - 100 cache write
			t.Errorf("input = %d, want 300", req.InputTokens)
		}
		if req.OutputTokens != 150 { // 200 - 50 reasoning
			t.Errorf("output = %d, want 150", req.OutputTokens)
		}
		if req.CacheReadTokens != 600 || req.CacheWriteTokens != 100 || req.ReasoningTokens != 50 {
			t.Errorf("pools = (read %d, write %d, reasoning %d), want (600, 100, 50)",
				req.CacheReadTokens, req.CacheWriteTokens, req.ReasoningTokens)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("trackAgentTokens did not report to Autumn")
	}
}

// Each subtest uses a fresh customer id, so cached verdicts from one subtest
// can't leak into another.
func TestCheckAgentAllowed(t *testing.T) {
	ctx := context.Background()
	c := &Config{Deps: deps}

	t.Run("billing disabled → allowed", func(t *testing.T) {
		orig := deps.Config.BillingEnabled
		deps.Config.BillingEnabled = false
		t.Cleanup(func() { deps.Config.BillingEnabled = orig })

		if err := c.checkAgentAllowed(ctx, uuid.New().String()); err != nil {
			t.Errorf("want nil, got %v", err)
		}
	})

	t.Run("team without autumn customer → allowed", func(t *testing.T) {
		if err := c.checkAgentAllowed(ctx, ""); err != nil {
			t.Errorf("want nil, got %v", err)
		}
	})

	t.Run("autumn allowed → nil", func(t *testing.T) {
		custID := uuid.New().String()
		autumntest.MockCheck(t, func(_ context.Context, cid, feat string) (*autumn.CheckResponse, error) {
			if cid != custID || feat != "agent_tokens" {
				t.Errorf("unexpected args: cid=%q feat=%q", cid, feat)
			}
			return &autumn.CheckResponse{Allowed: true}, nil
		})

		if err := c.checkAgentAllowed(ctx, custID); err != nil {
			t.Errorf("want nil, got %v", err)
		}
	})

	t.Run("autumn denied → error", func(t *testing.T) {
		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			return &autumn.CheckResponse{Allowed: false}, nil
		})

		if err := c.checkAgentAllowed(ctx, uuid.New().String()); err == nil {
			t.Error("want error, got nil")
		}
	})

	t.Run("autumn error → fail open", func(t *testing.T) {
		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			return nil, errors.New("autumn timeout")
		})

		if err := c.checkAgentAllowed(ctx, uuid.New().String()); err != nil {
			t.Errorf("want nil (fail-open on autumn error), got %v", err)
		}
	})

	// Guards that checkAgentAllowed goes through the cache: a second call for
	// the same customer is served from Valkey instead of re-hitting Autumn.
	t.Run("caches verdict — second call skips autumn.Check", func(t *testing.T) {
		custID := uuid.New().String()

		var checkCalls int
		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			checkCalls++
			return &autumn.CheckResponse{Allowed: true}, nil
		})

		if err := c.checkAgentAllowed(ctx, custID); err != nil {
			t.Fatalf("first call: want nil, got %v", err)
		}
		if err := c.checkAgentAllowed(ctx, custID); err != nil {
			t.Fatalf("second call: want nil, got %v", err)
		}
		if checkCalls != 1 {
			t.Errorf("autumn.Check called %d times, want 1 (second call should hit the shared cache)", checkCalls)
		}
	})
}
