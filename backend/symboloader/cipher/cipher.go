package cipher

import (
	"fmt"
	"hash/fnv"
	"io"
)

// ChecksumFnv1 computes Fnv1 hash.
func ChecksumFnv1(r io.Reader) (string, error) {
	h := fnv.New64()

	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
