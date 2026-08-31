package exprfilter

import (
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

var allEntities = []Entity{BuildsEntity, SpansEntity, BugReportsEntity}

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
			if len(entity.Keys) == 0 {
				t.Error("an entity with no keys can be filtered by nothing")
			}
			if entity.BindKey == nil {
				t.Error("an entity with no BindKey cannot write a filter")
			}
			if entity.SuggestFixedKeyValues == nil {
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
		"version_name", "version_code",
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
