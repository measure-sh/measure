package codec

import (
	"github.com/klauspost/compress/zstd"
)

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
