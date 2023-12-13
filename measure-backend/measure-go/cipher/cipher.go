package cipher

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

func InviteCode() (string, error) {
	bytes := make([]byte, 64)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(bytes), nil
}

func ComputeChecksum(bytes []byte) (*string, error) {
	hash := sha256.New()
	if _, err := hash.Write(bytes); err != nil {
		return nil, err
	}
	checksum := hex.EncodeToString(hash.Sum(nil))[:8]
	return &checksum, nil
}
