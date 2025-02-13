package cache

import (
	"container/list"
	"sync"
)

// LRUCache represents a thread-safe
// LRU cache.
type LRUCache struct {
	cap   int
	cache map[string]*list.Element
	list  *list.List
	mu    sync.Mutex
}

type entry struct {
	key   string
	value any
}

// New initialized a new LRU cache
// with given capacity.
func NewLRUCache(cap int) *LRUCache {
	return &LRUCache{
		cap:   cap,
		cache: make(map[string]*list.Element),
		list:  list.New(),
	}
}

// Get retrieves a value from the cache
// and marks it as recently used.
func (c *LRUCache) Get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.cache[key]; ok {
		c.list.MoveToFront(elem)
		return elem.Value.(*entry).value, true
	}

	return nil, false
}

// Put inserts a value into the cache, evicting
// the least recently used item if necessary.
func (c *LRUCache) Put(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.cache[key]; ok {
		c.list.MoveToFront(elem)
		elem.Value.(*entry).value = value
		return
	}

	if c.list.Len() >= c.cap {
		c.evict()
	}

	e := &entry{key, value}
	elem := c.list.PushFront(e)
	c.cache[key] = elem
}

// evict removes the least recently
// used item from the cache.
func (c *LRUCache) evict() {
	elem := c.list.Back()
	if elem != nil {
		c.list.Remove(elem)
		kv := elem.Value.(*entry)
		delete(c.cache, kv.key)
	}
}
