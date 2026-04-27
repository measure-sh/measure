package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// fakeClonerServer mocks the slice of Drive API used by DriveCloner:
// Files.Get (folder verify), Files.List (source + dest listing),
// Files.Delete (wipe + DeleteCopy), Files.Copy.
type fakeClonerServer struct {
	t   *testing.T
	srv *httptest.Server

	// folders maps folderID → mimeType + canAddChildren.
	folders map[string]struct {
		mimeType        string
		canAddChildren  bool
	}

	// listings maps parent folderID → slice of file metadata to return.
	mu       sync.Mutex
	listings map[string][]fakeFile

	// deleteCalls and copyCalls record observed mutations.
	deleteCalls atomic.Int64
	copyCalls   atomic.Int64

	// deleteStatus[id] forces an HTTP status for that file's delete.
	deleteStatus map[string]int
}

type fakeFile struct {
	ID          string
	Name        string
	MimeType    string
	Md5Checksum string
	// ParentID is implied by which listings entry the file lives under.
}

func newFakeClonerServer(t *testing.T) *fakeClonerServer {
	t.Helper()
	f := &fakeClonerServer{
		t:            t,
		folders:      make(map[string]struct{ mimeType string; canAddChildren bool }),
		listings:     make(map[string][]fakeFile),
		deleteStatus: make(map[string]int),
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/files", f.handleFilesList)
	mux.HandleFunc("/files/", f.handleFilesByID)
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeClonerServer) addFolder(id string, canAddChildren bool) {
	f.folders[id] = struct {
		mimeType       string
		canAddChildren bool
	}{mimeType: "application/vnd.google-apps.folder", canAddChildren: canAddChildren}
}

func (f *fakeClonerServer) addFiles(parentID string, files ...fakeFile) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.listings[parentID] = append(f.listings[parentID], files...)
}

func (f *fakeClonerServer) handleFilesList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	parent := extractParentFromQuery(q)

	f.mu.Lock()
	files := append([]fakeFile(nil), f.listings[parent]...)
	f.mu.Unlock()

	out := struct {
		Files []map[string]any `json:"files"`
	}{}
	for _, file := range files {
		out.Files = append(out.Files, map[string]any{
			"id":          file.ID,
			"name":        file.Name,
			"mimeType":    file.MimeType,
			"md5Checksum": file.Md5Checksum,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (f *fakeClonerServer) handleFilesByID(w http.ResponseWriter, r *http.Request) {
	// Path: /files/{id} for GET/DELETE; /files/{id}/copy for POST copy.
	path := strings.TrimPrefix(r.URL.Path, "/files/")
	if strings.HasSuffix(path, "/copy") {
		srcID := strings.TrimSuffix(path, "/copy")
		f.handleCopy(w, r, srcID)
		return
	}

	switch r.Method {
	case http.MethodGet:
		folder, ok := f.folders[path]
		if !ok {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		out := map[string]any{
			"id":       path,
			"mimeType": folder.mimeType,
			"capabilities": map[string]any{
				"canAddChildren": folder.canAddChildren,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	case http.MethodDelete:
		f.deleteCalls.Add(1)
		if status, ok := f.deleteStatus[path]; ok {
			http.Error(w, "forced", status)
			return
		}
		// Remove from any listing
		f.mu.Lock()
		for parent, files := range f.listings {
			out := files[:0]
			for _, file := range files {
				if file.ID != path {
					out = append(out, file)
				}
			}
			f.listings[parent] = out
		}
		f.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (f *fakeClonerServer) handleCopy(w http.ResponseWriter, r *http.Request, srcID string) {
	f.copyCalls.Add(1)
	var body struct {
		Name    string   `json:"name"`
		Parents []string `json:"parents"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	newID := fmt.Sprintf("copy-%d-%s", f.copyCalls.Load(), srcID)
	if len(body.Parents) > 0 {
		f.mu.Lock()
		f.listings[body.Parents[0]] = append(f.listings[body.Parents[0]], fakeFile{
			ID: newID, Name: body.Name, MimeType: "application/x-7z-compressed",
		})
		f.mu.Unlock()
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": newID})
}

// extractParentFromQuery parses "'X' in parents and ..." → X.
func extractParentFromQuery(q string) string {
	prefix := "'"
	i := strings.Index(q, prefix)
	if i < 0 {
		return ""
	}
	rest := q[i+1:]
	j := strings.Index(rest, "'")
	if j < 0 {
		return ""
	}
	return rest[:j]
}

func (f *fakeClonerServer) client(t *testing.T) *drive.Service {
	t.Helper()
	svc, err := drive.NewService(context.Background(),
		option.WithEndpoint(f.srv.URL),
		option.WithHTTPClient(http.DefaultClient),
	)
	if err != nil {
		t.Fatalf("drive.NewService: %v", err)
	}
	return svc
}

func TestNewDriveClonerRejectsNonFolder(t *testing.T) {
	srv := newFakeClonerServer(t)
	srv.folders["not-a-folder"] = struct {
		mimeType       string
		canAddChildren bool
	}{mimeType: "application/x-7z-compressed", canAddChildren: false}

	_, err := NewDriveCloner(context.Background(), srv.client(t), "not-a-folder")
	if err == nil || !errors.Is(err, ErrInvalidDestFolder) {
		t.Errorf("expected ErrInvalidDestFolder for non-folder, got %v", err)
	}
}

func TestNewDriveClonerRejectsReadOnly(t *testing.T) {
	srv := newFakeClonerServer(t)
	srv.addFolder("dest", false) // canAddChildren = false

	_, err := NewDriveCloner(context.Background(), srv.client(t), "dest")
	if err == nil || !errors.Is(err, ErrInvalidDestFolder) {
		t.Errorf("expected ErrInvalidDestFolder for read-only folder, got %v", err)
	}
}

func TestWipeAndCopyEmptyDestination(t *testing.T) {
	srv := newFakeClonerServer(t)
	srv.addFolder("dest", true)
	srv.addFolder("src1", true)
	srv.addFiles("src1",
		fakeFile{ID: "f1", Name: "26.0.7z", MimeType: "application/x-7z-compressed", Md5Checksum: "aaa"},
		fakeFile{ID: "f2", Name: "26.1.7z", MimeType: "application/x-7z-compressed", Md5Checksum: "bbb"},
	)

	c, err := NewDriveCloner(context.Background(), srv.client(t), "dest")
	if err != nil {
		t.Fatalf("NewDriveCloner: %v", err)
	}

	catalog := &Catalog{Folders: []DriveFolder{
		{URL: "https://drive.google.com/drive/folders/src1"},
	}}
	copied, wiped, err := c.WipeAndCopy(context.Background(), catalog)
	if err != nil {
		t.Fatalf("WipeAndCopy: %v", err)
	}
	if copied != 2 {
		t.Errorf("copied: got %d, want 2", copied)
	}
	if wiped != 0 {
		t.Errorf("wiped: got %d, want 0", wiped)
	}
}

func TestWipeAndCopyWithExistingDestArchives(t *testing.T) {
	srv := newFakeClonerServer(t)
	srv.addFolder("dest", true)
	srv.addFolder("src1", true)
	// Pre-populate dest with stale .7z files from a previous run.
	srv.addFiles("dest",
		fakeFile{ID: "old1", Name: "old.7z", MimeType: "application/x-7z-compressed"},
		fakeFile{ID: "old2", Name: "old2.7z", MimeType: "application/x-7z-compressed"},
		fakeFile{ID: "keep-me", Name: "notes.txt", MimeType: "text/plain"}, // non-7z, should be kept
	)
	srv.addFiles("src1",
		fakeFile{ID: "f1", Name: "26.0.7z", MimeType: "application/x-7z-compressed", Md5Checksum: "aaa"},
	)

	c, err := NewDriveCloner(context.Background(), srv.client(t), "dest")
	if err != nil {
		t.Fatalf("NewDriveCloner: %v", err)
	}

	catalog := &Catalog{Folders: []DriveFolder{
		{URL: "https://drive.google.com/drive/folders/src1"},
	}}
	copied, wiped, err := c.WipeAndCopy(context.Background(), catalog)
	if err != nil {
		t.Fatalf("WipeAndCopy: %v", err)
	}
	if copied != 1 {
		t.Errorf("copied: got %d, want 1", copied)
	}
	if wiped != 2 {
		t.Errorf("wiped: got %d, want 2 (old1, old2; notes.txt kept)", wiped)
	}
}

func TestWipeAndCopyDedupesByMD5AcrossSourceFolders(t *testing.T) {
	srv := newFakeClonerServer(t)
	srv.addFolder("dest", true)
	srv.addFolder("src1", true)
	srv.addFolder("src2", true)
	// Same MD5 in two different source folders — should be copied once.
	srv.addFiles("src1",
		fakeFile{ID: "a", Name: "13.4.7z", MimeType: "application/x-7z-compressed", Md5Checksum: "shared"},
	)
	srv.addFiles("src2",
		fakeFile{ID: "b", Name: "13.4.7z", MimeType: "application/x-7z-compressed", Md5Checksum: "shared"},
		fakeFile{ID: "c", Name: "13.5.7z", MimeType: "application/x-7z-compressed", Md5Checksum: "unique"},
	)

	c, err := NewDriveCloner(context.Background(), srv.client(t), "dest")
	if err != nil {
		t.Fatalf("NewDriveCloner: %v", err)
	}

	catalog := &Catalog{Folders: []DriveFolder{
		{URL: "https://drive.google.com/drive/folders/src1"},
		{URL: "https://drive.google.com/drive/folders/src2"},
	}}
	copied, _, err := c.WipeAndCopy(context.Background(), catalog)
	if err != nil {
		t.Fatalf("WipeAndCopy: %v", err)
	}
	if copied != 2 {
		t.Errorf("copied: got %d, want 2 (one per unique md5)", copied)
	}
}

func TestDeleteCopyIdempotentOn404(t *testing.T) {
	srv := newFakeClonerServer(t)
	srv.addFolder("dest", true)
	srv.deleteStatus["nonexistent"] = http.StatusNotFound

	c, err := NewDriveCloner(context.Background(), srv.client(t), "dest")
	if err != nil {
		t.Fatalf("NewDriveCloner: %v", err)
	}

	if err := c.DeleteCopy(context.Background(), "nonexistent"); err != nil {
		t.Errorf("DeleteCopy on 404: expected no error, got %v", err)
	}
	if err := c.DeleteCopy(context.Background(), ""); err != nil {
		t.Errorf("DeleteCopy on empty ID: expected no error, got %v", err)
	}
}

func TestExtractFolderID(t *testing.T) {
	cases := []struct {
		url, want string
		wantErr   bool
	}{
		{"https://drive.google.com/drive/folders/abc123", "abc123", false},
		{"https://drive.google.com/drive/folders/abc-123_def", "abc-123_def", false},
		{"https://example.com/no-folders-here", "", true},
	}
	for _, c := range cases {
		got, err := ExtractFolderID(c.url)
		if (err != nil) != c.wantErr {
			t.Errorf("ExtractFolderID(%q) err: got %v, wantErr %v", c.url, err, c.wantErr)
		}
		if got != c.want {
			t.Errorf("ExtractFolderID(%q): got %q, want %q", c.url, got, c.want)
		}
	}
}
