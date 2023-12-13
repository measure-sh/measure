package measure

import (
	"fmt"
	"hash/fnv"
	"io"
)

func checksum(r io.Reader) (string, error) {
	h := fnv.New64()

	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
