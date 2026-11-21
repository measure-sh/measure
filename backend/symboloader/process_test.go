package main

import (
	"errors"
	"fmt"
	"testing"

	"backend/libs/symbol"

	"symboloader/server"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
)

// TestRecordArtifact checks the one-row-per-artifact split: the
// first non-meta dif fills the existing row, every later dif
// becomes an extra row. Every row carries the passed per-object
// checksum & its own object size.
func TestRecordArtifact(t *testing.T) {
	// buildLocation reads the global server config
	server.SetConfig(&server.ServerConfig{SymbolsBucket: "test", SymbolsBucketRegion: "us-east-1"})

	b := &Build{
		Mappings: []*Mapping{{Type: symbol.TypeJsBundle.String()}},
	}

	difs := []*symbol.Dif{
		{Key: "8d/f7/main.jsbundle", Data: []byte("bundle-bytes")},
		{Key: "bb/8f/main.jsbundle.map", Data: []byte("sourcemap")},
		{Key: "cc/11/extra.js", Data: []byte("x")},
	}

	for i, dif := range difs {
		checksum := "cksum-" + dif.Key
		if err := b.recordArtifact(0, dif, checksum); err != nil {
			t.Fatalf("recordArtifact[%d]: %v", i, err)
		}
	}

	// primary row holds the first artifact & its checksum
	if b.Mappings[0].Key != "8d/f7/main.jsbundle" {
		t.Fatalf("primary key = %q, want first dif", b.Mappings[0].Key)
	}
	if b.Mappings[0].Checksum != "cksum-8d/f7/main.jsbundle" {
		t.Fatalf("primary checksum = %q, want per-object", b.Mappings[0].Checksum)
	}
	if b.Mappings[0].Size != int64(len("bundle-bytes")) {
		t.Fatalf("primary size = %d, want per-object", b.Mappings[0].Size)
	}
	if !b.Mappings[0].UploadComplete {
		t.Fatal("primary should be marked upload complete")
	}

	// remaining artifacts become extra rows
	if len(b.Extras) != 2 {
		t.Fatalf("extras = %d, want 2", len(b.Extras))
	}
	if b.Extras[0].Key != "bb/8f/main.jsbundle.map" || b.Extras[1].Key != "cc/11/extra.js" {
		t.Fatalf("extra keys = %q, %q", b.Extras[0].Key, b.Extras[1].Key)
	}
	// each extra carries the passed checksum & its own object size
	if b.Extras[0].Checksum != "cksum-bb/8f/main.jsbundle.map" {
		t.Fatalf("extra[0] checksum = %q", b.Extras[0].Checksum)
	}
	if b.Extras[0].Size != int64(len("sourcemap")) {
		t.Fatalf("extra[0] size = %d, want per-object", b.Extras[0].Size)
	}
	if b.Extras[0].Type != symbol.TypeJsBundle.String() {
		t.Fatalf("extra[0] type = %q", b.Extras[0].Type)
	}
}

// TestArtifactExists is the dedup gate: an object is skipped only
// when a sibling row matches on key, checksum & patch id. Matching
// on key+checksum alone makes a redelivered notification
// idempotent; the patch id term stops a different patch's identical
// zero-byte bundle content from falsely colliding.
func TestArtifactExists(t *testing.T) {
	patchA := uuid.MustParse("aaaaaaaa-0000-0000-0000-000000000001")
	patchB := uuid.MustParse("bbbbbbbb-0000-0000-0000-000000000002")

	b := &Build{
		Mappings: []*Mapping{
			{Key: "8d/f7/main.jsbundle", Checksum: "C1", PatchID: patchA},
			{Key: "bb/8f/main.jsbundle.map", Checksum: "C2", PatchID: patchA},
		},
	}

	if !b.artifactExists("8d/f7/main.jsbundle", "C1", patchA) {
		t.Fatal("exact key+checksum+patch match should exist")
	}
	if b.artifactExists("8d/f7/main.jsbundle", "C9", patchA) {
		t.Fatal("same key different checksum must not match")
	}
	if b.artifactExists("zz/00/other.js", "C1", patchA) {
		t.Fatal("unknown key must not match")
	}
	// Same key+checksum, different patch: a different OTA patch's
	// identical (zero-byte) bundle must not dedup against this one.
	if b.artifactExists("8d/f7/main.jsbundle", "C1", patchB) {
		t.Fatal("same key+checksum different patch must not match")
	}
}

func TestIsTransient(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"wrapped permanent", fmt.Errorf("ctx: %w", permanent(errors.New("bad"))), false},
		{"plain", errors.New("db down"), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isTransient(tt.err); got != tt.want {
				t.Fatalf("isTransient = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestClassifyReadError(t *testing.T) {
	tests := []struct {
		name         string
		err          error
		classify     func(error) error
		wantPerm     bool
		wantNotFound bool
	}{
		{"s3 no such key", fmt.Errorf("get: %w", &types.NoSuchKey{}), classifyS3ReadError, true, true},
		{"s3 other", errors.New("timeout"), classifyS3ReadError, false, false},
		{"gcs not exist", fmt.Errorf("get: %w", storage.ErrObjectNotExist), classifyGCSReadError, true, true},
		{"gcs other", errors.New("timeout"), classifyGCSReadError, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.classify(tt.err)
			if perm := errors.Is(got, ErrPermanentFailure); perm != tt.wantPerm {
				t.Fatalf("permanent = %v, want %v", perm, tt.wantPerm)
			}
			if nf := errors.Is(got, ErrIncomingNotFound); nf != tt.wantNotFound {
				t.Fatalf("not found = %v, want %v", nf, tt.wantNotFound)
			}
		})
	}
}

func TestSettleIncoming(t *testing.T) {
	tests := []struct {
		name        string
		err         error
		wantDeleted bool
	}{
		{"success", nil, true},
		{"permanent", permanent(errors.New("bad")), true},
		{"not found", classifyGCSReadError(storage.ErrObjectNotExist), false},
		{"transient", errors.New("db down"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deleted := false
			settleIncoming("incoming/x", tt.err, func() { deleted = true })
			if deleted != tt.wantDeleted {
				t.Fatalf("deleted = %v, want %v", deleted, tt.wantDeleted)
			}
		})
	}
}

func TestRecoverPermanent(t *testing.T) {
	run := func() (err error) {
		defer recoverPermanent(&err)
		panic("corrupt input")
	}

	if err := run(); !errors.Is(err, ErrPermanentFailure) {
		t.Fatalf("err = %v, want ErrPermanentFailure", err)
	}
}

func TestExtractMappingPermanentFailures(t *testing.T) {
	id := uuid.New()
	tests := []struct {
		name  string
		build *Build
		id    uuid.UUID
	}{
		{"id not in build", &Build{Mappings: []*Mapping{{ID: uuid.New()}}}, id},
		{"extract error", &Build{Mappings: []*Mapping{{ID: id, Type: "unknown"}}}, id},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.build.extractMapping(tt.id, "f", []byte{})
			if !errors.Is(err, ErrPermanentFailure) {
				t.Fatalf("err = %v, want ErrPermanentFailure", err)
			}
		})
	}
}

func TestGCSNotificationValidate(t *testing.T) {
	full := map[string]string{"mapping_id": "m", "original_file_name": "f"}
	tests := []struct {
		name string
		n    GCSSymbolNotification
		want string
	}{
		{"valid", GCSSymbolNotification{Name: "incoming/x", Metadata: full}, ""},
		{"empty name", GCSSymbolNotification{Metadata: full}, "name is empty"},
		{"empty metadata", GCSSymbolNotification{Name: "incoming/x"}, "metadata is empty"},
		{"missing mapping_id", GCSSymbolNotification{Name: "incoming/x", Metadata: map[string]string{"original_file_name": "f"}}, "mapping_id is missing in metadata"},
		{"missing original_file_name", GCSSymbolNotification{Name: "incoming/x", Metadata: map[string]string{"mapping_id": "m"}}, "original_file_name is missing in metadata"},
		{"first failure wins", GCSSymbolNotification{Metadata: map[string]string{"other": "x"}}, "name is empty"},
		{"mapping_id before original_file_name", GCSSymbolNotification{Name: "incoming/x", Metadata: map[string]string{"other": "x"}}, "mapping_id is missing in metadata"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ""
			if err := tt.n.validate(); err != nil {
				got = err.Error()
			}
			if got != tt.want {
				t.Fatalf("validate = %q, want %q", got, tt.want)
			}
		})
	}
}
