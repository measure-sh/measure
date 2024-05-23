package group

import (
	"measure-backend/measure-go/filter"
	"reflect"
	"testing"

	"github.com/google/uuid"
)

var groups = []ExceptionGroup{
	{
		ID: func() uuid.UUID {
			id, _ := uuid.Parse("018da688-071c-7207-a1fe-ef529bde9963")
			return id
		}(),
		Name: "foo0",
	},
	{
		ID: func() uuid.UUID {
			id, _ := uuid.Parse("018da688-13e1-76db-8ad7-632401256db3")
			return id
		}(),
		Name: "foo1",
	},
	{
		ID: func() uuid.UUID {
			id, _ := uuid.Parse("018da688-50e5-7479-9225-8b6756adbe39")
			return id
		}(),
		Name: "foo2",
	},
}

func TestPaginateGroups(t *testing.T) {
	subgroup, next, previous := PaginateGroups[ExceptionGroup](groups, &filter.AppFilter{})

	{
		expected := len(groups)
		got := len(subgroup)
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := groups[0].ID.String()
		got := subgroup[0].ID.String()
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}
	{
		expected := groups[len(groups)-1].ID.String()
		got := subgroup[len(groups)-1].ID.String()
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := false
		got := next
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := false
		got := previous
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

}

func TestForwardLimitOne(t *testing.T) {
	subgroup, next, previous := PaginateGroups[ExceptionGroup](groups, &filter.AppFilter{
		Limit: 1,
	})

	{
		expected := 1
		got := len(subgroup)
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := "018da688-071c-7207-a1fe-ef529bde9963"
		got := subgroup[0].ID.String()
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := true
		got := next
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := false
		got := previous
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}
}

func TestBackwardLimitOne(t *testing.T) {
	subgroup, next, previous := PaginateGroups[ExceptionGroup](groups, &filter.AppFilter{
		Limit: -1,
	})

	{
		expected := 0
		got := len(subgroup)
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := true
		got := next
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := false
		got := previous
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}
}

func TestForwardLimitWithID(t *testing.T) {
	subgroup, next, previous := PaginateGroups[ExceptionGroup](groups, &filter.AppFilter{
		KeyID: groups[0].ID.String(),
		Limit: 1,
	})

	{
		expected := 1
		got := len(subgroup)
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := groups[1].ID.String()
		got := subgroup[0].ID.String()
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := true
		got := next
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := true
		got := previous
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	subgroup, next, previous = PaginateGroups[ExceptionGroup](groups, &filter.AppFilter{
		KeyID: groups[len(groups)-1].ID.String(),
		Limit: 1,
	})

	{
		expected := 0
		got := len(subgroup)
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := false
		got := next
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := true
		got := previous
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}
}

func TestBackwardLimitWithID(t *testing.T) {
	subgroup, next, previous := PaginateGroups[ExceptionGroup](groups, &filter.AppFilter{
		KeyID: groups[0].ID.String(),
		Limit: -1,
	})

	{
		expected := 0
		got := len(subgroup)
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := true
		got := next
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := false
		got := previous
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}
}
