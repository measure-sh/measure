//go:build integration

package measure

import (
	"math"
	"reflect"
	"slices"
	"testing"
	"time"

	"backend/libs/filter"
	"backend/testinfra"

	"github.com/google/uuid"
)

// A fingerprint has 32 characters, the same as the FixedString(32) group id.
const (
	fpJourneyCrash   = "000000000000000000000000000000e1"
	fpJourneyANR     = "000000000000000000000000000000e2"
	fpJourneyHandled = "000000000000000000000000000000e3"
	fpJourneyHang    = "000000000000000000000000000000e4"
)

// journeyFixture adds events and spans at whole seconds after base.
// analytics_events_mv and analytics_spans_mv copy them into analytics_events.
type journeyFixture struct {
	plotFixture
	base time.Time
}

func newJourneyFixture(t *testing.T) journeyFixture {
	return journeyFixture{
		plotFixture: newPlotFixture(t),
		base:        time.Date(2026, 1, 10, 10, 0, 0, 0, time.UTC),
	}
}

func (f journeyFixture) at(second int) time.Time {
	return f.base.Add(time.Duration(second) * time.Second)
}

func (f journeyFixture) seed(t *testing.T, row testinfra.EventRow) {
	t.Helper()
	th.SeedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, row)
}

func (f journeyFixture) screen(t *testing.T, installation, session, name string, second int) {
	t.Helper()
	f.seed(t, testinfra.EventRow{
		Type:                       "lifecycle_activity",
		InstallationID:             installation,
		SessionID:                  session,
		Timestamp:                  f.at(second),
		LifecycleActivityType:      "resumed",
		LifecycleActivityClassName: name,
	})
}

func (f journeyFixture) issue(t *testing.T, installation, session, issueType, fingerprint string, handled bool, second int) {
	t.Helper()
	f.seed(t, testinfra.EventRow{
		Type:           issueType,
		InstallationID: installation,
		SessionID:      session,
		Timestamp:      f.at(second),
		Fingerprint:    fingerprint,
		Handled:        handled,
	})
}

func (f journeyFixture) appHang(t *testing.T, installation, session, state string, second int) {
	t.Helper()
	f.seed(t, testinfra.EventRow{
		Type:           "app_hang",
		InstallationID: installation,
		SessionID:      session,
		Timestamp:      f.at(second),
		Fingerprint:    fpJourneyHang,
		AppHangState:   state,
	})
}

func (f journeyFixture) filter(exprTree *filter.ExprTree) *filter.Filter {
	return f.journeyFilter(f.base.Add(-time.Hour), f.base.Add(time.Hour), exprTree)
}

// seededJourney has the session ids from seedJourney.
type seededJourney struct {
	sessionA1, sessionA2, sessionB string
}

// seedJourney adds four sessions of three installations:
//
//	userA, sessionA1: Home, Home, add_to_cart, Cart, crash, Detail
//	userA, sessionA2: Home, Cart
//	userB, sessionB:  Home, Detail. Home has a request, a root span and a
//	                  handled exception.
//	userC, sessionC:  Cart, ANR
func (f journeyFixture) seedJourney(t *testing.T) seededJourney {
	t.Helper()
	userA, userB, userC := uuid.NewString(), uuid.NewString(), uuid.NewString()
	sessionC := uuid.NewString()
	s := seededJourney{sessionA1: uuid.NewString(), sessionA2: uuid.NewString(), sessionB: uuid.NewString()}

	f.screen(t, userA, s.sessionA1, "Home", 0)
	f.screen(t, userA, s.sessionA1, "Home", 1)
	f.seed(t, testinfra.EventRow{Type: "custom", InstallationID: userA, SessionID: s.sessionA1, Timestamp: f.at(2), CustomName: "add_to_cart"})
	f.screen(t, userA, s.sessionA1, "Cart", 3)
	f.issue(t, userA, s.sessionA1, "exception", fpJourneyCrash, false, 4)
	f.screen(t, userA, s.sessionA1, "Detail", 5)

	f.screen(t, userA, s.sessionA2, "Home", 10)
	f.screen(t, userA, s.sessionA2, "Cart", 12)

	f.screen(t, userB, s.sessionB, "Home", 20)
	f.seed(t, testinfra.EventRow{
		Type:           "http",
		InstallationID: userB,
		SessionID:      s.sessionB,
		Timestamp:      f.at(21),
		HttpURL:        "https://api.test/products/42",
		HttpMethod:     "get",
		HttpStatusCode: 200,
		HttpStartTime:  1000,
		HttpEndTime:    1250,
	})
	th.SeedSpanRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.SpanRow{
		SpanName:       "load_home",
		SessionID:      s.sessionB,
		InstallationID: userB,
		StartTime:      f.at(21),
		Duration:       300 * time.Millisecond,
	})
	f.issue(t, userB, s.sessionB, "exception", fpJourneyHandled, true, 21)
	f.screen(t, userB, s.sessionB, "Detail", 22)

	f.screen(t, userC, sessionC, "Cart", 30)
	f.issue(t, userC, sessionC, "anr", fpJourneyANR, false, 32)

	th.SeedExceptionGroup(f.ctx, t, f.teamIDStr(), f.appIDStr(), fpJourneyCrash)
	th.SeedNonfatalExceptionGroup(f.ctx, t, f.teamIDStr(), f.appIDStr(), fpJourneyHandled, true, false)
	th.SeedAnrGroup(f.ctx, t, f.teamIDStr(), f.appIDStr(), fpJourneyANR)
	th.SeedUrlPattern(f.ctx, t, f.teamIDStr(), f.appIDStr(), "api.test", "/products/*")

	return s
}

func journeyLinkUsers(journey Journey) map[string]uint64 {
	links := map[string]uint64{}
	for _, link := range journey.Links {
		links[link.Source+" > "+link.Target] = link.Users
	}
	return links
}

func ms(value float64) *float64 { return &value }

func TestGetJourney(t *testing.T) {
	f := newJourneyFixture(t)
	f.seedJourney(t)

	journey, err := GetJourney(f.ctx, nil, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}

	// Rows in sequence for one node are one step. The steps after a crash
	// are not in the journey. A user counts one time for each node.
	want := map[string]JourneyNode{
		"screen:Home":       {ID: "screen:Home", Name: "Home", Kind: "screen", Step: 0, Users: 2, Continuing: 2},
		"event:add_to_cart": {ID: "event:add_to_cart", Name: "add_to_cart", Kind: "event", Step: 1, Users: 1, Continuing: 1, MedianMsFromPrevious: ms(2000)},
		"screen:Cart":       {ID: "screen:Cart", Name: "Cart", Kind: "screen", Step: 0, Users: 2, Continuing: 2, MedianMsFromPrevious: ms(1000)},
		"screen:Detail":     {ID: "screen:Detail", Name: "Detail", Kind: "screen", Step: 1, Users: 1, Continuing: 0, MedianMsFromPrevious: ms(2000)},
		"fatal":             {ID: "fatal", Name: "Fatal error", Kind: "fatal", Step: 1, Users: 2, Continuing: 0, MedianMsFromPrevious: ms(1000)},
	}
	got := map[string]JourneyNode{}
	for _, node := range journey.Nodes {
		got[node.ID] = node
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("nodes\n got %+v\nwant %+v", got, want)
	}
	for i := 1; i < len(journey.Nodes); i++ {
		if journey.Nodes[i-1].Step > journey.Nodes[i].Step {
			t.Errorf("want nodes in step order, got %+v", journey.Nodes)
		}
	}

	wantLinks := map[string]uint64{
		"screen:Home > event:add_to_cart": 1,
		"event:add_to_cart > screen:Cart": 1,
		"screen:Cart > fatal":             2,
		"screen:Home > screen:Cart":       1,
		"screen:Home > screen:Detail":     1,
	}
	if got := journeyLinkUsers(journey); !reflect.DeepEqual(got, wantLinks) {
		t.Errorf("links = %v, want %v", got, wantLinks)
	}
}

func TestGetJourneyFilters(t *testing.T) {
	f := newJourneyFixture(t)
	userA, userB := uuid.NewString(), uuid.NewString()
	sessionA, sessionB := uuid.NewString(), uuid.NewString()

	f.screen(t, userA, sessionA, "Home", 0)
	f.screen(t, userA, sessionA, "Cart", 1)
	f.seed(t, testinfra.EventRow{
		Type: "lifecycle_activity", InstallationID: userB, SessionID: sessionB, Timestamp: f.at(2),
		AppVersion: "2.0", LifecycleActivityType: "resumed", LifecycleActivityClassName: "Home",
	})
	f.seed(t, testinfra.EventRow{
		Type: "lifecycle_activity", InstallationID: userB, SessionID: sessionB, Timestamp: f.at(3),
		AppVersion: "2.0", LifecycleActivityType: "resumed", LifecycleActivityClassName: "Detail",
	})

	t.Run("a fixed key matches each row's own attribute", func(t *testing.T) {
		exprTree := filter.ExprTree{Condition: &filter.Condition{
			KeyName: "version_name", Operator: filter.OperatorIn, Values: []filter.Value{{Text: "2.0"}},
		}}
		journey, err := GetJourney(f.ctx, nil, deps.RchPool, f.filter(&exprTree))
		if err != nil {
			t.Fatalf("GetJourney: %v", err)
		}
		if got, want := journeyLinkUsers(journey), map[string]uint64{"screen:Home > screen:Detail": 1}; !reflect.DeepEqual(got, want) {
			t.Errorf("links = %v, want %v", got, want)
		}
	})

	t.Run("a custom key matches every row of the sessions that have the attribute", func(t *testing.T) {
		err := th.ChConn.Exec(f.ctx, "insert into measure.events (id, type, session_id, app_id, team_id, timestamp, `attribute.installation_id`, `lifecycle_activity.type`, `lifecycle_activity.class_name`, user_defined_attribute) values (generateUUIDv4(), 'lifecycle_activity', ?, ?, ?, ?, ?, 'resumed', 'Settings', map('plan', ('string', 'pro')))",
			sessionA, f.appID, f.teamID, f.at(4), userA)
		if err != nil {
			t.Fatalf("seed event with attributes: %v", err)
		}

		exprTree := filter.ExprTree{Condition: &filter.Condition{
			KeyName: "custom.plan", Operator: filter.OperatorIn, Values: []filter.Value{{Text: "pro"}},
		}}
		flt := f.filter(&exprTree)
		flt.Entity.Keys = append(flt.Entity.Keys, filter.CustomKey("plan", filter.ValueTypeString))
		journey, err := GetJourney(f.ctx, nil, deps.RchPool, flt)
		if err != nil {
			t.Fatalf("GetJourney: %v", err)
		}
		if got, want := journeyLinkUsers(journey), map[string]uint64{"screen:Home > screen:Cart": 1, "screen:Cart > screen:Settings": 1}; !reflect.DeepEqual(got, want) {
			t.Errorf("links = %v, want %v", got, want)
		}
	})
}

func TestGetJourneyEndsSessionsOnKilledAppHangsOnly(t *testing.T) {
	f := newJourneyFixture(t)
	user := uuid.NewString()
	recovered, killed := uuid.NewString(), uuid.NewString()

	f.screen(t, user, recovered, "Home", 0)
	f.appHang(t, user, recovered, "recovered", 1)
	f.screen(t, user, recovered, "Cart", 2)

	f.screen(t, user, killed, "Settings", 10)
	f.appHang(t, user, killed, "killed", 11)

	journey, err := GetJourney(f.ctx, nil, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}
	want := map[string]uint64{"screen:Home > screen:Cart": 1, "screen:Settings > fatal": 1}
	if got := journeyLinkUsers(journey); !reflect.DeepEqual(got, want) {
		t.Errorf("links = %v, want %v", got, want)
	}
}

func TestGetJourneyWithACrashBeforeTheFirstStep(t *testing.T) {
	f := newJourneyFixture(t)
	user := uuid.NewString()
	crashed, other := uuid.NewString(), uuid.NewString()

	f.issue(t, user, crashed, "exception", fpJourneyCrash, false, 0)
	f.screen(t, user, crashed, "Home", 1)
	f.screen(t, user, other, "Home", 10)
	f.screen(t, user, other, "Cart", 11)

	journey, err := GetJourney(f.ctx, nil, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}
	var ids []string
	for _, node := range journey.Nodes {
		ids = append(ids, node.ID)
	}
	slices.Sort(ids)
	if want := []string{"fatal", "screen:Cart", "screen:Home"}; !slices.Equal(ids, want) {
		t.Errorf("nodes = %v, want %v", ids, want)
	}
	if got, want := journeyLinkUsers(journey), map[string]uint64{"screen:Home > screen:Cart": 1}; !reflect.DeepEqual(got, want) {
		t.Errorf("links = %v, want %v", got, want)
	}
}

func TestGetJourneyKeepsTheNodesAndLinksWithTheMostUsers(t *testing.T) {
	f := newJourneyFixture(t)
	// Each of 5050 sessions goes from screen S(i % 500) to a different screen.
	// Thus there are 5050 different links between 500 screens, and each
	// screen has 10 or more users. Each of the screens X0 to X4 has one
	// user.
	seed := func(sessions int, steps string) {
		t.Helper()
		err := th.ChConn.Exec(f.ctx, "insert into measure.events (id, type, session_id, app_id, team_id, timestamp, `attribute.installation_id`, `lifecycle_activity.type`, `lifecycle_activity.class_name`) "+
			"select generateUUIDv4(), 'lifecycle_activity', toUUID(concat('00000000-0000-0000-0000-', leftPad(toString(number), 12, '0'))), ?, ?, "+
			"toDateTime64(?, 3, 'UTC') + toIntervalSecond(step.1), toUUID(concat('10000000-0000-0000-0000-', leftPad(toString(number), 12, '0'))), 'resumed', step.2 "+
			"from numbers(?) array join "+steps+" as step",
			f.appID, f.teamID, f.base.Format(time.DateTime), sessions)
		if err != nil {
			t.Fatalf("seed screens: %v", err)
		}
	}
	seed(5050, "[(0, concat('S', toString(number % 500))), (1, concat('S', toString((number % 500 + intDiv(number, 500) + 1) % 500)))]")
	seed(5, "[(0, concat('X', toString(number)))]")
	crashed, user := uuid.NewString(), uuid.NewString()
	f.screen(t, user, crashed, "S0", 10)
	f.issue(t, user, crashed, "exception", fpJourneyCrash, false, 11)

	journey, err := GetJourney(f.ctx, nil, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}

	kept := map[string]bool{}
	for _, node := range journey.Nodes {
		kept[node.ID] = true
	}
	if len(kept) != journeyMaxNodes+1 || !kept[journeyFatalNode] || kept["screen:X0"] {
		t.Errorf("want the %d screens S and the fatal error node, got %d nodes", journeyMaxNodes, len(kept))
	}
	toFatal := 0
	for _, link := range journey.Links {
		if link.Target == journeyFatalNode {
			toFatal++
		}
	}
	if len(journey.Links) != JourneyMaxLinks+1 || toFatal != 1 {
		t.Errorf("want %d links and the link to the fatal error node, got %d links and %d to the fatal error node", JourneyMaxLinks, len(journey.Links), toFatal)
	}
}

// seedManyScreens adds a screen row for each of n installations, in a
// session of its own. Every 1000th installation reaches a screen that no other
// installation reaches. The rows go into analytics_events directly, because an
// insert into events also runs every view on the events table, such as
// sessions_mv, and aggregating this many rows there goes over the memory limit
// of the test's ClickHouse server.
func (f journeyFixture) seedManyScreens(t *testing.T, prefix string, n int) {
	t.Helper()
	err := th.ChConn.Exec(f.ctx, "insert into measure.analytics_events (id, type, session_id, app_id, team_id, timestamp, installation_id, `screen.name`) "+
		"select generateUUIDv4(), 'lifecycle_activity', generateUUIDv4(), ?, ?, toDateTime64(?, 3, 'UTC'), toUUID(concat(?, '-0000-0000-0000-', leftPad(toString(number), 12, '0'))), "+
		"if(number % 1000 = 0, concat(?, toString(number)), 'Home') from numbers(?)",
		f.appID, f.teamID, f.base.Format(time.DateTime), prefix, prefix, n)
	if err != nil {
		t.Fatalf("seed screens: %v", err)
	}
}

func TestJourneyNodeIDsReadsTheInstallationsOfTheCounts(t *testing.T) {
	f := newJourneyFixture(t)
	// More rows than the sample, so the queries read a share of the
	// installations.
	f.seedManyScreens(t, "10000000", 6_000_000)
	flt := f.filter(nil)

	stmt, err := journeyStepsStmt(sampledAnalyticsEvents, flt)
	if err != nil {
		t.Fatalf("journeyStepsStmt: %v", err)
	}
	stmt.Select("any(_sample_factor)").Select("groupUniqArray(cityHash64(" + journeyNodeIDExpr + "))")
	defer stmt.Close()
	var factor float64
	var hashes []uint64
	if err := th.ChConn.QueryRow(f.ctx, stmt.String(), stmt.Args()...).Scan(&factor, &hashes); err != nil {
		t.Fatalf("read the sample: %v", err)
	}
	if factor <= 1 {
		t.Fatalf("want a sample of the installations, got the factor %v", factor)
	}

	// Rows added after the hashes were found make a sample of a row count
	// read a smaller share of the installations.
	f.seedManyScreens(t, "20000000", 60_000)

	ids, err := journeyNodeIDs(f.ctx, deps.RchPool, flt, factor, hashes)
	if err != nil {
		t.Fatalf("journeyNodeIDs: %v", err)
	}
	if len(ids) != len(hashes) {
		t.Errorf("want an id for each of the %d hashes, got %d", len(hashes), len(ids))
	}

	journey, err := GetJourney(f.ctx, nil, deps.RchPool, flt)
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}
	if journey.SamplePercent == nil || *journey.SamplePercent >= 100 {
		t.Errorf("want a sampled journey, got the sample percent %v", journey.SamplePercent)
	}
	nodes := map[string]bool{}
	for _, node := range journey.Nodes {
		if node.ID == "" || node.Name == "" || node.Kind == "" {
			t.Errorf("want an id, a name and a kind, got %+v", node)
		}
		nodes[node.ID] = true
	}
	if len(nodes) != journeyMaxNodes {
		t.Errorf("want %d nodes, got %d", journeyMaxNodes, len(nodes))
	}
}

func TestJourneyListsReadTheSampleOfTheJourney(t *testing.T) {
	f := newJourneyFixture(t)
	// More rows than the sample, so the journey reads a share of the
	// installations.
	f.seedManyScreens(t, "10000000", 6_000_000)
	journey, err := GetJourney(f.ctx, nil, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}
	if journey.SamplePercent == nil || *journey.SamplePercent >= 100 {
		t.Fatalf("want a sampled journey, got the sample percent %v", journey.SamplePercent)
	}

	// Rows added after the journey make a sample of a row count read a
	// smaller share of the installations.
	f.seedManyScreens(t, "20000000", 60_000)
	path := []string{"screen:Home", "screen:Home"}

	pathUsers, err := GetJourneyPathUsers(f.ctx, nil, deps.RchPool, f.filter(nil), path)
	if err != nil {
		t.Fatalf("GetJourneyPathUsers: %v", err)
	}
	if pathUsers.SamplePercent == nil {
		t.Fatal("want a sample percent without the journey's sample percent, got nil")
	}
	if *pathUsers.SamplePercent >= *journey.SamplePercent {
		t.Fatalf("want a smaller sample than the journey's %v without its sample percent, got %v", *journey.SamplePercent, *pathUsers.SamplePercent)
	}

	flt := f.filter(nil)
	if err := flt.SetSamplePercent(*journey.SamplePercent); err != nil {
		t.Fatalf("SetSamplePercent: %v", err)
	}
	pathUsers, err = GetJourneyPathUsers(f.ctx, nil, deps.RchPool, flt, path)
	if err != nil {
		t.Fatalf("GetJourneyPathUsers with the sample percent: %v", err)
	}
	if pathUsers.SamplePercent == nil {
		t.Fatal("want the journey's sample percent, got nil")
	}
	if math.Abs(*pathUsers.SamplePercent-*journey.SamplePercent) > 1e-9 {
		t.Errorf("want the journey's sample percent %v, got %v", *journey.SamplePercent, *pathUsers.SamplePercent)
	}
}

func TestJourneyOfADayReadsAllTheInstallationsOfThatDay(t *testing.T) {
	f := newJourneyFixture(t)
	day := 10 * 24 * 60 * 60
	// The month has more rows than the sample, and the day has fewer. Each
	// insert has rows of both days, so the rows of the two days are in the
	// same parts, as after merges.
	err := th.ChConn.Exec(f.ctx, "insert into measure.analytics_events (id, type, session_id, app_id, team_id, timestamp, installation_id, `screen.name`) "+
		"select generateUUIDv4(), 'lifecycle_activity', generateUUIDv4(), ?, ?, toDateTime64(?, 3, 'UTC') + toIntervalSecond(? * (number % 2)), generateUUIDv4(), 'Home' from numbers(?)",
		f.appID, f.teamID, f.base.Format(time.DateTime), day, 8_000_000)
	if err != nil {
		t.Fatalf("seed screens: %v", err)
	}
	installation, session := uuid.NewString(), uuid.NewString()
	f.screen(t, installation, session, "Home", day)
	f.screen(t, installation, session, "Cart", day+1)
	flt := f.journeyFilter(f.at(day).Add(-time.Hour), f.at(day).Add(time.Hour), nil)

	journey, err := GetJourney(f.ctx, nil, deps.RchPool, flt)
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}
	if journey.SamplePercent == nil || *journey.SamplePercent != 100 {
		t.Errorf("want the journey to read all the installations, got the sample percent %s", formatSamplePercent(journey.SamplePercent))
	}

	sessions, err := GetJourneySessions(f.ctx, nil, deps.RchPool, flt, JourneySelection{Node: "screen:Cart"})
	if err != nil {
		t.Fatalf("GetJourneySessions: %v", err)
	}
	if sessions.SamplePercent == nil || *sessions.SamplePercent != 100 {
		t.Errorf("want the sessions to read all the installations, got the sample percent %s", formatSamplePercent(sessions.SamplePercent))
	}
}

func TestJourneyWithNodesKeepsTheFatalErrorNodeOnlyWhenLinked(t *testing.T) {
	journey := Journey{
		Nodes: []JourneyNode{{ID: "screen:A"}, {ID: "screen:B"}, {ID: "screen:C"}, {ID: journeyFatalNode}},
		Links: []JourneyLink{
			{Source: "screen:A", Target: "screen:B", Users: 2},
			{Source: "screen:C", Target: journeyFatalNode, Users: 1},
		},
	}

	for _, tc := range []struct {
		ids  []string
		want []string
	}{
		{ids: []string{"screen:A", "screen:B"}, want: []string{"screen:A", "screen:B"}},
		{ids: []string{"screen:C"}, want: []string{"screen:C", journeyFatalNode}},
	} {
		var got []string
		for _, node := range journey.WithNodes(tc.ids, 10).Nodes {
			got = append(got, node.ID)
		}
		if !slices.Equal(got, tc.want) {
			t.Errorf("WithNodes(%v) nodes = %v, want %v", tc.ids, got, tc.want)
		}
	}
}

func TestJourneyTopLinksKeepsAllNodesAndTheLinksWithTheMostUsers(t *testing.T) {
	journey := Journey{
		Nodes: []JourneyNode{{ID: "screen:A"}, {ID: "screen:B"}, {ID: "screen:C"}, {ID: journeyFatalNode}},
		Links: []JourneyLink{
			{Source: "screen:A", Target: "screen:B", Users: 5},
			{Source: "screen:B", Target: "screen:C", Users: 3},
			{Source: "screen:C", Target: journeyFatalNode, Users: 1},
		},
	}

	top := journey.TopLinks(1)

	if len(top.Nodes) != 4 {
		t.Errorf("nodes = %+v, want all 4", top.Nodes)
	}
	var links []string
	for _, link := range top.Links {
		links = append(links, link.Source+" > "+link.Target)
	}
	if want := []string{"screen:A > screen:B", "screen:C > " + journeyFatalNode}; !slices.Equal(links, want) {
		t.Errorf("links = %v, want %v", links, want)
	}
}

func TestJourneyTopKeepsTheNodesAndLinksWithTheMostUsers(t *testing.T) {
	node := func(id string, users uint64) JourneyNode {
		return JourneyNode{ID: id, Users: users}
	}
	journey := Journey{
		Nodes: []JourneyNode{node("screen:A", 9), node("screen:B", 8), node("screen:C", 1), node(journeyFatalNode, 20)},
		Links: []JourneyLink{
			{Source: "screen:A", Target: "screen:B", Users: 5},
			{Source: "screen:B", Target: "screen:A", Users: 4},
			{Source: "screen:A", Target: "screen:C", Users: 3},
			{Source: "screen:B", Target: journeyFatalNode, Users: 1},
		},
	}

	top := journey.Top(2, 1)

	var nodes, links []string
	for _, node := range top.Nodes {
		nodes = append(nodes, node.ID)
	}
	for _, link := range top.Links {
		links = append(links, link.Source+" > "+link.Target)
	}
	if want := []string{"screen:A", "screen:B", journeyFatalNode}; !slices.Equal(nodes, want) {
		t.Errorf("nodes = %v, want %v", nodes, want)
	}
	if want := []string{"screen:A > screen:B", "screen:B > " + journeyFatalNode}; !slices.Equal(links, want) {
		t.Errorf("links = %v, want %v", links, want)
	}
}

func TestGetJourneyReadsTheCache(t *testing.T) {
	f := newJourneyFixture(t)
	user, session := uuid.NewString(), uuid.NewString()
	f.screen(t, user, session, "Home", 0)
	f.screen(t, user, session, "Cart", 1)

	first, err := GetJourney(f.ctx, th.VK, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}
	f.screen(t, user, session, "Detail", 2)
	second, err := GetJourney(f.ctx, th.VK, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetJourney: %v", err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Errorf("want the cached journey %+v, got %+v", first, second)
	}
}

func TestGetJourneyPathUsers(t *testing.T) {
	f := newJourneyFixture(t)
	f.seedJourney(t)

	for _, tc := range []struct {
		path []string
		want uint64
	}{
		{[]string{"screen:Home", "event:add_to_cart", "screen:Cart"}, 1},
		{[]string{"screen:Home", "screen:Cart"}, 1},
		{[]string{"screen:Cart", "fatal"}, 2},
		{[]string{"screen:Home", "screen:Detail"}, 1},
		{[]string{"screen:Cart", "screen:Detail"}, 0},
		{[]string{"event:Home", "screen:Cart"}, 0},
	} {
		pathUsers, err := GetJourneyPathUsers(f.ctx, nil, deps.RchPool, f.filter(nil), tc.path)
		if err != nil {
			t.Fatalf("GetJourneyPathUsers(%v): %v", tc.path, err)
		}
		if pathUsers.Users != tc.want {
			t.Errorf("users of %v = %d, want %d", tc.path, pathUsers.Users, tc.want)
		}
		if pathUsers.SamplePercent == nil || *pathUsers.SamplePercent != 100 {
			t.Errorf("sample percent of %v = %v, want 100", tc.path, pathUsers.SamplePercent)
		}
	}

	empty := f.journeyFilter(f.base.Add(-3*time.Hour), f.base.Add(-2*time.Hour), nil)
	pathUsers, err := GetJourneyPathUsers(f.ctx, nil, deps.RchPool, empty, []string{"screen:Home", "screen:Cart"})
	if err != nil {
		t.Fatalf("GetJourneyPathUsers: %v", err)
	}
	if pathUsers.Users != 0 || pathUsers.SamplePercent != nil {
		t.Errorf("path users of a range without sessions = %+v, want 0 users and a nil sample percent", pathUsers)
	}
}

func TestGetJourneyErrors(t *testing.T) {
	f := newJourneyFixture(t)
	f.seedJourney(t)

	ids := func(t *testing.T, selection JourneySelection) map[string]uint64 {
		t.Helper()
		page, err := GetJourneyErrors(f.ctx, nil, deps.RchPool, f.filter(nil), selection)
		if err != nil {
			t.Fatalf("GetJourneyErrors: %v", err)
		}
		if (len(page.Results) > 0) != (page.SamplePercent != nil) {
			t.Errorf("sample percent = %v for %d errors, want a percent only when there are errors", page.SamplePercent, len(page.Results))
		}
		users := map[string]uint64{}
		for _, journeyError := range page.Results {
			users[journeyError.ID+" "+journeyError.ErrorType] = journeyError.Users
		}
		return users
	}

	t.Run("a node covers the time until the next step", func(t *testing.T) {
		want := map[string]uint64{fpJourneyHandled + " exception": 1}
		if got := ids(t, JourneySelection{Node: "screen:Home"}); !reflect.DeepEqual(got, want) {
			t.Errorf("errors = %v, want %v", got, want)
		}
	})

	t.Run("a link covers the time between its nodes", func(t *testing.T) {
		want := map[string]uint64{fpJourneyCrash + " exception": 1, fpJourneyANR + " anr": 1}
		if got := ids(t, JourneySelection{Path: []string{"screen:Cart", "fatal"}}); !reflect.DeepEqual(got, want) {
			t.Errorf("errors = %v, want %v", got, want)
		}
	})

	t.Run("a path the sessions did not take has no errors", func(t *testing.T) {
		if got := ids(t, JourneySelection{Path: []string{"screen:Detail", "screen:Home"}}); len(got) != 0 {
			t.Errorf("errors = %v, want none", got)
		}
	})
}

func TestGetJourneyTracesAndNetwork(t *testing.T) {
	f := newJourneyFixture(t)
	f.seedJourney(t)
	home := JourneySelection{Node: "screen:Home"}

	traces, err := GetJourneyTraces(f.ctx, nil, deps.RchPool, f.filter(nil), home, 0.5)
	if err != nil {
		t.Fatalf("GetJourneyTraces: %v", err)
	}
	wantTraces := []JourneyTrace{{SpanName: "load_home", Count: 1, Users: 1, DurationMs: 300}}
	if !reflect.DeepEqual(traces.Results, wantTraces) {
		t.Errorf("traces = %+v, want %+v", traces.Results, wantTraces)
	}
	if traces.SamplePercent == nil || *traces.SamplePercent != 100 {
		t.Errorf("traces sample percent = %v, want 100", traces.SamplePercent)
	}

	endpoints, err := GetJourneyNetwork(f.ctx, nil, deps.RchPool, f.filter(nil), home, 0.5)
	if err != nil {
		t.Fatalf("GetJourneyNetwork: %v", err)
	}
	wantEndpoints := []JourneyEndpoint{{Domain: "api.test", PathPattern: "/products/*", Count: 1, Users: 1, LatencyMs: 250}}
	if !reflect.DeepEqual(endpoints.Results, wantEndpoints) {
		t.Errorf("endpoints = %+v, want %+v", endpoints.Results, wantEndpoints)
	}
	if endpoints.SamplePercent == nil || *endpoints.SamplePercent != 100 {
		t.Errorf("endpoints sample percent = %v, want 100", endpoints.SamplePercent)
	}

	traces, err = GetJourneyTraces(f.ctx, nil, deps.RchPool, f.filter(nil), JourneySelection{Node: "screen:Cart"}, 0.5)
	if err != nil {
		t.Fatalf("GetJourneyTraces: %v", err)
	}
	if len(traces.Results) != 0 {
		t.Errorf("want no traces outside the node's windows, got %+v", traces.Results)
	}
	if traces.SamplePercent != nil {
		t.Errorf("sample percent = %v, want nil for a list with no traces", *traces.SamplePercent)
	}
}

func TestGetJourneySessions(t *testing.T) {
	f := newJourneyFixture(t)
	s := f.seedJourney(t)

	page, err := GetJourneySessions(f.ctx, nil, deps.RchPool, f.filter(nil), JourneySelection{Node: "screen:Home"})
	if err != nil {
		t.Fatalf("GetJourneySessions: %v", err)
	}
	if page.Next {
		t.Error("want no next page")
	}
	if page.SamplePercent == nil || *page.SamplePercent != 100 {
		t.Errorf("sample percent = %v, want 100", page.SamplePercent)
	}
	var got []string
	for _, session := range page.Results {
		got = append(got, session.SessionID.String())
	}
	want := []string{s.sessionB, s.sessionA2, s.sessionA1}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("sessions = %v, want the latest visit first %v", got, want)
	}

	flt := f.filter(nil)
	flt.Limit = 1
	flt.Offset = 1
	page, err = GetJourneySessions(f.ctx, nil, deps.RchPool, flt, JourneySelection{Node: "screen:Home"})
	if err != nil {
		t.Fatalf("GetJourneySessions page: %v", err)
	}
	if len(page.Results) != 1 || page.Results[0].SessionID.String() != s.sessionA2 || !page.Next || !page.Previous {
		t.Errorf("page = %+v, want the second session with both pages", page)
	}
}

func TestGetJourneySessionsKeepsTheNextPageWhenASessionHasNoSessionsIndexRows(t *testing.T) {
	f := newJourneyFixture(t)
	s := f.seedJourney(t)
	if err := th.ChConn.Exec(f.ctx, "delete from measure.sessions_index where session_id = toUUID(?)", s.sessionB); err != nil {
		t.Fatalf("delete session times: %v", err)
	}

	flt := f.filter(nil)
	flt.Limit = 2
	page, err := GetJourneySessions(f.ctx, nil, deps.RchPool, flt, JourneySelection{Node: "screen:Home"})
	if err != nil {
		t.Fatalf("GetJourneySessions: %v", err)
	}
	if len(page.Results) != 1 || page.Results[0].SessionID.String() != s.sessionA2 || !page.Next {
		t.Errorf("page = %+v, want the second session and a next page", page)
	}

	flt.Offset = 2
	page, err = GetJourneySessions(f.ctx, nil, deps.RchPool, flt, JourneySelection{Node: "screen:Home"})
	if err != nil {
		t.Fatalf("GetJourneySessions next page: %v", err)
	}
	if len(page.Results) != 1 || page.Results[0].SessionID.String() != s.sessionA1 || page.Next {
		t.Errorf("next page = %+v, want the third session and no next page", page)
	}
}
