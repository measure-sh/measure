package main

type ByteCounter struct {
	Count int64
}

func (bc *ByteCounter) Write(p []byte) (int, error) {
	n := len(p)
	bc.Count += int64(n)
	return n, nil
}
