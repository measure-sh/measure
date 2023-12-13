package cipher

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"io"
)

func InviteCode() (string, error) {
	bytes := make([]byte, 64)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(bytes), nil
}

func ChecksumFnv1(r io.Reader) (string, error) {
	h := fnv.New64()

	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
