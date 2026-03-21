package network

import (
	"reflect"
	"sort"
	"testing"
)

func assertResultsEqual(t *testing.T, expected, actual []UrlPattern) {
	t.Helper()

	sortResults := func(r []UrlPattern) {
		sort.Slice(r, func(i, j int) bool {
			a := r[i].Parts
			b := r[j].Parts

			for k := 0; k < len(a) && k < len(b); k++ {
				if a[k] != b[k] {
					return a[k] < b[k]
				}
			}
			return len(a) < len(b)
		})
	}

	sortResults(expected)
	sortResults(actual)

	if !reflect.DeepEqual(expected, actual) {
		t.Errorf("Expected %v, but got %v", expected, actual)
	}
}

func TestAllSequences_EmptyTrie(t *testing.T) {
	trie := NewUrlTrie(100)
	results := trie.GetPatterns()

	if len(results) != 0 {
		t.Errorf("Expected empty results, but got %v", results)
	}
}

func TestInsert_DistinctPathsRemainSeparate(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "orders"}, Frequency: 1})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 1},
		{Parts: []string{"api.example.com", "api", "v1", "orders"}, Frequency: 1},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_DuplicatePathsIncrementFrequency(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 1})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 2},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_WildcardAbsorbsMatchingSiblings(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "*", "users"}, Frequency: 1})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "*", "users"}, Frequency: 2},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_HighCardinalityTriggersWildcardCollapse(t *testing.T) {
	trie := NewUrlTrie(2)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "1"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "2"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "3"}, Frequency: 1})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "users", "*"}, Frequency: 3},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_HighCardinalityCollapseAppliesToMultipleSegments(t *testing.T) {
	trie := NewUrlTrie(2)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "1", "orders", "A"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "2", "orders", "B"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "3", "orders", "C"}, Frequency: 1})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "users", "*", "orders", "*"}, Frequency: 3},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_HighCardinalityCollapseMaintainsFrequencyForDifferentPaths(t *testing.T) {
	trie := NewUrlTrie(2)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "1", "orders", "A"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "2", "orders", "B"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "3", "orders", "C"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "history"}, Frequency: 1})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "users", "*", "orders", "*"}, Frequency: 3},
		{Parts: []string{"api.example.com", "api", "users", "*"}, Frequency: 1},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_FrequencyGreaterThanOneAccumulatesCorrectly(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 500})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 300})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 800},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_FrequencyPreservedAcrossWildcardCollapse(t *testing.T) {
	trie := NewUrlTrie(2)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "1"}, Frequency: 500})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "2"}, Frequency: 300})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "3"}, Frequency: 200})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "users", "*"}, Frequency: 1000},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestSeedTrie_NewEventsRouteThroughExistingWildcards(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "*", "orders"}, Frequency: 0})

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "42", "orders"}, Frequency: 5})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "99", "orders"}, Frequency: 3})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "users", "*", "orders"}, Frequency: 8},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestSeedTrie_ZeroFrequencyPatternsNotInOutput(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 0})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "orders"}, Frequency: 0})

	results := trie.GetPatterns()
	if len(results) != 0 {
		t.Errorf("Expected empty results for zero-Frequency seeds, but got %v", results)
	}

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 5})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 5},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_MultipleDomainsSeparate(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "users"}, Frequency: 3})
	trie.Insert(UrlPattern{Parts: []string{"cdn.example.com", "users"}, Frequency: 7})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "users"}, Frequency: 3},
		{Parts: []string{"cdn.example.com", "users"}, Frequency: 7},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_IntermediateNodeIsPattern(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api"}, Frequency: 2})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 5})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api"}, Frequency: 2},
		{Parts: []string{"api.example.com", "api", "v1", "users"}, Frequency: 5},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_NewEventsRouteIntoAlreadyCollapsedWildcard(t *testing.T) {
	trie := NewUrlTrie(2)

	// Trigger collapse
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "1"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "2"}, Frequency: 1})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "3"}, Frequency: 1})

	// New insertions should route through the existing wildcard
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "4"}, Frequency: 10})
	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "api", "users", "5"}, Frequency: 20})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "api", "users", "*"}, Frequency: 33},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_SingleSegmentDomainOnly(t *testing.T) {
	trie := NewUrlTrie(100)

	trie.Insert(UrlPattern{Parts: []string{"example.com"}, Frequency: 5})

	expected := []UrlPattern{
		{Parts: []string{"example.com"}, Frequency: 5},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestInsert_HighCardinalityDomainsNeverCollapse(t *testing.T) {
	trie := NewUrlTrie(2)

	trie.Insert(UrlPattern{Parts: []string{"api.example.com", "users"}, Frequency: 3})
	trie.Insert(UrlPattern{Parts: []string{"cdn.example.com", "users"}, Frequency: 7})
	trie.Insert(UrlPattern{Parts: []string{"auth.example.com", "users"}, Frequency: 1})

	expected := []UrlPattern{
		{Parts: []string{"api.example.com", "users"}, Frequency: 3},
		{Parts: []string{"cdn.example.com", "users"}, Frequency: 7},
		{Parts: []string{"auth.example.com", "users"}, Frequency: 1},
	}

	assertResultsEqual(t, expected, trie.GetPatterns())
}

func TestPartsToUrl(t *testing.T) {
	got := partsToUrl([]string{"example.com", "api", "v1", "users"})
	expected := "example.com/api/v1/users"
	if got != expected {
		t.Errorf("expected %s, got %s", expected, got)
	}
}
