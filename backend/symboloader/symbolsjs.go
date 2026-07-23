package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"strings"
	"time"

	"backend/libs/objstore"
	"backend/libs/symbol"
	"symboloader/server"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// presignTTL bounds how long the presigned GET URLs returned
// to Symbolicator stay valid. Enough time for Symbolicator to
// fetch both the bundle and the sourcemap without holding the
// URLs open for longer than needed.
const presignTTL = 5 * time.Minute

// lookupFile mirrors the `File` variant of RawJsLookupResult
// in crates/symbolicator-js/src/api_lookup.rs. Symbolicator
// indexes returned files by abs_path and matches them against
// the frame's URL candidates produced by
// utils.rs::get_release_file_candidate_urls.
//
// Debug-id alone does not bind a `file`-type entry to a frame
// — the abs_path must match. Pairing of bundle and sourcemap
// is via a `Sourcemap` header on the bundle entry, resolved
// relative to the bundle's own abs_path.
type lookupFile struct {
	Type         string            `json:"type"`
	ID           string            `json:"id"`
	URL          string            `json:"url"`
	AbsPath      string            `json:"abs_path"`
	Headers      map[string]string `json:"headers"`
	ResolvedWith string            `json:"resolved_with"`
}

// jsbundleRow is one matched row from build_mappings. The
// key's last path segment is the original inner filename
// (e.g. main.jsbundle, main.jsbundle.map). The .map suffix
// is the only reliable discriminator between bundle and
// sourcemap across iOS / Android / Hermes targets.
//
// The DB column is `patch_id`; on the Symbolicator wire it
// arrives as a `?debug_id=` query param. We map the names at
// the handler boundary.
type jsbundleRow struct {
	Key     string
	PatchID uuid.UUID
}

// filename returns the inner filename embedded in the row's
// storage key (e.g. "main.jsbundle.map").
func (r jsbundleRow) filename() string {
	return path.Base(r.Key)
}

// isSourcemap reports whether the row points at a sourcemap
// (`.map` file). All other inner filenames are treated as
// bundles, since the bundle extension varies across runtimes
// (`.jsbundle`, `.bundle`, `.js`, `.hbc`).
func (r jsbundleRow) isSourcemap() bool {
	return strings.HasSuffix(r.filename(), ".map")
}

// resolvedPair is a bundle/sourcemap pair ready for emission
// as lookupFile entries. Either side may be empty (an upload
// missing one of the two files).
type resolvedPair struct {
	BundleKey         string
	BundleFilename    string
	SourcemapKey      string
	SourcemapFilename string
	// ResolvedWith is the label echoed back to Symbolicator
	// in the response. Informational only — Symbolicator does
	// not branch on it.
	ResolvedWith string
}

// HandleSymbolsJsRequest serves the Sentry artifact-lookup
// protocol for JS / sourcemap symbolication at /symbols/js.
// The path is conventional — Symbolicator only knows the URL
// we give it via SentrySourceConfig.url. Two lookup paths
// supported:
//
//  1. OTA / patch-id path: ?debug_id=<patch_id> (one or more),
//     scoped by ?app_id=<uuid>. Internally maps to a patch_id
//     column lookup. Used when the SDK supplies a patch_id via a
//     module entry on the event.
//
//  2. URL fallback path: ?app_id=<uuid>&version_name=...&
//     version_code=...&url=... (?url= repeatable). Used when no
//     debug_id is supplied — ingest-worker sets app_id +
//     version on the source URL so we can scope the lookup.
//
// The endpoint accepts but ignores `release` and `dist` query
// params. Symbolicator only sends `?url=` when the request body
// has `release` set, so the ingest-worker must populate that
// (any non-empty value works) for this fallback to fire.
//
// Auth: the Bearer token is read off the Authorization header
// but not validated. Real per-app authentication is a follow-up.
func HandleSymbolsJsRequest(c *gin.Context) {
	ctx := c.Request.Context()
	config := server.Server.Config

	var pairs []resolvedPair
	var err error

	if patchIDs := c.QueryArray("debug_id"); len(patchIDs) > 0 {
		pairs, err = resolveByPatchID(ctx, c.Query("app_id"), patchIDs)
	} else if appID := c.Query("app_id"); appID != "" {
		versionName := c.Query("version_name")
		versionCode := c.Query("version_code")
		urls := c.QueryArray("url")
		fmt.Println("app_id", appID)
		fmt.Println("versionName", versionName)
		fmt.Println("versionCode", versionCode)
		fmt.Println("urls", urls)
		if versionName != "" && versionCode != "" && len(urls) > 0 {
			pairs, err = resolveByURL(ctx, appID, versionName, versionCode, urls)
		}
	}

	if err != nil {
		fmt.Printf("symbols/js: resolve failed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lookup failed"})
		return
	}
	if len(pairs) == 0 {
		c.Data(http.StatusOK, "application/json", []byte("[]"))
		return
	}

	gcsClient, s3Client, err := setupStorageClients(ctx, config)
	if err != nil {
		fmt.Printf("symbols/js: failed to create storage client: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lookup failed"})
		return
	}
	if gcsClient != nil {
		defer gcsClient.Close()
	}

	results := []lookupFile{}
	for _, p := range pairs {
		emitPair(ctx, config, gcsClient, s3Client, p, &results)
	}

	resultsJson, _ := json.Marshal(results)
	fmt.Println("results", string(resultsJson))

	c.JSON(http.StatusOK, results)
}

// resolveByPatchID handles the OTA path: caller supplies the
// scoping app_id and one or more patch_ids; we look up the
// matching build_mappings rows and pair bundle + sourcemap per
// patch_id. Filenames are derived from the row's storage key —
// no HEAD against object metadata. Rows arrive ordered
// last_updated DESC so re-uploads collapse to the newest per role.
func resolveByPatchID(ctx context.Context, appID string, patchIDs []string) (pairs []resolvedPair, err error) {
	rows, err := queryJsBundleRowsByPatchID(ctx, appID, patchIDs)
	if err != nil {
		return
	}

	byPatchID := make(map[uuid.UUID][]jsbundleRow)
	for _, r := range rows {
		byPatchID[r.PatchID] = append(byPatchID[r.PatchID], r)
	}

	for _, group := range byPatchID {
		bundle, sourcemap := classifyRows(group)
		pair := resolvedPair{ResolvedWith: "debug-id"}
		if bundle != nil {
			pair.BundleKey = bundle.Key
			pair.BundleFilename = bundle.filename()
		}
		if sourcemap != nil {
			pair.SourcemapKey = sourcemap.Key
			pair.SourcemapFilename = sourcemap.filename()
		}
		if pair.BundleKey != "" || pair.SourcemapKey != "" {
			pairs = append(pairs, pair)
		}
	}
	return
}

// resolveByURL handles the non-OTA path. Symbolicator sends one
// or more `?url=` values derived from the frame's abs_path stem
// (e.g. "/main.jsbundle"). We scope the candidate set by app +
// version and match requested URLs against the inner filename
// embedded in each row's storage key.
//
// Re-uploads under the same (app_id, version_name, version_code)
// are de-duplicated by keeping the most-recent row per filename
// (driven by ORDER BY last_updated DESC and first-write-wins
// into the filename map).
func resolveByURL(
	ctx context.Context,
	appID, versionName, versionCode string,
	urls []string,
) (pairs []resolvedPair, err error) {
	rows, err := queryJsBundleRowsByAppVersion(ctx, appID, versionName, versionCode)
	if err != nil {
		return
	}

	// Build filename → key map from the rows. Rows are pre-
	// sorted by last_updated DESC; first-seen wins keeps the
	// most recent upload for any duplicate filename.
	byFilename := make(map[string]string)
	for _, r := range rows {
		filename := r.filename()
		if filename == "" {
			continue
		}
		if _, exists := byFilename[filename]; !exists {
			byFilename[filename] = r.Key
		}
	}

	seen := make(map[string]bool)
	for _, u := range urls {
		// Symbolicator sends "/main.jsbundle" — strip the
		// leading slash to compare against stored filenames.
		bundleFilename := strings.TrimPrefix(u, "/")
		if bundleFilename == "" {
			continue
		}
		sourcemapFilename := bundleFilename + ".map"

		bundleKey := byFilename[bundleFilename]
		sourcemapKey := byFilename[sourcemapFilename]
		if bundleKey == "" && sourcemapKey == "" {
			continue
		}

		// Multiple `?url=` values from one Symbolicator request
		// can map to the same bundle (frame stems collapse).
		// Dedupe so we don't emit the same pair twice.
		sig := bundleKey + "|" + sourcemapKey
		if seen[sig] {
			continue
		}
		seen[sig] = true

		pairs = append(pairs, resolvedPair{
			BundleKey:         bundleKey,
			BundleFilename:    bundleFilename,
			SourcemapKey:      sourcemapKey,
			SourcemapFilename: sourcemapFilename,
			ResolvedWith:      "release",
		})
	}
	return
}

// emitPair writes the lookupFile entries for one resolved pair
// into the results slice. The bundle entry carries a Sourcemap
// header naming the sibling map; Symbolicator joins it against
// the bundle's own abs_path to locate the map entry.
func emitPair(
	ctx context.Context,
	config *server.ServerConfig,
	gcsClient *storage.Client,
	s3Client *s3.Client,
	p resolvedPair,
	results *[]lookupFile,
) {
	if p.BundleKey != "" && p.BundleFilename != "" {
		url, presignErr := presignKey(ctx, config, gcsClient, s3Client, p.BundleKey)
		if presignErr != nil {
			fmt.Printf("symbols/js: presign failed for %s: %v\n", p.BundleKey, presignErr)
		} else {
			headers := map[string]string{}
			if p.SourcemapKey != "" && p.SourcemapFilename != "" {
				// A bare filename joins to the bundle's
				// abs_path (~/<bundleName>) producing
				// ~/<sourcemapName>.
				headers["Sourcemap"] = p.SourcemapFilename
			}
			*results = append(*results, lookupFile{
				Type:         "file",
				ID:           p.BundleKey,
				URL:          url,
				AbsPath:      "~/" + p.BundleFilename,
				Headers:      headers,
				ResolvedWith: p.ResolvedWith,
			})
		}
	}

	if p.SourcemapKey != "" && p.SourcemapFilename != "" {
		url, presignErr := presignKey(ctx, config, gcsClient, s3Client, p.SourcemapKey)
		if presignErr != nil {
			fmt.Printf("symbols/js: presign failed for %s: %v\n", p.SourcemapKey, presignErr)
			return
		}
		*results = append(*results, lookupFile{
			Type:         "file",
			ID:           p.SourcemapKey,
			URL:          url,
			AbsPath:      "~/" + p.SourcemapFilename,
			Headers:      map[string]string{},
			ResolvedWith: p.ResolvedWith,
		})
	}
}

// setupStorageClients returns the appropriate client(s) for
// the deployment mode. Only one of (gcsClient, s3Client) is
// non-nil per call.
func setupStorageClients(
	ctx context.Context,
	config *server.ServerConfig,
) (gcsClient *storage.Client, s3Client *s3.Client, err error) {
	if config.IsCloud() {
		gcsClient, err = objstore.CreateGCSClient(ctx)
		return
	}
	s3Client = objstore.CreateS3Client(
		ctx,
		config.SymbolsAccessKey,
		config.SymbolsSecretAccessKey,
		config.SymbolsBucketRegion,
		config.AWSEndpoint,
	)
	return
}

// classifyRows splits a group of rows for one patch_id into
// the bundle and sourcemap entries based on the inner filename
// suffix (`.map` = sourcemap, anything else = bundle). Rows are
// pre-sorted last_updated DESC, so first-seen-wins per role keeps
// the most recent upload when a patch_id is re-uploaded.
func classifyRows(rows []jsbundleRow) (bundle, sourcemap *jsbundleRow) {
	for i := range rows {
		r := &rows[i]
		if r.isSourcemap() {
			if sourcemap == nil {
				sourcemap = r
			}
		} else if bundle == nil {
			bundle = r
		}
	}
	return
}

// queryJsBundleRowsByPatchID returns build_mappings rows for
// the given app_id and patch_ids whose mapping_type is "jsbundle",
// ordered most-recent first so re-uploads dedupe to the latest.
//
// patch_ids are UUIDs; the app_id filter is still required to
// avoid cross-app collisions. The app_id reaches this path via
// the source URL the ingest-worker sets on the Sentry source
// (configureSource). Inbound ?debug_id= values arrive as strings
// and are parsed to UUIDs here; non-UUID values are skipped so a
// malformed query param can't error the whole lookup at the DB.
func queryJsBundleRowsByPatchID(ctx context.Context, appID string, patchIDs []string) (rows []jsbundleRow, err error) {
	placeholders := make([]string, 0, len(patchIDs))
	args := make([]any, 0, len(patchIDs))
	for _, d := range patchIDs {
		id, parseErr := uuid.Parse(d)
		if parseErr != nil {
			continue
		}
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	// No valid UUID patch_ids to look up.
	if len(args) == 0 {
		return
	}

	stmt := sqlf.PostgreSQL.
		From("build_mappings").
		Select("key, patch_id").
		Where("app_id = ?", appID).
		Where("mapping_type = ?", symbol.TypeJsBundle.String()).
		Where("patch_id IN ("+strings.Join(placeholders, ",")+")", args...).
		OrderBy("last_updated DESC")

	defer stmt.Close()

	res, queryErr := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if queryErr != nil {
		err = queryErr
		return
	}
	defer res.Close()

	for res.Next() {
		var r jsbundleRow
		if scanErr := res.Scan(&r.Key, &r.PatchID); scanErr != nil {
			err = scanErr
			return
		}
		rows = append(rows, r)
	}
	err = res.Err()
	return
}

// queryJsBundleRowsByAppVersion returns build_mappings rows
// scoped by (app_id, version_name, version_code) and
// mapping_type 'jsbundle', ordered most-recent first so that
// downstream filename deduplication keeps the latest upload.
func queryJsBundleRowsByAppVersion(ctx context.Context, appID, versionName, versionCode string) (rows []jsbundleRow, err error) {
	stmt := sqlf.PostgreSQL.
		From("build_mappings").
		Select("key").
		Where("app_id = ?", appID).
		Where("version_name = ?", versionName).
		Where("version_code = ?", versionCode).
		Where("mapping_type = ?", symbol.TypeJsBundle.String()).
		OrderBy("last_updated DESC")

	defer stmt.Close()

	res, queryErr := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if queryErr != nil {
		err = queryErr
		return
	}
	defer res.Close()

	for res.Next() {
		var r jsbundleRow
		if scanErr := res.Scan(&r.Key); scanErr != nil {
			err = scanErr
			return
		}
		rows = append(rows, r)
	}
	err = res.Err()
	return
}

// presignKey generates a short-lived presigned GET URL for the
// given storage key. Cloud uses GCS V4 signing; on-prem uses
// the S3 SDK presigner.
func presignKey(
	ctx context.Context,
	config *server.ServerConfig,
	gcsClient *storage.Client,
	s3Client *s3.Client,
	key string,
) (string, error) {
	if config.IsCloud() {
		return objstore.CreateGCSGETPresignedURL(gcsClient, config.SymbolsBucket, key, &storage.SignedURLOptions{
			Scheme:  storage.SigningSchemeV4,
			Method:  "GET",
			Expires: time.Now().Add(presignTTL),
		})
	}
	return objstore.CreateS3GETPresignedURL(ctx, s3Client, &s3.GetObjectInput{
		Bucket: aws.String(config.SymbolsBucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(presignTTL))
}
