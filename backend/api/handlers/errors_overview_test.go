//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// The fingerprint columns are FixedString(32).
const (
	fpOverviewCrash = "0000000000000000000000000000e001"
	fpOverviewANR   = "0000000000000000000000000000e002"
)

// Events are seeded at this instant and the group rows at insert time, so
// the queried range must cover both.
var errorsOverviewTestTime = time.Now().UTC()

var anrOnlyFilterQuery = "filter_expr=" + url.QueryEscape(`error_type:in:[ANR]`)

func errorsOverviewTimeRangeQuery() string {
	from := errorsOverviewTestTime.Add(-time.Hour).Format("2006-01-02T15:04:05.000Z")
	to := errorsOverviewTestTime.Add(time.Hour).Format("2006-01-02T15:04:05.000Z")
	return "from=" + from + "&to=" + to
}

func newErrorsOverviewContext(callerID string, appID uuid.UUID, rawQuery string) (*gin.Context, *httptest.ResponseRecorder) {
	path := "/apps/" + appID.String() + "/errors"
	if rawQuery != "" {
		path += "?" + rawQuery
	}
	c, w := newTestGinContext("GET", path, nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	return c, w
}

func newErrorsPlotInstancesContext(callerID string, appID uuid.UUID, rawQuery string) (*gin.Context, *httptest.ResponseRecorder) {
	path := "/apps/" + appID.String() + "/errors/plots/instances"
	if rawQuery != "" {
		path += "?" + rawQuery
	}
	c, w := newTestGinContext("GET", path, nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	return c, w
}

func newErrorDetailErrorsContext(callerID string, appID uuid.UUID, fingerprint, rawQuery string) (*gin.Context, *httptest.ResponseRecorder) {
	path := "/apps/" + appID.String() + "/errorGroups/" + fingerprint + "/errors"
	if rawQuery != "" {
		path += "?" + rawQuery
	}
	c, w := newTestGinContext("GET", path, nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "errorGroupId", Value: fingerprint}}
	return c, w
}

// seedErrorsOverviewApp seeds one crash and one ANR with their group rows.
func seedErrorsOverviewApp(ctx context.Context, t *testing.T, teamID, appID uuid.UUID) {
	t.Helper()
	now := errorsOverviewTestTime

	seedExceptionGroup(ctx, t, teamID.String(), appID.String(), fpOverviewCrash)
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "exception", Fingerprint: fpOverviewCrash, Severity: "fatal", Timestamp: now,
	})

	seedAnrGroup(ctx, t, teamID.String(), appID.String(), fpOverviewANR)
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "anr", Fingerprint: fpOverviewANR, Timestamp: now,
	})
}

func TestGetErrorOverview(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)
	seedErrorsOverviewApp(ctx, t, teamID, appID)

	groupIDs := func(t *testing.T, rawQuery string) []string {
		t.Helper()
		c, w := newErrorsOverviewContext(ownerID, appID, rawQuery)
		h.GetErrorOverview(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}

		var body struct {
			Results []struct {
				ID string `json:"id"`
			} `json:"results"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}

		ids := make([]string, len(body.Results))
		for i, r := range body.Results {
			ids[i] = r.ID
		}
		return ids
	}

	t.Run("every error group of the app", func(t *testing.T) {
		got := groupIDs(t, errorsOverviewTimeRangeQuery())
		if len(got) != 2 {
			t.Fatalf("results = %v, want both error groups", got)
		}
	})

	t.Run("a filter expression narrows the results", func(t *testing.T) {
		got := groupIDs(t, errorsOverviewTimeRangeQuery()+"&"+anrOnlyFilterQuery)
		if len(got) != 1 || got[0] != fpOverviewANR {
			t.Errorf("results = %v, want only the anr group %q", got, fpOverviewANR)
		}
	})

	t.Run("a filter expression on a key the entity does not have is refused", func(t *testing.T) {
		c, w := newErrorsOverviewContext(ownerID, appID, errorsOverviewTimeRangeQuery()+"&filter_expr=span_status:in:error")
		h.GetErrorOverview(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}

		var body struct {
			Error  string `json:"error"`
			Issues []struct {
				Message string `json:"message"`
			} `json:"filter_expr_issues"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if body.Error != "invalid_filter_expr" || len(body.Issues) != 1 {
			t.Fatalf("want one filter expression issue, got %s", w.Body.String())
		}
		if !strings.Contains(body.Issues[0].Message, "span_status") {
			t.Errorf("want the unknown key named, got %q", body.Issues[0].Message)
		}
	})

	t.Run("an error type the key does not offer is refused", func(t *testing.T) {
		c, w := newErrorsOverviewContext(ownerID, appID, errorsOverviewTimeRangeQuery()+"&filter_expr=error_type:in:crash")
		h.GetErrorOverview(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})
}

func TestGetErrorDetailErrors(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)
	seedErrorsOverviewApp(ctx, t, teamID, appID)

	t.Run("a filter expression narrows the events", func(t *testing.T) {
		c, w := newErrorDetailErrorsContext(ownerID, appID, fpOverviewCrash, errorsOverviewTimeRangeQuery()+"&filter_expr=os_name:in:ios")
		h.GetErrorDetailErrors(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		var body struct {
			Results []any `json:"results"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if len(body.Results) != 0 {
			t.Errorf("want no events on ios, got %d", len(body.Results))
		}
	})

	t.Run("one group's events cannot be filtered by error type", func(t *testing.T) {
		c, w := newErrorDetailErrorsContext(ownerID, appID, fpOverviewCrash, errorsOverviewTimeRangeQuery()+"&"+anrOnlyFilterQuery)
		h.GetErrorDetailErrors(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), "error_type") {
			t.Errorf("want the unknown key named, got %s", w.Body.String())
		}
	})
}

func TestGetErrorOverviewPlotInstances(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)
	seedErrorsOverviewApp(ctx, t, teamID, appID)

	totalInstances := func(t *testing.T, rawQuery string) uint64 {
		t.Helper()
		c, w := newErrorsPlotInstancesContext(ownerID, appID, rawQuery)
		h.GetErrorOverviewPlotInstances(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}

		var body []struct {
			ID   string `json:"id"`
			Data []struct {
				Datetime  string `json:"datetime"`
				Instances uint64 `json:"instances"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}

		var total uint64
		for _, entry := range body {
			for _, d := range entry.Data {
				total += d.Instances
			}
		}
		return total
	}

	t.Run("every error of the app", func(t *testing.T) {
		if got := totalInstances(t, "timezone=Etc/UTC&"+errorsOverviewTimeRangeQuery()); got != 2 {
			t.Errorf("total instances = %d, want 2", got)
		}
	})

	t.Run("a filter expression narrows the plot", func(t *testing.T) {
		rawQuery := "timezone=Etc/UTC&" + errorsOverviewTimeRangeQuery() + "&" + anrOnlyFilterQuery
		if got := totalInstances(t, rawQuery); got != 1 {
			t.Errorf("total instances = %d, want 1", got)
		}
	})

	t.Run("a request without a timezone is refused", func(t *testing.T) {
		c, w := newErrorsPlotInstancesContext(ownerID, appID, errorsOverviewTimeRangeQuery())
		h.GetErrorOverviewPlotInstances(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), "timezone") {
			t.Errorf("want the missing field named, got %s", w.Body.String())
		}
	})
}
