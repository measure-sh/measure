package main

import (
	"testing"

	"backend/libs/symbol"

	"symboloader/server"
)

// TestRecordArtifact checks the one-row-per-artifact split: the
// first non-meta dif fills the existing row, every later dif
// becomes an extra row carrying its own key & per-object size.
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

	for _, dif := range difs {
		if err := b.recordArtifact(0, dif); err != nil {
			t.Fatalf("recordArtifact: %v", err)
		}
	}

	// primary row holds the first artifact
	if b.Mappings[0].Key != "8d/f7/main.jsbundle" {
		t.Fatalf("primary key = %q, want first dif", b.Mappings[0].Key)
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
	// each extra carries its own object size & a checksum
	if b.Extras[0].Size != int64(len("sourcemap")) {
		t.Fatalf("extra[0] size = %d, want per-object", b.Extras[0].Size)
	}
	if b.Extras[0].Checksum == "" {
		t.Fatal("extra[0] should carry a per-object checksum")
	}
	if b.Extras[0].Type != symbol.TypeJsBundle.String() {
		t.Fatalf("extra[0] type = %q", b.Extras[0].Type)
	}
}
