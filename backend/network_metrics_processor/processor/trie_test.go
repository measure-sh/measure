package processor

import (
	"reflect"
	"sort"
	"strings"
	"testing"
)

func assertResultsEqual(t *testing.T, expected, actual []UrlPattern) {
	t.Helper()

	sortResults := func(r []UrlPattern) {
		sort.Slice(r, func(i, j int) bool {
			return strings.Join(r[i].Segments, "/") < strings.Join(r[j].Segments, "/")
		})
	}

	sortResults(expected)
	sortResults(actual)

	if !reflect.DeepEqual(expected, actual) {
		t.Errorf("Expected %v, but got %v", expected, actual)
	}
}

func TestAllSequences_EmptyTree(t *testing.T) {
	tree := NewUrlTrie(100)
	results := tree.GetPatterns()

	if len(results) != 0 {
		t.Errorf("Expected empty results, but got %v", results)
	}
}

func TestInsert_DistinctPathsRemainSeparate(t *testing.T) {
	tree := NewUrlTrie(100)
	tree.Insert([]string{"api.example.com", "api", "v1", "users"})
	tree.Insert([]string{"api.example.com", "api", "v1", "orders"})

	expected := []UrlPattern{
		{Segments: []string{"api.example.com", "api", "v1", "users"}, Frequency: 1},
		{Segments: []string{"api.example.com", "api", "v1", "orders"}, Frequency: 1},
	}
	assertResultsEqual(t, expected, tree.GetPatterns())
}

func TestInsert_DuplicatePathsIncrementFrequency(t *testing.T) {
	tree := NewUrlTrie(100)
	tree.Insert([]string{"api.example.com", "api", "v1", "users"})
	tree.Insert([]string{"api.example.com", "api", "v1", "users"})

	expected := []UrlPattern{
		{Segments: []string{"api.example.com", "api", "v1", "users"}, Frequency: 2},
	}
	assertResultsEqual(t, expected, tree.GetPatterns())
}

func TestInsert_WildcardAbsorbsMatchingSiblings(t *testing.T) {
	tree := NewUrlTrie(100)
	tree.Insert([]string{"api.example.com", "api", "v1", "users"})
	tree.Insert([]string{"api.example.com", "api", "*", "users"})

	expected := []UrlPattern{
		{Segments: []string{"api.example.com", "api", "*", "users"}, Frequency: 3},
	}
	assertResultsEqual(t, expected, tree.GetPatterns())
}

func TestInsert_HighCardinalityTriggersWildcardCollapse(t *testing.T) {
	tree := NewUrlTrie(2)
	tree.Insert([]string{"api.example.com", "api", "users", "1"})
	tree.Insert([]string{"api.example.com", "api", "users", "2"})
	tree.Insert([]string{"api.example.com", "api", "users", "3"})

	expected := []UrlPattern{
		{Segments: []string{"api.example.com", "api", "users", "*"}, Frequency: 3},
	}
	assertResultsEqual(t, expected, tree.GetPatterns())
}

func TestInsert_HighCardinalityCollapseAppliesToMultipleSegments(t *testing.T) {
	tree := NewUrlTrie(2)
	tree.Insert([]string{"api.example.com", "api", "users", "1", "orders", "A"})
	tree.Insert([]string{"api.example.com", "api", "users", "2", "orders", "B"})
	tree.Insert([]string{"api.example.com", "api", "users", "3", "orders", "C"})

	expected := []UrlPattern{
		{Segments: []string{"api.example.com", "api", "users", "*", "orders", "*"}, Frequency: 3},
	}
	assertResultsEqual(t, expected, tree.GetPatterns())
}

func TestInsert_HighCardinalityCollapseMaintainsFrequencyFor(t *testing.T) {
	tree := NewUrlTrie(2)
	tree.Insert([]string{"api.example.com", "api", "users", "1", "orders", "A"})
	tree.Insert([]string{"api.example.com", "api", "users", "2", "orders", "B"})
	tree.Insert([]string{"api.example.com", "api", "users", "3", "orders", "C"})

	expected := []UrlPattern{
		{Segments: []string{"api.example.com", "api", "users", "*", "orders", "*"}, Frequency: 3},
	}
	assertResultsEqual(t, expected, tree.GetPatterns())
}

func TestInsert_HighCardinalityCollapseMaintainsFrequencyForDifferentPaths(t *testing.T) {
	tree := NewUrlTrie(2)
	tree.Insert([]string{"api.example.com", "api", "users", "1", "orders", "A"})
	tree.Insert([]string{"api.example.com", "api", "users", "2", "orders", "B"})
	tree.Insert([]string{"api.example.com", "api", "users", "3", "orders", "C"})
	tree.Insert([]string{"api.example.com", "api", "users", "history"})

	expected := []UrlPattern{
		{Segments: []string{"api.example.com", "api", "users", "*", "orders", "*"}, Frequency: 3},
		{Segments: []string{"api.example.com", "api", "users", "*"}, Frequency: 1},
	}

	assertResultsEqual(t, expected, tree.GetPatterns())
}
