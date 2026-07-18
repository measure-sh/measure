//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// seedBuildMappingRow inserts one uploaded build mapping file row with a
// non-empty storage key.
func seedBuildMappingRow(ctx context.Context, t *testing.T, mappingID, appID uuid.UUID, versionName, versionCode, mappingType string, lastUpdated time.Time) {
	t.Helper()
	th.SeedBuildMappingRow(ctx, t, mappingID.String(), appID.String(), versionName, versionCode, mappingType, "test/"+mappingID.String(), uuid.Nil.String(), lastUpdated)
}

// configureSymbolsStore uploads the given objects into a fresh
// bucket on the MinIO test container and points the process config
// at it, restoring the config when the test finishes.
func configureSymbolsStore(t *testing.T, objects map[string]testinfra.S3Object) {
	t.Helper()
	bucket := "symbols-" + uuid.NewString()
	testinfra.SeedS3Bucket(context.Background(), t, minioEndpoint, bucket, objects)

	origEndpoint := deps.Config.AWSEndpoint
	origBucket := deps.Config.SymbolsBucket
	origRegion := deps.Config.SymbolsBucketRegion
	origAccessKey := deps.Config.SymbolsAccessKey
	origSecretKey := deps.Config.SymbolsSecretAccessKey

	deps.Config.AWSEndpoint = minioEndpoint
	deps.Config.SymbolsBucket = bucket
	deps.Config.SymbolsBucketRegion = "us-east-1"
	deps.Config.SymbolsAccessKey = testinfra.MinioUser
	deps.Config.SymbolsSecretAccessKey = testinfra.MinioPassword

	t.Cleanup(func() {
		deps.Config.AWSEndpoint = origEndpoint
		deps.Config.SymbolsBucket = origBucket
		deps.Config.SymbolsBucketRegion = origRegion
		deps.Config.SymbolsAccessKey = origAccessKey
		deps.Config.SymbolsSecretAccessKey = origSecretKey
	})
}

// buildsResponse mirrors the GetBuilds JSON body.
type buildsResponse struct {
	Results []struct {
		VersionName string `json:"version_name"`
		VersionCode string `json:"version_code"`
		PatchID     string `json:"patch_id"`
		LastUpdated string `json:"last_updated"`
		Files       []struct {
			ID          string `json:"id"`
			MappingType string `json:"mapping_type"`
			DownloadURL string `json:"download_url"`
			Filesize    int64  `json:"filesize"`
			LastUpdated string `json:"last_updated"`
		} `json:"files"`
	} `json:"results"`
	Meta struct {
		Next     bool `json:"next"`
		Previous bool `json:"previous"`
	} `json:"meta"`
}

func getBuildsRequest(t *testing.T, userID, appIDParam, query string) (*buildsResponse, *httptest.ResponseRecorder) {
	t.Helper()
	c, w := newTestGinContext("GET", "/apps/"+appIDParam+"/builds"+query, nil)
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: appIDParam}}

	h.GetBuilds(c)

	if w.Code != http.StatusOK {
		return nil, w
	}
	var resp buildsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal builds response: %v, body: %s", err, w.Body.String())
	}
	return &resp, w
}

// --------------------------------------------------------------------------
// GetBuilds handler
// --------------------------------------------------------------------------

func TestGetBuilds(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, _ := seedTeamAndMemberWithRole(t, ctx, "owner")

		_, w := getBuildsRequest(t, userID, "not-a-uuid", "")
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown app → 400 with no team", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, _ := seedTeamAndMemberWithRole(t, ctx, "owner")

		_, w := getBuildsRequest(t, userID, uuid.New().String(), "")
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "no team exists")
	})

	t.Run("user outside the team → not authorized", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		outsiderID := uuid.New().String()
		seedUser(ctx, t, outsiderID, "outsider@test.com")

		_, w := getBuildsRequest(t, outsiderID, appID.String(), "")
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("packages files into builds with download urls", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
		oldProguard := uuid.New()
		newProguard := uuid.New()
		elfDebug := uuid.New()
		seedBuildMappingRow(ctx, t, oldProguard, appID, "1.0.0", "100", "proguard", base)
		seedBuildMappingRow(ctx, t, newProguard, appID, "1.0.0", "100", "proguard", base.Add(10*time.Minute))
		seedBuildMappingRow(ctx, t, elfDebug, appID, "1.0.0", "100", "elf_debug", base.Add(20*time.Minute))

		resp, w := getBuildsRequest(t, userID, appID.String(), "")
		if resp == nil {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}

		if len(resp.Results) != 1 {
			t.Fatalf("want 1 build, got %+v", resp.Results)
		}
		build := resp.Results[0]
		if build.VersionName != "1.0.0" || build.VersionCode != "100" || build.PatchID != "" {
			t.Errorf("unexpected build: %+v", build)
		}
		if len(build.Files) != 2 {
			t.Fatalf("want 2 files (latest of each type), got %+v", build.Files)
		}
		if build.Files[0].MappingType != "elf_debug" || build.Files[0].ID != elfDebug.String() {
			t.Errorf("want elf_debug file %s first, got %+v", elfDebug, build.Files[0])
		}
		if build.Files[1].MappingType != "proguard" || build.Files[1].ID != newProguard.String() {
			t.Errorf("want latest proguard file %s, got %+v", newProguard, build.Files[1])
		}
		for _, file := range build.Files {
			want := "/apps/" + appID.String() + "/builds/" + file.ID + "/download"
			if file.DownloadURL != want {
				t.Errorf("download_url = %q, want %q", file.DownloadURL, want)
			}
		}
		if resp.Meta.Next || resp.Meta.Previous {
			t.Errorf("want next=false previous=false, got %+v", resp.Meta)
		}
	})

	t.Run("paginates builds via limit and offset", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
		for i, v := range []string{"1.0.0", "2.0.0", "3.0.0"} {
			seedBuildMappingRow(ctx, t, uuid.New(), appID, v, "100", "proguard", base.Add(time.Duration(i)*10*time.Minute))
		}

		resp, w := getBuildsRequest(t, userID, appID.String(), "?limit=1&offset=1")
		if resp == nil {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if len(resp.Results) != 1 || resp.Results[0].VersionName != "2.0.0" {
			t.Fatalf("want build 2.0.0 on page 2, got %+v", resp.Results)
		}
		if !resp.Meta.Next || !resp.Meta.Previous {
			t.Errorf("want next=true previous=true, got %+v", resp.Meta)
		}
	})
}

// --------------------------------------------------------------------------
// DownloadBuildFile handler
// --------------------------------------------------------------------------

func downloadRequest(t *testing.T, userID, appIDParam, buildFileIDParam string) *httptest.ResponseRecorder {
	t.Helper()
	c, w := newTestGinContext("GET", "/apps/"+appIDParam+"/builds/"+buildFileIDParam+"/download", nil)
	c.Set("userId", userID)
	c.Params = gin.Params{
		{Key: "id", Value: appIDParam},
		{Key: "buildFileId", Value: buildFileIDParam},
	}

	h.DownloadBuildFile(c)
	return w
}

func TestDownloadBuildFile(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, _ := seedTeamAndMemberWithRole(t, ctx, "owner")

		w := downloadRequest(t, userID, "not-a-uuid", uuid.New().String())
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("invalid build file id → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		w := downloadRequest(t, userID, appID.String(), "not-a-uuid")
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown app → 400 with no team", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, _ := seedTeamAndMemberWithRole(t, ctx, "owner")

		w := downloadRequest(t, userID, uuid.New().String(), uuid.New().String())
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "no team exists")
	})

	t.Run("unknown build file → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		w := downloadRequest(t, userID, appID.String(), uuid.New().String())
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("pending upload with empty key → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		pendingUpload := uuid.New()
		th.SeedBuildMappingRow(ctx, t, pendingUpload.String(), appID.String(), "1.0.0", "100", "proguard", "", uuid.Nil.String(), time.Now().UTC())

		w := downloadRequest(t, userID, appID.String(), pendingUpload.String())
		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("streams the file with download headers", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		fileID := uuid.New()
		seedBuildMappingRow(ctx, t, fileID, appID, "1.0.0", "100", "proguard", time.Now().UTC())

		content := []byte("com.a.b -> a.a:\n    void c() -> a\n")
		configureSymbolsStore(t, map[string]testinfra.S3Object{
			"test/" + fileID.String(): {Data: content},
		})

		w := downloadRequest(t, userID, appID.String(), fileID.String())
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if got := w.Header().Get("Content-Disposition"); got != "attachment; filename=mapping.txt" {
			t.Errorf("Content-Disposition = %q, want attachment; filename=mapping.txt", got)
		}
		if got := w.Header().Get("Content-Type"); got != "text/plain" {
			t.Errorf("Content-Type = %q, want text/plain", got)
		}
		if got := w.Header().Get("Content-Length"); got != strconv.Itoa(len(content)) {
			t.Errorf("Content-Length = %q, want %d", got, len(content))
		}
		if w.Body.String() != string(content) {
			t.Errorf("body differs from stored object")
		}
	})
}

// --------------------------------------------------------------------------
// PutBuilds handler
// --------------------------------------------------------------------------

// closeNotifyRecorder adds the CloseNotify method httputil's reverse
// proxy asks gin's writer for; the plain httptest recorder lacks it
// and panics through gin's type assertion.
type closeNotifyRecorder struct {
	*httptest.ResponseRecorder
}

func (c closeNotifyRecorder) CloseNotify() <-chan bool {
	return make(chan bool)
}

// newProxyTestContext builds a gin test context whose writer survives
// being handed to a reverse proxy.
func newProxyTestContext(method, path string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(closeNotifyRecorder{rec})
	c.Request = httptest.NewRequest(method, path, nil)
	return c, rec
}

func TestPutBuilds(t *testing.T) {
	t.Run("cloud → 410 gone", func(t *testing.T) {
		orig := deps.Config.CloudEnv
		deps.Config.CloudEnv = true
		t.Cleanup(func() { deps.Config.CloudEnv = orig })

		c, w := newTestGinContext("PUT", "/builds", nil)
		h.PutBuilds(c)
		// the handler sets a status with no body, which gin's test
		// writer only flushes on demand
		c.Writer.WriteHeaderNow()

		if w.Code != http.StatusGone {
			t.Fatalf("status = %d, want 410, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("self-hosted → proxies to the ingest service", func(t *testing.T) {
		// The ingest origin is fixed to the compose service name, which
		// does not resolve in tests, so the reverse proxy answers 502.
		// That still pins the branch: the request is proxied, not 410ed.
		c, w := newProxyTestContext("PUT", "/builds")
		h.PutBuilds(c)
		c.Writer.WriteHeaderNow()

		if w.Code != http.StatusBadGateway {
			t.Fatalf("status = %d, want 502, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// ProxySymbol handler
// --------------------------------------------------------------------------

func TestProxySymbol(t *testing.T) {
	t.Run("missing payload → 400", func(t *testing.T) {
		c, w := newTestGinContext("PUT", "/proxy/symbols", nil)
		h.ProxySymbol(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("payload host not matching the object store → 400", func(t *testing.T) {
		origEndpoint := deps.Config.AWSEndpoint
		deps.Config.AWSEndpoint = "http://minio.test:9000"
		t.Cleanup(func() { deps.Config.AWSEndpoint = origEndpoint })

		payload := url.QueryEscape("http://evil.example/msr-symbols-test/key")
		c, w := newTestGinContext("PUT", "/proxy/symbols?payload="+payload, nil)
		h.ProxySymbol(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("valid payload → proxies to the object store", func(t *testing.T) {
		store := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/msr-symbols-test/incoming/file.tgz" || r.URL.Query().Get("sig") != "abc" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.Write([]byte("object-bytes"))
		}))
		t.Cleanup(store.Close)

		origEndpoint := deps.Config.AWSEndpoint
		deps.Config.AWSEndpoint = store.URL
		t.Cleanup(func() { deps.Config.AWSEndpoint = origEndpoint })

		payload := url.QueryEscape(store.URL + "/msr-symbols-test/incoming/file.tgz?sig=abc")
		c, w := newProxyTestContext("PUT", "/proxy/symbols?payload="+payload)
		h.ProxySymbol(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if w.Body.String() != "object-bytes" {
			t.Errorf("body = %q, want object-bytes", w.Body.String())
		}
	})
}
