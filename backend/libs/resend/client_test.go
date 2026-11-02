package resend

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

type recordedRequest struct {
	Method string
	Path   string
	Query  string
	Body   map[string]any
}

type reply struct {
	status int
	body   string
}

// setupTestServer points the client at a test server that answers each
// request with the next reply in replies (200 {} once they run out), and
// records the requests.
func setupTestServer(t *testing.T, replies ...reply) *[]recordedRequest {
	t.Helper()
	var reqs []recordedRequest
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer re_test" {
			t.Errorf("Authorization = %q, want %q", got, "Bearer re_test")
		}
		rec := recordedRequest{Method: r.Method, Path: r.URL.EscapedPath(), Query: r.URL.RawQuery}
		if b, _ := io.ReadAll(r.Body); len(b) > 0 {
			if err := json.Unmarshal(b, &rec.Body); err != nil {
				t.Fatalf("decode body: %v", err)
			}
		}
		reqs = append(reqs, rec)
		rp := reply{status: http.StatusOK, body: `{}`}
		if len(reqs) <= len(replies) {
			rp = replies[len(reqs)-1]
		}
		w.WriteHeader(rp.status)
		_, _ = w.Write([]byte(rp.body))
	}))

	origURL, origKey, origSegment := apiURL, apiKey, segmentID
	apiURL, apiKey, segmentID = ts.URL, "re_test", "seg_1"
	t.Cleanup(func() {
		ts.Close()
		apiURL, apiKey, segmentID = origURL, origKey, origSegment
	})
	return &reqs
}

func TestSubscribe(t *testing.T) {
	ctx := context.Background()

	t.Run("new contact is created subscribed in the segment", func(t *testing.T) {
		reqs := setupTestServer(t)

		if err := subscribe(ctx, "ada@example.com", "Ada"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(*reqs) != 1 {
			t.Fatalf("requests = %d, want 1", len(*reqs))
		}
		create := (*reqs)[0]
		if create.Method != http.MethodPost || create.Path != "/contacts" {
			t.Errorf("request = %s %s", create.Method, create.Path)
		}
		if create.Body["email"] != "ada@example.com" || create.Body["first_name"] != "Ada" || create.Body["unsubscribed"] != false {
			t.Errorf("unexpected body: %v", create.Body)
		}
		segments, _ := create.Body["segments"].([]any)
		if len(segments) != 1 || segments[0].(map[string]any)["id"] != "seg_1" {
			t.Errorf("segments = %v, want [{id: seg_1}]", create.Body["segments"])
		}
	})

	t.Run("existing contact is marked subscribed and added to the segment", func(t *testing.T) {
		reqs := setupTestServer(t, reply{http.StatusConflict, `{}`})

		if err := subscribe(ctx, "a+b@example.com", "Ada"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(*reqs) != 3 {
			t.Fatalf("requests = %d, want 3", len(*reqs))
		}
		update := (*reqs)[1]
		if update.Method != http.MethodPatch || update.Path != "/contacts/a+b@example.com" || update.Body["unsubscribed"] != false {
			t.Errorf("update = %s %s %v", update.Method, update.Path, update.Body)
		}
		add := (*reqs)[2]
		if add.Method != http.MethodPost || add.Path != "/contacts/a+b@example.com/segments/seg_1" {
			t.Errorf("segment add = %s %s", add.Method, add.Path)
		}
	})

	t.Run("contact already in the segment counts as done", func(t *testing.T) {
		setupTestServer(t, reply{http.StatusConflict, `{}`}, reply{http.StatusOK, `{}`}, reply{http.StatusConflict, `{}`})

		if err := subscribe(ctx, "ada@example.com", "Ada"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("server error on create is returned without an update", func(t *testing.T) {
		reqs := setupTestServer(t, reply{http.StatusInternalServerError, `{}`})

		if err := subscribe(ctx, "ada@example.com", "Ada"); err == nil {
			t.Fatal("err = nil, want error")
		}
		if len(*reqs) != 1 {
			t.Errorf("requests = %d, want 1", len(*reqs))
		}
	})

	t.Run("rate limit on create is returned without an update", func(t *testing.T) {
		reqs := setupTestServer(t, reply{http.StatusTooManyRequests, `{}`})

		if err := subscribe(ctx, "ada@example.com", "Ada"); err == nil {
			t.Fatal("err = nil, want error")
		}
		if len(*reqs) != 1 {
			t.Errorf("requests = %d, want 1", len(*reqs))
		}
	})
}

func TestUnsubscribe(t *testing.T) {
	ctx := context.Background()

	t.Run("contact is marked unsubscribed", func(t *testing.T) {
		reqs := setupTestServer(t)

		if err := unsubscribe(ctx, "ada@example.com"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(*reqs) != 1 || (*reqs)[0].Method != http.MethodPatch || (*reqs)[0].Body["unsubscribed"] != true {
			t.Errorf("requests = %+v", *reqs)
		}
	})

	t.Run("unknown contact needs nothing", func(t *testing.T) {
		setupTestServer(t, reply{http.StatusNotFound, `{}`})

		if err := unsubscribe(ctx, "ada@example.com"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}
