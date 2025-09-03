package codec

import (
	"bytes"

	"github.com/klauspost/compress/zstd"
)

// zstdMagic is the magic sequence for detecting
// zstd compressed data.
var zstdMagic = []byte{0x28, 0xB5, 0x2F, 0xFD}

// CompressZstd deflates input bytes using zstd.
func CompressZstd(uncompressed []byte) (compressed []byte, err error) {
	encoder, err := zstd.NewWriter(nil)
	if err != nil {
		return
	}
	defer encoder.Close()

	compressed = encoder.EncodeAll(uncompressed, make([]byte, 0, len(uncompressed)))

	return
}

// IsZstdCompressed determines if zstd has been
// used to compress data.
func IsZstdCompressed(data []byte) bool {
	if len(data) < len(zstdMagic) {
		return false
	}

	return bytes.Equal(data[:len(zstdMagic)], zstdMagic)
}
