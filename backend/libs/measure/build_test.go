package measure

import (
	"archive/zip"
	"bytes"
	"io"
	"strings"
	"testing"
)

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
