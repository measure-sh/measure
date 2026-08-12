package exprfilter

import (
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

var allEntities = []Entity{BuildsEntity}

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
			if entity.SuggestKeyValues == nil {
				t.Error("an entity with no SuggestKeyValues cannot list what a key can be set to")
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
