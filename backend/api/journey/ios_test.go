package journey

import (
	"testing"

	"github.com/google/uuid"
)

func TestNewJourneyiOSOne(t *testing.T) {
	events, err := readEvents("ios_events_one.json")
	if err != nil {
		panic(err)
	}

	journey := NewJourneyiOS(events, &Options{
		BiGraph: true,
	})

	expectedOrder := 3
	gotOrder := journey.Graph.Order()

	if expectedOrder != gotOrder {
		t.Errorf("Expected %d order, but got %d", expectedOrder, gotOrder)
	}

	expectedString := "3 [{0 1} {1 2}]"
	gotString := journey.Graph.String()

	if expectedString != gotString {
		t.Errorf("Expected %q, got %q", expectedString, gotString)
	}

	// forward direction
	{
		sessionIds := journey.metalut[journey.makeKey(0, 1)].Slice()
		expectedLen := 1
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("557c5de5-4cdd-46d5-891a-7d77fdb94a87"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
	}

	{
		sessionIds := journey.metalut[journey.makeKey(1, 2)].Slice()
		expectedLen := 1
		gotLen := len(sessionIds)
		if expectedLen != gotLen {
			t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
		}

		expected := []uuid.UUID{
			uuid.MustParse("557c5de5-4cdd-46d5-891a-7d77fdb94a87"),
		}
		if expected[0] != sessionIds[0] {
			t.Errorf("Expected %v, but got %v", expected[0], sessionIds[0])
		}
	}
}
