package main

// ByteCounter allows you to count bytes
type ByteCounter struct {
	Count int64
}

// ByteCounter implements the Write interface
func (bc *ByteCounter) Write(p []byte) (int, error) {
	n := len(p)
	bc.Count += int64(n)
	return n, nil
}

// Add adds count number of bytes and
// returns the total count
func (bc *ByteCounter) Add(count int) int64 {
	bc.Count += int64(count)
	return bc.Count
}
