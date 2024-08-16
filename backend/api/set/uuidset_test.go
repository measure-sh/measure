package set

import (
	"testing"

	"github.com/google/uuid"
)

func TestNewUUIDSet(t *testing.T) {
	uuidSet := NewUUIDSet()

	if uuidSet.elements == nil {
		t.Error("Expected elements to be not nil")
	}

	expectedLen := 0
	gotLen := len(uuidSet.elements)
	if expectedLen != gotLen {
		t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
	}
}

func TestUUIDSetAdd(t *testing.T) {
	uuidSet := NewUUIDSet()

	uuidOne := uuid.MustParse("0e06c30d-3cb3-415c-9876-a8c0e3f98111")
	uuidTwo := uuid.MustParse("b263068b-548a-4561-add9-9be5ec9e6448")

	uuidSet.Add(uuidOne)
	uuidSet.Add(uuidTwo)

	expectedLen := 2
	gotLen := uuidSet.Size()
	if expectedLen != gotLen {
		t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
	}

	uuidSet.Add(uuidOne)
	expectedLen = 2
	gotLen = uuidSet.Size()
	if expectedLen != gotLen {
		t.Errorf("Expected %d length, got %d", expectedLen, gotLen)
	}
}

func TestUUIDSetSize(t *testing.T) {
	uuidSet := NewUUIDSet()

	uuidOne := uuid.MustParse("0e06c30d-3cb3-415c-9876-a8c0e3f98111")
	uuidTwo := uuid.MustParse("b263068b-548a-4561-add9-9be5ec9e6448")

	uuidSet.Add(uuidOne)
	uuidSet.Add(uuidTwo)

	expectedSize := 2
	gotSize := uuidSet.Size()

	if expectedSize != gotSize {
		t.Errorf("Expected %d size, got %d", expectedSize, gotSize)
	}
}

func TestUUIDSetHas(t *testing.T) {
	uuidSet := NewUUIDSet()

	uuidOne := uuid.MustParse("0e06c30d-3cb3-415c-9876-a8c0e3f98111")
	uuidTwo := uuid.MustParse("b263068b-548a-4561-add9-9be5ec9e6448")

	uuidSet.Add(uuidOne)

	expected := true
	got := uuidSet.Has(uuidOne)

	if expected != got {
		t.Errorf("Expected %v, but got %v", expected, got)
	}

	expected = false
	got = uuidSet.Has(uuidTwo)

	if expected != got {
		t.Errorf("Expected %v, but got %v", expected, got)
	}
}

func TestUUIDSetSlice(t *testing.T) {
	uuidSet := NewUUIDSet()

	uuidOne := uuid.MustParse("0e06c30d-3cb3-415c-9876-a8c0e3f98111")
	uuidTwo := uuid.MustParse("b263068b-548a-4561-add9-9be5ec9e6448")

	uuidSet.Add(uuidOne)
	uuidSet.Add(uuidTwo)

	slice := uuidSet.Slice()

	expectedOne := uuidOne
	gotOne := slice[0]

	if expectedOne != gotOne {
		t.Errorf("Expected %v, but got %v", expectedOne, gotOne)
	}

	expectedTwo := uuidTwo
	gotTwo := slice[1]

	if expectedTwo != gotTwo {
		t.Errorf("Expected %v, but got %v", expectedTwo, gotTwo)
	}

	expectedLen := 2
	gotLen := len(slice)

	if expectedLen != gotLen {
		t.Errorf("Expected %d length, but got %d", expectedLen, gotLen)
	}
}
