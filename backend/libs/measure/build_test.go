//go:build integration

package measure

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"backend/libs/filter"
	"backend/testinfra"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// --------------------------------------------------------------------------
// Build & BuildFile JSON shape
// --------------------------------------------------------------------------

func TestBuildJSONShape(t *testing.T) {
	build := Build{
		VersionName: "1.0.0",
		VersionCode: "100",
		LastUpdated: time.Now().UTC(),
		Files: []BuildFile{
			{
				ID:          uuid.New(),
				VersionName: "1.0.0",
				VersionCode: "100",
				MappingType: "proguard",
				Key:         "aa/bbb/proguard",
				DownloadURL: "/apps/a/builds/b/download",
				FileSize:    100,
				LastUpdated: time.Now().UTC(),
			},
		},
	}

	data, err := json.Marshal(build)
	if err != nil {
		t.Fatalf("marshal build: %v", err)
	}

	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("unmarshal build: %v", err)
	}

	// a regular build carries no patch_id field at all
	if _, ok := m["patch_id"]; ok {
		t.Errorf("want no patch_id for a regular build, got %v", m["patch_id"])
	}
	for _, key := range []string{"version_name", "version_code", "last_updated", "files"} {
		if _, ok := m[key]; !ok {
			t.Errorf("build JSON missing %q: %s", key, data)
		}
	}

	files, ok := m["files"].([]any)
	if !ok || len(files) != 1 {
		t.Fatalf("want 1 file in JSON, got %s", data)
	}
	file := files[0].(map[string]any)
	for _, key := range []string{"id", "mapping_type", "download_url", "filesize", "last_updated"} {
		if _, ok := file[key]; !ok {
			t.Errorf("file JSON missing %q: %s", key, data)
		}
	}
	// the build carries the group identity and the storage key stays
	// internal
	for _, key := range []string{"version_name", "version_code", "patch_id", "key"} {
		if _, ok := file[key]; ok {
			t.Errorf("file JSON must not contain %q: %s", key, data)
		}
	}

	build.PatchID = uuid.New().String()
	data, err = json.Marshal(build)
	if err != nil {
		t.Fatalf("marshal patch build: %v", err)
	}
	if !strings.Contains(string(data), build.PatchID) {
		t.Errorf("want patch_id %s in JSON, got %s", build.PatchID, data)
	}
}

// --------------------------------------------------------------------------
// OpenBuildFileDownload
// --------------------------------------------------------------------------

// seedDownloadConfig uploads the given objects into a fresh bucket
// on the MinIO test container and returns the download config
// pointing at it. A bucket per call keeps object keys from colliding
// across tests.
func seedDownloadConfig(t *testing.T, objects map[string]testinfra.S3Object) BuildFileDownloadConfig {
	t.Helper()
	bucket := "symbols-" + uuid.NewString()
	testinfra.SeedS3Bucket(context.Background(), t, minioEndpoint, bucket, objects)

	return BuildFileDownloadConfig{
		IsCloud:                false,
		AWSEndpoint:            minioEndpoint,
		SymbolsBucket:          bucket,
		SymbolsBucketRegion:    "us-east-1",
		SymbolsAccessKey:       testinfra.MinioUser,
		SymbolsSecretAccessKey: testinfra.MinioPassword,
	}
}

// streamAll streams the download body into memory and closes the
// download, failing the test on any error.
func streamAll(t *testing.T, download *BuildFileDownload) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := download.Stream(&buf); err != nil {
		t.Fatalf("stream download: %v", err)
	}
	if err := download.Close(); err != nil {
		t.Fatalf("close download: %v", err)
	}
	return buf.Bytes()
}

func TestOpenBuildFileDownloadProguard(t *testing.T) {
	ctx := context.Background()
	content := []byte("com.a.b -> a.a:\n    void c() -> a\n")
	config := seedDownloadConfig(t, map[string]testinfra.S3Object{
		"aa/bbb/proguard": {Data: content},
	})

	download, err := OpenBuildFileDownload(ctx, config, BuildFile{
		Key:         "aa/bbb/proguard",
		MappingType: "proguard",
	})
	if err != nil {
		t.Fatalf("open download: %v", err)
	}

	if download.Filename != "mapping.txt" {
		t.Errorf("filename = %q, want mapping.txt", download.Filename)
	}
	if download.ContentType != "text/plain" {
		t.Errorf("content type = %q, want text/plain", download.ContentType)
	}
	if download.ContentLength != int64(len(content)) {
		t.Errorf("content length = %d, want %d", download.ContentLength, len(content))
	}
	if got := streamAll(t, download); !bytes.Equal(got, content) {
		t.Errorf("streamed bytes differ from stored object")
	}
}

func TestOpenBuildFileDownloadElfDebug(t *testing.T) {
	ctx := context.Background()
	content := []byte("\x7fELF fake so bytes")

	t.Run("uses the uploaded filename from object metadata", func(t *testing.T) {
		config := seedDownloadConfig(t, map[string]testinfra.S3Object{
			"aa/bbb/debuginfo": {Data: content, Metadata: map[string]string{"original_file_name": "libapp.so"}},
		})

		download, err := OpenBuildFileDownload(ctx, config, BuildFile{
			Key:         "aa/bbb/debuginfo",
			MappingType: "elf_debug",
		})
		if err != nil {
			t.Fatalf("open download: %v", err)
		}

		if download.Filename != "libapp.so" {
			t.Errorf("filename = %q, want libapp.so", download.Filename)
		}
		if download.ContentType != "application/octet-stream" {
			t.Errorf("content type = %q, want application/octet-stream", download.ContentType)
		}
		if got := streamAll(t, download); !bytes.Equal(got, content) {
			t.Errorf("streamed bytes differ from stored object")
		}
	})

	t.Run("falls back to the key's basename without metadata", func(t *testing.T) {
		config := seedDownloadConfig(t, map[string]testinfra.S3Object{
			"aa/bbb/debuginfo": {Data: content},
		})

		download, err := OpenBuildFileDownload(ctx, config, BuildFile{
			Key:         "aa/bbb/debuginfo",
			MappingType: "elf_debug",
		})
		if err != nil {
			t.Fatalf("open download: %v", err)
		}

		if download.Filename != "debuginfo" {
			t.Errorf("filename = %q, want debuginfo", download.Filename)
		}
		streamAll(t, download)
	})
}

func TestOpenBuildFileDownloadJsBundle(t *testing.T) {
	ctx := context.Background()
	content := []byte(`{"version":3,"mappings":"AAAA"}`)
	config := seedDownloadConfig(t, map[string]testinfra.S3Object{
		"aa/bbb/main.jsbundle.map": {Data: content},
	})

	download, err := OpenBuildFileDownload(ctx, config, BuildFile{
		Key:         "aa/bbb/main.jsbundle.map",
		MappingType: "jsbundle",
	})
	if err != nil {
		t.Fatalf("open download: %v", err)
	}

	if download.Filename != "main.jsbundle.map" {
		t.Errorf("filename = %q, want main.jsbundle.map", download.Filename)
	}
	if download.ContentType != "application/octet-stream" {
		t.Errorf("content type = %q, want application/octet-stream", download.ContentType)
	}
	if got := streamAll(t, download); !bytes.Equal(got, content) {
		t.Errorf("streamed bytes differ from stored object")
	}
}

func TestOpenBuildFileDownloadDsym(t *testing.T) {
	ctx := context.Background()
	dwarf := []byte("\xcf\xfa\xed\xfefake mach-o dwarf bytes")
	config := seedDownloadConfig(t, map[string]testinfra.S3Object{
		"aa/bbb/debuginfo": {Data: dwarf},
		"aa/bbb/meta":      {Data: []byte(`{"name":"DemoApp"}`)},
	})

	download, err := OpenBuildFileDownload(ctx, config, BuildFile{
		Key:         "aa/bbb/debuginfo",
		MappingType: "dsym",
		VersionName: "1.2.0",
		VersionCode: "42",
	})
	if err != nil {
		t.Fatalf("open download: %v", err)
	}

	if download.Filename != "DemoApp.dSYM.zip" {
		t.Errorf("filename = %q, want DemoApp.dSYM.zip", download.Filename)
	}
	if download.ContentType != "application/zip" {
		t.Errorf("content type = %q, want application/zip", download.ContentType)
	}
	// the zip is assembled while streaming, so the size is unknown
	if download.ContentLength != -1 {
		t.Errorf("content length = %d, want -1", download.ContentLength)
	}

	data := streamAll(t, download)
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("read zip: %v", err)
	}

	entries := make(map[string][]byte)
	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open zip entry %q: %v", f.Name, err)
		}
		entryData, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			t.Fatalf("read zip entry %q: %v", f.Name, err)
		}
		entries[f.Name] = entryData
	}

	dwarfEntry, ok := entries["DemoApp.dSYM/Contents/Resources/DWARF/DemoApp"]
	if !ok {
		t.Fatalf("missing DWARF entry, got entries %v", zr.File)
	}
	if !bytes.Equal(dwarfEntry, dwarf) {
		t.Error("DWARF entry bytes differ from stored object")
	}

	plist, ok := entries["DemoApp.dSYM/Contents/Info.plist"]
	if !ok {
		t.Fatal("missing Info.plist entry")
	}
	for _, want := range []string{"<string>1.2.0</string>", "<string>42</string>"} {
		if !strings.Contains(string(plist), want) {
			t.Errorf("Info.plist missing %q:\n%s", want, plist)
		}
	}
}

func TestOpenBuildFileDownloadDsymMetaMissing(t *testing.T) {
	ctx := context.Background()
	dwarf := []byte("\xcf\xfa\xed\xfefake mach-o dwarf bytes")
	config := seedDownloadConfig(t, map[string]testinfra.S3Object{
		"aa/bbb/debuginfo": {Data: dwarf},
	})

	download, err := OpenBuildFileDownload(ctx, config, BuildFile{
		Key:         "aa/bbb/debuginfo",
		MappingType: "dsym",
		VersionName: "1.2.0",
		VersionCode: "42",
	})
	if err != nil {
		t.Fatalf("open download: %v", err)
	}

	// without the /meta sibling object the bundle name falls back
	if download.Filename != "debuginfo.dSYM.zip" {
		t.Errorf("filename = %q, want debuginfo.dSYM.zip", download.Filename)
	}
	streamAll(t, download)
}

func TestOpenBuildFileDownloadUnknownType(t *testing.T) {
	ctx := context.Background()
	config := seedDownloadConfig(t, map[string]testinfra.S3Object{
		"aa/bbb/whatever": {Data: []byte("data")},
	})

	_, err := OpenBuildFileDownload(ctx, config, BuildFile{
		Key:         "aa/bbb/whatever",
		MappingType: "nonsense",
	})
	if err == nil || !strings.Contains(err.Error(), "failed to recognize mapping type") {
		t.Fatalf("want unrecognized mapping type error, got %v", err)
	}
}

func TestOpenBuildFileDownloadMissingObject(t *testing.T) {
	ctx := context.Background()
	config := seedDownloadConfig(t, map[string]testinfra.S3Object{})

	_, err := OpenBuildFileDownload(ctx, config, BuildFile{
		Key:         "aa/bbb/proguard",
		MappingType: "proguard",
	})
	if err == nil {
		t.Fatal("want error for a missing object, got nil")
	}
}

// --------------------------------------------------------------------------
// writeDsymBundleZip
// --------------------------------------------------------------------------

func TestWriteDsymBundleZip(t *testing.T) {
	dwarf := []byte("\xcf\xfa\xed\xfefake mach-o dwarf bytes")

	var buf bytes.Buffer
	if err := writeDsymBundleZip(&buf, "DemoApp", "1.2.0", "42", bytes.NewReader(dwarf)); err != nil {
		t.Fatalf("write dsym bundle zip: %v", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("read zip: %v", err)
	}

	entries := make(map[string][]byte)
	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open zip entry %q: %v", f.Name, err)
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			t.Fatalf("read zip entry %q: %v", f.Name, err)
		}
		entries[f.Name] = data
	}

	if len(entries) != 2 {
		t.Fatalf("want 2 zip entries, got %d: %v", len(entries), zr.File)
	}

	dwarfEntry, ok := entries["DemoApp.dSYM/Contents/Resources/DWARF/DemoApp"]
	if !ok {
		t.Fatal("missing DWARF entry at DemoApp.dSYM/Contents/Resources/DWARF/DemoApp")
	}
	if !bytes.Equal(dwarfEntry, dwarf) {
		t.Error("DWARF entry bytes differ from input")
	}

	plist, ok := entries["DemoApp.dSYM/Contents/Info.plist"]
	if !ok {
		t.Fatal("missing Info.plist entry at DemoApp.dSYM/Contents/Info.plist")
	}
	for _, want := range []string{
		"com.apple.xcode.dsym.DemoApp",
		"<string>dSYM</string>",
		"<string>1.2.0</string>",
		"<string>42</string>",
	} {
		if !strings.Contains(string(plist), want) {
			t.Errorf("Info.plist missing %q:\n%s", want, plist)
		}
	}
}

func TestWriteDsymBundleZipRejectsUnsafeName(t *testing.T) {
	for _, name := range []string{
		"",
		".",
		"..",
		"../evil",
		`..\..\evil`,
		"dir/evil",
		`dir\evil`,
	} {
		var buf bytes.Buffer
		err := writeDsymBundleZip(&buf, name, "1.0", "1", strings.NewReader("d"))
		if err == nil {
			t.Errorf("name %q: want error, got nil", name)
		}
		if buf.Len() != 0 {
			t.Errorf("name %q: want no bytes written, got %d", name, buf.Len())
		}
	}
}

func TestWriteDsymBundleZipEscapesXML(t *testing.T) {
	var buf bytes.Buffer
	if err := writeDsymBundleZip(&buf, "A&B", "1.0<beta>", "1", strings.NewReader("d")); err != nil {
		t.Fatalf("write dsym bundle zip: %v", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("read zip: %v", err)
	}

	for _, f := range zr.File {
		if !strings.HasSuffix(f.Name, "Info.plist") {
			continue
		}
		rc, _ := f.Open()
		data, _ := io.ReadAll(rc)
		rc.Close()
		plist := string(data)
		if !strings.Contains(plist, "com.apple.xcode.dsym.A&amp;B") {
			t.Errorf("bundle identifier not XML-escaped:\n%s", plist)
		}
		if !strings.Contains(plist, "1.0&lt;beta&gt;") {
			t.Errorf("version not XML-escaped:\n%s", plist)
		}
		return
	}
	t.Fatal("Info.plist entry not found")
}

// --------------------------------------------------------------------------
// GetBuildFile
// --------------------------------------------------------------------------

func TestGetBuildFile(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	otherAppID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	seedApp(ctx, t, appID, teamID, 90)
	seedApp(ctx, t, otherAppID, teamID, 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
	noPatch := uuid.Nil.String()

	fileID := uuid.New()
	patchFileID := uuid.New()
	pendingUpload := uuid.New()
	patchID := uuid.New()
	seedBuildMappingRow(ctx, t, fileID, appID, "1.0.0", "100", "proguard", noPatch, base)
	seedBuildMappingRow(ctx, t, patchFileID, appID, "", "", "jsbundle", patchID.String(), base)
	th.SeedBuildMappingRow(ctx, t, pendingUpload.String(), appID.String(), "1.0.0", "100", "dsym", "", noPatch, base)

	t.Run("reads one file row", func(t *testing.T) {
		file, err := GetBuildFile(ctx, deps.PgPool, appID, fileID)
		if err != nil {
			t.Fatalf("get build file: %v", err)
		}
		if file.ID != fileID ||
			file.VersionName != "1.0.0" ||
			file.VersionCode != "100" ||
			file.PatchID != uuid.Nil ||
			file.MappingType != "proguard" ||
			file.Key != "test/"+fileID.String() ||
			file.FileSize != 100 ||
			!file.LastUpdated.Equal(base) {
			t.Errorf("unexpected build file: %+v", file)
		}
	})

	t.Run("reads a patch file row with its patch id", func(t *testing.T) {
		file, err := GetBuildFile(ctx, deps.PgPool, appID, patchFileID)
		if err != nil {
			t.Fatalf("get build file: %v", err)
		}
		if file.ID != patchFileID || file.PatchID != patchID {
			t.Errorf("unexpected patch file: %+v", file)
		}
	})

	t.Run("unknown file id → ErrNoRows", func(t *testing.T) {
		_, err := GetBuildFile(ctx, deps.PgPool, appID, uuid.New())
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Errorf("want ErrNoRows, got %v", err)
		}
	})

	t.Run("file of another app → ErrNoRows", func(t *testing.T) {
		_, err := GetBuildFile(ctx, deps.PgPool, otherAppID, fileID)
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Errorf("want ErrNoRows, got %v", err)
		}
	})

	t.Run("pending upload with empty key → ErrNoRows", func(t *testing.T) {
		_, err := GetBuildFile(ctx, deps.PgPool, appID, pendingUpload)
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Errorf("want ErrNoRows, got %v", err)
		}
	})
}

// --------------------------------------------------------------------------
// GetBuildsWithFilter
// --------------------------------------------------------------------------

func TestGetBuildsWithFilterPackagesFilesIntoBuilds(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	seedApp(ctx, t, appID, teamID, 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
	noPatch := uuid.Nil.String()

	oldProguard := uuid.New()
	newProguard := uuid.New()
	elfDebug := uuid.New()
	pendingUpload := uuid.New()
	v2Proguard := uuid.New()

	// version 1.0.0 has a superseded proguard file, its replacement
	// and an elf_debug file
	seedBuildMappingRow(ctx, t, oldProguard, appID, "1.0.0", "100", "proguard", noPatch, base)
	seedBuildMappingRow(ctx, t, newProguard, appID, "1.0.0", "100", "proguard", noPatch, base.Add(10*time.Minute))
	seedBuildMappingRow(ctx, t, elfDebug, appID, "1.0.0", "100", "elf_debug", noPatch, base.Add(20*time.Minute))

	// a file whose upload has not finished processing has an empty
	// key and stays out of the list
	th.SeedBuildMappingRow(ctx, t, pendingUpload.String(), appID.String(), "1.0.0", "100", "jsbundle", "", noPatch, base.Add(30*time.Minute))

	// version 2.0.0 has the newest file and sorts first
	seedBuildMappingRow(ctx, t, v2Proguard, appID, "2.0.0", "200", "proguard", noPatch, base.Add(40*time.Minute))

	af := &filter.AppFilter{
		AppID: appID,
		Limit: 10,
	}

	builds, next, previous, err := GetBuildsWithFilter(ctx, deps.PgPool, af)
	if err != nil {
		t.Fatalf("get builds: %v", err)
	}
	if next || previous {
		t.Errorf("want next=false previous=false, got next=%v previous=%v", next, previous)
	}
	if len(builds) != 2 {
		t.Fatalf("want 2 builds, got %d: %+v", len(builds), builds)
	}

	v2 := builds[0]
	if v2.VersionName != "2.0.0" || v2.VersionCode != "200" || v2.PatchID != "" {
		t.Errorf("want build 2.0.0 (200) first, got %+v", v2)
	}
	if len(v2.Files) != 1 || v2.Files[0].ID != v2Proguard {
		t.Errorf("want single proguard file %s, got %+v", v2Proguard, v2.Files)
	}

	v1 := builds[1]
	if v1.VersionName != "1.0.0" || v1.VersionCode != "100" || v1.PatchID != "" {
		t.Errorf("want build 1.0.0 (100) second, got %+v", v1)
	}
	if !v1.LastUpdated.Equal(base.Add(20 * time.Minute)) {
		t.Errorf("want build last_updated from its newest file, got %v", v1.LastUpdated)
	}
	if len(v1.Files) != 2 {
		t.Fatalf("want 2 files, got %+v", v1.Files)
	}
	if v1.Files[0].ID != elfDebug || v1.Files[0].MappingType != "elf_debug" {
		t.Errorf("want elf_debug file %s first, got %+v", elfDebug, v1.Files[0])
	}
	if v1.Files[1].ID != newProguard || v1.Files[1].MappingType != "proguard" {
		t.Errorf("want latest proguard file %s, got %+v", newProguard, v1.Files[1])
	}
}

func TestGetBuildsWithFilterGroupsPatchesSeparately(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	seedApp(ctx, t, appID, teamID, 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
	noPatch := uuid.Nil.String()

	regular := uuid.New()
	patchOneOld := uuid.New()
	patchOneNew := uuid.New()
	patchTwoFile := uuid.New()

	patchOne := uuid.New().String()
	patchTwo := uuid.New().String()

	seedBuildMappingRow(ctx, t, regular, appID, "1.0.0", "100", "proguard", noPatch, base)

	// OTA patch uploads carry a patch id and no version; a re-upload
	// of the same patch id inserts a new row and the latest one wins
	seedBuildMappingRow(ctx, t, patchOneOld, appID, "", "", "jsbundle", patchOne, base.Add(10*time.Minute))
	seedBuildMappingRow(ctx, t, patchOneNew, appID, "", "", "jsbundle", patchOne, base.Add(20*time.Minute))
	seedBuildMappingRow(ctx, t, patchTwoFile, appID, "", "", "jsbundle", patchTwo, base.Add(30*time.Minute))

	af := &filter.AppFilter{
		AppID: appID,
		Limit: 10,
	}

	builds, _, _, err := GetBuildsWithFilter(ctx, deps.PgPool, af)
	if err != nil {
		t.Fatalf("get builds: %v", err)
	}
	if len(builds) != 3 {
		t.Fatalf("want 3 builds, got %d: %+v", len(builds), builds)
	}

	if builds[0].PatchID != patchTwo || len(builds[0].Files) != 1 || builds[0].Files[0].ID != patchTwoFile {
		t.Errorf("want patch %s build first with file %s, got %+v", patchTwo, patchTwoFile, builds[0])
	}
	if builds[1].PatchID != patchOne || len(builds[1].Files) != 1 || builds[1].Files[0].ID != patchOneNew {
		t.Errorf("want patch %s build with only its latest file %s, got %+v", patchOne, patchOneNew, builds[1])
	}
	if builds[2].VersionName != "1.0.0" || builds[2].PatchID != "" {
		t.Errorf("want regular build 1.0.0 last, got %+v", builds[2])
	}
}

func TestGetBuildsWithFilterPaginatesBuilds(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	seedApp(ctx, t, appID, teamID, 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
	noPatch := uuid.Nil.String()

	// three builds with two files each; pagination counts builds,
	// not files
	versions := []string{"1.0.0", "2.0.0", "3.0.0"}
	for i, v := range versions {
		seedBuildMappingRow(ctx, t, uuid.New(), appID, v, "100", "proguard", noPatch, base.Add(time.Duration(i)*10*time.Minute))
		seedBuildMappingRow(ctx, t, uuid.New(), appID, v, "100", "elf_debug", noPatch, base.Add(time.Duration(i)*10*time.Minute+5*time.Minute))
	}

	af := &filter.AppFilter{
		AppID: appID,
		Limit: 2,
	}

	builds, next, previous, err := GetBuildsWithFilter(ctx, deps.PgPool, af)
	if err != nil {
		t.Fatalf("get builds: %v", err)
	}
	if len(builds) != 2 || builds[0].VersionName != "3.0.0" || builds[1].VersionName != "2.0.0" {
		t.Fatalf("want builds [3.0.0 2.0.0], got %+v", builds)
	}
	if !next || previous {
		t.Errorf("want next=true previous=false, got next=%v previous=%v", next, previous)
	}
	for _, b := range builds {
		if len(b.Files) != 2 {
			t.Errorf("want 2 files in build %s, got %+v", b.VersionName, b.Files)
		}
	}

	af.Offset = 2

	builds, next, previous, err = GetBuildsWithFilter(ctx, deps.PgPool, af)
	if err != nil {
		t.Fatalf("get builds page 2: %v", err)
	}
	if len(builds) != 1 || builds[0].VersionName != "1.0.0" {
		t.Fatalf("want builds [1.0.0], got %+v", builds)
	}
	if next || !previous {
		t.Errorf("want next=false previous=true, got next=%v previous=%v", next, previous)
	}
}

func TestGetBuildsWithFilterTimeRange(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	seedApp(ctx, t, appID, teamID, 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
	noPatch := uuid.Nil.String()

	seedBuildMappingRow(ctx, t, uuid.New(), appID, "1.0.0", "100", "proguard", noPatch, base)
	seedBuildMappingRow(ctx, t, uuid.New(), appID, "2.0.0", "200", "proguard", noPatch, base.Add(30*time.Minute))

	af := &filter.AppFilter{
		AppID: appID,
		Limit: 10,
		From:  base.Add(15 * time.Minute),
		To:    base.Add(45 * time.Minute),
	}

	builds, _, _, err := GetBuildsWithFilter(ctx, deps.PgPool, af)
	if err != nil {
		t.Fatalf("get builds: %v", err)
	}
	if len(builds) != 1 || builds[0].VersionName != "2.0.0" {
		t.Fatalf("want only build 2.0.0 inside the time range, got %+v", builds)
	}
}
