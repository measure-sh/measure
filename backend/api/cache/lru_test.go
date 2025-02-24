package cache

import "testing"

func TestPutGet(t *testing.T) {
	lru := NewLRUCache(1)
	lru.Put("foo", "bar")

	expected := "bar"
	got, ok := lru.Get("foo")

	if !ok {
		t.Errorf("Expected ok to be true, but got %v", ok)
	}

	if expected != got {
		t.Errorf("Expected %q to be %v, but got %v", "foo", expected, got)
	}
}

func TestEviction(t *testing.T) {
	lru := NewLRUCache(3)
	lru.Put("fruit", "apple")
	lru.Put("price", 100)
	lru.Put("fresh", true)

	{
		fruit, _ := lru.Get("fruit")
		price, _ := lru.Get("price")
		fresh, _ := lru.Get("fresh")

		expectedFruit := "apple"
		expectedPrice := 100
		expectedFresh := true

		if fruit != expectedFruit {
			t.Errorf("Expected fruit to be %v, but got %v", expectedFruit, fruit)
		}
		if price != expectedPrice {
			t.Errorf("Expected price to be %v, but got %v", expectedPrice, price)
		}
		if !fresh.(bool) {
			t.Errorf("Expected fresh to be %v, but got %v", expectedFresh, fresh)
		}
	}

	lru.Put("foo", "bar")

	{
		fruit, _ := lru.Get("fruit")
		price, _ := lru.Get("price")
		fresh, _ := lru.Get("fresh")
		foo, _ := lru.Get("foo")

		expectedPrice := 100
		expectedFresh := true
		expectedFoo := "bar"

		if fruit != nil {
			t.Errorf("Expected fruit to be %v, but got %v", nil, fruit)
		}
		if price != expectedPrice {
			t.Errorf("Expected price to be %v, but got %v", expectedPrice, price)
		}
		if !fresh.(bool) {
			t.Errorf("Expected fresh to be %v, but got %v", expectedFresh, fresh)
		}
		if foo != expectedFoo {
			t.Errorf("Expected foo to be %v, but got %v", expectedFoo, foo)
		}
	}
}
