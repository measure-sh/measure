package app

import (
	"os"
	"path/filepath"
	"testing"
)

// TestScanOTADiscovery checks that an OTA jsbundle (nested under a patch_id
// dir) lands in OTABuilds while a regular jsbundle (directly under jsbundle/)
// still lands in Builds. The two scan patterns must stay disjoint.
func TestScanOTADiscovery(t *testing.T) {
	root := t.TempDir()

	patchID := "3f2b8c1a-0000-4000-8000-000000000000"
	regular := filepath.Join(root, "foo-app", "1.2.3", "1000", "jsbundle", "main.jsbundle.tgz")
	ota := filepath.Join(root, "foo-app", "1.2.3", "1000", "jsbundle", patchID, "main.jsbundle.tgz")
	sidecar := filepath.Join(root, "foo-app", "1.2.3", "1000", "jsbundle", patchID, "patch_version")

	for _, p := range []string{regular, ota} {
		if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("x"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(sidecar, []byte("1.2.3-patch.7\n"), 0644); err != nil {
		t.Fatal(err)
	}

	apps, err := Scan(root, &ScanOpts{})
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}

	app := apps.Lookup("foo-app", "1.2.3")

	if len(app.OTABuilds) != 1 {
		t.Fatalf("expected 1 OTA build, got %d", len(app.OTABuilds))
	}
	otaBuild, ok := app.OTABuilds[patchID]
	if !ok {
		t.Fatalf("OTA build for patch %q not found", patchID)
	}
	if otaBuild.VersionCode != "1000" {
		t.Errorf("expected OTA version code 1000, got %q", otaBuild.VersionCode)
	}
	if len(otaBuild.MappingFiles) != 1 {
		t.Errorf("expected 1 OTA mapping file, got %d", len(otaBuild.MappingFiles))
	}
	// the patch_version sidecar populates PatchVersion, trimmed,
	// without counting as a mapping file
	if otaBuild.PatchVersion != "1.2.3-patch.7" {
		t.Errorf("expected patch version 1.2.3-patch.7, got %q", otaBuild.PatchVersion)
	}

	// regular jsbundle must not leak into OTABuilds nor be missed by Builds
	build, ok := app.Builds["1000"]
	if !ok {
		t.Fatal("regular build 1000 not found")
	}
	if len(build.MappingFiles) != 1 {
		t.Errorf("expected 1 regular jsbundle mapping, got %d", len(build.MappingFiles))
	}
}
