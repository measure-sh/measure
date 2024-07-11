package cipher

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"io"
)

// ComputeSHA2Hash computes SHA256 hash of input
// bytes and returns the full hash encoded as
// string.
func ComputeSHA2Hash(bytes []byte) (*string, error) {
	hash := sha256.New()
	if _, err := hash.Write(bytes); err != nil {
		return nil, err
	}
	checksum := hex.EncodeToString(hash.Sum(nil))
	return &checksum, nil
}

// ComputeChecksum computes SHA256 hash of input
// bytes and returns the first 8 characters of the
// hash.
func ComputeChecksum(bytes []byte) (*string, error) {
	hash := sha256.New()
	if _, err := hash.Write(bytes); err != nil {
		return nil, err
	}
	checksum := hex.EncodeToString(hash.Sum(nil))[:8]
	return &checksum, nil
}

// ChecksumFnv1 computes Fnv1 hash.
func ChecksumFnv1(r io.Reader) (string, error) {
	h := fnv.New64()

	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
