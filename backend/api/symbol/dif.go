package symbol

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

const (
	// TypeDsymUnknown represents an unknown
	// dSYM entity.
	TypeDsymUnknown DsymType = iota
	// TypeDsymDebug represents a symbol
	// debug entity.
	TypeDsymDebug
)

// String provides the human recognizable
// dSYM entity type.
func (d DsymType) String() string {
	switch d {
	default:
		return "unknown"
	case TypeDsymDebug:
		return "dsymDebug"
	}
}

// DsymType represents the kind of
// entity residing in a dSYM bundle.
type DsymType int

// Dif represents debug information
// files.
//
// Dif is designed to be cross-
// platform. On some platforms, like
// iOS, there may be more than 1 dif
// files.
type Dif struct {
	// Data contains raw bytes of
	// the file.
	Data []byte
	// Meta denotes if the dif is
	// a meta file. This file typically
	// would contain useful information
	// about the Dif file.
	Meta bool
	// Key contains the S3-like
	// object key.
	Key string
}

// ExtractDsymEntities extracts data from Mach-O
// binary by reading a gzipped tarball while
// matching a caller provided predicate.
func ExtractDsymEntities(file io.Reader, filter func(string) (DsymType, bool)) (entities map[DsymType][]*Dif, err error) {
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return
	}

	defer func() {
		if err := gzipReader.Close(); err != nil {
			fmt.Println("failed to close gzip reader while extracting dSYM entities")
		}
	}()

	tarReader := tar.NewReader(gzipReader)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		if header.Typeflag == tar.TypeDir {
			continue
		}

		if dSYMType, ok := filter(header.Name); ok {
			if entities == nil {
				entities = make(map[DsymType][]*Dif)
			}

			debugBytes, err := io.ReadAll(tarReader)
			if err != nil {
				return nil, err
			}

			// we create an isolated byte reader
			// so that one operation reading data
			// does not affect other unrelated
			// operations because we can't reset
			// the seek back to 0 on a *tar.Reader
			debugReaderOne := bytes.NewReader(debugBytes)

			if err = VerifyMachO(debugReaderOne); err != nil {
				return nil, err
			}

			// we create an isolated byte reader
			// so that one operation reading data
			// does not affect other unrelated
			// operations because we can't reset
			// the seek back to 0 on a *tar.Reader
			debugReaderTwo := bytes.NewReader(debugBytes)

			debugId, err := GetMachOUUID(debugReaderTwo)
			if err != nil {
				return nil, err
			}

			parts := strings.Split(header.Name, "/")
			name := parts[len(parts)-1]

			type meta struct {
				Name       string `json:"name"`
				Arch       string `json:"arch"`
				FileFormat string `json:"file_format"`
			}

			m := meta{
				Name:       name,
				Arch:       "arm64",
				FileFormat: "macho",
			}

			metaJson, err := json.Marshal(m)
			if err != nil {
				return nil, err
			}
			unifiedPath := BuildUnifiedLayout(debugId)

			difs := []*Dif{
				{
					Data: debugBytes,
					Meta: false,
					Key:  unifiedPath + "/debuginfo",
				},
				{
					Data: metaJson,
					Meta: true,
					Key:  unifiedPath + "/meta",
				},
			}

			entities[dSYMType] = difs
		}
	}

	return
}

// BuildUnifiedLayout creates a Sentry
// compatible unified layout from a debug id.
func BuildUnifiedLayout(id string) string {
	stripped := strings.ReplaceAll(id, "-", "")
	return fmt.Sprintf("%s/%s", stripped[:2], stripped[2:])
}

// GetMappingKey fetches the mapping file key
// from database.
func GetMappingKey(
	ctx context.Context,
	db *pgxpool.Pool,
	appId uuid.UUID,
	name, code string,
	mType MappingType,
) (key string, err error) {
	stmt := sqlf.PostgreSQL.
		From("build_mappings").
		Select("key").
		Where("app_id = ?", appId).
		Where("version_name = ?", name).
		Where("version_code = ?", code).
		Where("mapping_type = ?", mType)

	defer stmt.Close()

	if err = db.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&key); err != nil {
		return
	}

	return
}

// MappingKeyToDebugId formats a mapping key
// in Unified Layout to a valid UUID.
func MappingKeyToDebugId(key string) string {
	return fmt.Sprintf("%s%s-%s-%s-%s-%s", key[:2], key[3:9], key[9:13], key[13:17], key[17:21], key[21:33])
}

// VerifyMachO verifies Mach-O magic number.
func VerifyMachO(r *bytes.Reader) (err error) {
	buffer := make([]byte, 4096)
	n, err := r.Read(buffer[:8])
	if err != nil && err != io.EOF {
		return
	}

	magic := hex.EncodeToString(buffer[:4])

	if n < 4 || magic != "cffaedfe" && magic != "cefaedfe" {
		return errors.New("failed to find valid Mach-O magic number")
	}

	return
}

// GetMachOUUID extracts the binary id
// from Mach-O binary data.
func GetMachOUUID(r *bytes.Reader) (string, error) {
	const CHUNK_SIZE = 8192
	const LC_UUID_SIZE = 24
	buffer := make([]byte, CHUNK_SIZE)

	for {
		n, err := r.Read(buffer)
		if err == io.EOF {
			return "", nil
		}
		if err != nil {
			return "", fmt.Errorf("failed to read Mach-O stream: %w", err)
		}

		for i := 0; i <= n-LC_UUID_SIZE; i++ {
			if buffer[i] == 0x1b &&
				binary.LittleEndian.Uint32(buffer[i+4:i+8]) == LC_UUID_SIZE {
				uuidBytes := buffer[i+8 : i+8+16]
				debugId := formatUUID(uuidBytes)
				return debugId, nil
			}
		}
	}
}

// formatUUID encodes a uuid byte slice
// to hex string.
func formatUUID(uuid []byte) string {
	return fmt.Sprintf("%s-%s-%s-%s-%s", hex.EncodeToString(uuid[0:4]), hex.EncodeToString(uuid[4:6]), hex.EncodeToString(uuid[6:8]), hex.EncodeToString(uuid[8:10]), hex.EncodeToString(uuid[10:16]))
}
