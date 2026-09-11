package filter

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

var allEntities = []Entity{BuildsEntity, SpansEntity, BugReportsEntity, SessionsEntity, ErrorsEntity, JourneysEntity, AlertsEntity, NetworkEntity, AppHealthEntity}

func sampleValues(t *testing.T, key Key, operator Operator) []Value {
	t.Helper()

	switch operator {
	case OperatorIsSet, OperatorIsNotSet:
		return nil
	}

	var text string
	switch key.ValueType {
	case ValueTypeEnum:
		if len(key.EnumValues) == 0 {
			t.Fatalf("key %q holds a fixed set of values but declares none", key.Name)
		}
		text = key.EnumValues[0]
	case ValueTypeUUID:
		text = uuid.New().String()
	case ValueTypeInt32, ValueTypeInt64, ValueTypeUInt32, ValueTypeFloat64:
		text = "1024"
	case ValueTypeBool:
		text = "true"
	case ValueTypeDatetime:
		text = time.Now().UTC().Format(time.RFC3339)
	default:
		text = "1.2.0"
	}

	if operator == OperatorBetween {
		return []Value{{Text: text}, {Text: text}}
	}
	return []Value{{Text: text}}
}

func TestEntitiesFillEveryField(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			if entity.Name == "" {
				t.Error("an entity with no name cannot be asked for by a request")
			}
			if entity.BindKey == nil {
				t.Error("an entity with no BindKey cannot write a filter")
			}
			if len(entity.Keys) > 0 && entity.SuggestFixedKeyValues == nil {
				t.Error("an entity with no SuggestFixedKeyValues cannot list what a fixed key can be set to")
			}
		})
	}
}

func TestEveryKeyGroupIsInTheOrderTheFilterBarShows(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			for _, key := range entity.Keys {
				if !slices.Contains(keyGroupOrder, key.KeyGroup) {
					t.Errorf("key %q belongs to group %q, which keyGroupOrder does not list", key.Name, key.KeyGroup)
				}
			}
		})
	}
}

func TestKeyNamesAreUniqueWithinAEntity(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			seen := map[string]bool{}
			for _, key := range entity.Keys {
				if seen[key.Name] {
					t.Errorf("key %q is defined twice", key.Name)
				}
				seen[key.Name] = true
			}
		})
	}
}

func TestKeysFillEveryFieldThePickerDraws(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			for i, key := range entity.Keys {
				if key.Name == "" {
					t.Errorf("the key at position %d has no name, so no filter can address it", i)
				}
				if key.Label == "" {
					t.Errorf("key %q has no label for the picker to draw", key.Name)
				}
				if key.Description == "" {
					t.Errorf("key %q has no description for the picker to draw", key.Name)
				}
				if len(key.Operators) == 0 {
					t.Errorf("key %q offers no operators, so it cannot be filtered on", key.Name)
				}
			}
		})
	}
}

func TestKeysOnlyOfferOperatorsTheirValueTypeAllows(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			for _, key := range entity.Keys {
				allowed := AllowedOperatorsFor(key.ValueType)
				for _, operator := range key.Operators {
					if !slices.Contains(allowed, operator) {
						t.Errorf("key %q offers %q, which a %q key may not", key.Name, operator, key.ValueType)
					}
				}
			}
		})
	}
}

func TestEnumValuesAndTheFullListModeGoTogether(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			for _, key := range entity.Keys {
				if key.ValueSuggestionMode == ValueSuggestionModeFullList && len(key.EnumValues) == 0 {
					t.Errorf("key %q lists its values in full but declares none", key.Name)
				}
				if len(key.EnumValues) > 0 && key.ValueSuggestionMode != ValueSuggestionModeFullList {
					t.Errorf("key %q declares a fixed set of values but does not list them in full", key.Name)
				}
			}
		})
	}
}

func TestListKeyGroupsReturnsGroupsWithKeysInFilterBarOrder(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			withKeys := map[KeyGroup]bool{}
			for _, key := range entity.Keys {
				withKeys[key.KeyGroup] = true
			}

			want := []KeyGroup{}
			for _, keyGroup := range keyGroupOrder {
				if withKeys[keyGroup] {
					want = append(want, keyGroup)
				}
			}

			if got := ListKeyGroups(entity.Keys); !slices.Equal(got, want) {
				t.Errorf("want %v, got %v", want, got)
			}
		})
	}
}

func TestEntitiesBindEveryOperatorTheyOffer(t *testing.T) {
	for _, entity := range allEntities {
		t.Run(entity.Name, func(t *testing.T) {
			for _, key := range entity.Keys {
				t.Run(key.Name, func(t *testing.T) {
					for _, operator := range key.Operators {
						condition := Condition{
							KeyName:  key.Name,
							Operator: operator,
							Values:   sampleValues(t, key, operator),
						}

						stmt, err := entity.BindKey(condition)
						if err != nil {
							t.Errorf("Operator %q: %v", operator, err)
							continue
						}
						if stmt.String() == "" {
							t.Errorf("Operator %q wrote no SQL", operator)
						}
						stmt.Close()
					}
				})
			}
		})
	}
}

func TestBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := BuildsEntity.BindKey(Condition{
		KeyName:  "device_cohort",
		Operator: OperatorIn,
		Values:   []Value{{Text: "beta"}},
	})

	if err == nil {
		t.Fatal("want a key the builds entity does not have refused")
	}
	if !strings.Contains(err.Error(), "device_cohort") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestBuildsEntityOffersEveryBuildKey(t *testing.T) {
	byName := IndexKeysByName(BuildsEntity.Keys)

	wanted := []string{"version_name", "version_code", "mapping_type", "patch_version", "patch_id"}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the builds entity", name)
		}
	}
}

func TestSpansEntityOffersEverySpanKey(t *testing.T) {
	byName := IndexKeysByName(SpansEntity.Keys)

	wanted := []string{
		"version_name", "version_code", "patch_version", "patch_id",
		"span_status",
		"os_name", "os_version",
		"device_name", "device_manufacturer", "locale",
		"network_type", "network_generation", "network_provider",
		"country",
	}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the spans entity", name)
		}
	}
	if len(SpansEntity.Keys) != len(wanted) {
		t.Errorf("want %d spans keys, got %d", len(wanted), len(SpansEntity.Keys))
	}
}

func TestSpansBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := SpansEntity.BindKey(Condition{
		KeyName:  "mapping_type",
		Operator: OperatorIn,
		Values:   []Value{{Text: "proguard"}},
	})

	if err == nil {
		t.Fatal("want a key the spans entity does not have refused")
	}
	if !strings.Contains(err.Error(), "mapping_type") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestSpanStatusBindsTheColumnCodes(t *testing.T) {
	stmt, err := SpansEntity.BindKey(Condition{
		KeyName:  "span_status",
		Operator: OperatorIn,
		Values:   []Value{{Text: "unset"}, {Text: "error"}},
	})
	if err != nil {
		t.Fatalf("bind span_status: %v", err)
	}
	defer stmt.Close()

	if got := stmt.String(); got != "status in ?" {
		t.Errorf("want the status column compared, got %q", got)
	}
	args := stmt.Args()
	if len(args) != 1 {
		t.Fatalf("want one bound argument, got %v", args)
	}
	if got, ok := args[0].([]int8); !ok || !slices.Equal(got, []int8{0, 2}) {
		t.Errorf("want the codes [0 2] bound, got %v", args[0])
	}

	if _, err := SpansEntity.BindKey(Condition{
		KeyName:  "span_status",
		Operator: OperatorIn,
		Values:   []Value{{Text: "cancelled"}},
	}); err == nil {
		t.Error("want a status name the column does not store refused")
	}
}

func TestBugReportsEntityOffersEveryBugReportKey(t *testing.T) {
	byName := IndexKeysByName(BugReportsEntity.Keys)

	wanted := []string{
		"version_name", "version_code", "patch_version", "patch_id",
		"bug_report_status", "user_id", "bug_report_description", "session_id",
		"os_name", "os_version",
		"device_name", "device_manufacturer", "locale",
		"network_type", "network_generation", "network_provider",
		"country",
	}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the bug reports entity", name)
		}
	}
	if len(BugReportsEntity.Keys) != len(wanted) {
		t.Errorf("want %d bug report keys, got %d", len(wanted), len(BugReportsEntity.Keys))
	}
}

func TestBugReportsBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := BugReportsEntity.BindKey(Condition{
		KeyName:  "span_status",
		Operator: OperatorIn,
		Values:   []Value{{Text: "error"}},
	})

	if err == nil {
		t.Fatal("want a key the bug reports entity does not have refused")
	}
	if !strings.Contains(err.Error(), "span_status") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestBugReportStatusBindsTheColumnCodes(t *testing.T) {
	stmt, err := BugReportsEntity.BindKey(Condition{
		KeyName:  "bug_report_status",
		Operator: OperatorIn,
		Values:   []Value{{Text: "open"}, {Text: "closed"}},
	})
	if err != nil {
		t.Fatalf("bind bug_report_status: %v", err)
	}
	defer stmt.Close()

	if got := stmt.String(); got != "status in ?" {
		t.Errorf("want the status column compared, got %q", got)
	}
	args := stmt.Args()
	if len(args) != 1 {
		t.Fatalf("want one bound argument, got %v", args)
	}
	if got, ok := args[0].([]uint8); !ok || !slices.Equal(got, []uint8{0, 1}) {
		t.Errorf("want the codes [0 1] bound, got %v", args[0])
	}

	notIn, err := BugReportsEntity.BindKey(Condition{
		KeyName:  "bug_report_status",
		Operator: OperatorNotIn,
		Values:   []Value{{Text: "closed"}},
	})
	if err != nil {
		t.Fatalf("bind bug_report_status not_in: %v", err)
	}
	defer notIn.Close()
	if got := notIn.String(); got != "status not in ?" {
		t.Errorf("want the status column excluded, got %q", got)
	}
	if got, ok := notIn.Args()[0].([]uint8); !ok || !slices.Equal(got, []uint8{1}) {
		t.Errorf("want the code [1] bound, got %v", notIn.Args()[0])
	}

	if _, err := BugReportsEntity.BindKey(Condition{
		KeyName:  "bug_report_status",
		Operator: OperatorIn,
		Values:   []Value{{Text: "resolved"}},
	}); err == nil {
		t.Error("want a status name the column does not store refused")
	}
}

func TestJourneysEntityOffersEveryJourneyKey(t *testing.T) {
	byName := IndexKeysByName(JourneysEntity.Keys)

	wanted := []string{"version_name", "version_code", "patch_version", "patch_id"}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the journeys entity", name)
		}
	}
	if len(JourneysEntity.Keys) != len(wanted) {
		t.Errorf("want %d journey keys, got %d", len(wanted), len(JourneysEntity.Keys))
	}
}

func TestJourneysBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := JourneysEntity.BindKey(Condition{
		KeyName:  "os_name",
		Operator: OperatorIn,
		Values:   []Value{{Text: "android"}},
	})

	if err == nil {
		t.Fatal("want a key the journeys entity does not have refused")
	}
	if !strings.Contains(err.Error(), "os_name") {
		t.Errorf("want the key named, got %q", err)
	}
}

// Asserts the overrides compare the version keys against the
// flat attribute columns of the events table, where the journey
// table itself holds them as a tuple.
func TestJourneyEventsKeyBindingsReadTheEventsColumns(t *testing.T) {
	flt := &Filter{Entity: JourneysEntity, FilterExpr: "version_name:in:1.2.0 AND version_code:in:120"}
	if err := flt.BuildExprTree(); err != nil {
		t.Fatalf("build: %v", err)
	}

	onJourney, err := flt.Predicate(nil)
	if err != nil {
		t.Fatalf("predicate on the journey table: %v", err)
	}
	defer onJourney.Close()
	if got := onJourney.String(); got != "((tupleElement(app_version, 1) in ?) and (tupleElement(app_version, 2) in ?))" {
		t.Errorf("want the tuple columns compared, got %q", got)
	}

	onEvents, err := flt.Predicate(JourneyEventsKeyBindings)
	if err != nil {
		t.Fatalf("predicate on the events table: %v", err)
	}
	defer onEvents.Close()
	if got := onEvents.String(); got != "((attribute.app_version in ?) and (attribute.app_build in ?))" {
		t.Errorf("want the attribute columns compared, got %q", got)
	}
	if args := onEvents.Args(); len(args) != 2 || !slices.Equal(args[0].([]string), []string{"1.2.0"}) || !slices.Equal(args[1].([]string), []string{"120"}) {
		t.Errorf("want the version values bound, got %v", args)
	}
}

func TestAppHealthEntityOffersEveryAppHealthKey(t *testing.T) {
	byName := IndexKeysByName(AppHealthEntity.Keys)

	wanted := []string{"version_name", "version_code"}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the app health entity", name)
		}
	}
	if len(AppHealthEntity.Keys) != len(wanted) {
		t.Errorf("want %d app health keys, got %d", len(wanted), len(AppHealthEntity.Keys))
	}
}

func TestAppHealthBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := AppHealthEntity.BindKey(Condition{
		KeyName:  "os_name",
		Operator: OperatorIn,
		Values:   []Value{{Text: "android"}},
	})

	if err == nil {
		t.Fatal("want a key the app health entity does not have refused")
	}
	if !strings.Contains(err.Error(), "os_name") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestAppHealthEventsKeyBindingsReadTheEventsColumns(t *testing.T) {
	flt := &Filter{Entity: AppHealthEntity, FilterExpr: "version_name:in:1.2.0 AND version_code:in:120"}
	if err := flt.BuildExprTree(); err != nil {
		t.Fatalf("build: %v", err)
	}

	onMetrics, err := flt.Predicate(nil)
	if err != nil {
		t.Fatalf("predicate on the app metrics table: %v", err)
	}
	defer onMetrics.Close()
	if got := onMetrics.String(); got != "((tupleElement(app_version, 1) in ?) and (tupleElement(app_version, 2) in ?))" {
		t.Errorf("want the tuple columns compared, got %q", got)
	}

	onEvents, err := flt.Predicate(AppHealthEventsKeyBindings)
	if err != nil {
		t.Fatalf("predicate on the events table: %v", err)
	}
	defer onEvents.Close()
	if got := onEvents.String(); got != "((`attribute.app_version` in ?) and (`attribute.app_build` in ?))" {
		t.Errorf("want the attribute columns compared, got %q", got)
	}
	if args := onEvents.Args(); len(args) != 2 || !slices.Equal(args[0].([]string), []string{"1.2.0"}) || !slices.Equal(args[1].([]string), []string{"120"}) {
		t.Errorf("want the version values bound, got %v", args)
	}
}

func TestNetworkEntityOffersEveryNetworkKey(t *testing.T) {
	byName := IndexKeysByName(NetworkEntity.Keys)

	wanted := []string{
		"version_name", "version_code", "patch_version", "patch_id",
		"http_method",
		"os_name", "os_version",
		"device_name", "device_manufacturer", "locale",
		"network_type", "network_generation", "network_provider",
		"country",
	}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the network entity", name)
		}
	}
	if len(NetworkEntity.Keys) != len(wanted) {
		t.Errorf("want %d network keys, got %d", len(wanted), len(NetworkEntity.Keys))
	}
}

func TestNetworkBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := NetworkEntity.BindKey(Condition{
		KeyName:  "span_status",
		Operator: OperatorIn,
		Values:   []Value{{Text: "error"}},
	})

	if err == nil {
		t.Fatal("want a key the network entity does not have refused")
	}
	if !strings.Contains(err.Error(), "span_status") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestNetworkHttpMethodComparesLowercased(t *testing.T) {
	condition := Condition{
		KeyName:  "http_method",
		Operator: OperatorIn,
		Values:   []Value{{Text: "get"}},
	}

	onEvents, err := NetworkEntity.BindKey(condition)
	if err != nil {
		t.Fatalf("bind http_method: %v", err)
	}
	defer onEvents.Close()
	if got := onEvents.String(); got != "lower(method) in ?" {
		t.Errorf("want the method column lowercased, got %q", got)
	}

	onMetrics, err := NetworkMetricsKeyBindings["http_method"](condition)
	if err != nil {
		t.Fatalf("bind http_method on the rollup: %v", err)
	}
	defer onMetrics.Close()
	if got := onMetrics.String(); got != "hasAny(arrayMap(method -> lower(method), methods), ?)" {
		t.Errorf("want the method array lowercased, got %q", got)
	}
}

func TestNetworkMetricsKeyBindingsReadTheRollupArrays(t *testing.T) {
	flt := &Filter{Entity: NetworkEntity, FilterExpr: "version_name:in:1.2.0 AND country:in:US"}
	if err := flt.BuildExprTree(); err != nil {
		t.Fatalf("build: %v", err)
	}

	onEvents, err := flt.Predicate(nil)
	if err != nil {
		t.Fatalf("predicate on the events table: %v", err)
	}
	defer onEvents.Close()
	if got := onEvents.String(); got != "((tupleElement(`attribute.app_version`, 1) in ?) and (`inet.country_code` in ?))" {
		t.Errorf("want the event columns compared, got %q", got)
	}

	onMetrics, err := flt.Predicate(NetworkMetricsKeyBindings)
	if err != nil {
		t.Fatalf("predicate on the rollup: %v", err)
	}
	defer onMetrics.Close()
	want := "((hasAny(arrayMap(version -> tupleElement(version, 1), app_versions), ?)) and (hasAny(`inet.country_code`, ?)))"
	if got := onMetrics.String(); got != want {
		t.Errorf("\n got %s\nwant %s", got, want)
	}
	if args := onMetrics.Args(); len(args) != 2 || !slices.Equal(args[0].([]string), []string{"1.2.0"}) || !slices.Equal(args[1].([]string), []string{"US"}) {
		t.Errorf("want the condition values bound, got %v", args)
	}
}

func TestNetworkMetricsBindEveryOperatorTheKeysOffer(t *testing.T) {
	for _, key := range NetworkEntity.Keys {
		t.Run(key.Name, func(t *testing.T) {
			binding, bound := NetworkMetricsKeyBindings[key.Name]
			if !bound {
				t.Fatalf("key %q has no rollup binding", key.Name)
			}
			for _, operator := range key.Operators {
				stmt, err := binding(Condition{
					KeyName:  key.Name,
					Operator: operator,
					Values:   sampleValues(t, key, operator),
				})
				if err != nil {
					t.Errorf("Operator %q: %v", operator, err)
					continue
				}
				if stmt.String() == "" {
					t.Errorf("Operator %q wrote no SQL", operator)
				}
				stmt.Close()
			}
		})
	}
}

func TestSessionsEntityOffersEverySessionKey(t *testing.T) {
	byName := IndexKeysByName(SessionsEntity.Keys)

	wanted := []string{
		"version_name", "version_code", "patch_version", "patch_id",
		"session_events", "session_foreground_background", "session_custom_event", "session_log", "session_screen", "session_error_text",
		"session_id", "user_id",
		"os_name", "os_version",
		"device_name", "device_manufacturer", "locale",
		"network_type", "network_generation", "network_provider",
		"country",
	}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the sessions entity", name)
		}
	}
	if len(SessionsEntity.Keys) != len(wanted) {
		t.Errorf("want %d sessions keys, got %d", len(wanted), len(SessionsEntity.Keys))
	}
}

func TestSessionsBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := SessionsEntity.BindKey(Condition{
		KeyName:  "span_status",
		Operator: OperatorIn,
		Values:   []Value{{Text: "error"}},
	})

	if err == nil {
		t.Fatal("want a key the sessions entity does not have refused")
	}
	if !strings.Contains(err.Error(), "span_status") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestSessionEventsBindPredicates(t *testing.T) {
	bind := func(t *testing.T, operator Operator, names ...string) *sqlf.Stmt {
		t.Helper()
		values := make([]Value, len(names))
		for i, name := range names {
			values[i] = Value{Text: name}
		}
		stmt, err := SessionsEntity.BindKey(Condition{
			KeyName:  "session_events",
			Operator: operator,
			Values:   values,
		})
		if err != nil {
			t.Fatalf("bind events: %v", err)
		}
		return stmt
	}

	t.Run("one value", func(t *testing.T) {
		stmt := bind(t, OperatorIn, "anr")
		defer stmt.Close()

		if got, want := stmt.String(), "(anr_count >= 1)"; got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
		if args := stmt.Args(); len(args) != 0 {
			t.Errorf("want no bound arguments, got %v", args)
		}
	})

	t.Run("many values", func(t *testing.T) {
		stmt := bind(t, OperatorIn, "fatal_error", "anr")
		defer stmt.Close()

		if got, want := stmt.String(), "(fatal_exception_count >= 1 or anr_count >= 1)"; got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
	})

	t.Run("not in", func(t *testing.T) {
		stmt := bind(t, OperatorNotIn, "bug_report")
		defer stmt.Close()

		if got, want := stmt.String(), "not (bug_report_count >= 1)"; got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
	})

	t.Run("user interaction is any gesture", func(t *testing.T) {
		stmt := bind(t, OperatorIn, "user_interaction")
		defer stmt.Close()

		want := "((event_type_counts['gesture_click'] >= 1 or event_type_counts['gesture_long_click'] >= 1 or event_type_counts['gesture_scroll'] >= 1))"
		if got := stmt.String(); got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
	})

	t.Run("unknown value", func(t *testing.T) {
		_, err := SessionsEntity.BindKey(Condition{
			KeyName:  "session_events",
			Operator: OperatorIn,
			Values:   []Value{{Text: "screen_view"}},
		})
		if err == nil {
			t.Fatal("want an event kind the entity does not know refused")
		}
		if !strings.Contains(err.Error(), "screen_view") {
			t.Errorf("want the value named, got %q", err)
		}
	})

	t.Run("operator it does not offer", func(t *testing.T) {
		_, err := SessionsEntity.BindKey(Condition{
			KeyName:  "session_events",
			Operator: OperatorContains,
			Values:   []Value{{Text: "anr"}},
		})
		if err == nil {
			t.Fatal("want contains on events refused")
		}
	})
}

func TestSessionLifecycleBindsPredicates(t *testing.T) {
	bind := func(t *testing.T, operator Operator, names ...string) (*sqlf.Stmt, error) {
		t.Helper()
		values := make([]Value, len(names))
		for i, name := range names {
			values[i] = Value{Text: name}
		}
		return SessionsEntity.BindKey(Condition{
			KeyName:  "session_foreground_background",
			Operator: operator,
			Values:   values,
		})
	}

	foregroundSQL := "(foreground_count >= 1" +
		" or event_type_counts['gesture_click'] >= 1" +
		" or event_type_counts['gesture_long_click'] >= 1" +
		" or event_type_counts['gesture_scroll'] >= 1" +
		" or event_type_counts['lifecycle_activity'] >= 1" +
		" or event_type_counts['lifecycle_view_controller'] >= 1" +
		" or event_type_counts['screen_view'] >= 1)"

	t.Run("foreground is any indicator", func(t *testing.T) {
		stmt, err := bind(t, OperatorIn, "foreground")
		if err != nil {
			t.Fatalf("bind lifecycle: %v", err)
		}
		defer stmt.Close()

		if got, want := stmt.String(), "("+foregroundSQL+")"; got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
		if args := stmt.Args(); len(args) != 0 {
			t.Errorf("want no bound arguments, got %v", args)
		}
	})

	t.Run("background is the background lifecycle count", func(t *testing.T) {
		stmt, err := bind(t, OperatorIn, "background")
		if err != nil {
			t.Fatalf("bind lifecycle: %v", err)
		}
		defer stmt.Close()

		if got, want := stmt.String(), "(background_count >= 1)"; got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
	})

	t.Run("both values match either", func(t *testing.T) {
		stmt, err := bind(t, OperatorIn, "foreground", "background")
		if err != nil {
			t.Fatalf("bind lifecycle: %v", err)
		}
		defer stmt.Close()

		if got, want := stmt.String(), "("+foregroundSQL+" or background_count >= 1)"; got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
	})

	t.Run("not in", func(t *testing.T) {
		stmt, err := bind(t, OperatorNotIn, "foreground")
		if err != nil {
			t.Fatalf("bind lifecycle: %v", err)
		}
		defer stmt.Close()

		if got, want := stmt.String(), "not ("+foregroundSQL+")"; got != want {
			t.Errorf("\n got %s\nwant %s", got, want)
		}
	})

	t.Run("unknown value", func(t *testing.T) {
		_, err := bind(t, OperatorIn, "hibernating")
		if err == nil {
			t.Fatal("want a lifecycle the entity does not know refused")
		}
		if !strings.Contains(err.Error(), "hibernating") {
			t.Errorf("want the value named, got %q", err)
		}
	})

	t.Run("operator it does not offer", func(t *testing.T) {
		if _, err := bind(t, OperatorContains, "foreground"); err == nil {
			t.Fatal("want contains on lifecycle refused")
		}
	})
}

func TestSessionTextKeysReadTheSessionArrays(t *testing.T) {
	bind := func(t *testing.T, keyName string, operator Operator, text string) (*sqlf.Stmt, error) {
		t.Helper()
		return SessionsEntity.BindKey(Condition{
			KeyName:  keyName,
			Operator: operator,
			Values:   []Value{{Text: text}},
		})
	}

	screenArrays := "arrayConcat(unique_screen_view_names, unique_view_classnames," +
		" unique_subview_classnames, unique_view_controller_classnames)"

	errorTextArrays := "arrayConcat(" +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], unique_fatal_exceptions)), " +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], unique_unhandled_exceptions)), " +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], unique_handled_exceptions)), " +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], unique_anrs)), " +
		"arrayFlatten(arrayMap(error -> [JSONExtractString(error, 'code'), if(JSONType(error, 'num_code') = 'Null', '', JSONExtractRaw(error, 'num_code')), JSONExtractRaw(error, 'meta')], unique_errors)))"

	tests := []struct {
		keyName  string
		operator Operator
		want     string
	}{
		{"session_custom_event", OperatorIn, "hasAny(unique_custom_type_names, ?)"},
		{"session_custom_event", OperatorContains, "arrayExists(value -> value ilike ?, unique_custom_type_names)"},
		{"session_log", OperatorContains, "arrayExists(value -> value ilike ?, arrayConcat(unique_logs, unique_strings))"},
		{"session_log", OperatorNotContains, "not arrayExists(value -> value ilike ?, arrayConcat(unique_logs, unique_strings))"},
		{"session_error_text", OperatorContains, "arrayExists(value -> value ilike ?, " + errorTextArrays + ")"},
		{"session_error_text", OperatorEndsWith, "arrayExists(value -> value ilike ?, " + errorTextArrays + ")"},
		{"session_screen", OperatorIn, "hasAny(" + screenArrays + ", ?)"},
		{"session_screen", OperatorStartsWith, "arrayExists(value -> value ilike ?, " + screenArrays + ")"},
	}

	for _, test := range tests {
		t.Run(test.keyName+" "+string(test.operator), func(t *testing.T) {
			stmt, err := bind(t, test.keyName, test.operator, "checkout")
			if err != nil {
				t.Fatalf("bind %s: %v", test.keyName, err)
			}
			defer stmt.Close()

			if got := stmt.String(); got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
		})
	}

	// The bindings answer every text operator, so an operator a key does not
	// offer is turned away when the filter is validated.
	for _, refused := range []string{
		"session_custom_event:ends_with:checkout",
		"session_log:in:checkout",
		"session_error_text:in:checkout",
		"screen:ends_with:checkout",
	} {
		t.Run("refuses "+refused, func(t *testing.T) {
			flt := &Filter{AppID: uuid.New(), Entity: SessionsEntity, Limit: 10, FilterExpr: refused}
			if err := flt.BuildExprTree(); err != nil {
				t.Fatalf("build: %v", err)
			}
			var invalid *ValidationError
			if err := flt.Validate(); !errors.As(err, &invalid) {
				t.Errorf("want %q refused, got %v", refused, err)
			}
		})
	}
}

func TestSessionsAggregatedKeyBindingsReadThePerSessionTotals(t *testing.T) {
	gestureCounts := "sumMap(event_type_counts)['gesture_click'] >= 1" +
		" or sumMap(event_type_counts)['gesture_long_click'] >= 1" +
		" or sumMap(event_type_counts)['gesture_scroll'] >= 1"

	screenArrays := "arrayConcat(groupUniqArrayArray(unique_screen_view_names), groupUniqArrayArray(unique_view_classnames)," +
		" groupUniqArrayArray(unique_subview_classnames), groupUniqArrayArray(unique_view_controller_classnames))"

	errorTextArrays := "arrayConcat(" +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], groupUniqArrayArray(unique_fatal_exceptions))), " +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], groupUniqArrayArray(unique_unhandled_exceptions))), " +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], groupUniqArrayArray(unique_handled_exceptions))), " +
		"arrayFlatten(arrayMap(e -> [e.type, e.message, e.file_name, e.class_name, e.method_name], groupUniqArrayArray(unique_anrs))), " +
		"arrayFlatten(arrayMap(error -> [JSONExtractString(error, 'code'), if(JSONType(error, 'num_code') = 'Null', '', JSONExtractRaw(error, 'num_code')), JSONExtractRaw(error, 'meta')], groupUniqArrayArray(unique_errors))))"

	tests := []struct {
		keyName  string
		operator Operator
		values   []string
		want     string
	}{
		{"session_events", OperatorIn, []string{"fatal_error"}, "(sum(fatal_exception_count) >= 1)"},
		{"session_events", OperatorNotIn, []string{"anr"}, "not (sum(anr_count) >= 1)"},
		{"session_events", OperatorIn, []string{"user_interaction"}, "((" + gestureCounts + "))"},
		{"session_foreground_background", OperatorIn, []string{"foreground"}, "((sum(foreground_count) >= 1 or " + gestureCounts +
			" or sumMap(event_type_counts)['lifecycle_activity'] >= 1" +
			" or sumMap(event_type_counts)['lifecycle_view_controller'] >= 1" +
			" or sumMap(event_type_counts)['screen_view'] >= 1))"},
		{"session_foreground_background", OperatorIn, []string{"background"}, "(sum(background_count) >= 1)"},
		{"user_id", OperatorIn, []string{"alice"}, "hasAny(groupUniqArrayArray(user_ids), ?)"},
		{"patch_id", OperatorIsNotSet, nil, "max(patch_id) = ?"},
		{"patch_version", OperatorIn, []string{"1.2.0-patch.3"}, "max(patch_version) in ?"},
		{"session_log", OperatorContains, []string{"boom"}, "arrayExists(value -> value ilike ?, arrayConcat(groupUniqArrayArray(unique_logs), groupUniqArrayArray(unique_strings)))"},
		{"session_screen", OperatorIn, []string{"Checkout"}, "hasAny(" + screenArrays + ", ?)"},
		{"session_error_text", OperatorContains, []string{"boom"}, "arrayExists(value -> value ilike ?, " + errorTextArrays + ")"},
	}

	for _, test := range tests {
		t.Run(test.keyName+" "+string(test.operator), func(t *testing.T) {
			values := make([]Value, len(test.values))
			for i, text := range test.values {
				values[i] = Value{Text: text}
			}

			binding, bound := SessionsAggregatedKeyBindings[test.keyName]
			if !bound {
				t.Fatalf("key %q has no aggregated binding", test.keyName)
			}
			stmt, err := binding(Condition{KeyName: test.keyName, Operator: test.operator, Values: values})
			if err != nil {
				t.Fatalf("bind %s: %v", test.keyName, err)
			}
			defer stmt.Close()

			if got := stmt.String(); got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
		})
	}
}

func TestErrorsEntityOffersEveryErrorKey(t *testing.T) {
	byName := IndexKeysByName(ErrorsEntity.Keys)

	wanted := []string{
		"error_type",
		"version_name", "version_code", "patch_version", "patch_id",
		"user_id",
		"os_name", "os_version",
		"device_name", "device_manufacturer", "locale",
		"network_type", "network_generation", "network_provider",
		"country",
	}
	for _, name := range wanted {
		if _, ok := byName[name]; !ok {
			t.Errorf("want a %q key on the errors entity", name)
		}
	}
	if len(ErrorsEntity.Keys) != len(wanted) {
		t.Errorf("want %d errors keys, got %d", len(wanted), len(ErrorsEntity.Keys))
	}

	if ErrorsEntity.Keys[0].Name != "error_type" {
		t.Errorf("want the error type key first, got %q", ErrorsEntity.Keys[0].Name)
	}
	if groups := ListKeyGroups(ErrorsEntity.Keys); len(groups) == 0 || groups[0] != KeyGroupError {
		t.Errorf("want the error group listed first, got %v", groups)
	}
}

func TestErrorGroupEventsEntityOffersEveryErrorKeyButTheType(t *testing.T) {
	entity, err := FindByName("error_group_events")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := IndexKeysByName(entity.Keys)["error_type"]; ok {
		t.Error("want no error_type key on the error events entity")
	}
	if want := len(ErrorsEntity.Keys) - 1; len(entity.Keys) != want {
		t.Errorf("want %d error event keys, got %d", want, len(entity.Keys))
	}
	for i, key := range entity.Keys {
		if ErrorsEntity.Keys[i+1].Name != key.Name {
			t.Errorf("want key %d to be %q, got %q", i, ErrorsEntity.Keys[i+1].Name, key.Name)
		}
	}
}

func TestErrorsBindKeyRefusesAKeyTheEntityDoesNotHave(t *testing.T) {
	_, err := ErrorsEntity.BindKey(Condition{
		KeyName:  "session_events",
		Operator: OperatorIn,
		Values:   []Value{{Text: "anr"}},
	})

	if err == nil {
		t.Fatal("want a key the errors entity does not have refused")
	}
	if !strings.Contains(err.Error(), "session_events") {
		t.Errorf("want the key named, got %q", err)
	}
}

func TestErrorTypeBindsPredicates(t *testing.T) {
	bind := func(t *testing.T, operator Operator, names ...string) (*sqlf.Stmt, error) {
		t.Helper()
		values := make([]Value, len(names))
		for i, name := range names {
			values[i] = Value{Text: name}
		}
		return ErrorsEntity.BindKey(Condition{
			KeyName:  "error_type",
			Operator: operator,
			Values:   values,
		})
	}

	const (
		crashSQL     = "(type = 'exception' and (`exception.severity` = 'fatal' or (`exception.severity` = '' and `exception.handled` = false)))"
		anrSQL       = "(type = 'anr')"
		handledSQL   = "(type = 'exception' and (`exception.severity` = 'handled' or (`exception.severity` = '' and `exception.handled` = true)))"
		unhandledSQL = "(type = 'exception' and `exception.severity` = 'unhandled')"
	)

	tests := []struct {
		name     string
		operator Operator
		values   []string
		want     string
	}{
		{"a crash", OperatorIn, []string{ErrorTypeCrash}, "(" + crashSQL + ")"},
		{"an anr", OperatorIn, []string{ErrorTypeANR}, "(" + anrSQL + ")"},
		{"a handled error", OperatorIn, []string{ErrorTypeHandledError}, "(" + handledSQL + ")"},
		{"an unhandled error", OperatorIn, []string{ErrorTypeUnhandledError}, "(" + unhandledSQL + ")"},
		{"many values match either", OperatorIn, []string{ErrorTypeCrash, ErrorTypeANR}, "(" + crashSQL + " or " + anrSQL + ")"},
		{"not in", OperatorNotIn, []string{ErrorTypeANR}, "not (" + anrSQL + ")"},
		{"not in many", OperatorNotIn, []string{ErrorTypeHandledError, ErrorTypeUnhandledError}, "not (" + handledSQL + " or " + unhandledSQL + ")"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			stmt, err := bind(t, test.operator, test.values...)
			if err != nil {
				t.Fatalf("bind error type: %v", err)
			}
			defer stmt.Close()

			if got := stmt.String(); got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
			if args := stmt.Args(); len(args) != 0 {
				t.Errorf("want no bound arguments, got %v", args)
			}
		})
	}

	t.Run("unknown value", func(t *testing.T) {
		_, err := bind(t, OperatorIn, "Kernel Panic")
		if err == nil {
			t.Fatal("want an error kind the entity does not know refused")
		}
		if !strings.Contains(err.Error(), "Kernel Panic") {
			t.Errorf("want the value named, got %q", err)
		}
	})

	t.Run("operator it does not offer", func(t *testing.T) {
		if _, err := bind(t, OperatorContains, ErrorTypeCrash); err == nil {
			t.Fatal("want contains on the error type refused")
		}
	})
}

func TestErrorsBindKeysToEventColumns(t *testing.T) {
	patch := uuid.New()

	tests := []struct {
		keyName  string
		operator Operator
		values   []string
		want     string
	}{
		{"version_name", OperatorIn, []string{"1.2.0"}, "`attribute.app_version` in ?"},
		{"version_code", OperatorNotIn, []string{"120"}, "`attribute.app_build` not in ?"},
		{"patch_version", OperatorContains, []string{"patch"}, "`attribute.patch_version` ilike ?"},
		{"patch_id", OperatorIn, []string{patch.String()}, "`attribute.patch_id` in ?"},
		{"patch_id", OperatorIsSet, nil, "`attribute.patch_id` <> ?"},
		{"patch_id", OperatorIsNotSet, nil, "`attribute.patch_id` = ?"},
		{"user_id", OperatorIn, []string{"alice"}, "`attribute.user_id` in ?"},
		{"os_name", OperatorIn, []string{"android"}, "`attribute.os_name` in ?"},
		{"os_version", OperatorStartsWith, []string{"14"}, "`attribute.os_version` ilike ?"},
		{"device_name", OperatorIn, []string{"pixel"}, "`attribute.device_name` in ?"},
		{"device_manufacturer", OperatorIn, []string{"TestCo"}, "`attribute.device_manufacturer` in ?"},
		{"locale", OperatorIn, []string{"en-US"}, "`attribute.device_locale` in ?"},
		{"network_type", OperatorIn, []string{"wifi"}, "`attribute.network_type` in ?"},
		{"network_generation", OperatorIn, []string{"4g"}, "`attribute.network_generation` in ?"},
		{"network_provider", OperatorIn, []string{"carrier"}, "`attribute.network_provider` in ?"},
		{"country", OperatorNotIn, []string{"US"}, "`inet.country_code` not in ?"},
	}

	for _, test := range tests {
		t.Run(test.keyName+" "+string(test.operator), func(t *testing.T) {
			values := make([]Value, len(test.values))
			for i, text := range test.values {
				values[i] = Value{Text: text}
			}
			stmt, err := ErrorsEntity.BindKey(Condition{
				KeyName:  test.keyName,
				Operator: test.operator,
				Values:   values,
			})
			if err != nil {
				t.Fatalf("bind %s: %v", test.keyName, err)
			}
			defer stmt.Close()

			if got := stmt.String(); got != test.want {
				t.Errorf("\n got %s\nwant %s", got, test.want)
			}
		})
	}

	t.Run("a patch id that is not a uuid", func(t *testing.T) {
		if _, err := ErrorsEntity.BindKey(Condition{
			KeyName:  "patch_id",
			Operator: OperatorIn,
			Values:   []Value{{Text: "not-a-uuid"}},
		}); err == nil {
			t.Fatal("want a patch id that is not a uuid refused")
		}
	})
}

func TestAlertsEntityCannotBeFiltered(t *testing.T) {
	if len(AlertsEntity.Keys) != 0 {
		t.Errorf("want no keys on the alerts entity, got %d", len(AlertsEntity.Keys))
	}

	flt := &Filter{
		AppID:      uuid.New(),
		Entity:     AlertsEntity,
		Limit:      10,
		FilterExpr: "version_name:in:1.2.0",
	}
	if err := flt.BuildExprTree(); err != nil {
		t.Fatalf("build: %v", err)
	}

	err := flt.Validate()
	var invalid *ValidationError
	if !errors.As(err, &invalid) {
		t.Fatalf("want a filter on the alerts entity refused, got %v", err)
	}
	if len(invalid.Issues) != 1 || !strings.Contains(invalid.Issues[0].Message, "version_name") {
		t.Errorf("want the unknown key named, got %v", invalid.Issues)
	}

	if _, err := AlertsEntity.BindKey(Condition{
		KeyName:  "version_name",
		Operator: OperatorIn,
		Values:   []Value{{Text: "1.2.0"}},
	}); !errors.Is(err, ErrKeyNotSupported) {
		t.Errorf("want ErrKeyNotSupported, got %v", err)
	}
}

func TestFindByName(t *testing.T) {
	for _, entity := range allEntities {
		found, err := FindByName(entity.Name)
		if err != nil {
			t.Fatalf("find %q: %v", entity.Name, err)
		}
		if found.Name != entity.Name {
			t.Errorf("want %q, got %q", entity.Name, found.Name)
		}
	}

	if _, err := FindByName("nowhere"); err == nil {
		t.Error("want an unknown entity name refused")
	}
}
