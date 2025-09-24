package symbol

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
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
func ExtractDsymEntities(file io.Reader, filter func(string) (DsymType, bool)) (entities [][]*Dif, err error) {
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

		if _, ok := filter(header.Name); ok {
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

			entities = append(entities, difs)
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

// MappingKeyToDebugId formats a mapping key
// in Unified Layout to a valid UUID.
func MappingKeyToDebugId(key string) string {
	return fmt.Sprintf("%s%s-%s-%s-%s-%s", key[:2], key[3:9], key[9:13], key[13:17], key[17:21], key[21:33])
}

// MappingKeyToCodeId formats a mapping key
// in Unified Layout to a valid CodeId.
func MappingKeyToCodeId(key string) string {
	noSlash := strings.Replace(key, "/", "", -1)
	result := strings.Replace(noSlash, "debuginfo", "", -1)
	return result
}

// VerifyMachO verifies Mach-O magic number.
func VerifyMachO(r *bytes.Reader) (err error) {
	buffer := make([]byte, 4096)
	n, err := r.Read(buffer[:8])
	if err != nil && err != io.EOF {
		return
	}

	magic := hex.EncodeToString(buffer[:4])

	// Mach-O magic numbers
	// "cafebabe" is used by dSYMs generate by Dart/Flutter
	// https://ilostmynotes.blogspot.com/2014/05/mach-o-filetype-identification.html
	if n < 4 || magic != "cffaedfe" && magic != "cefaedfe" && magic != "cafebabe" {
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

// extracts the architecture from an ELF file
func GetArchFromELF(elfData []byte) (string, error) {
	if len(elfData) < 20 {
		return "", fmt.Errorf("invalid ELF data: too short")
	}

	// Validate ELF magic number
	if !bytes.Equal(elfData[:4], []byte{0x7f, 'E', 'L', 'F'}) {
		return "", fmt.Errorf("not a valid ELF file")
	}

	dataEncoding := elfData[5]
	var bo binary.ByteOrder

	switch dataEncoding {
	case 1:
		bo = binary.LittleEndian
	case 2:
		bo = binary.BigEndian
	default:
		return "", fmt.Errorf("invalid byte order class: %d", dataEncoding)
	}

	// e_machine is at offset 18 (0x12) for both 32-bit and 64-bit ELF
	eMachine := bo.Uint16(elfData[18:20])

	switch eMachine {
	case 3:
		return "x86", nil
	case 62:
		return "x86_64", nil
	case 40:
		return "arm", nil
	case 183:
		return "arm64", nil
	default:
		return "", fmt.Errorf("unknown architecture: %d", eMachine)
	}
}

// extracts the build id from an ELF file
// ELF files have a section header table that describes each section in the file.
// We use shoff (table start offset), shentsize (entry size), and shnum (entry count) to loop through them.
//
// Each section may look like this (simplified):
//
// Index | Name Offset | Type     | Offset  | Size   |
// ------|-------------|----------|---------|--------|
//
//	0   |      1      | PROGBITS | 0x100   | 0x200  | <- .text
//	1   |     11      | PROGBITS | 0x300   | 0x100  | <- .data
//	2   |     21      | NOTE     | 0x400   | 0x24   | <- .note.gnu.build-id
//
// The section name (like ".note.gnu.build-id") is found using the "Name Offset" into the section name string table,
// which is another section itself, located using shstrndx.
func GetBuildIDFromELF(elfData []byte) (string, error) {
	if len(elfData) < 0x40 {
		return "", fmt.Errorf("invalid ELF file: too small")
	}

	// Check ELF magic number
	if !bytes.Equal(elfData[:4], []byte{0x7f, 'E', 'L', 'F'}) {
		return "", fmt.Errorf("not a valid ELF file")
	}

	class := elfData[4]
	dataEncoding := elfData[5]
	var bo binary.ByteOrder
	switch dataEncoding {
	case 1:
		bo = binary.LittleEndian
	case 2:
		bo = binary.BigEndian
	default:
		return "", fmt.Errorf("unknown ELF data encoding")
	}

	var shoff, shentsize, shnum, shstrndx uint64

	switch class {
	case 1: // 32-bit ELF
		// File offset where the section header table begins
		shoff = uint64(bo.Uint32(elfData[0x20:0x24]))

		// Size of each entry in the section header table
		shentsize = uint64(bo.Uint16(elfData[0x2e:0x30]))

		// Number of entries in the section header table
		shnum = uint64(bo.Uint16(elfData[0x30:0x32]))

		// Index of the section that contains the section name strings
		shstrndx = uint64(bo.Uint16(elfData[0x32:0x34]))

	case 2: // 64-bit ELF
		// File offset where the section header table begins
		shoff = bo.Uint64(elfData[0x28:0x30])

		// Size of each entry in the section header table
		shentsize = uint64(bo.Uint16(elfData[0x3a:0x3c]))

		// Number of entries in the section header table
		shnum = uint64(bo.Uint16(elfData[0x3c:0x3e]))

		// Index of the section that contains the section name strings
		shstrndx = uint64(bo.Uint16(elfData[0x3e:0x40]))

	default:
		return "", fmt.Errorf("unsupported ELF class")
	}

	// Bounds check
	if int(shoff+shentsize*shnum) > len(elfData) {
		return "", fmt.Errorf("section headers out of bounds")
	}

	// Read section header string table offset
	shstrOffset := shoff + shstrndx*shentsize
	if int(shstrOffset+shentsize) > len(elfData) {
		return "", fmt.Errorf("shstrndx out of bounds")
	}
	var shstrtabOffset uint64
	if class == 1 {
		shstrtabOffset = uint64(bo.Uint32(elfData[shstrOffset+0x10 : shstrOffset+0x14]))
	} else {
		shstrtabOffset = bo.Uint64(elfData[shstrOffset+0x18 : shstrOffset+0x20])
	}

	// Locate .note.gnu.build-id section
	for i := uint64(0); i < shnum; i++ {
		off := shoff + i*shentsize
		var nameOffset uint32
		var sectionOffset, sectionSize uint64

		if class == 1 {
			nameOffset = bo.Uint32(elfData[off : off+4])
			sectionOffset = uint64(bo.Uint32(elfData[off+0x10 : off+0x14]))
			sectionSize = uint64(bo.Uint32(elfData[off+0x14 : off+0x18]))
		} else {
			nameOffset = bo.Uint32(elfData[off : off+4])
			sectionOffset = bo.Uint64(elfData[off+0x18 : off+0x20])
			sectionSize = bo.Uint64(elfData[off+0x20 : off+0x28])
		}

		// Resolve section name
		if int(shstrtabOffset+uint64(nameOffset)) >= len(elfData) {
			continue
		}
		sectionName := readNullTerminatedString(elfData[shstrtabOffset+uint64(nameOffset):])

		if sectionName == ".note.gnu.build-id" {
			if int(sectionOffset+sectionSize) > len(elfData) {
				return "", fmt.Errorf("build-id section out of bounds")
			}
			note := elfData[sectionOffset : sectionOffset+sectionSize]

			if len(note) < 16 {
				return "", fmt.Errorf("note section too small")
			}

			nameSize := bo.Uint32(note[0:4])
			descSize := bo.Uint32(note[4:8])
			noteType := bo.Uint32(note[8:12])

			if noteType != 3 {
				return "", fmt.Errorf("unexpected note type: %d", noteType)
			}

			nameStart := 12
			nameEnd := nameStart + int(nameSize)
			descStart := (nameEnd + 3) &^ 3 // align to 4
			descEnd := descStart + int(descSize)

			if descEnd > len(note) {
				return "", fmt.Errorf("invalid note sizes")
			}

			return hex.EncodeToString(note[descStart:descEnd]), nil
		}
	}

	return "", fmt.Errorf("build-id not found")
}

// readNullTerminatedString returns the string up to the first null byte
func readNullTerminatedString(b []byte) string {
	if i := bytes.IndexByte(b, 0); i >= 0 {
		return string(b[:i])
	}
	return string(b)
}
