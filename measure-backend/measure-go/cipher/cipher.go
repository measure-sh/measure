package cipher

import (
	"crypto/rand"
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
