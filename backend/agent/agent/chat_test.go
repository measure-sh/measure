package agent

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// chatTestConfig points a Config at a stub LLM server answering every call
// with the given status and body.
func chatTestConfig(t *testing.T, status int, body string) *Config {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return &Config{BaseURL: srv.URL, APIKey: "test-key"}
}

func TestChatRateLimited(t *testing.T) {
	t.Run("429 with provider message", func(t *testing.T) {
		c := chatTestConfig(t, http.StatusTooManyRequests,
			`{"error":{"message":"Provider returned error"}}`)
		_, err := c.chat(context.Background(), "test-model", nil, nil)
		if !errors.Is(err, errLLMRateLimited) {
			t.Fatalf("expected errLLMRateLimited, got %v", err)
		}
		if !strings.Contains(err.Error(), "Provider returned error") {
			t.Fatalf("expected the provider message in the error, got %v", err)
		}
	})

	t.Run("429 with unparseable body", func(t *testing.T) {
		// Proxies can answer 429 with HTML; the sentinel must still fire.
		c := chatTestConfig(t, http.StatusTooManyRequests, "<html>slow down</html>")
		_, err := c.chat(context.Background(), "test-model", nil, nil)
		if !errors.Is(err, errLLMRateLimited) {
			t.Fatalf("expected errLLMRateLimited, got %v", err)
		}
	})

	t.Run("other provider errors are not rate limits", func(t *testing.T) {
		c := chatTestConfig(t, http.StatusInternalServerError,
			`{"error":{"message":"upstream exploded"}}`)
		_, err := c.chat(context.Background(), "test-model", nil, nil)
		if err == nil || errors.Is(err, errLLMRateLimited) {
			t.Fatalf("expected a plain llm error, got %v", err)
		}
	})

	t.Run("success decodes", func(t *testing.T) {
		c := chatTestConfig(t, http.StatusOK,
			`{"choices":[{"message":{"role":"assistant","content":"hi"}}],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}`)
		resp, err := c.chat(context.Background(), "test-model", nil, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.Choices[0].Message.Content != "hi" || resp.Usage.TotalTokens != 4 {
			t.Fatalf("unexpected response: %+v", resp)
		}
	})
}

// TestChatParsesCacheAndReasoningTokens locks the usage field tags against
// OpenRouter's shape: cache read/write live under prompt_tokens_details,
// reasoning under completion_tokens_details.
func TestChatParsesCacheAndReasoningTokens(t *testing.T) {
	c := chatTestConfig(t, http.StatusOK, `{
		"choices":[{"message":{"role":"assistant","content":"hi"}}],
		"usage":{
			"prompt_tokens":194,"completion_tokens":2,"total_tokens":196,
			"prompt_tokens_details":{"cached_tokens":100,"cache_write_tokens":80,"audio_tokens":0},
			"completion_tokens_details":{"reasoning_tokens":5}
		}
	}`)
	resp, err := c.chat(context.Background(), "test-model", nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := resp.Usage.PromptDetails.CachedTokens; got != 100 {
		t.Errorf("cached_tokens = %d, want 100", got)
	}
	if got := resp.Usage.PromptDetails.CacheWriteTokens; got != 80 {
		t.Errorf("cache_write_tokens = %d, want 80", got)
	}
	if got := resp.Usage.CompletionDetails.ReasoningTokens; got != 5 {
		t.Errorf("reasoning_tokens = %d, want 5", got)
	}
}

// TestTokenUsageAggregates checks that a turn's calls and a folded-in
// compaction aggregate sum across every dimension, cache counts included.
func TestTokenUsageAggregates(t *testing.T) {
	mk := func(raw string) chatUsage {
		var u chatUsage
		if err := json.Unmarshal([]byte(raw), &u); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		return u
	}

	var turn tokenUsage
	turn.addCall(mk(`{"prompt_tokens":100,"completion_tokens":20,"prompt_tokens_details":{"cached_tokens":40,"cache_write_tokens":10},"completion_tokens_details":{"reasoning_tokens":5}}`))
	turn.addCall(mk(`{"prompt_tokens":200,"completion_tokens":30,"prompt_tokens_details":{"cached_tokens":60},"completion_tokens_details":{"reasoning_tokens":7}}`))

	var comp tokenUsage
	comp.addCall(mk(`{"prompt_tokens":50,"completion_tokens":5,"prompt_tokens_details":{"cache_write_tokens":25}}`))

	total := comp
	total.add(turn)

	for _, tc := range []struct {
		name      string
		got, want int
	}{
		{"prompt", total.prompt, 350},
		{"completion", total.completion, 55},
		{"reasoning", total.reasoning, 12},
		{"cacheRead", total.cacheRead, 100},
		{"cacheWrite", total.cacheWrite, 35},
	} {
		if tc.got != tc.want {
			t.Errorf("%s = %d, want %d", tc.name, tc.got, tc.want)
		}
	}
}

// TestChatSendsSessionID locks the OpenRouter sticky-routing field: chat sends
// session_id from the context, and omits it when the context carries none.
func TestChatSendsSessionID(t *testing.T) {
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotBody, _ = io.ReadAll(r.Body)
		w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"ok"}}],"usage":{}}`))
	}))
	t.Cleanup(srv.Close)
	c := &Config{BaseURL: srv.URL, APIKey: "test-key"}

	decode := func(t *testing.T) map[string]any {
		t.Helper()
		var req map[string]any
		if err := json.Unmarshal(gotBody, &req); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		return req
	}

	t.Run("sent from context", func(t *testing.T) {
		ctx := withConversationID(context.Background(), "conv-123")
		if _, err := c.chat(ctx, "test-model", nil, nil); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got := decode(t)["session_id"]; got != "conv-123" {
			t.Errorf("session_id = %v, want conv-123", got)
		}
	})

	t.Run("omitted when absent", func(t *testing.T) {
		if _, err := c.chat(context.Background(), "test-model", nil, nil); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, present := decode(t)["session_id"]; present {
			t.Error("session_id should be omitted when the context carries none")
		}
	})
}
