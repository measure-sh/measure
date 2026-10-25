//go:build integration

package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"backend/libs/measure"
	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type journeyPage[T any] struct {
	Results []T `json:"results"`
	Meta    struct {
		Next     bool `json:"next"`
		Previous bool `json:"previous"`
	} `json:"meta"`
}

func serveJourney(handler gin.HandlerFunc, list, userID string, appID uuid.UUID, query string) *httptest.ResponseRecorder {
	path := "/apps/" + appID.String() + "/journey"
	if list != "" {
		path += "/" + list
	}
	c, w := newTestGinContext("GET", path+"?"+query, strings.NewReader(""))
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	handler(c)
	return w
}

func TestJourneyHandlers(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	start := time.Now().UTC().Add(-time.Hour).Truncate(time.Second)
	userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 30)

	// The one session goes to Home and Cart. Then it crashes.
	installation, session := uuid.NewString(), uuid.NewString()
	crash := strings.Repeat("a", 32)
	for _, row := range []testinfra.EventRow{
		{Type: "lifecycle_activity", LifecycleActivityType: "resumed", LifecycleActivityClassName: "Home", Timestamp: start},
		{Type: "lifecycle_activity", LifecycleActivityType: "resumed", LifecycleActivityClassName: "Cart", Timestamp: start.Add(time.Second)},
		{Type: "exception", Fingerprint: crash, Timestamp: start.Add(2 * time.Second)},
	} {
		row.InstallationID = installation
		row.SessionID = session
		th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, row)
	}
	th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{Table: "fatal_exception_groups", Fingerprint: crash, Type: "IllegalStateException"})
	inRange := rangeQuery(start.Add(-time.Hour), start.Add(time.Hour))

	t.Run("the journey has the screens and the fatal error", func(t *testing.T) {
		w := serveJourney(h.GetJourney, "", userID, appID, inRange)
		expectStatus(t, w, http.StatusOK)
		journey := decodeBody[measure.Journey](t, w)
		var links []string
		for _, link := range journey.Links {
			links = append(links, link.Source+" > "+link.Target)
		}
		slices.Sort(links)
		if len(journey.Nodes) != 3 || strings.Join(links, ", ") != "screen:Cart > fatal, screen:Home > screen:Cart" {
			t.Errorf("journey = %+v", journey)
		}
	})

	t.Run("an app with fewer rows than the sample is read in full", func(t *testing.T) {
		w := serveJourney(h.GetJourney, "", userID, appID, inRange)
		expectStatus(t, w, http.StatusOK)
		if journey := decodeBody[measure.Journey](t, w); journey.SamplePercent == nil || *journey.SamplePercent != 100 {
			t.Errorf("sample_percent = %v, want 100", journey.SamplePercent)
		}
	})

	t.Run("max_links keeps the links with the most users", func(t *testing.T) {
		w := serveJourney(h.GetJourney, "", userID, appID, inRange+"&max_links=1")
		expectStatus(t, w, http.StatusOK)
		if journey := decodeBody[measure.Journey](t, w); len(journey.Links) != 2 {
			t.Errorf("links = %+v, want the link from Home and the link to the fatal error", journey.Links)
		}
		for _, maxLinks := range []string{"0", "5001", "2.5", "all"} {
			w := serveJourney(h.GetJourney, "", userID, appID, inRange+"&max_links="+maxLinks)
			expectStatus(t, w, http.StatusBadRequest)
		}
	})

	t.Run("path users count the users through the path", func(t *testing.T) {
		w := serveJourney(h.GetJourneyPathUsers, "path", userID, appID, inRange+"&path=screen:Home&path=screen:Cart&path=fatal")
		expectStatus(t, w, http.StatusOK)
		got := decodeBody[measure.JourneyPathUsers](t, w)
		if got.Users != 1 || got.SamplePercent == nil || *got.SamplePercent != 100 {
			t.Errorf("path users = %+v, want 1 user at a sample percent of 100", got)
		}
	})

	t.Run("path users need two nodes", func(t *testing.T) {
		w := serveJourney(h.GetJourneyPathUsers, "path", userID, appID, inRange+"&path=screen:Home")
		expectStatus(t, w, http.StatusBadRequest)
	})

	t.Run("a link selects the errors between its nodes", func(t *testing.T) {
		w := serveJourney(h.GetJourneyErrors, "errors", userID, appID, inRange+"&source=screen:Cart&target=fatal")
		expectStatus(t, w, http.StatusOK)
		page := decodeBody[journeyPage[measure.JourneyError]](t, w)
		if len(page.Results) != 1 || page.Results[0].Type != "IllegalStateException" || page.Results[0].Users != 1 {
			t.Errorf("errors = %+v", page.Results)
		}
	})

	t.Run("a node's lists cover the time until the next step", func(t *testing.T) {
		w := serveJourney(h.GetJourneyErrors, "errors", userID, appID, inRange+"&node=screen:Home")
		expectStatus(t, w, http.StatusOK)
		if page := decodeBody[journeyPage[measure.JourneyError]](t, w); len(page.Results) != 0 {
			t.Errorf("errors = %+v, want none", page.Results)
		}
	})

	t.Run("a path selects the sessions that went through it", func(t *testing.T) {
		w := serveJourney(h.GetJourneySessions, "sessions", userID, appID, inRange+"&path=screen:Home&path=screen:Cart")
		expectStatus(t, w, http.StatusOK)
		if page := decodeBody[journeyPage[measure.FunnelStepSession]](t, w); len(page.Results) != 1 {
			t.Errorf("sessions = %+v, want one", page.Results)
		}
	})

	t.Run("the journey ignores a SamplePercent param", func(t *testing.T) {
		for _, percent := range []string{"-1", "1000", "NaN"} {
			w := serveJourney(h.GetJourney, "", userID, appID, inRange+"&SamplePercent="+percent)
			expectStatus(t, w, http.StatusOK)
			if journey := decodeBody[measure.Journey](t, w); len(journey.Nodes) != 3 || journey.SamplePercent == nil || *journey.SamplePercent != 100 {
				t.Errorf("journey with SamplePercent=%s = %+v, want the 3 nodes at a sample percent of 100", percent, journey)
			}
		}
	})

	t.Run("the lists and path users take a sample percent above 0 and at most 100", func(t *testing.T) {
		lists := []struct {
			handler gin.HandlerFunc
			list    string
			query   string
		}{
			{h.GetJourneyPathUsers, "path", "&path=screen:Home&path=screen:Cart"},
			{h.GetJourneyErrors, "errors", "&node=screen:Home"},
			{h.GetJourneyTraces, "traces", "&node=screen:Home&quantile=p50"},
			{h.GetJourneyNetwork, "network", "&node=screen:Home&quantile=p50"},
			{h.GetJourneySessions, "sessions", "&node=screen:Home"},
		}
		for _, list := range lists {
			t.Run(list.list, func(t *testing.T) {
				for _, percent := range []string{"100", "37.5", "0.001"} {
					expectStatus(t, serveJourney(list.handler, list.list, userID, appID, inRange+list.query+"&sample_percent="+percent), http.StatusOK)
				}
				for _, percent := range []string{"0", "-5", "100.5", "NaN", "all"} {
					expectError(t, serveJourney(list.handler, list.list, userID, appID, inRange+list.query+"&sample_percent="+percent), http.StatusBadRequest, "sample_percent must be above 0 and at most 100")
				}
			})
		}
	})

	t.Run("a list needs a selection", func(t *testing.T) {
		w := serveJourney(h.GetJourneySessions, "sessions", userID, appID, inRange+"&source=screen:Home")
		expectStatus(t, w, http.StatusBadRequest)
	})

	t.Run("traces and network need a known quantile", func(t *testing.T) {
		for list, handler := range map[string]gin.HandlerFunc{"traces": h.GetJourneyTraces, "network": h.GetJourneyNetwork} {
			w := serveJourney(handler, list, userID, appID, inRange+"&node=screen:Home&quantile=p42")
			expectStatus(t, w, http.StatusBadRequest)
			w = serveJourney(handler, list, userID, appID, inRange+"&node=screen:Home&quantile=p90")
			expectStatus(t, w, http.StatusOK)
		}
	})
}
