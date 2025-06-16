package group

import (
	"backend/api/filter"
	"backend/api/paginate"
	"reflect"
	"testing"
)

var groups = []ExceptionGroup{
	{
		ID:         "5d41402abc4b2a76b9719d911017c592",
		Type:       "type0",
		Message:    "Message0",
		MethodName: "MethodName0",
		FileName:   "FileName0",
		LineNumber: 0,
	},
	{
		ID:         "6e809cbda0732ac4845916a59016f954",
		Type:       "type1",
		Message:    "Message1",
		MethodName: "MethodName1",
		FileName:   "FileName1",
		LineNumber: 1,
	},
	{
		ID:         "7ce8be0fa3932e840f6a19c2b83e11ae",
		Type:       "type2",
		Message:    "Message2",
		MethodName: "MethodName2",
		FileName:   "FileName2",
		LineNumber: 2,
	},
}

func TestPaginateGroups(t *testing.T) {
	subgroup, next, previous := paginate.Paginate(groups, &filter.AppFilter{})

	{
		expected := len(groups)
		got := len(subgroup)
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}

	{
		expected := groups[0].ID
		got := subgroup[0].ID
		if !reflect.DeepEqual(expected, got) {
			t.Errorf("Expected %v but got %v", expected, got)
		}
	}
	{
		expected := groups[len(groups)-1].ID
		got := subgroup[len(groups)-1].ID
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
	subgroup, next, previous := paginate.Paginate(groups, &filter.AppFilter{
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
		expected := "5d41402abc4b2a76b9719d911017c592"
		got := subgroup[0].ID
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
	subgroup, next, previous := paginate.Paginate(groups, &filter.AppFilter{
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
	subgroup, next, previous := paginate.Paginate(groups, &filter.AppFilter{
		KeyID: groups[0].ID,
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
		expected := groups[1].ID
		got := subgroup[0].ID
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

	subgroup, next, previous = paginate.Paginate(groups, &filter.AppFilter{
		KeyID: groups[len(groups)-1].ID,
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
	subgroup, next, previous := paginate.Paginate(groups, &filter.AppFilter{
		KeyID: groups[0].ID,
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
