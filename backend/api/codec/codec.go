package codec

import (
	"archive/tar"
	"compress/gzip"
	"errors"
	"io"
)

// IsTarGz validates that the expected file
// is a valid gzipped tarball.
func IsTarGz(file io.Reader) (err error) {
	// check if gzip file
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		if errors.Is(err, gzip.ErrHeader) {
			err = errors.Join(errors.New("not a valid gzip file"), err)
			return
		}
		err = errors.Join(errors.New("gzip check failed"), err)
		return
	}

	defer gzipReader.Close()

	// check if tar archive
	tarReader := tar.NewReader(gzipReader)
	_, err = tarReader.Next()
	if err != nil {
		err = errors.Join(errors.New("not a valid tar file"), err)
		return
	}

	return
}
