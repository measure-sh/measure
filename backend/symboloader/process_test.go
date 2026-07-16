package main

import (
	"testing"

	"backend/libs/symbol"

	"symboloader/server"
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
// when a sibling row matches on both key & checksum. This is what
// makes a redelivered notification idempotent.
func TestArtifactExists(t *testing.T) {
	b := &Build{
		Mappings: []*Mapping{
			{Key: "8d/f7/main.jsbundle", Checksum: "C1"},
			{Key: "bb/8f/main.jsbundle.map", Checksum: "C2"},
		},
	}

	if !b.artifactExists("8d/f7/main.jsbundle", "C1") {
		t.Fatal("exact key+checksum match should exist")
	}
	if b.artifactExists("8d/f7/main.jsbundle", "C9") {
		t.Fatal("same key different checksum must not match")
	}
	if b.artifactExists("zz/00/other.js", "C1") {
		t.Fatal("unknown key must not match")
	}
}
