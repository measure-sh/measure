//go:build integration

package handlers

import (
	"backend/libs/measure"
	"backend/testinfra"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type funnelsPage struct {
	Results []measure.Funnel `json:"results"`
	Meta    struct {
		Next     bool `json:"next"`
		Previous bool `json:"previous"`
	} `json:"meta"`
}

// whether each team role may create, edit and delete funnels
var funnelRoles = []struct {
	role     string
	canWrite bool
}{{"owner", true}, {"admin", true}, {"developer", true}, {"viewer", false}}

const validFunnelBody = `{"name":"Checkout","steps":[{"event_name":"add_to_cart"},{"event_name":"purchase"}],"conversion_window_seconds":3600}`

func seedFunnelApp(ctx context.Context, t *testing.T, role string) (userID string, appID uuid.UUID) {
	t.Helper()
	userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
	appID = uuid.New()
	seedApp(ctx, t, appID, teamID, 30)
	return userID, appID
}

func seedFunnel(ctx context.Context, t *testing.T, appID uuid.UUID, userID, name string) measure.Funnel {
	t.Helper()
	funnel, err := measure.CreateFunnel(ctx, th.PgPool, appID, userID, measure.FunnelDraft{
		Name:                    name,
		Steps:                   []measure.FunnelStep{{EventName: "app_open"}, {EventName: "purchase"}},
		ConversionWindowSeconds: 86400,
	})
	if err != nil {
		t.Fatalf("seed funnel: %v", err)
	}
	return funnel
}

func setFunnelUpdatedAt(ctx context.Context, t *testing.T, funnelID uuid.UUID, updatedAt time.Time) {
	t.Helper()
	if _, err := th.PgPool.Exec(ctx, `update measure.funnels set updated_at = $1 where id = $2`, updatedAt, funnelID); err != nil {
		t.Fatalf("set updated_at: %v", err)
	}
}

func serveFunnel(handler gin.HandlerFunc, method, path, body, userID string, appID string, funnelID string) *httptest.ResponseRecorder {
	c, w := newTestGinContext(method, path, strings.NewReader(body))
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: appID}}
	if funnelID != "" {
		c.Params = append(c.Params, gin.Param{Key: "funnelId", Value: funnelID})
	}
	handler(c)
	return w
}

func listFunnels(userID string, appID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnels, "GET", "/apps/"+appID.String()+"/funnels?"+query, "", userID, appID.String(), "")
}

func getFunnel(userID string, appID, funnelID uuid.UUID) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnel, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String(), "", userID, appID.String(), funnelID.String())
}

func createFunnel(userID string, appID uuid.UUID, body string) *httptest.ResponseRecorder {
	return serveFunnel(h.CreateFunnel, "POST", "/apps/"+appID.String()+"/funnels", body, userID, appID.String(), "")
}

func updateFunnel(userID string, appID, funnelID uuid.UUID, body string) *httptest.ResponseRecorder {
	return serveFunnel(h.UpdateFunnel, "PATCH", "/apps/"+appID.String()+"/funnels/"+funnelID.String(), body, userID, appID.String(), funnelID.String())
}

func deleteFunnel(userID string, appID, funnelID uuid.UUID) *httptest.ResponseRecorder {
	return serveFunnel(h.DeleteFunnel, "DELETE", "/apps/"+appID.String()+"/funnels/"+funnelID.String(), "", userID, appID.String(), funnelID.String())
}

func decodeBody[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("unmarshal %q: %v", w.Body.String(), err)
	}
	return v
}

func expectStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, want, w.Body.String())
	}
}

func expectError(t *testing.T, w *httptest.ResponseRecorder, wantStatus int, wantError string) {
	t.Helper()
	expectStatus(t, w, wantStatus)
	if got := decodeBody[map[string]any](t, w)["error"]; got != wantError {
		t.Fatalf("error = %q, want %q", got, wantError)
	}
}

func funnelNames(funnels []measure.Funnel) []string {
	names := make([]string, len(funnels))
	for i, funnel := range funnels {
		names[i] = funnel.Name
	}
	return names
}

func expectNames(t *testing.T, got []measure.Funnel, want ...string) {
	t.Helper()
	names := funnelNames(got)
	if strings.Join(names, ",") != strings.Join(want, ",") {
		t.Fatalf("names = %v, want %v", names, want)
	}
}

func funnelBody(name string, eventNames []string, windowSeconds int) string {
	steps := make([]measure.FunnelStep, len(eventNames))
	for i, eventName := range eventNames {
		steps[i] = measure.FunnelStep{EventName: eventName}
	}
	body, _ := json.Marshal(measure.FunnelDraft{Name: name, Steps: steps, ConversionWindowSeconds: windowSeconds})
	return string(body)
}

func repeatedEvents(n int) []string {
	eventNames := make([]string, n)
	for i := range eventNames {
		eventNames[i] = "step"
	}
	return eventNames
}

var invalidFunnelBodies = []struct {
	name      string
	body      string
	wantError string
}{
	{"malformed json", `{"name":`, "invalid request payload"},
	{"wrong field type", `{"name":"Checkout","steps":"add_to_cart","conversion_window_seconds":3600}`, "invalid request payload"},
	{"missing name", `{"steps":[{"event_name":"a"},{"event_name":"b"}],"conversion_window_seconds":3600}`, "funnel name is required"},
	{"blank name", funnelBody("   ", []string{"a", "b"}, 3600), "funnel name is required"},
	{"name too long", funnelBody(strings.Repeat("é", 257), []string{"a", "b"}, 3600), "funnel name must be at most 256 characters"},
	{"missing steps", `{"name":"Checkout","conversion_window_seconds":3600}`, "a funnel must have between 2 and 30 steps"},
	{"one step", funnelBody("Checkout", []string{"a"}, 3600), "a funnel must have between 2 and 30 steps"},
	{"31 steps", funnelBody("Checkout", repeatedEvents(31), 3600), "a funnel must have between 2 and 30 steps"},
	{"step without event", funnelBody("Checkout", []string{"a", ""}, 3600), "every step must have an event"},
	{"step of only spaces", funnelBody("Checkout", []string{"a", "  "}, 3600), "step 2 must be the name of a custom event"},
	{"step no custom event can have", funnelBody("Checkout", []string{"add to cart", "b"}, 3600), "step 1 must be the name of a custom event"},
	{"step name too long", funnelBody("Checkout", []string{"a", strings.Repeat("b", 65)}, 3600), "step 2 must be the name of a custom event"},
	{"missing window", `{"name":"Checkout","steps":[{"event_name":"a"},{"event_name":"b"}]}`, "the conversion window must be between 1 minute and 30 days"},
	{"window under a minute", funnelBody("Checkout", []string{"a", "b"}, 59), "the conversion window must be between 1 minute and 30 days"},
	{"window over 30 days", funnelBody("Checkout", []string{"a", "b"}, 30*86400+60), "the conversion window must be between 1 minute and 30 days"},
	{"window not whole minutes", funnelBody("Checkout", []string{"a", "b"}, 90), "the conversion window must be a whole number of minutes"},
}

func TestCreateFunnel(t *testing.T) {
	ctx := context.Background()

	t.Run("saves the draft and returns the funnel", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")

		w := createFunnel(userID, appID, `{"name":"  Checkout  ","steps":[{"event_name":"add_to_cart"},{"event_name":"add_to_cart"},{"event_name":"purchase"}],"conversion_window_seconds":3600}`)
		expectStatus(t, w, http.StatusCreated)

		funnel := decodeBody[measure.Funnel](t, w)
		if funnel.ID == uuid.Nil || funnel.AppID != appID {
			t.Fatalf("id = %v, app_id = %v, want a new id and app %v", funnel.ID, funnel.AppID, appID)
		}
		if funnel.Name != "Checkout" {
			t.Fatalf("name = %q, want the trimmed name", funnel.Name)
		}
		if got := []measure.FunnelStep{{EventName: "add_to_cart"}, {EventName: "add_to_cart"}, {EventName: "purchase"}}; !slices.Equal(funnel.Steps, got) {
			t.Fatalf("steps = %v, want %v", funnel.Steps, got)
		}
		if funnel.ConversionWindowSeconds != 3600 {
			t.Fatalf("conversion_window_seconds = %d, want 3600", funnel.ConversionWindowSeconds)
		}
		if funnel.Pinned || funnel.PinOrder != nil {
			t.Fatalf("pinned = %v, pin_order = %v, want an unpinned funnel", funnel.Pinned, funnel.PinOrder)
		}
		if funnel.CreatedBy == nil || funnel.CreatedBy.String() != userID {
			t.Fatalf("created_by = %v, want %s", funnel.CreatedBy, userID)
		}
		if funnel.CreatedByEmail == nil || *funnel.CreatedByEmail != "owner-authz@test.com" {
			t.Fatalf("created_by_email = %v, want owner-authz@test.com", funnel.CreatedByEmail)
		}

		got := decodeBody[measure.Funnel](t, getFunnel(userID, appID, funnel.ID))
		if got.Name != "Checkout" || !slices.Equal(got.Steps, funnel.Steps) {
			t.Fatalf("stored funnel = %+v, want %+v", got, funnel)
		}
	})

	t.Run("accepts the limits of each rule", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")

		for _, body := range []string{
			funnelBody(strings.Repeat("é", 256), []string{"a", "b"}, 60),
			funnelBody("Checkout", repeatedEvents(30), 30*86400),
		} {
			expectStatus(t, createFunnel(userID, appID, body), http.StatusCreated)
		}
	})

	for _, tc := range invalidFunnelBodies {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, "owner")

			expectError(t, createFunnel(userID, appID, tc.body), http.StatusBadRequest, tc.wantError)

			page := decodeBody[funnelsPage](t, listFunnels(userID, appID, ""))
			if len(page.Results) != 0 {
				t.Fatalf("saved %d funnels, want none", len(page.Results))
			}
		})
	}

	for _, tc := range funnelRoles {
		t.Run(tc.role+" role", func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, tc.role)

			w := createFunnel(userID, appID, validFunnelBody)
			saved := decodeBody[funnelsPage](t, listFunnels(userID, appID, "")).Results
			if tc.canWrite {
				expectStatus(t, w, http.StatusCreated)
				expectNames(t, saved, "Checkout")
			} else {
				expectError(t, w, http.StatusForbidden, "you are not authorized to access this app")
				expectNames(t, saved)
			}
		})
	}

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID := seedFunnelApp(ctx, t, "owner")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, createFunnel(outsiderID, appID, validFunnelBody), http.StatusForbidden)
	})

	t.Run("invalid app id returns bad request", func(t *testing.T) {
		w := serveFunnel(h.CreateFunnel, "POST", "/apps/nope/funnels", validFunnelBody, uuid.NewString(), "nope", "")
		expectError(t, w, http.StatusBadRequest, "app id invalid or missing")
	})
}

func TestGetFunnel(t *testing.T) {
	ctx := context.Background()

	t.Run("every role can read a funnel", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, appID := seedFunnelApp(ctx, t, tc.role)
				funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

				w := getFunnel(userID, appID, funnel.ID)
				expectStatus(t, w, http.StatusOK)
				if got := decodeBody[measure.Funnel](t, w); got.ID != funnel.ID || got.Name != "Checkout" {
					t.Fatalf("funnel = %+v, want %+v", got, funnel)
				}
			})
		}
	})

	t.Run("shows a deleted creator as null", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		creatorID := uuid.NewString()
		seedUser(ctx, t, creatorID, "creator@test.com")
		funnel := seedFunnel(ctx, t, appID, creatorID, "Checkout")
		if _, err := th.PgPool.Exec(ctx, `delete from measure.users where id = $1`, creatorID); err != nil {
			t.Fatalf("delete creator: %v", err)
		}

		got := decodeBody[measure.Funnel](t, getFunnel(userID, appID, funnel.ID))
		if got.CreatedBy != nil || got.CreatedByEmail != nil {
			t.Fatalf("created_by = %v, created_by_email = %v, want both null", got.CreatedBy, got.CreatedByEmail)
		}
	})

	t.Run("missing funnel returns not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		expectError(t, getFunnel(userID, appID, uuid.New()), http.StatusNotFound, "Funnel not found")
	})

	t.Run("another app's funnel returns not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		funnel := seedFunnel(ctx, t, otherAppID, userID, "Checkout")

		expectError(t, getFunnel(userID, appID, funnel.ID), http.StatusNotFound, "Funnel not found")
	})

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")

		expectStatus(t, getFunnel(outsiderID, appID, funnel.ID), http.StatusForbidden)
	})

	t.Run("invalid funnel id returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		w := serveFunnel(h.GetFunnel, "GET", "/apps/"+appID.String()+"/funnels/nope", "", userID, appID.String(), "nope")
		expectError(t, w, http.StatusBadRequest, "funnel id invalid or missing")
	})
}

func TestGetFunnels(t *testing.T) {
	ctx := context.Background()

	t.Run("lists the app's funnels most recently updated first", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		now := time.Now().UTC()
		for _, seed := range []struct {
			name string
			age  time.Duration
		}{{"Oldest", 2 * time.Hour}, {"Newest", 0}, {"Middle", time.Hour}} {
			funnel := seedFunnel(ctx, t, appID, userID, seed.name)
			setFunnelUpdatedAt(ctx, t, funnel.ID, now.Add(-seed.age))
		}
		seedFunnel(ctx, t, otherAppID, userID, "Other app")

		w := listFunnels(userID, appID, "")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[funnelsPage](t, w)
		expectNames(t, page.Results, "Newest", "Middle", "Oldest")
		if page.Meta.Next || page.Meta.Previous {
			t.Fatalf("meta = %+v, want a single page", page.Meta)
		}
	})

	t.Run("every role can list funnels", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, appID := seedFunnelApp(ctx, t, tc.role)
				seedFunnel(ctx, t, appID, userID, "Checkout")

				w := listFunnels(userID, appID, "")
				expectStatus(t, w, http.StatusOK)
				expectNames(t, decodeBody[funnelsPage](t, w).Results, "Checkout")
			})
		}
	})

	t.Run("returns an empty list when the app has no funnels", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")

		w := listFunnels(userID, appID, "")
		expectStatus(t, w, http.StatusOK)
		if !strings.Contains(w.Body.String(), `"results":[]`) {
			t.Fatalf("body = %s, want an empty results array", w.Body.String())
		}
	})

	t.Run("pages with limit and offset", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		now := time.Now().UTC()
		for i, name := range []string{"A", "B", "C"} {
			funnel := seedFunnel(ctx, t, appID, userID, name)
			setFunnelUpdatedAt(ctx, t, funnel.ID, now.Add(-time.Duration(i)*time.Hour))
		}

		for _, tc := range []struct {
			query        string
			want         []string
			next, before bool
		}{
			{"limit=2&offset=0", []string{"A", "B"}, true, false},
			{"limit=2&offset=1", []string{"B", "C"}, false, true},
			{"limit=2&offset=2", []string{"C"}, false, true},
			{"limit=3&offset=0", []string{"A", "B", "C"}, false, false},
		} {
			page := decodeBody[funnelsPage](t, listFunnels(userID, appID, tc.query))
			expectNames(t, page.Results, tc.want...)
			if page.Meta.Next != tc.next || page.Meta.Previous != tc.before {
				t.Fatalf("%s: meta = %+v, want next %v previous %v", tc.query, page.Meta, tc.next, tc.before)
			}
		}
	})

	t.Run("searches names case-insensitively", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		now := time.Now().UTC()
		for i, name := range []string{"Checkout", "Quick checkout", "Onboarding"} {
			funnel := seedFunnel(ctx, t, appID, userID, name)
			setFunnelUpdatedAt(ctx, t, funnel.ID, now.Add(-time.Duration(i)*time.Hour))
		}

		expectNames(t, decodeBody[funnelsPage](t, listFunnels(userID, appID, "search=CHECK")).Results, "Checkout", "Quick checkout")
		expectNames(t, decodeBody[funnelsPage](t, listFunnels(userID, appID, "search=signup")).Results)
	})

	t.Run("matches LIKE wildcards in the search as plain text", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		seedFunnel(ctx, t, appID, userID, "100% done")
		seedFunnel(ctx, t, appID, userID, "sign_up")
		seedFunnel(ctx, t, appID, userID, "Signup")

		expectNames(t, decodeBody[funnelsPage](t, listFunnels(userID, appID, "search=%25")).Results, "100% done")
		expectNames(t, decodeBody[funnelsPage](t, listFunnels(userID, appID, "search=n_u")).Results, "sign_up")
	})

	for _, tc := range []struct {
		query     string
		wantError string
	}{
		{"limit=0", "`limit` must be between 1 and 1000"},
		{"limit=1001", "`limit` must be between 1 and 1000"},
		{"offset=-1", "`offset` cannot be negative"},
	} {
		t.Run("rejects "+tc.query, func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, "owner")
			expectError(t, listFunnels(userID, appID, tc.query), http.StatusBadRequest, tc.wantError)
		})
	}

	t.Run("rejects a limit that is not a number", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		expectStatus(t, listFunnels(userID, appID, "limit=ten"), http.StatusBadRequest)
	})

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID := seedFunnelApp(ctx, t, "owner")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, listFunnels(outsiderID, appID, ""), http.StatusForbidden)
	})
}

func TestUpdateFunnel(t *testing.T) {
	ctx := context.Background()

	t.Run("replaces the draft and moves updated_at", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "developer")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		setFunnelUpdatedAt(ctx, t, funnel.ID, funnel.UpdatedAt.Add(-time.Hour))

		w := updateFunnel(userID, appID, funnel.ID, funnelBody(" Purchase ", []string{"purchase", "app_open", "purchase"}, 120))
		expectStatus(t, w, http.StatusOK)

		got := decodeBody[measure.Funnel](t, w)
		if got.ID != funnel.ID || got.Name != "Purchase" || got.ConversionWindowSeconds != 120 {
			t.Fatalf("funnel = %+v, want the new name and window on the same id", got)
		}
		if want := []measure.FunnelStep{{EventName: "purchase"}, {EventName: "app_open"}, {EventName: "purchase"}}; !slices.Equal(got.Steps, want) {
			t.Fatalf("steps = %v, want %v", got.Steps, want)
		}
		if !got.CreatedAt.Equal(funnel.CreatedAt) {
			t.Fatalf("created_at = %v, want it unchanged at %v", got.CreatedAt, funnel.CreatedAt)
		}
		if !got.UpdatedAt.After(funnel.UpdatedAt.Add(-time.Hour)) {
			t.Fatalf("updated_at = %v, want it moved forward", got.UpdatedAt)
		}
		if got.CreatedBy == nil || got.CreatedBy.String() != userID {
			t.Fatalf("created_by = %v, want the original creator", got.CreatedBy)
		}
	})

	t.Run("keeps the original creator when someone else edits", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		editorID := uuid.NewString()
		seedUser(ctx, t, editorID, "editor@test.com")
		seedTeamMembership(ctx, t, teamID, editorID, "developer")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

		got := decodeBody[measure.Funnel](t, updateFunnel(editorID, appID, funnel.ID, validFunnelBody))
		if got.CreatedByEmail == nil || *got.CreatedByEmail != "owner-authz@test.com" {
			t.Fatalf("created_by_email = %v, want the creator's", got.CreatedByEmail)
		}
	})

	for _, tc := range invalidFunnelBodies {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, "owner")
			funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

			expectError(t, updateFunnel(userID, appID, funnel.ID, tc.body), http.StatusBadRequest, tc.wantError)

			got := decodeBody[measure.Funnel](t, getFunnel(userID, appID, funnel.ID))
			if got.Name != "Checkout" || !got.UpdatedAt.Equal(funnel.UpdatedAt) {
				t.Fatalf("funnel = %+v, want it unchanged", got)
			}
		})
	}

	t.Run("missing funnel returns not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		expectError(t, updateFunnel(userID, appID, uuid.New(), validFunnelBody), http.StatusNotFound, "Funnel not found")
	})

	t.Run("another app's funnel returns not found and stays unchanged", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		funnel := seedFunnel(ctx, t, otherAppID, userID, "Other")

		expectError(t, updateFunnel(userID, appID, funnel.ID, validFunnelBody), http.StatusNotFound, "Funnel not found")
		if got := decodeBody[measure.Funnel](t, getFunnel(userID, otherAppID, funnel.ID)); got.Name != "Other" {
			t.Fatalf("name = %q, want Other", got.Name)
		}
	})

	for _, tc := range funnelRoles {
		t.Run(tc.role+" role", func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, tc.role)
			funnel := seedFunnel(ctx, t, appID, userID, "Onboarding")

			w := updateFunnel(userID, appID, funnel.ID, validFunnelBody)
			got := decodeBody[measure.Funnel](t, getFunnel(userID, appID, funnel.ID))
			if tc.canWrite {
				expectStatus(t, w, http.StatusOK)
				if got.Name != "Checkout" {
					t.Fatalf("name = %q, want Checkout", got.Name)
				}
			} else {
				expectError(t, w, http.StatusForbidden, "you are not authorized to access this app")
				if got.Name != "Onboarding" {
					t.Fatalf("name = %q, want it unchanged", got.Name)
				}
			}
		})
	}
}

func TestDeleteFunnel(t *testing.T) {
	ctx := context.Background()

	t.Run("deletes the funnel", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "developer")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		kept := seedFunnel(ctx, t, appID, userID, "Onboarding")

		expectStatus(t, deleteFunnel(userID, appID, funnel.ID), http.StatusOK)
		expectStatus(t, getFunnel(userID, appID, funnel.ID), http.StatusNotFound)
		expectNames(t, decodeBody[funnelsPage](t, listFunnels(userID, appID, "")).Results, kept.Name)
	})

	t.Run("missing funnel returns not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		expectError(t, deleteFunnel(userID, appID, uuid.New()), http.StatusNotFound, "Funnel not found")
	})

	t.Run("another app's funnel returns not found and is kept", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		funnel := seedFunnel(ctx, t, otherAppID, userID, "Other")

		expectError(t, deleteFunnel(userID, appID, funnel.ID), http.StatusNotFound, "Funnel not found")
		expectStatus(t, getFunnel(userID, otherAppID, funnel.ID), http.StatusOK)
	})

	for _, tc := range funnelRoles {
		t.Run(tc.role+" role", func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, tc.role)
			funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

			w := deleteFunnel(userID, appID, funnel.ID)
			if tc.canWrite {
				expectStatus(t, w, http.StatusOK)
				expectStatus(t, getFunnel(userID, appID, funnel.ID), http.StatusNotFound)
			} else {
				expectError(t, w, http.StatusForbidden, "you are not authorized to access this app")
				expectStatus(t, getFunnel(userID, appID, funnel.ID), http.StatusOK)
			}
		})
	}
}

type pinnedFunnels struct {
	Results []measure.Funnel `json:"results"`
}

func listPinned(userID string, appID uuid.UUID) *httptest.ResponseRecorder {
	return serveFunnel(h.GetPinnedFunnels, "GET", "/apps/"+appID.String()+"/funnels/pinned", "", userID, appID.String(), "")
}

func pinFunnel(userID string, appID, funnelID uuid.UUID) *httptest.ResponseRecorder {
	return serveFunnel(h.PinFunnel, "PUT", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/pin", "", userID, appID.String(), funnelID.String())
}

func unpinFunnel(userID string, appID, funnelID uuid.UUID) *httptest.ResponseRecorder {
	return serveFunnel(h.UnpinFunnel, "DELETE", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/pin", "", userID, appID.String(), funnelID.String())
}

func reorderPinned(userID string, appID uuid.UUID, body string) *httptest.ResponseRecorder {
	return serveFunnel(h.ReorderPinnedFunnels, "PUT", "/apps/"+appID.String()+"/funnels/pinned", body, userID, appID.String(), "")
}

func funnelIDsBody(funnels ...measure.Funnel) string {
	ids := make([]string, len(funnels))
	for i, funnel := range funnels {
		ids[i] = `"` + funnel.ID.String() + `"`
	}
	return `{"funnel_ids":[` + strings.Join(ids, ",") + `]}`
}

func pinnedList(t *testing.T, userID string, appID uuid.UUID) []measure.Funnel {
	t.Helper()
	w := listPinned(userID, appID)
	expectStatus(t, w, http.StatusOK)
	return decodeBody[pinnedFunnels](t, w).Results
}

func mustPin(t *testing.T, userID string, appID uuid.UUID, funnels ...measure.Funnel) {
	t.Helper()
	for _, funnel := range funnels {
		expectStatus(t, pinFunnel(userID, appID, funnel.ID), http.StatusOK)
	}
}

func TestGetPinnedFunnels(t *testing.T) {
	ctx := context.Background()

	t.Run("lists the app's pinned funnels in pinned order", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		checkout := seedFunnel(ctx, t, appID, userID, "Checkout")
		seedFunnel(ctx, t, appID, userID, "Unpinned")
		onboarding := seedFunnel(ctx, t, appID, userID, "Onboarding")
		mustPin(t, userID, appID, onboarding, checkout)
		mustPin(t, userID, otherAppID, seedFunnel(ctx, t, otherAppID, userID, "Other app"))

		pinned := pinnedList(t, userID, appID)
		expectNames(t, pinned, "Onboarding", "Checkout")
		for _, funnel := range pinned {
			if !funnel.Pinned || funnel.PinOrder == nil {
				t.Fatalf("%s: pinned = %v, pin_order = %v, want pinned", funnel.Name, funnel.Pinned, funnel.PinOrder)
			}
		}
	})

	t.Run("returns an empty list when nothing is pinned", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		seedFunnel(ctx, t, appID, userID, "Checkout")

		w := listPinned(userID, appID)
		expectStatus(t, w, http.StatusOK)
		if w.Body.String() != `{"results":[]}` {
			t.Fatalf("body = %s, want an empty results array", w.Body.String())
		}
	})

	t.Run("every role can list pinned funnels", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, appID := seedFunnelApp(ctx, t, tc.role)
				funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
				if _, err := measure.SetFunnelPinned(ctx, th.PgPool, appID, funnel.ID, true); err != nil {
					t.Fatalf("pin: %v", err)
				}

				expectNames(t, pinnedList(t, userID, appID), "Checkout")
			})
		}
	})

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID := seedFunnelApp(ctx, t, "owner")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, listPinned(outsiderID, appID), http.StatusForbidden)
	})
}

func TestPinFunnel(t *testing.T) {
	ctx := context.Background()

	t.Run("puts the first pin first and each later pin after it", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		checkout := seedFunnel(ctx, t, appID, userID, "Checkout")
		onboarding := seedFunnel(ctx, t, appID, userID, "Onboarding")

		w := pinFunnel(userID, appID, checkout.ID)
		expectStatus(t, w, http.StatusOK)
		got := decodeBody[measure.Funnel](t, w)
		if !got.Pinned || got.PinOrder == nil || *got.PinOrder != 0 {
			t.Fatalf("pinned = %v, pin_order = %v, want the first position", got.Pinned, got.PinOrder)
		}

		mustPin(t, userID, appID, onboarding)
		expectNames(t, pinnedList(t, userID, appID), "Checkout", "Onboarding")
	})

	t.Run("pins after the highest position when an unpin leaves a gap", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		a := seedFunnel(ctx, t, appID, userID, "A")
		b := seedFunnel(ctx, t, appID, userID, "B")
		c := seedFunnel(ctx, t, appID, userID, "C")
		mustPin(t, userID, appID, a, b)
		expectStatus(t, unpinFunnel(userID, appID, a.ID), http.StatusOK)

		mustPin(t, userID, appID, c, a)
		expectNames(t, pinnedList(t, userID, appID), "B", "C", "A")
	})

	t.Run("pinning a pinned funnel again leaves it where it is", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		checkout := seedFunnel(ctx, t, appID, userID, "Checkout")
		onboarding := seedFunnel(ctx, t, appID, userID, "Onboarding")
		mustPin(t, userID, appID, checkout, onboarding)

		w := pinFunnel(userID, appID, checkout.ID)
		expectStatus(t, w, http.StatusOK)
		if got := decodeBody[measure.Funnel](t, w); got.PinOrder == nil || *got.PinOrder != 0 {
			t.Fatalf("pin_order = %v, want it unchanged at 0", got.PinOrder)
		}
		expectNames(t, pinnedList(t, userID, appID), "Checkout", "Onboarding")
	})

	t.Run("refuses a pin once the app has the most pinned funnels", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		pinned := make([]measure.Funnel, measure.MaxPinnedFunnels)
		for i := range pinned {
			pinned[i] = seedFunnel(ctx, t, appID, userID, fmt.Sprintf("Funnel %d", i))
		}
		mustPin(t, userID, appID, pinned...)
		extra := seedFunnel(ctx, t, appID, userID, "Extra")

		expectError(t, pinFunnel(userID, appID, extra.ID), http.StatusConflict, "Up to 10 funnels can be pinned, unpin one to pin another")
		expectStatus(t, pinFunnel(userID, appID, pinned[0].ID), http.StatusOK)

		expectStatus(t, unpinFunnel(userID, appID, pinned[0].ID), http.StatusOK)
		mustPin(t, userID, appID, extra)
		if got := pinnedList(t, userID, appID); len(got) != measure.MaxPinnedFunnels || got[len(got)-1].Name != "Extra" {
			t.Fatalf("pinned = %v, want %d funnels ending with Extra", funnelNames(got), measure.MaxPinnedFunnels)
		}
	})

	t.Run("pinning and unpinning leave updated_at unchanged", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

		mustPin(t, userID, appID, funnel)
		expectStatus(t, unpinFunnel(userID, appID, funnel.ID), http.StatusOK)

		if got := decodeBody[measure.Funnel](t, getFunnel(userID, appID, funnel.ID)); !got.UpdatedAt.Equal(funnel.UpdatedAt) {
			t.Fatalf("updated_at = %v, want it unchanged at %v", got.UpdatedAt, funnel.UpdatedAt)
		}
	})

	t.Run("gives funnels pinned at the same time their own positions", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnels := make([]measure.Funnel, 10)
		for i := range funnels {
			funnels[i] = seedFunnel(ctx, t, appID, userID, fmt.Sprintf("Funnel %d", i))
		}

		codes := make([]int, len(funnels))
		var wg sync.WaitGroup
		for i, funnel := range funnels {
			wg.Add(1)
			go func() {
				defer wg.Done()
				codes[i] = pinFunnel(userID, appID, funnel.ID).Code
			}()
		}
		wg.Wait()

		for i, code := range codes {
			if code != http.StatusOK {
				t.Fatalf("pin %d status = %d, want 200", i, code)
			}
		}
		positions := map[int]bool{}
		for _, funnel := range pinnedList(t, userID, appID) {
			positions[*funnel.PinOrder] = true
		}
		if len(positions) != len(funnels) {
			t.Fatalf("positions = %v, want %d distinct positions", positions, len(funnels))
		}
	})

	t.Run("missing funnel returns not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		expectError(t, pinFunnel(userID, appID, uuid.New()), http.StatusNotFound, "Funnel not found")
	})

	t.Run("missing funnel returns not found when the pins are full", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		pinned := make([]measure.Funnel, measure.MaxPinnedFunnels)
		for i := range pinned {
			pinned[i] = seedFunnel(ctx, t, appID, userID, fmt.Sprintf("Funnel %d", i))
		}
		mustPin(t, userID, appID, pinned...)

		expectError(t, pinFunnel(userID, appID, uuid.New()), http.StatusNotFound, "Funnel not found")
	})

	t.Run("another app's funnel returns not found and stays unpinned", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		funnel := seedFunnel(ctx, t, otherAppID, userID, "Other")

		expectError(t, pinFunnel(userID, appID, funnel.ID), http.StatusNotFound, "Funnel not found")
		expectNames(t, pinnedList(t, userID, otherAppID))
	})

	for _, tc := range funnelRoles {
		t.Run(tc.role+" role", func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, tc.role)
			funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

			w := pinFunnel(userID, appID, funnel.ID)
			if tc.canWrite {
				expectStatus(t, w, http.StatusOK)
				expectNames(t, pinnedList(t, userID, appID), "Checkout")
			} else {
				expectError(t, w, http.StatusForbidden, "you are not authorized to access this app")
				expectNames(t, pinnedList(t, userID, appID))
			}
		})
	}
}

func TestUnpinFunnel(t *testing.T) {
	ctx := context.Background()

	t.Run("unpins the funnel and keeps the others in order", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		a := seedFunnel(ctx, t, appID, userID, "A")
		b := seedFunnel(ctx, t, appID, userID, "B")
		c := seedFunnel(ctx, t, appID, userID, "C")
		mustPin(t, userID, appID, a, b, c)

		w := unpinFunnel(userID, appID, b.ID)
		expectStatus(t, w, http.StatusOK)
		if got := decodeBody[measure.Funnel](t, w); got.Pinned || got.PinOrder != nil {
			t.Fatalf("pinned = %v, pin_order = %v, want unpinned", got.Pinned, got.PinOrder)
		}
		expectNames(t, pinnedList(t, userID, appID), "A", "C")
	})

	t.Run("leaves an unpinned funnel unpinned", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

		w := unpinFunnel(userID, appID, funnel.ID)
		expectStatus(t, w, http.StatusOK)
		if got := decodeBody[measure.Funnel](t, w); got.Pinned {
			t.Fatal("pinned = true, want false")
		}
	})

	t.Run("missing funnel returns not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		expectError(t, unpinFunnel(userID, appID, uuid.New()), http.StatusNotFound, "Funnel not found")
	})

	t.Run("another app's funnel returns not found and stays pinned", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		funnel := seedFunnel(ctx, t, otherAppID, userID, "Other")
		mustPin(t, userID, otherAppID, funnel)

		expectError(t, unpinFunnel(userID, appID, funnel.ID), http.StatusNotFound, "Funnel not found")
		expectNames(t, pinnedList(t, userID, otherAppID), "Other")
	})

	for _, tc := range funnelRoles {
		t.Run(tc.role+" role", func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID := seedFunnelApp(ctx, t, tc.role)
			funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
			if _, err := measure.SetFunnelPinned(ctx, th.PgPool, appID, funnel.ID, true); err != nil {
				t.Fatalf("pin: %v", err)
			}

			w := unpinFunnel(userID, appID, funnel.ID)
			if tc.canWrite {
				expectStatus(t, w, http.StatusOK)
				expectNames(t, pinnedList(t, userID, appID))
			} else {
				expectError(t, w, http.StatusForbidden, "you are not authorized to access this app")
				expectNames(t, pinnedList(t, userID, appID), "Checkout")
			}
		})
	}
}

func TestReorderPinnedFunnels(t *testing.T) {
	ctx := context.Background()

	seedPinned := func(t *testing.T, role string) (userID string, appID uuid.UUID, a, b, c, unpinned measure.Funnel) {
		t.Helper()
		userID, appID = seedFunnelApp(ctx, t, role)
		a = seedFunnel(ctx, t, appID, userID, "A")
		b = seedFunnel(ctx, t, appID, userID, "B")
		c = seedFunnel(ctx, t, appID, userID, "C")
		unpinned = seedFunnel(ctx, t, appID, userID, "Unpinned")
		for _, funnel := range []measure.Funnel{a, b, c} {
			if _, err := measure.SetFunnelPinned(ctx, th.PgPool, appID, funnel.ID, true); err != nil {
				t.Fatalf("pin: %v", err)
			}
		}
		return userID, appID, a, b, c, unpinned
	}

	t.Run("saves the new order and returns the pinned funnels in it", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, a, b, c, _ := seedPinned(t, "owner")

		w := reorderPinned(userID, appID, funnelIDsBody(c, a, b))
		expectStatus(t, w, http.StatusOK)
		expectNames(t, decodeBody[pinnedFunnels](t, w).Results, "C", "A", "B")
		expectNames(t, pinnedList(t, userID, appID), "C", "A", "B")
	})

	t.Run("accepts an empty order when nothing is pinned", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		seedFunnel(ctx, t, appID, userID, "Checkout")

		w := reorderPinned(userID, appID, `{"funnel_ids":[]}`)
		expectStatus(t, w, http.StatusOK)
		expectNames(t, decodeBody[pinnedFunnels](t, w).Results)
	})

	for _, tc := range []struct {
		name  string
		order func(a, b, c, unpinned measure.Funnel) string
	}{
		{"a pinned funnel is missing", func(a, b, c, _ measure.Funnel) string { return funnelIDsBody(c, a) }},
		{"an unpinned funnel is included", func(a, b, c, u measure.Funnel) string { return funnelIDsBody(c, a, b, u) }},
		{"an unpinned funnel replaces a pinned one", func(a, b, c, u measure.Funnel) string { return funnelIDsBody(c, a, u) }},
		{"a funnel appears twice", func(a, b, c, _ measure.Funnel) string { return funnelIDsBody(c, a, a) }},
		{"the order is empty", func(_, _, _, _ measure.Funnel) string { return `{"funnel_ids":[]}` }},
		{"an unknown id is included", func(a, b, _, _ measure.Funnel) string {
			return funnelIDsBody(a, b, measure.Funnel{ID: uuid.New()})
		}},
	} {
		t.Run("returns a conflict when "+tc.name, func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID, a, b, c, unpinned := seedPinned(t, "owner")

			expectError(t, reorderPinned(userID, appID, tc.order(a, b, c, unpinned)), http.StatusConflict, "Pinned funnels have changed, refresh the page to see the latest pins")
			expectNames(t, pinnedList(t, userID, appID), "A", "B", "C")
		})
	}

	t.Run("returns a conflict for another app's pinned funnel", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		mine := seedFunnel(ctx, t, appID, userID, "Mine")
		other := seedFunnel(ctx, t, otherAppID, userID, "Other")
		mustPin(t, userID, appID, mine)
		mustPin(t, userID, otherAppID, other)

		expectStatus(t, reorderPinned(userID, appID, funnelIDsBody(other)), http.StatusConflict)
		expectNames(t, pinnedList(t, userID, appID), "Mine")
		expectNames(t, pinnedList(t, userID, otherAppID), "Other")
	})

	for _, tc := range []struct {
		name string
		body string
	}{
		{"missing funnel_ids", `{}`},
		{"null funnel_ids", `{"funnel_ids":null}`},
		{"an id that is not a uuid", `{"funnel_ids":["nope"]}`},
		{"malformed json", `{"funnel_ids":`},
	} {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID, _, _, _, _ := seedPinned(t, "owner")

			expectError(t, reorderPinned(userID, appID, tc.body), http.StatusBadRequest, "invalid request payload")
			expectNames(t, pinnedList(t, userID, appID), "A", "B", "C")
		})
	}

	for _, tc := range funnelRoles {
		t.Run(tc.role+" role", func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, appID, a, b, c, _ := seedPinned(t, tc.role)

			w := reorderPinned(userID, appID, funnelIDsBody(c, b, a))
			if tc.canWrite {
				expectStatus(t, w, http.StatusOK)
				expectNames(t, pinnedList(t, userID, appID), "C", "B", "A")
			} else {
				expectError(t, w, http.StatusForbidden, "you are not authorized to access this app")
				expectNames(t, pinnedList(t, userID, appID), "A", "B", "C")
			}
		})
	}
}

func listEventNames(userID string, appID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.SuggestFunnelEventNames, "GET", "/apps/"+appID.String()+"/funnels/events?"+query, "", userID, appID.String(), "")
}

func eventNames(t *testing.T, userID string, appID uuid.UUID, query string) []string {
	t.Helper()
	w := listEventNames(userID, appID, query)
	expectStatus(t, w, http.StatusOK)
	return decodeBody[struct {
		Results []string `json:"results"`
	}](t, w).Results
}

func seedCustomEvents(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, at time.Time, names ...string) {
	t.Helper()
	for _, name := range names {
		th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{Type: "custom", CustomName: name, Timestamp: at})
	}
}

func TestSuggestFunnelEventNames(t *testing.T) {
	ctx := context.Background()

	t.Run("lists the app's custom event names once each, most recently seen first", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		now := time.Now().UTC()
		seedCustomEvents(ctx, t, teamID, appID, now.Add(-3*time.Hour), "purchase", "app_open")
		seedCustomEvents(ctx, t, teamID, appID, now.Add(-2*time.Hour), "add_to_cart")
		seedCustomEvents(ctx, t, teamID, appID, now.Add(-time.Hour), "purchase")
		th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{Type: "screen_view", Timestamp: now})
		seedCustomEvents(ctx, t, teamID, otherAppID, now, "other_app_event")

		if got, want := eventNames(t, userID, appID, ""), []string{"purchase", "add_to_cart", "app_open"}; !slices.Equal(got, want) {
			t.Fatalf("names = %v, want %v", got, want)
		}
	})

	t.Run("lists only the first 50 names, alphabetically when seen at the same time", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		var names []string
		for i := range 51 {
			names = append(names, fmt.Sprintf("event_%02d", i))
		}
		seedCustomEvents(ctx, t, teamID, appID, time.Now().UTC(), names...)

		if got := eventNames(t, userID, appID, ""); !slices.Equal(got, names[:50]) {
			t.Fatalf("names = %v, want event_00 to event_49", got)
		}
	})

	t.Run("searches names case-insensitively with wildcards as plain text", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedCustomEvents(ctx, t, teamID, appID, time.Now().UTC(), "add_to_cart", "Cart Viewed", "addXtoXcart", "purchase", "100% done")

		for _, tc := range []struct {
			query string
			want  []string
		}{
			{"search=CART", []string{"Cart Viewed", "addXtoXcart", "add_to_cart"}},
			{"search=_to_", []string{"add_to_cart"}},
			{"search=%25", []string{"100% done"}},
			{"search=signup", []string{}},
		} {
			if got := eventNames(t, userID, appID, tc.query); !slices.Equal(got, tc.want) {
				t.Fatalf("%s: names = %v, want %v", tc.query, got, tc.want)
			}
		}
	})

	t.Run("leaves out names last sent more than 30 days ago", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)
		now := time.Now().UTC()
		seedCustomEvents(ctx, t, teamID, appID, now.Add(-29*24*time.Hour), "recent")
		seedCustomEvents(ctx, t, teamID, appID, now.Add(-31*24*time.Hour), "stale")

		if got := eventNames(t, userID, appID, ""); !slices.Equal(got, []string{"recent"}) {
			t.Fatalf("names = %v, want [recent]", got)
		}
	})

	t.Run("returns an empty list when the app has sent no custom events", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")

		w := listEventNames(userID, appID, "")
		expectStatus(t, w, http.StatusOK)
		if w.Body.String() != `{"results":[]}` {
			t.Fatalf("body = %s, want an empty results array", w.Body.String())
		}
	})

	t.Run("every role can list event names", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, tc.role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)
				seedCustomEvents(ctx, t, teamID, appID, time.Now().UTC(), "purchase")

				w := listEventNames(userID, appID, "")
				expectStatus(t, w, http.StatusOK)
				if w.Body.String() != `{"results":["purchase"]}` {
					t.Fatalf("body = %s, want purchase", w.Body.String())
				}
			})
		}
	})

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID := seedFunnelApp(ctx, t, "owner")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, listEventNames(outsiderID, appID, ""), http.StatusForbidden)
	})
}

type funnelEvent struct {
	name   string
	offset time.Duration
}

func seedInstallationEvents(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, appVersion string, start time.Time, events ...funnelEvent) string {
	t.Helper()
	installationID := uuid.NewString()
	for _, event := range events {
		th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
			Type:           "custom",
			CustomName:     event.name,
			InstallationID: installationID,
			AppVersion:     appVersion,
			Timestamp:      start.Add(event.offset),
		})
	}
	return installationID
}

// seedPlanEvents seeds one installation's events in one session, and sets the
// user-defined attribute plan on another event of that session.
func seedPlanEvents(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, plan string, start time.Time, events ...funnelEvent) {
	t.Helper()
	installationID := uuid.NewString()
	sessionID := uuid.NewString()
	for _, event := range events {
		th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
			Type:           "custom",
			CustomName:     event.name,
			InstallationID: installationID,
			SessionID:      sessionID,
			Timestamp:      start.Add(event.offset),
		})
	}
	th.SeedUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.UDAttrRow{
		SessionID: sessionID,
		Key:       "plan",
		Value:     plan,
		Timestamp: start,
	})
}

func seedFunnelSteps(ctx context.Context, t *testing.T, appID uuid.UUID, userID string, windowSeconds int, eventNames ...string) measure.Funnel {
	t.Helper()
	steps := make([]measure.FunnelStep, len(eventNames))
	for i, name := range eventNames {
		steps[i] = measure.FunnelStep{EventName: name}
	}
	funnel, err := measure.CreateFunnel(ctx, th.PgPool, appID, userID, measure.FunnelDraft{
		Name:                    "Checkout",
		Steps:                   steps,
		ConversionWindowSeconds: windowSeconds,
	})
	if err != nil {
		t.Fatalf("seed funnel: %v", err)
	}
	return funnel
}

func rangeQuery(from, to time.Time) string {
	const layout = "2006-01-02T15:04:05.000Z"
	return "from=" + from.UTC().Format(layout) + "&to=" + to.UTC().Format(layout)
}

func getConversion(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnelConversion, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/conversion?"+query, "", userID, appID.String(), funnelID.String())
}

// conversionSteps fetches the funnel's conversion and turns each step into
// one string of its event name, installation count and median seconds from
// the step before, such as "add_to_cart 2 90", with "-" when the step has no
// median, so a test can compare every step in one assertion.
func conversionSteps(t *testing.T, userID string, appID, funnelID uuid.UUID, query string) []string {
	t.Helper()
	w := getConversion(userID, appID, funnelID, query)
	expectStatus(t, w, http.StatusOK)
	conversion := decodeBody[struct {
		Steps []measure.FunnelStepConversion `json:"steps"`
	}](t, w)
	steps := make([]string, len(conversion.Steps))
	for i, step := range conversion.Steps {
		median := "-"
		if step.MedianSecondsFromPrevious != nil {
			median = fmt.Sprintf("%g", *step.MedianSecondsFromPrevious)
		}
		steps[i] = fmt.Sprintf("%s %d %s", step.EventName, step.Users, median)
	}
	return steps
}

func expectConversion(t *testing.T, got []string, want ...string) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Fatalf("steps = %q, want %q", got, want)
	}
}

func TestGetFunnelConversion(t *testing.T) {
	ctx := context.Background()
	start := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Second)
	lastTwoDays := rangeQuery(start.Add(-24*time.Hour), start.Add(24*time.Hour))

	t.Run("counts the installations that reached each step and the median time from the step before", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 3 * time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", 2 * time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		// Skipping a step stops the installation at the step before.
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		// Later steps without the first do not count.
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"add_to_cart", 0}, funnelEvent{"purchase", time.Minute})
		// Steps out of order only count from the first step on.
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"add_to_cart", 0}, funnelEvent{"app_open", time.Minute})
		seedInstallationEvents(ctx, t, teamID, otherAppID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"app_open 5 -", "add_to_cart 2 90", "purchase 1 120")
	})

	t.Run("a step counts only within the conversion window from the first step", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", 59 * time.Minute}, funnelEvent{"purchase", 61 * time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", 60 * time.Minute})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"app_open 2 -", "add_to_cart 2 3570", "purchase 0 -")
	})

	t.Run("a later first step starts a path that can still convert", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 100*60, "app_open", "add_to_cart", "purchase")

		// The path from the first app_open runs out of window before purchase,
		// the one from the second converts.
		seedInstallationEvents(ctx, t, teamID, appID, "", start,
			funnelEvent{"app_open", 0},
			funnelEvent{"add_to_cart", 90 * time.Minute},
			funnelEvent{"app_open", 95 * time.Minute},
			funnelEvent{"purchase", 120 * time.Minute},
			funnelEvent{"add_to_cart", 150 * time.Minute},
			funnelEvent{"purchase", 160 * time.Minute},
		)

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"app_open 1 -", "add_to_cart 1 3300", "purchase 1 600")
	})

	t.Run("a step repeated back to back needs the event twice", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "add_to_cart", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"add_to_cart", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"add_to_cart", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 2 * time.Minute})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"add_to_cart 2 -", "add_to_cart 1 60", "purchase 1 60")
	})

	t.Run("steps sent in the same millisecond count in funnel order", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "view_cart", "checkout")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"checkout", 0}, funnelEvent{"view_cart", 0})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"view_cart 1 -", "checkout 1 -")
	})

	t.Run("a step reached again on the same path keeps its first time", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", start,
			funnelEvent{"app_open", 0},
			funnelEvent{"add_to_cart", 10 * time.Minute},
			funnelEvent{"add_to_cart", 50 * time.Minute},
			funnelEvent{"purchase", 60 * time.Minute},
		)

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"app_open 1 -", "add_to_cart 1 600", "purchase 1 3000")
	})

	t.Run("an installation's times come from the first path that reached its furthest step", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", start,
			funnelEvent{"app_open", 0},
			funnelEvent{"add_to_cart", 10 * time.Minute},
			funnelEvent{"purchase", 20 * time.Minute},
			funnelEvent{"app_open", 30 * time.Minute},
			funnelEvent{"add_to_cart", 70 * time.Minute},
			funnelEvent{"purchase", 80 * time.Minute},
		)

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"app_open 1 -", "add_to_cart 1 600", "purchase 1 600")
	})

	t.Run("leaves gaps of zero out of the median", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "add_to_cart", "purchase")

		for range 3 {
			seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"add_to_cart", 0}, funnelEvent{"purchase", 0})
		}
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"add_to_cart", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"add_to_cart", 0}, funnelEvent{"purchase", 2 * time.Minute})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"add_to_cart 5 -", "purchase 5 90")
	})

	t.Run("repeated events of one step give the same result", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", start,
			funnelEvent{"app_open", 0},
			funnelEvent{"app_open", time.Minute},
			funnelEvent{"app_open", 2 * time.Minute},
			funnelEvent{"add_to_cart", 3 * time.Minute},
			funnelEvent{"add_to_cart", 4 * time.Minute},
			funnelEvent{"add_to_cart", 5 * time.Minute},
			funnelEvent{"purchase", 6 * time.Minute},
		)
		// Every event is step 1, so only the last one is kept, and it has no
		// event after it.
		seedInstallationEvents(ctx, t, teamID, appID, "", start,
			funnelEvent{"app_open", 0},
			funnelEvent{"app_open", time.Minute},
			funnelEvent{"app_open", 2 * time.Minute},
		)

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
			"app_open 2 -", "add_to_cart 1 60", "purchase 1 180")
	})

	t.Run("counts installations that entered in the date range, with later steps up to a conversion window after it", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 7200, "app_open", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", -time.Minute}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Hour})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 59 * time.Minute}, funnelEvent{"purchase", 3 * time.Hour})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", time.Hour}, funnelEvent{"purchase", 61 * time.Minute})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, rangeQuery(start, start.Add(time.Hour))),
			"app_open 2 -", "purchase 1 3600")
	})

	t.Run("counts only events matching the filter", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "1.0.0", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "2.0.0", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "1.0.0", start, funnelEvent{"app_open", 0})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays+"&filter_expr="+url.QueryEscape("version_name:in:1.0.0")),
			"app_open 2 -", "purchase 1 60")
	})

	t.Run("counts only events from sessions with the custom attribute", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "purchase")

		seedPlanEvents(ctx, t, teamID, appID, "pro", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedPlanEvents(ctx, t, teamID, appID, "pro", start, funnelEvent{"app_open", 0})
		seedPlanEvents(ctx, t, teamID, appID, "free", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})

		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays+"&filter_expr="+url.QueryEscape("custom.plan:in:pro")),
			"app_open 2 -", "purchase 1 60")
	})

	t.Run("rejects a filter on a key funnels do not have", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

		w := getConversion(userID, appID, funnel.ID, lastTwoDays+"&filter_expr="+url.QueryEscape("user_id:in:someone"))
		expectStatus(t, w, http.StatusBadRequest)
	})

	t.Run("an unknown funnel or one from another app is not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		otherFunnel := seedFunnel(ctx, t, otherAppID, userID, "Other")

		expectError(t, getConversion(userID, appID, uuid.New(), lastTwoDays), http.StatusNotFound, "Funnel not found")
		expectError(t, getConversion(userID, appID, otherFunnel.ID, lastTwoDays), http.StatusNotFound, "Funnel not found")
	})

	t.Run("every role can read conversion", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, tc.role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)
				funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
				seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})

				expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays),
					"app_open 1 -", "purchase 1 60")
			})
		}
	})

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, getConversion(outsiderID, appID, funnel.ID, lastTwoDays), http.StatusForbidden)
	})
}

func getStepErrors(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnelStepErrors, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/errors?"+query, "", userID, appID.String(), funnelID.String())
}

type stepErrorsPage struct {
	Results []measure.FunnelStepError `json:"results"`
	Meta    struct {
		Next     bool `json:"next"`
		Previous bool `json:"previous"`
	} `json:"meta"`
}

// stepErrorRows turns each error group on the page into one string of its id,
// type, error type, severity, instances, users, conversions and drop-offs, so
// a test can compare the page in one assertion.
func stepErrorRows(page stepErrorsPage) []string {
	rows := []string{}
	for _, stepError := range page.Results {
		rows = append(rows, fmt.Sprintf("%s %s %s %s %d %d %d %d", stepError.ID[:1], stepError.Type, stepError.ErrorType, stepError.Severity, stepError.Count, stepError.Users, stepError.Converted, stepError.Dropped))
	}
	return rows
}

// seedInstallationError sends one error event of type kind from an
// installation: "exception", "anr" or "app_hang".
func seedInstallationError(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, installationID, appVersion, kind, fingerprint string, handled bool, at time.Time) {
	t.Helper()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type:           kind,
		InstallationID: installationID,
		AppVersion:     appVersion,
		Fingerprint:    fingerprint,
		Handled:        handled,
		Timestamp:      at,
	})
}

func TestGetFunnelStepErrors(t *testing.T) {
	ctx := context.Background()
	start := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Second)
	lastTwoDays := rangeQuery(start.Add(-24*time.Hour), start.Add(24*time.Hour))
	crash := strings.Repeat("a", 32)
	anr := strings.Repeat("b", 32)
	handled := strings.Repeat("c", 32)
	appHang := strings.Repeat("e", 32)

	// Seeds a three-step funnel with a one-hour window, where installations
	// hit a crash, an ANR, a handled exception and an app hang at different
	// points.
	seed := func(t *testing.T) (string, uuid.UUID, measure.Funnel) {
		t.Helper()
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "fatal_exception_groups", Fingerprint: crash, Type: "IllegalStateException"})
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "anr_groups", Fingerprint: anr, Type: "ANR"})
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "nonfatal_exception_groups", Fingerprint: handled, Type: "IOException", Handled: true})
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "app_hang_groups", Fingerprint: appHang})

		// Crashes before moving into add_to_cart.
		converted := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", 2 * time.Minute})
		seedInstallationError(ctx, t, teamID, appID, converted, "", "exception", crash, false, start.Add(time.Minute))
		// Crashes twice, hits a handled exception and an app hang, then drops
		// off.
		dropped := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationError(ctx, t, teamID, appID, dropped, "", "exception", crash, false, start.Add(time.Minute))
		seedInstallationError(ctx, t, teamID, appID, dropped, "", "exception", crash, false, start.Add(90*time.Second))
		seedInstallationError(ctx, t, teamID, appID, dropped, "", "exception", handled, true, start.Add(3*time.Minute))
		seedInstallationError(ctx, t, teamID, appID, dropped, "", "app_hang", appHang, false, start.Add(5*time.Minute))
		// An error whose group has no group table row is left out.
		seedInstallationError(ctx, t, teamID, appID, dropped, "", "exception", strings.Repeat("d", 32), false, start.Add(4*time.Minute))
		// Hits an ANR late in its conversion window, then drops off.
		late := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationError(ctx, t, teamID, appID, late, "", "anr", anr, false, start.Add(59*time.Minute))
		// Crashes before entering the funnel and after its conversion window.
		outside := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationError(ctx, t, teamID, appID, outside, "", "exception", crash, false, start.Add(-time.Minute))
		seedInstallationError(ctx, t, teamID, appID, outside, "", "exception", crash, false, start.Add(61*time.Minute))
		// Crashes after moving into add_to_cart, then drops off before purchase.
		later := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		seedInstallationError(ctx, t, teamID, appID, later, "", "exception", crash, false, start.Add(2*time.Minute))
		return userID, appID, funnel
	}

	t.Run("lists the errors between two steps with the installations that converted and dropped off after them", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		w := getStepErrors(userID, appID, funnel.ID, lastTwoDays+"&step=1")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepErrorsPage](t, w)
		expectPoints(t, stepErrorRows(page),
			"a IllegalStateException exception fatal 3 2 1 1",
			"b ANR anr fatal 1 1 0 1",
			"c IOException exception handled 1 1 0 1",
			"e  app_hang  1 1 0 1")
		if page.Meta.Next || page.Meta.Previous {
			t.Fatalf("meta = %+v, want no other pages", page.Meta)
		}

		w = getStepErrors(userID, appID, funnel.ID, lastTwoDays+"&step=2")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepErrorRows(decodeBody[stepErrorsPage](t, w)),
			"a IllegalStateException exception fatal 1 1 0 1")
	})

	t.Run("describes a group by its newest row when it has rows from before the range and after its end", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart")
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "fatal_exception_groups", Fingerprint: crash, AppVersion: "v0", Type: "NullPointerException", Timestamp: start.AddDate(0, -2, 0)})
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "fatal_exception_groups", Fingerprint: crash, Type: "IllegalStateException", Timestamp: start.Add(48 * time.Hour)})

		dropped := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationError(ctx, t, teamID, appID, dropped, "", "exception", crash, false, start.Add(time.Minute))

		w := getStepErrors(userID, appID, funnel.ID, lastTwoDays+"&step=1")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepErrorRows(decodeBody[stepErrorsPage](t, w)),
			"a IllegalStateException exception fatal 1 1 0 1")
	})

	t.Run("lists the errors across the whole funnel when no step is given", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "fatal_exception_groups", Fingerprint: crash, Type: "IllegalStateException"})

		// Crashes between add_to_cart and purchase, and again after purchase.
		finished := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 3 * time.Minute})
		seedInstallationError(ctx, t, teamID, appID, finished, "", "exception", crash, false, start.Add(2*time.Minute))
		seedInstallationError(ctx, t, teamID, appID, finished, "", "exception", crash, false, start.Add(4*time.Minute))
		// Crashes after add_to_cart, and again after its conversion window.
		quit := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		seedInstallationError(ctx, t, teamID, appID, quit, "", "exception", crash, false, start.Add(30*time.Minute))
		seedInstallationError(ctx, t, teamID, appID, quit, "", "exception", crash, false, start.Add(61*time.Minute))

		w := getStepErrors(userID, appID, funnel.ID, lastTwoDays)
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepErrorRows(decodeBody[stepErrorsPage](t, w)),
			"a IllegalStateException exception fatal 2 2 1 1")
	})

	t.Run("lists only the errors that match the filter", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart")
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "fatal_exception_groups", Fingerprint: crash, Type: "IllegalStateException"})
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "anr_groups", Fingerprint: anr, Type: "ANR"})

		// Enters on 2.0, then updates to 2.1 and hits an ANR there.
		updated := seedInstallationEvents(ctx, t, teamID, appID, "2.0", start, funnelEvent{"app_open", 0})
		seedInstallationError(ctx, t, teamID, appID, updated, "2.0", "exception", crash, false, start.Add(time.Minute))
		seedInstallationError(ctx, t, teamID, appID, updated, "2.1", "anr", anr, false, start.Add(2*time.Minute))

		w := getStepErrors(userID, appID, funnel.ID, lastTwoDays+"&step=1&filter_expr="+url.QueryEscape("version_name:in:2.0"))
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepErrorRows(decodeBody[stepErrorsPage](t, w)),
			"a IllegalStateException exception fatal 1 1 0 1")
	})

	t.Run("pages through the errors", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		w := getStepErrors(userID, appID, funnel.ID, lastTwoDays+"&step=1&limit=1&offset=1")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepErrorsPage](t, w)
		expectPoints(t, stepErrorRows(page), "b ANR anr fatal 1 1 0 1")
		if !page.Meta.Next || !page.Meta.Previous {
			t.Fatalf("meta = %+v, want a next and a previous page", page.Meta)
		}
	})

	t.Run("rejects a step outside the funnel's transitions", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		for _, query := range []string{"&step=", "&step=0", "&step=3", "&step=one"} {
			expectError(t, getStepErrors(userID, appID, funnel.ID, lastTwoDays+query), http.StatusBadRequest, "step must be between 1 and 2")
		}
	})

	t.Run("forbids users outside the app's team", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID, funnel := seed(t)
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, getStepErrors(outsiderID, appID, funnel.ID, lastTwoDays+"&step=1"), http.StatusForbidden)
	})
}

func getStepTraces(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnelStepTraces, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/traces?"+query, "", userID, appID.String(), funnelID.String())
}

type stepTracesPage struct {
	Results []measure.FunnelStepTrace `json:"results"`
	Meta    struct {
		Next     bool `json:"next"`
		Previous bool `json:"previous"`
	} `json:"meta"`
}

// stepTraceRows turns each span name on the page into one string of its
// name, instances, drop-offs, conversions and the drop-off and conversion
// durations, with "-" for a missing duration, so a test can compare the page
// in one assertion.
func stepTraceRows(page stepTracesPage) []string {
	duration := func(ms *float64) string {
		if ms == nil {
			return "-"
		}
		return fmt.Sprint(*ms)
	}
	rows := []string{}
	for _, stepTrace := range page.Results {
		rows = append(rows, fmt.Sprintf("%s %d %d %d %s %s", stepTrace.SpanName, stepTrace.Count, stepTrace.Dropped, stepTrace.Converted, duration(stepTrace.DroppedDurationMs), duration(stepTrace.ConvertedDurationMs)))
	}
	return rows
}

// seedInstallationSpan sends one root span from an installation.
func seedInstallationSpan(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, installationID, appVersion, spanName string, at time.Time, duration time.Duration) {
	t.Helper()
	th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
		SpanName:       spanName,
		InstallationID: installationID,
		AppVersion:     appVersion,
		StartTime:      at,
		Duration:       duration,
	})
}

func TestGetFunnelStepTraces(t *testing.T) {
	ctx := context.Background()
	start := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Second)
	lastTwoDays := rangeQuery(start.Add(-24*time.Hour), start.Add(24*time.Hour))

	// Seeds a three-step funnel with a one-hour window, where installations
	// record root spans at different points.
	seed := func(t *testing.T) (string, uuid.UUID, measure.Funnel) {
		t.Helper()
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		// Checks out and searches before moving into add_to_cart.
		converted := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", 2 * time.Minute})
		seedInstallationSpan(ctx, t, teamID, appID, converted, "", "checkout", start.Add(time.Minute), time.Second)
		seedInstallationSpan(ctx, t, teamID, appID, converted, "", "search", start.Add(30*time.Second), 500*time.Millisecond)
		// Checks out twice, slower than the converted installation, searches
		// and loads recommendations, then drops off.
		dropped := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationSpan(ctx, t, teamID, appID, dropped, "", "checkout", start.Add(time.Minute), 3*time.Second)
		seedInstallationSpan(ctx, t, teamID, appID, dropped, "", "checkout", start.Add(5*time.Minute), time.Second)
		seedInstallationSpan(ctx, t, teamID, appID, dropped, "", "search", start.Add(2*time.Minute), 600*time.Millisecond)
		seedInstallationSpan(ctx, t, teamID, appID, dropped, "", "recommendations", start.Add(3*time.Minute), 800*time.Millisecond)
		// A child span is left out.
		th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
			SpanName:       "checkout_request",
			ParentID:       strings.Repeat("e", 16),
			InstallationID: dropped,
			StartTime:      start.Add(time.Minute),
		})
		// Checks out before entering the funnel and after its conversion window.
		outside := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationSpan(ctx, t, teamID, appID, outside, "", "checkout", start.Add(-time.Minute), time.Second)
		seedInstallationSpan(ctx, t, teamID, appID, outside, "", "checkout", start.Add(61*time.Minute), time.Second)
		// Loads recommendations, then drops off.
		seedInstallationSpan(ctx, t, teamID, appID, outside, "", "recommendations", start.Add(10*time.Minute), 800*time.Millisecond)
		// Checks out after moving into add_to_cart, then drops off before purchase.
		later := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		seedInstallationSpan(ctx, t, teamID, appID, later, "", "checkout", start.Add(2*time.Minute), 2*time.Second)
		return userID, appID, funnel
	}

	t.Run("lists the root spans between two steps, most drop-offs first", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		w := getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepTracesPage](t, w)
		expectPoints(t, stepTraceRows(page),
			"recommendations 2 2 0 800 -",
			"checkout 3 1 1 2000 1000",
			"search 2 1 1 600 500")
		if page.Meta.Next || page.Meta.Previous {
			t.Fatalf("meta = %+v, want no other pages", page.Meta)
		}

		w = getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p99")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepTraceRows(decodeBody[stepTracesPage](t, w)),
			"recommendations 2 2 0 800 -",
			"checkout 3 1 1 2980 1000",
			"search 2 1 1 600 500")

		w = getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&step=2&quantile=p50")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepTraceRows(decodeBody[stepTracesPage](t, w)),
			"checkout 1 1 0 2000 -")
	})

	t.Run("lists the root spans across the whole funnel when no step is given", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		// Checks out between add_to_cart and purchase, and again after purchase.
		finished := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 3 * time.Minute})
		seedInstallationSpan(ctx, t, teamID, appID, finished, "", "checkout", start.Add(2*time.Minute), 2*time.Second)
		seedInstallationSpan(ctx, t, teamID, appID, finished, "", "checkout", start.Add(4*time.Minute), time.Second)
		// Checks out after add_to_cart, and again after its conversion window.
		quit := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		seedInstallationSpan(ctx, t, teamID, appID, quit, "", "checkout", start.Add(30*time.Minute), 4*time.Second)
		seedInstallationSpan(ctx, t, teamID, appID, quit, "", "checkout", start.Add(61*time.Minute), time.Second)

		w := getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&quantile=p50")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepTraceRows(decodeBody[stepTracesPage](t, w)),
			"checkout 2 1 1 4000 2000")
	})

	t.Run("lists only the spans that match the filter", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart")

		// Enters on 2.0, then updates to 2.1 and searches there.
		updated := seedInstallationEvents(ctx, t, teamID, appID, "2.0", start, funnelEvent{"app_open", 0})
		seedInstallationSpan(ctx, t, teamID, appID, updated, "2.0", "checkout", start.Add(time.Minute), time.Second)
		seedInstallationSpan(ctx, t, teamID, appID, updated, "2.1", "search", start.Add(2*time.Minute), time.Second)

		w := getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50&filter_expr="+url.QueryEscape("version_name:in:2.0"))
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepTraceRows(decodeBody[stepTracesPage](t, w)),
			"checkout 1 1 0 1000 -")
	})

	t.Run("pages through the spans", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		w := getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50&limit=1&offset=1")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepTracesPage](t, w)
		expectPoints(t, stepTraceRows(page), "checkout 3 1 1 2000 1000")
		if !page.Meta.Next || !page.Meta.Previous {
			t.Fatalf("meta = %+v, want a next and a previous page", page.Meta)
		}
	})

	t.Run("rejects a step outside the funnel's transitions", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		for _, query := range []string{"&step=", "&step=0", "&step=3", "&step=one"} {
			expectError(t, getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&quantile=p50"+query), http.StatusBadRequest, "step must be between 1 and 2")
		}
	})

	t.Run("rejects an unknown quantile", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		for _, query := range []string{"", "&quantile=p75", "&quantile=0.5"} {
			expectError(t, getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&step=1"+query), http.StatusBadRequest, "quantile must be one of p50, p90, p95 or p99")
		}
	})

	t.Run("forbids users outside the app's team", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID, funnel := seed(t)
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, getStepTraces(outsiderID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50"), http.StatusForbidden)
	})
}

func getStepNetwork(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnelStepNetwork, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/network?"+query, "", userID, appID.String(), funnelID.String())
}

type stepNetworkPage struct {
	Results []measure.FunnelStepEndpoint `json:"results"`
	Meta    struct {
		Next     bool `json:"next"`
		Previous bool `json:"previous"`
	} `json:"meta"`
}

// stepEndpointRows turns each URL pattern on the page into one string of its
// domain, path pattern, requests, drop-offs, conversions and the drop-off and
// conversion latencies, with "-" for a missing latency, so a test can compare
// the page in one assertion.
func stepEndpointRows(page stepNetworkPage) []string {
	latency := func(ms *float64) string {
		if ms == nil {
			return "-"
		}
		return fmt.Sprint(*ms)
	}
	rows := []string{}
	for _, stepEndpoint := range page.Results {
		rows = append(rows, fmt.Sprintf("%s%s %d %d %d %s %s", stepEndpoint.Domain, stepEndpoint.PathPattern, stepEndpoint.Count, stepEndpoint.Dropped, stepEndpoint.Converted, latency(stepEndpoint.DroppedLatencyMs), latency(stepEndpoint.ConvertedLatencyMs)))
	}
	return rows
}

// seedInstallationRequest sends one network request from an installation,
// with a status code of 0 for a request that got no response.
func seedInstallationRequest(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, installationID, appVersion, url string, statusCode int, at time.Time, latency time.Duration) {
	t.Helper()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type:           "http",
		InstallationID: installationID,
		AppVersion:     appVersion,
		Timestamp:      at,
		HttpURL:        url,
		HttpMethod:     "get",
		HttpStatusCode: statusCode,
		HttpStartTime:  uint64(at.UnixMilli()),
		HttpEndTime:    uint64(at.Add(latency).UnixMilli()),
	})
}

func TestGetFunnelStepNetwork(t *testing.T) {
	ctx := context.Background()
	start := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Second)
	lastTwoDays := rangeQuery(start.Add(-24*time.Hour), start.Add(24*time.Hour))
	const api = "https://api.shop.com"

	seedPatterns := func(t *testing.T, teamID, appID uuid.UUID) {
		t.Helper()
		for _, path := range []string{"/products/*", "/cart", "/recommendations"} {
			th.SeedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.shop.com", path)
		}
	}

	// Seeds a three-step funnel with a one-hour window, where installations
	// make network requests at different points.
	seed := func(t *testing.T) (string, uuid.UUID, measure.Funnel) {
		t.Helper()
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedPatterns(t, teamID, appID)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		// Loads a product and the cart before moving into add_to_cart.
		converted := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", 2 * time.Minute})
		seedInstallationRequest(ctx, t, teamID, appID, converted, "", api+"/products/1", 200, start.Add(time.Minute), time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, converted, "", api+"/cart", 200, start.Add(30*time.Second), 500*time.Millisecond)
		// Loads two products, slower than the converted installation, the
		// cart and recommendations, then drops off.
		dropped := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationRequest(ctx, t, teamID, appID, dropped, "", api+"/products/2", 200, start.Add(time.Minute), 3*time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, dropped, "", api+"/products/3", 200, start.Add(5*time.Minute), time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, dropped, "", api+"/cart", 200, start.Add(2*time.Minute), 600*time.Millisecond)
		seedInstallationRequest(ctx, t, teamID, appID, dropped, "", api+"/recommendations", 200, start.Add(3*time.Minute), 800*time.Millisecond)
		// A request that matches no pattern, one that got no response and one
		// that took over a minute are left out.
		seedInstallationRequest(ctx, t, teamID, appID, dropped, "", api+"/unknown", 200, start.Add(3*time.Minute), time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, dropped, "", api+"/cart", 0, start.Add(4*time.Minute), time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, dropped, "", api+"/cart", 200, start.Add(4*time.Minute), 90*time.Second)
		// Loads a product before entering the funnel and after its conversion
		// window, and recommendations in between, then drops off.
		outside := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		seedInstallationRequest(ctx, t, teamID, appID, outside, "", api+"/products/4", 200, start.Add(-time.Minute), time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, outside, "", api+"/products/4", 200, start.Add(61*time.Minute), time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, outside, "", api+"/recommendations", 200, start.Add(10*time.Minute), 800*time.Millisecond)
		// Loads a product after moving into add_to_cart, then drops off before
		// purchase.
		later := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		seedInstallationRequest(ctx, t, teamID, appID, later, "", api+"/products/5", 200, start.Add(2*time.Minute), 2*time.Second)
		return userID, appID, funnel
	}

	t.Run("lists the URL patterns requested between two steps, most drop-offs first", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		w := getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepNetworkPage](t, w)
		expectPoints(t, stepEndpointRows(page),
			"api.shop.com/recommendations 2 2 0 800 -",
			"api.shop.com/products/* 3 1 1 2000 1000",
			"api.shop.com/cart 2 1 1 600 500")
		if page.Meta.Next || page.Meta.Previous {
			t.Fatalf("meta = %+v, want no other pages", page.Meta)
		}

		w = getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p99")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepEndpointRows(decodeBody[stepNetworkPage](t, w)),
			"api.shop.com/recommendations 2 2 0 800 -",
			"api.shop.com/products/* 3 1 1 2980 1000",
			"api.shop.com/cart 2 1 1 600 500")

		w = getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&step=2&quantile=p50")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepEndpointRows(decodeBody[stepNetworkPage](t, w)),
			"api.shop.com/products/* 1 1 0 2000 -")
	})

	t.Run("lists the URL patterns requested across the whole funnel when no step is given", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedPatterns(t, teamID, appID)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		// Loads the cart between add_to_cart and purchase, and again after
		// purchase.
		finished := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 3 * time.Minute})
		seedInstallationRequest(ctx, t, teamID, appID, finished, "", api+"/cart", 200, start.Add(2*time.Minute), 500*time.Millisecond)
		seedInstallationRequest(ctx, t, teamID, appID, finished, "", api+"/cart", 200, start.Add(4*time.Minute), time.Second)
		// Loads the cart after add_to_cart, and again after its conversion
		// window.
		quit := seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		seedInstallationRequest(ctx, t, teamID, appID, quit, "", api+"/cart", 200, start.Add(30*time.Minute), 700*time.Millisecond)
		seedInstallationRequest(ctx, t, teamID, appID, quit, "", api+"/cart", 200, start.Add(61*time.Minute), time.Second)

		w := getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&quantile=p50")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepEndpointRows(decodeBody[stepNetworkPage](t, w)),
			"api.shop.com/cart 2 1 1 700 500")
	})

	t.Run("lists only the requests that match the filter", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedPatterns(t, teamID, appID)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart")

		// Enters on 2.0, then updates to 2.1 and loads the cart there.
		updated := seedInstallationEvents(ctx, t, teamID, appID, "2.0", start, funnelEvent{"app_open", 0})
		seedInstallationRequest(ctx, t, teamID, appID, updated, "2.0", api+"/products/1", 200, start.Add(time.Minute), time.Second)
		seedInstallationRequest(ctx, t, teamID, appID, updated, "2.1", api+"/cart", 200, start.Add(2*time.Minute), time.Second)

		w := getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50&filter_expr="+url.QueryEscape("version_name:in:2.0"))
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepEndpointRows(decodeBody[stepNetworkPage](t, w)),
			"api.shop.com/products/* 1 1 0 1000 -")
	})

	t.Run("pages through the URL patterns", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		w := getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50&limit=1&offset=1")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepNetworkPage](t, w)
		expectPoints(t, stepEndpointRows(page), "api.shop.com/products/* 3 1 1 2000 1000")
		if !page.Meta.Next || !page.Meta.Previous {
			t.Fatalf("meta = %+v, want a next and a previous page", page.Meta)
		}
	})

	t.Run("rejects a step outside the funnel's transitions", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		for _, query := range []string{"&step=", "&step=0", "&step=3", "&step=one"} {
			expectError(t, getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&quantile=p50"+query), http.StatusBadRequest, "step must be between 1 and 2")
		}
	})

	t.Run("rejects an unknown quantile", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel := seed(t)

		for _, query := range []string{"", "&quantile=p75", "&quantile=0.5"} {
			expectError(t, getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&step=1"+query), http.StatusBadRequest, "quantile must be one of p50, p90, p95 or p99")
		}
	})

	t.Run("forbids users outside the app's team", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID, funnel := seed(t)
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, getStepNetwork(outsiderID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50"), http.StatusForbidden)
	})
}

func getStepSessions(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnelStepSessions, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/sessions?"+query, "", userID, appID.String(), funnelID.String())
}

type stepSessionsPage struct {
	Results []measure.FunnelStepSession `json:"results"`
	Meta    struct {
		Next     bool `json:"next"`
		Previous bool `json:"previous"`
	} `json:"meta"`
}

// stepSessionRows turns each session on the page into one string of its
// label, its installation's label, its user id, its start as an offset from
// start and its duration, so a test can compare the page in one assertion.
func stepSessionRows(page stepSessionsPage, labels map[string]string, start time.Time) []string {
	rows := []string{}
	for _, stepSession := range page.Results {
		rows = append(rows, fmt.Sprintf("%s %s %q %s %d", labels[stepSession.SessionID.String()], labels[stepSession.InstallationID.String()], stepSession.UserID, stepSession.FirstEventTime.Sub(start), stepSession.DurationMs))
	}
	return rows
}

// seedSessionEvent sends one event of an installation's session, a custom
// event when name is set and a session start otherwise.
func seedSessionEvent(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, installationID, sessionID, appVersion, userID, name string, at time.Time) {
	t.Helper()
	eventType := "custom"
	if name == "" {
		eventType = "session_start"
	}
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type:           eventType,
		CustomName:     name,
		SessionID:      sessionID,
		InstallationID: installationID,
		AppVersion:     appVersion,
		UserID:         userID,
		Timestamp:      at,
	})
}

func TestGetFunnelStepSessions(t *testing.T) {
	ctx := context.Background()
	start := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Second)
	lastTwoDays := rangeQuery(start.Add(-24*time.Hour), start.Add(24*time.Hour))

	// Seeds a three-step funnel with a one-hour window and two installations
	// on different versions, labelling each installation and session.
	seed := func(t *testing.T) (string, uuid.UUID, measure.Funnel, map[string]string) {
		t.Helper()
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")
		labels := map[string]string{}
		label := func(name string) string {
			id := uuid.NewString()
			labels[id] = name
			return id
		}

		// Opens the app in one session and adds to the cart in the next,
		// signing in there, then browses after adding to the cart.
		a, a1, a2, a3 := label("a"), label("a1"), label("a2"), label("a3")
		seedSessionEvent(ctx, t, teamID, appID, a, a1, "1.0", "", "app_open", start)
		seedSessionEvent(ctx, t, teamID, appID, a, a1, "1.0", "", "browse", start.Add(time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, a, a2, "1.0", "user-a", "add_to_cart", start.Add(10*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, a, a2, "1.0", "user-a", "browse", start.Add(12*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, a, a3, "1.0", "user-a", "browse", start.Add(30*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, a, a3, "1.0", "user-a", "browse", start.Add(31*time.Minute))
		// Opens the app and drops off, with a session inside its conversion
		// window, one that only started and one after the window.
		b, b1, b2, b3, b4 := label("b"), label("b1"), label("b2"), label("b3"), label("b4")
		seedSessionEvent(ctx, t, teamID, appID, b, b1, "2.0", "", "app_open", start.Add(5*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, b, b1, "2.0", "", "browse", start.Add(6*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, b, b2, "2.0", "", "browse", start.Add(40*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, b, b2, "2.0", "", "browse", start.Add(41*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, b, b3, "2.0", "", "", start.Add(50*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, b, b4, "2.0", "", "browse", start.Add(70*time.Minute))
		seedSessionEvent(ctx, t, teamID, appID, b, b4, "2.0", "", "browse", start.Add(71*time.Minute))
		return userID, appID, funnel, labels
	}

	t.Run("lists the sessions of installations that converted or dropped off between two steps", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel, labels := seed(t)

		w := getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&step=1&outcome=converted")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepSessionsPage](t, w)
		expectPoints(t, stepSessionRows(page, labels, start),
			`a1 a "" 0s 60000`,
			`a2 a "user-a" 10m0s 120000`)
		if page.Meta.Next || page.Meta.Previous {
			t.Fatalf("meta = %+v, want no other pages", page.Meta)
		}

		w = getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&step=1&outcome=dropped")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepSessionRows(decodeBody[stepSessionsPage](t, w), labels, start),
			`b1 b "" 5m0s 60000`,
			`b2 b "" 40m0s 60000`)
	})

	t.Run("lists the sessions across the whole funnel when no step is given, the latest attempts first", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel, labels := seed(t)

		w := getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&outcome=dropped")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepSessionRows(decodeBody[stepSessionsPage](t, w), labels, start),
			`b1 b "" 5m0s 60000`,
			`b2 b "" 40m0s 60000`,
			`a1 a "" 0s 60000`,
			`a2 a "user-a" 10m0s 120000`,
			`a3 a "user-a" 30m0s 60000`)

		w = getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&outcome=converted")
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepSessionRows(decodeBody[stepSessionsPage](t, w), labels, start))
	})

	t.Run("lists only the sessions that match the filter", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel, labels := seed(t)

		w := getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&outcome=dropped&filter_expr="+url.QueryEscape("version_name:in:2.0"))
		expectStatus(t, w, http.StatusOK)
		expectPoints(t, stepSessionRows(decodeBody[stepSessionsPage](t, w), labels, start),
			`b1 b "" 5m0s 60000`,
			`b2 b "" 40m0s 60000`)
	})

	t.Run("pages through the sessions", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel, labels := seed(t)

		w := getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&outcome=dropped&limit=1&offset=1")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[stepSessionsPage](t, w)
		expectPoints(t, stepSessionRows(page, labels, start), `b2 b "" 40m0s 60000`)
		if !page.Meta.Next || !page.Meta.Previous {
			t.Fatalf("meta = %+v, want a next and a previous page", page.Meta)
		}
	})

	t.Run("rejects a step outside the funnel's transitions", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel, _ := seed(t)

		for _, query := range []string{"&step=", "&step=0", "&step=3", "&step=one"} {
			expectError(t, getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&outcome=dropped"+query), http.StatusBadRequest, "step must be between 1 and 2")
		}
	})

	t.Run("rejects a missing or unknown outcome", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID, funnel, _ := seed(t)

		for _, query := range []string{"", "&outcome=", "&outcome=both"} {
			expectError(t, getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&step=1"+query), http.StatusBadRequest, "outcome must be one of dropped or converted")
		}
	})

	t.Run("forbids users outside the app's team", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, appID, funnel, _ := seed(t)
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, getStepSessions(outsiderID, appID, funnel.ID, lastTwoDays+"&step=1&outcome=dropped"), http.StatusForbidden)
	})
}

func TestFunnelStepListsAccess(t *testing.T) {
	ctx := context.Background()
	start := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Second)
	lastTwoDays := rangeQuery(start.Add(-24*time.Hour), start.Add(24*time.Hour))

	stepLists := []struct {
		name  string
		get   func(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder
		query string
	}{
		{"errors", getStepErrors, lastTwoDays},
		{"traces", getStepTraces, lastTwoDays + "&quantile=p95"},
		{"network", getStepNetwork, lastTwoDays + "&quantile=p95"},
		{"sessions", getStepSessions, lastTwoDays + "&outcome=dropped"},
	}

	t.Run("every role can read the step lists", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, appID := seedFunnelApp(ctx, t, tc.role)
				funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

				for _, stepList := range stepLists {
					expectStatus(t, stepList.get(userID, appID, funnel.ID, stepList.query), http.StatusOK)
				}
			})
		}
	})

	t.Run("an unknown funnel or one from another app is not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		otherFunnel := seedFunnel(ctx, t, otherAppID, userID, "Other")

		for _, stepList := range stepLists {
			t.Run(stepList.name, func(t *testing.T) {
				expectError(t, stepList.get(userID, appID, uuid.New(), stepList.query), http.StatusNotFound, "Funnel not found")
				expectError(t, stepList.get(userID, appID, otherFunnel.ID, stepList.query), http.StatusNotFound, "Funnel not found")
			})
		}
	})
}

func TestFunnelEndpointsRejectInvalidIDs(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	userID, appID := seedFunnelApp(ctx, t, "owner")
	lastDay := rangeQuery(time.Now().Add(-24*time.Hour), time.Now())

	t.Run("an invalid funnel id is a bad request", func(t *testing.T) {
		for _, endpoint := range []struct {
			name    string
			handler gin.HandlerFunc
			method  string
			query   string
		}{
			{"update", h.UpdateFunnel, "PATCH", ""},
			{"delete", h.DeleteFunnel, "DELETE", ""},
			{"pin", h.PinFunnel, "PUT", ""},
			{"unpin", h.UnpinFunnel, "DELETE", ""},
			{"conversion", h.GetFunnelConversion, "GET", lastDay},
			{"trend", h.GetFunnelTrend, "GET", "period=day&timezone=UTC"},
			{"cadence", h.GetFunnelCadence, "GET", "weeks=4&timezone=UTC"},
			{"errors", h.GetFunnelStepErrors, "GET", lastDay},
			{"traces", h.GetFunnelStepTraces, "GET", lastDay},
			{"network", h.GetFunnelStepNetwork, "GET", lastDay},
			{"sessions", h.GetFunnelStepSessions, "GET", lastDay + "&outcome=dropped"},
		} {
			t.Run(endpoint.name, func(t *testing.T) {
				w := serveFunnel(endpoint.handler, endpoint.method, "/apps/"+appID.String()+"/funnels/not-a-uuid?"+endpoint.query, validFunnelBody, userID, appID.String(), "not-a-uuid")
				expectError(t, w, http.StatusBadRequest, "funnel id invalid or missing")
			})
		}
	})

	t.Run("an invalid app id is a bad request", func(t *testing.T) {
		for _, endpoint := range []struct {
			name    string
			handler gin.HandlerFunc
			method  string
		}{
			{"list", h.GetFunnels, "GET"},
			{"event names", h.SuggestFunnelEventNames, "GET"},
			{"pinned", h.GetPinnedFunnels, "GET"},
			{"reorder", h.ReorderPinnedFunnels, "PUT"},
			{"update", h.UpdateFunnel, "PATCH"},
		} {
			t.Run(endpoint.name, func(t *testing.T) {
				w := serveFunnel(endpoint.handler, endpoint.method, "/apps/not-a-uuid/funnels", `{"funnel_ids":[]}`, userID, "not-a-uuid", uuid.NewString())
				expectError(t, w, http.StatusBadRequest, "app id invalid or missing")
			})
		}
	})
}

func getTrend(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnelTrend, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/trend?"+query, "", userID, appID.String(), funnelID.String())
}

func fetchTrend(t *testing.T, userID string, appID, funnelID uuid.UUID, query string) measure.FunnelTrend {
	t.Helper()
	w := getTrend(userID, appID, funnelID, query)
	expectStatus(t, w, http.StatusOK)
	return decodeBody[measure.FunnelTrend](t, w)
}

// enteredPoints turns each trend point that installations entered into one
// string of its date, the installation count at each step and the median
// seconds to convert, such as "2026-10-12 2/1 90", with "-" when the point has
// no median, so a test can compare the points in one assertion.
func enteredPoints(trend measure.FunnelTrend) []string {
	points := []string{}
	for _, point := range trend.Points {
		if point.Steps[0].Users == 0 {
			continue
		}
		users := make([]string, len(point.Steps))
		for i, step := range point.Steps {
			users[i] = fmt.Sprint(step.Users)
		}
		median := "-"
		if point.MedianSecondsToConvert != nil {
			median = fmt.Sprintf("%g", *point.MedianSecondsToConvert)
		}
		points = append(points, fmt.Sprintf("%s %s %s", point.Datetime, strings.Join(users, "/"), median))
	}
	return points
}

func expectPoints(t *testing.T, got []string, want ...string) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Fatalf("points = %q, want %q", got, want)
	}
}

func TestGetFunnelTrend(t *testing.T) {
	ctx := context.Background()
	today := time.Now().UTC().Truncate(24 * time.Hour)
	yesterday := today.AddDate(0, 0, -1)
	twoDaysAgo := today.AddDate(0, 0, -2)
	daily := "period=day&timezone=UTC"

	t.Run("returns the step names and the last 30 days with each step's users and medians", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", yesterday, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 3 * time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", yesterday, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", 3 * time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", today, funnelEvent{"app_open", 0})

		trend := fetchTrend(t, userID, appID, funnel.ID, daily)
		if !slices.Equal(trend.EventNames, []string{"app_open", "add_to_cart", "purchase"}) {
			t.Fatalf("event names = %v, want app_open, add_to_cart and purchase", trend.EventNames)
		}
		if len(trend.Points) != 30 {
			t.Fatalf("points = %d, want 30", len(trend.Points))
		}
		if first, last := trend.Points[0].Datetime, trend.Points[29].Datetime; first != today.AddDate(0, 0, -29).Format(time.DateOnly) || last != today.Format(time.DateOnly) {
			t.Fatalf("points run from %s to %s, want the 30 days up to today", first, last)
		}
		expectPoints(t, enteredPoints(trend), yesterday.Format(time.DateOnly)+" 2/2/1 180", today.Format(time.DateOnly)+" 1/0/0 -")
		steps := trend.Points[28].Steps
		if steps[0].MedianSecondsFromPrevious != nil || *steps[1].MedianSecondsFromPrevious != 120 || *steps[2].MedianSecondsFromPrevious != 120 {
			t.Fatalf("yesterday's step medians = %v, %v, %v, want none, 120 and 120", steps[0].MedianSecondsFromPrevious, steps[1].MedianSecondsFromPrevious, steps[2].MedianSecondsFromPrevious)
		}
	})

	t.Run("counts an installation in each period it entered, with later steps after the period's end", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "purchase")

		// Enters a minute before midnight and converts two minutes later, in
		// the next day.
		seedInstallationEvents(ctx, t, teamID, appID, "", yesterday, funnelEvent{"app_open", -time.Minute}, funnelEvent{"purchase", time.Minute})
		// The purchase is outside the window of the first day's app_open, and
		// the second day's app_open does not start a path for the first day.
		seedInstallationEvents(ctx, t, teamID, appID, "", twoDaysAgo, funnelEvent{"app_open", time.Hour}, funnelEvent{"app_open", 25 * time.Hour}, funnelEvent{"purchase", 26 * time.Hour})

		expectPoints(t, enteredPoints(fetchTrend(t, userID, appID, funnel.ID, daily)),
			twoDaysAgo.Format(time.DateOnly)+" 2/1 120", yesterday.Format(time.DateOnly)+" 1/1 3600")
	})

	t.Run("marks the periods within a conversion window of now as incomplete", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "purchase")

		trend := fetchTrend(t, userID, appID, funnel.ID, daily)
		for i, point := range trend.Points {
			if want := i < 28; point.Complete != want {
				t.Fatalf("point %s complete = %t, want %t", point.Datetime, point.Complete, want)
			}
		}
	})

	t.Run("starts weeks on Monday and months on the first", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		monday := today.AddDate(0, 0, -(int(today.Weekday())+6)%7)
		firstOfMonth := today.AddDate(0, 0, 1-today.Day())

		for _, tc := range []struct {
			period string
			last   time.Time
			step   func(time.Time) time.Time
		}{
			{"week", monday, func(t time.Time) time.Time { return t.AddDate(0, 0, -7) }},
			{"month", firstOfMonth, func(t time.Time) time.Time { return t.AddDate(0, -1, 0) }},
		} {
			trend := fetchTrend(t, userID, appID, funnel.ID, "period="+tc.period+"&timezone=UTC")
			if len(trend.Points) != 12 {
				t.Fatalf("%s: points = %d, want 12", tc.period, len(trend.Points))
			}
			start := tc.last
			for i := 11; i >= 0; i-- {
				if got := trend.Points[i].Datetime; got != start.Format(time.DateOnly) {
					t.Fatalf("%s: point %d = %s, want %s", tc.period, i, got, start.Format(time.DateOnly))
				}
				start = tc.step(start)
			}
		}
	})

	t.Run("splits periods in the requested time zone", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "purchase")

		// 20:00 UTC is 01:30 the next day in Kolkata.
		seedInstallationEvents(ctx, t, teamID, appID, "", yesterday.Add(20*time.Hour), funnelEvent{"app_open", 0})

		expectPoints(t, enteredPoints(fetchTrend(t, userID, appID, funnel.ID, daily)), yesterday.Format(time.DateOnly)+" 1/0 -")
		expectPoints(t, enteredPoints(fetchTrend(t, userID, appID, funnel.ID, "period=day&timezone=Asia/Kolkata")), today.Format(time.DateOnly)+" 1/0 -")
	})

	t.Run("counts only events matching the filter", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "1.0.0", yesterday, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "2.0.0", yesterday, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "1.0.0", yesterday, funnelEvent{"app_open", 0})

		expectPoints(t, enteredPoints(fetchTrend(t, userID, appID, funnel.ID, daily+"&filter_expr="+url.QueryEscape("version_name:in:1.0.0"))),
			yesterday.Format(time.DateOnly)+" 2/1 60")
	})

	t.Run("counts only events from sessions with the custom attribute, whatever the date range", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "purchase")

		seedPlanEvents(ctx, t, teamID, appID, "pro", twoDaysAgo, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedPlanEvents(ctx, t, teamID, appID, "free", twoDaysAgo, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})

		expectPoints(t, enteredPoints(fetchTrend(t, userID, appID, funnel.ID, daily+"&"+rangeQuery(today, today.Add(time.Hour))+"&filter_expr="+url.QueryEscape("custom.plan:in:pro"))),
			twoDaysAgo.Format(time.DateOnly)+" 1/1 60")
	})

	t.Run("returns builds first uploaded in the trend, only with the builds param", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		patchID := uuid.NewString()

		seedBuildMappingRow(ctx, t, uuid.New(), appID, "1.0.0", "100", "proguard", today.AddDate(0, 0, -40))
		seedBuildMappingRow(ctx, t, uuid.New(), appID, "2.0.0", "200", "proguard", twoDaysAgo)
		seedBuildMappingRow(ctx, t, uuid.New(), appID, "2.0.0", "200", "elf_debug", yesterday)
		th.SeedBuildMappingRow(ctx, t, uuid.NewString(), appID.String(), "", "", "jsbundle", "test/patch", patchID, "p1", yesterday)
		th.SeedBuildMappingRow(ctx, t, uuid.NewString(), appID.String(), "3.0.0", "300", "proguard", "", uuid.Nil.String(), "", yesterday)

		if builds := fetchTrend(t, userID, appID, funnel.ID, daily).Builds; len(builds) != 0 {
			t.Fatalf("builds = %+v, want none without the builds param", builds)
		}

		got := []string{}
		for _, build := range fetchTrend(t, userID, appID, funnel.ID, daily+"&builds=true").Builds {
			patch := "-"
			if build.PatchID != nil {
				patch = *build.PatchID + " " + *build.PatchVersion
			}
			got = append(got, fmt.Sprintf("%s %s %s %s", build.VersionName, build.VersionCode, patch, build.UploadedAt.UTC().Format(time.DateOnly)))
		}
		want := []string{
			"2.0.0 200 - " + twoDaysAgo.Format(time.DateOnly),
			"  " + patchID + " p1 " + yesterday.Format(time.DateOnly),
		}
		if !slices.Equal(got, want) {
			t.Fatalf("builds = %q, want %q", got, want)
		}
	})

	t.Run("rejects a missing or unknown period and a missing time zone", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

		for _, query := range []string{"timezone=UTC", "period=year&timezone=UTC"} {
			expectError(t, getTrend(userID, appID, funnel.ID, query), http.StatusBadRequest, "period must be one of day, week or month")
		}
		expectError(t, getTrend(userID, appID, funnel.ID, "period=day"), http.StatusBadRequest, "missing required field `timezone`")
	})

	t.Run("an unknown funnel or one from another app is not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		otherFunnel := seedFunnel(ctx, t, otherAppID, userID, "Other")

		expectError(t, getTrend(userID, appID, uuid.New(), daily), http.StatusNotFound, "Funnel not found")
		expectError(t, getTrend(userID, appID, otherFunnel.ID, daily), http.StatusNotFound, "Funnel not found")
	})

	t.Run("every role can read the trend", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, tc.role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)
				funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
				seedInstallationEvents(ctx, t, teamID, appID, "", yesterday, funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})

				expectPoints(t, enteredPoints(fetchTrend(t, userID, appID, funnel.ID, daily)), yesterday.Format(time.DateOnly)+" 1/1 60")
			})
		}
	})

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, getTrend(outsiderID, appID, funnel.ID, daily), http.StatusForbidden)
	})
}

func getCadence(userID string, appID, funnelID uuid.UUID, query string) *httptest.ResponseRecorder {
	return serveFunnel(h.GetFunnelCadence, "GET", "/apps/"+appID.String()+"/funnels/"+funnelID.String()+"/cadence?"+query, "", userID, appID.String(), funnelID.String())
}

// cadenceHours fetches the funnel's cadence and turns each hour into one
// string of its weekday, hour, installation count and converted count, such
// as "1 9 2/1", so a test can compare the hours in one assertion.
func cadenceHours(t *testing.T, userID string, appID, funnelID uuid.UUID, query string) []string {
	t.Helper()
	w := getCadence(userID, appID, funnelID, query)
	expectStatus(t, w, http.StatusOK)
	hours := []string{}
	for _, hour := range decodeBody[measure.FunnelCadence](t, w).Hours {
		hours = append(hours, fmt.Sprintf("%d %d %d/%d", hour.Weekday, hour.Hour, hour.Users, hour.Converted))
	}
	return hours
}

func expectHours(t *testing.T, got []string, want ...string) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Fatalf("hours = %q, want %q", got, want)
	}
}

func TestGetFunnelCadence(t *testing.T) {
	ctx := context.Background()
	// The handler picks its weeks from the current time and the funnel's
	// conversion window. The events are seeded inside those weeks. The test and
	// the handler read the clock a few seconds apart. If the weeks move forward
	// in between, the events fall outside the handler's weeks and the test
	// fails. Running it again passes.
	lastMonday, thisMonday := measure.FunnelCadenceWeeks(time.Now().UTC(), time.Hour, 1)
	oneWeek := "weeks=1&timezone=UTC"

	t.Run("counts installations by the weekday and hour they entered, and how many converted", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", lastMonday.Add(9*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 2 * time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", lastMonday.Add(9*time.Hour+30*time.Minute), funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", lastMonday.AddDate(0, 0, 2).Add(14*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute}, funnelEvent{"purchase", 2 * time.Minute})

		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek), "1 9 2/1", "3 14 1/1")
	})

	t.Run("counts an installation once, in the hour of the path it converted on", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "purchase")

		// The purchase is outside the window of the 08:00 app_open.
		seedInstallationEvents(ctx, t, teamID, appID, "", lastMonday.Add(8*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"app_open", 3 * time.Hour}, funnelEvent{"purchase", 3*time.Hour + time.Minute})

		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek), "1 11 1/1")
	})

	t.Run("covers whole weeks up to the start of the current week", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "", thisMonday, funnelEvent{"app_open", 0})
		seedInstallationEvents(ctx, t, teamID, appID, "", lastMonday.Add(-time.Hour), funnelEvent{"app_open", 0})
		seedInstallationEvents(ctx, t, teamID, appID, "", lastMonday.Add(time.Hour), funnelEvent{"app_open", 0})

		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek), "1 1 1/0")
		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, "weeks=2&timezone=UTC"), "1 1 1/0", "7 23 1/0")
	})

	t.Run("returns the weeks it counted", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "purchase")

		w := getCadence(userID, appID, funnel.ID, "weeks=2&timezone=UTC")
		expectStatus(t, w, http.StatusOK)
		cadence := decodeBody[measure.FunnelCadence](t, w)
		if !cadence.From.Equal(lastMonday.AddDate(0, 0, -7)) || !cadence.To.Equal(thisMonday) {
			t.Fatalf("weeks = %v to %v, want %v to %v", cadence.From, cadence.To, lastMonday.AddDate(0, 0, -7), thisMonday)
		}
	})

	t.Run("ends at the latest week that has had a full conversion window", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 7*86400, "app_open", "purchase")

		from, to := measure.FunnelCadenceWeeks(time.Now().UTC(), 7*24*time.Hour, 1)
		seedInstallationEvents(ctx, t, teamID, appID, "", from.Add(9*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", to.Add(9*time.Hour), funnelEvent{"app_open", 0})

		w := getCadence(userID, appID, funnel.ID, oneWeek)
		expectStatus(t, w, http.StatusOK)
		cadence := decodeBody[measure.FunnelCadence](t, w)
		if !cadence.From.Equal(from) || !cadence.To.Equal(to) {
			t.Fatalf("weeks = %v to %v, want %v to %v", cadence.From, cadence.To, from, to)
		}
		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek), "1 9 1/1")
	})

	t.Run("places an installation that never passed the first step at its last first-step event", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart", "purchase")

		// The purchase advances no path, so it must not change where the second
		// installation is placed.
		start := lastMonday.Add(9*time.Hour + 50*time.Minute)
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"app_open", 20 * time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"purchase", 10 * time.Minute}, funnelEvent{"app_open", 20 * time.Minute})

		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek), "1 10 2/0")
	})

	t.Run("splits weekdays and hours in the requested time zone", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "purchase")

		// 20:00 UTC on Monday is 01:30 on Tuesday in Kolkata.
		seedInstallationEvents(ctx, t, teamID, appID, "", lastMonday.Add(20*time.Hour), funnelEvent{"app_open", 0})

		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek), "1 20 1/0")
		// Kolkata is ahead of UTC, so its latest counted week can start a week
		// later than UTC's. Asking for two weeks keeps the event in range.
		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, "weeks=2&timezone=Asia/Kolkata"), "2 1 1/0")
	})

	t.Run("counts only events matching the filter", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "purchase")

		seedInstallationEvents(ctx, t, teamID, appID, "1.0.0", lastMonday.Add(9*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedInstallationEvents(ctx, t, teamID, appID, "2.0.0", lastMonday.Add(9*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})

		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek+"&filter_expr="+url.QueryEscape("version_name:in:1.0.0")), "1 9 1/1")
	})

	t.Run("counts only events from sessions with the custom attribute, whatever the date range", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "purchase")

		seedPlanEvents(ctx, t, teamID, appID, "pro", lastMonday.Add(9*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})
		seedPlanEvents(ctx, t, teamID, appID, "free", lastMonday.Add(9*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})

		expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek+"&"+rangeQuery(thisMonday, thisMonday.Add(time.Hour))+"&filter_expr="+url.QueryEscape("custom.plan:in:pro")), "1 9 1/1")
	})

	t.Run("rejects a missing or out of range weeks and a missing time zone", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")

		for _, query := range []string{"timezone=UTC", "weeks=0&timezone=UTC", "weeks=13&timezone=UTC", "weeks=four&timezone=UTC"} {
			expectError(t, getCadence(userID, appID, funnel.ID, query), http.StatusBadRequest, "weeks must be between 1 and 12")
		}
		expectError(t, getCadence(userID, appID, funnel.ID, "weeks=1"), http.StatusBadRequest, "missing required field `timezone`")
	})

	t.Run("an unknown funnel or one from another app is not found", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID, otherAppID := uuid.New(), uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		seedApp(ctx, t, otherAppID, teamID, 30)
		otherFunnel := seedFunnel(ctx, t, otherAppID, userID, "Other")

		expectError(t, getCadence(userID, appID, uuid.New(), oneWeek), http.StatusNotFound, "Funnel not found")
		expectError(t, getCadence(userID, appID, otherFunnel.ID, oneWeek), http.StatusNotFound, "Funnel not found")
	})

	t.Run("every role can read the cadence", func(t *testing.T) {
		for _, tc := range funnelRoles {
			t.Run(tc.role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, tc.role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)
				funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
				from, _ := measure.FunnelCadenceWeeks(time.Now().UTC(), time.Duration(funnel.ConversionWindowSeconds)*time.Second, 1)
				seedInstallationEvents(ctx, t, teamID, appID, "", from.Add(9*time.Hour), funnelEvent{"app_open", 0}, funnelEvent{"purchase", time.Minute})

				expectHours(t, cadenceHours(t, userID, appID, funnel.ID, oneWeek), "1 9 1/1")
			})
		}
	})

	t.Run("user outside the team is denied", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, appID := seedFunnelApp(ctx, t, "owner")
		funnel := seedFunnel(ctx, t, appID, userID, "Checkout")
		outsiderID := uuid.NewString()
		seedUser(ctx, t, outsiderID, "outsider@test.com")
		expectStatus(t, getCadence(outsiderID, appID, funnel.ID, oneWeek), http.StatusForbidden)
	})
}

func TestFunnelResultCache(t *testing.T) {
	ctx := context.Background()
	start := time.Now().UTC().Add(-24 * time.Hour).Truncate(time.Second)
	lastTwoDays := rangeQuery(start.Add(-24*time.Hour), start.Add(24*time.Hour))

	t.Run("a repeated request reuses the result until the funnel's steps or window change", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "add_to_cart")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays), "app_open 1 -", "add_to_cart 1 60")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0}, funnelEvent{"add_to_cart", time.Minute})
		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays), "app_open 1 -", "add_to_cart 1 60")

		if _, err := measure.UpdateFunnel(ctx, th.PgPool, appID, funnel.ID, measure.FunnelDraft{
			Name:                    funnel.Name,
			Steps:                   funnel.Steps,
			ConversionWindowSeconds: 3600,
		}); err != nil {
			t.Fatalf("update funnel: %v", err)
		}
		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, lastTwoDays), "app_open 2 -", "add_to_cart 2 60")
	})

	t.Run("ranges ending a few minutes apart share a result within the same ten minutes", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 86400, "app_open", "add_to_cart")
		bucket := time.Now().UTC().Truncate(10 * time.Minute)
		rangeEndingAt := func(to time.Time) string { return rangeQuery(to.Add(-48*time.Hour), to) }

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, rangeEndingAt(bucket.Add(time.Minute+7*time.Second))), "app_open 1 -", "add_to_cart 0 -")

		seedInstallationEvents(ctx, t, teamID, appID, "", start, funnelEvent{"app_open", 0})
		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, rangeEndingAt(bucket.Add(2*time.Minute+31*time.Second))), "app_open 1 -", "add_to_cart 0 -")
		expectConversion(t, conversionSteps(t, userID, appID, funnel.ID, rangeEndingAt(bucket.Add(11*time.Minute+7*time.Second))), "app_open 2 -", "add_to_cart 0 -")
	})

	t.Run("every funnel query returns the same body from the cache until it is cleared", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		funnel := seedFunnelSteps(ctx, t, appID, userID, 3600, "app_open", "add_to_cart")
		crash := strings.Repeat("a", 32)
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "fatal_exception_groups", Fingerprint: crash, Type: "IllegalStateException"})
		th.SeedUrlPattern(ctx, t, teamID.String(), appID.String(), "api.example.com", "/cart")

		// Cadence only counts finished weeks, so each drop-off is also
		// seeded nine days earlier.
		dropOff := func(duration time.Duration) {
			for _, at := range []time.Time{start, start.AddDate(0, 0, -9)} {
				installationID := uuid.NewString()
				seedSessionEvent(ctx, t, teamID, appID, installationID, uuid.NewString(), "1.0", "", "app_open", at)
				seedInstallationError(ctx, t, teamID, appID, installationID, "1.0", "exception", crash, false, at.Add(time.Minute))
				seedInstallationSpan(ctx, t, teamID, appID, installationID, "1.0", "checkout", at.Add(time.Minute), duration)
				seedInstallationRequest(ctx, t, teamID, appID, installationID, "1.0", "https://api.example.com/cart", 500, at.Add(time.Minute), duration)
			}
		}
		queries := map[string]func() *httptest.ResponseRecorder{
			"conversion": func() *httptest.ResponseRecorder { return getConversion(userID, appID, funnel.ID, lastTwoDays) },
			"errors": func() *httptest.ResponseRecorder {
				return getStepErrors(userID, appID, funnel.ID, lastTwoDays+"&step=1")
			},
			"traces": func() *httptest.ResponseRecorder {
				return getStepTraces(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50")
			},
			"network": func() *httptest.ResponseRecorder {
				return getStepNetwork(userID, appID, funnel.ID, lastTwoDays+"&step=1&quantile=p50")
			},
			"sessions": func() *httptest.ResponseRecorder {
				return getStepSessions(userID, appID, funnel.ID, lastTwoDays+"&step=1&outcome=dropped")
			},
			"trend": func() *httptest.ResponseRecorder {
				return getTrend(userID, appID, funnel.ID, "period=day&timezone=UTC&builds=true")
			},
			"cadence": func() *httptest.ResponseRecorder { return getCadence(userID, appID, funnel.ID, "weeks=4&timezone=UTC") },
		}
		bodies := func() map[string]string {
			t.Helper()
			bodies := map[string]string{}
			for name, query := range queries {
				w := query()
				expectStatus(t, w, http.StatusOK)
				bodies[name] = w.Body.String()
			}
			return bodies
		}

		flush := func() {
			t.Helper()
			if err := th.VK.Do(ctx, th.VK.B().Flushall().Build()).Error(); err != nil {
				t.Fatal(err)
			}
		}

		// The trend and cadence keys can change at the start of an hour, so
		// the requests are repeated once when they run across one.
		var computed, cached, recomputed map[string]string
		for attempt := 0; attempt < 2; attempt++ {
			hour := time.Now().UTC().Truncate(time.Hour)
			flush()
			dropOff(time.Duration(4*attempt+1) * time.Second)
			computed = bodies()
			dropOff(time.Duration(4*attempt+3) * time.Second)
			cached = bodies()
			flush()
			recomputed = bodies()
			if time.Now().UTC().Truncate(time.Hour).Equal(hour) {
				break
			}
		}

		for name := range queries {
			if cached[name] != computed[name] {
				t.Errorf("%s: cached body differs from the computed one\ncomputed: %s\ncached:   %s", name, computed[name], cached[name])
			}
			if recomputed[name] == computed[name] {
				t.Errorf("%s: body did not change with the new drop-offs once the cache was cleared: %s", name, computed[name])
			}
		}
	})
}
