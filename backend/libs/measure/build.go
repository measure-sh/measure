package measure

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"path"
	"strings"
	"time"

	"backend/libs/filter"
	"backend/libs/objstore"
	"backend/libs/symbol"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// BuildFile represents a single mapping file uploaded for a build.
// VersionName, VersionCode and PatchID identify the build the file
// belongs to; they stay out of JSON because the builds list nests
// files inside their build, which already carries them.
type BuildFile struct {
	ID          uuid.UUID `json:"id"`
	VersionName string    `json:"-"`
	VersionCode string    `json:"-"`
	PatchID     uuid.UUID `json:"-"`
	MappingType string    `json:"mapping_type"`
	Key         string    `json:"-"`
	DownloadURL string    `json:"download_url"`
	FileSize    int64     `json:"filesize"`
	LastUpdated time.Time `json:"last_updated"`
}

// Build represents one build of an app: the mapping files uploaded
// for a (version_name, version_code, patch_id) group, keeping the
// latest file of each mapping type. PatchID is empty for regular
// builds; Over-The-Air patch uploads carry a patch id and empty
// version columns.
type Build struct {
	VersionName string      `json:"version_name"`
	VersionCode string      `json:"version_code"`
	PatchID     string      `json:"patch_id,omitempty"`
	LastUpdated time.Time   `json:"last_updated"`
	Files       []BuildFile `json:"files"`
}

// BuildFileDownloadConfig is the storage configuration
// OpenBuildFileDownload needs to read mapping file artifacts from
// the symbols bucket.
type BuildFileDownloadConfig struct {
	IsCloud                bool
	AWSEndpoint            string
	SymbolsBucket          string
	SymbolsBucketRegion    string
	SymbolsAccessKey       string
	SymbolsSecretAccessKey string
}

// BuildFileDownload is the downloadable form of a build's mapping
// file: the filename and headers a file download response needs,
// plus a Stream method that writes the body.
type BuildFileDownload struct {
	Filename    string
	ContentType string

	// ContentLength is -1 when the final size is not known upfront,
	// e.g. a dSYM bundle zip assembled while streaming.
	ContentLength int64

	stream func(w io.Writer) error
	closer func() error
}

// Stream writes the download body. Call after response
// headers are set; it must be called at most once.
func (d *BuildFileDownload) Stream(w io.Writer) error {
	return d.stream(w)
}

// Close releases the underlying object reader.
func (d *BuildFileDownload) Close() error {
	return d.closer()
}

// openSymbolObject opens the object at key in the symbols bucket and
// returns its reader, size and object metadata. The reader's Close
// releases every underlying resource.
func openSymbolObject(ctx context.Context, config BuildFileDownloadConfig, key string) (body io.ReadCloser, size int64, metadata map[string]string, err error) {
	if config.IsCloud {
		client, errStorage := storage.NewClient(ctx)
		if errStorage != nil {
			return nil, 0, nil, errStorage
		}

		obj := client.Bucket(config.SymbolsBucket).Object(key)

		attrs, errAttrs := obj.Attrs(ctx)
		if errAttrs != nil {
			client.Close()
			return nil, 0, nil, errAttrs
		}

		reader, errReader := obj.NewReader(ctx)
		if errReader != nil {
			client.Close()
			return nil, 0, nil, errReader
		}

		return &gcsObjectReader{reader: reader, client: client}, attrs.Size, attrs.Metadata, nil
	}

	client := objstore.CreateS3Client(ctx, config.SymbolsAccessKey, config.SymbolsSecretAccessKey, config.SymbolsBucketRegion, config.AWSEndpoint)

	out, errGet := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(config.SymbolsBucket),
		Key:    aws.String(key),
	})
	if errGet != nil {
		return nil, 0, nil, errGet
	}

	return out.Body, aws.ToInt64(out.ContentLength), out.Metadata, nil
}

// gcsObjectReader couples a GCS object reader with its client so
// closing the download releases both.
type gcsObjectReader struct {
	reader *storage.Reader
	client *storage.Client
}

func (r *gcsObjectReader) Read(p []byte) (int, error) {
	return r.reader.Read(p)
}

func (r *gcsObjectReader) Close() error {
	readerErr := r.reader.Close()
	if clientErr := r.client.Close(); clientErr != nil && readerErr == nil {
		readerErr = clientErr
	}
	return readerErr
}

// dsymName reads the binary name from the /meta object stored next to
// a dsym artifact's /debuginfo object.
func dsymName(ctx context.Context, config BuildFileDownloadConfig, debugInfoKey string) (string, error) {
	body, _, _, err := openSymbolObject(ctx, config, path.Dir(debugInfoKey)+"/meta")
	if err != nil {
		return "", err
	}
	defer body.Close()

	var meta struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(body).Decode(&meta); err != nil {
		return "", err
	}
	if meta.Name == "" {
		return "", fmt.Errorf("dsym meta has no name for key %q", debugInfoKey)
	}

	return meta.Name, nil
}

// xmlEscape escapes a string for interpolation into XML text nodes.
func xmlEscape(s string) string {
	var buf bytes.Buffer
	// EscapeText only errors on writer failures and bytes.Buffer has none.
	_ = xml.EscapeText(&buf, []byte(s))
	return buf.String()
}

// writeDsymBundleZip writes a zip holding a reconstructed .dSYM bundle:
// the stored DWARF binary at Contents/Resources/DWARF/<name> plus a
// minimal Info.plist, which is the shape Xcode produces and symbol
// tooling expects.
func writeDsymBundleZip(w io.Writer, name, versionName, versionCode string, dwarf io.Reader) error {
	// name becomes a path segment in the zip entries below and originates
	// from an uploaded artifact's tar entry basename, so a crafted name
	// with a path separator could make an extractor write outside its
	// target directory. A real Mach-O binary name is a bare filename, so
	// reject anything that is not.
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, `/\`) {
		return fmt.Errorf("unsafe dsym bundle name %q", name)
	}

	zw := zip.NewWriter(w)

	plist, err := zw.Create(name + ".dSYM/Contents/Info.plist")
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>English</string>
	<key>CFBundleIdentifier</key>
	<string>com.apple.xcode.dsym.%[1]s</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundlePackageType</key>
	<string>dSYM</string>
	<key>CFBundleSignature</key>
	<string>????</string>
	<key>CFBundleShortVersionString</key>
	<string>%[2]s</string>
	<key>CFBundleVersion</key>
	<string>%[3]s</string>
</dict>
</plist>
`, xmlEscape(name), xmlEscape(versionName), xmlEscape(versionCode)); err != nil {
		return err
	}

	dw, err := zw.Create(name + ".dSYM/Contents/Resources/DWARF/" + name)
	if err != nil {
		return err
	}

	if _, err := io.Copy(dw, dwarf); err != nil {
		return err
	}

	return zw.Close()
}

// OpenBuildFileDownload opens the downloadable form of a build's
// mapping file. The stored artifact already is what developers expect
// for proguard, elf_debug and jsbundle mappings and streams through
// as-is; dsym artifacts are stored as the DWARF binary, so the
// download reconstructs the .dSYM bundle around it as a zip.
func OpenBuildFileDownload(ctx context.Context, config BuildFileDownloadConfig, file BuildFile) (*BuildFileDownload, error) {
	body, size, metadata, err := openSymbolObject(ctx, config, file.Key)
	if err != nil {
		return nil, err
	}

	passthrough := func(w io.Writer) error {
		_, copyErr := io.Copy(w, body)
		return copyErr
	}

	switch file.MappingType {
	case symbol.TypeProguard.String():
		return &BuildFileDownload{
			Filename:      "mapping.txt",
			ContentType:   "text/plain",
			ContentLength: size,
			stream:        passthrough,
			closer:        body.Close,
		}, nil
	case symbol.TypeElfDebug.String():
		filename := metadata["original_file_name"]
		if filename == "" {
			filename = path.Base(file.Key)
		}
		return &BuildFileDownload{
			Filename:      filename,
			ContentType:   "application/octet-stream",
			ContentLength: size,
			stream:        passthrough,
			closer:        body.Close,
		}, nil
	case symbol.TypeJsBundle.String():
		return &BuildFileDownload{
			Filename:      path.Base(file.Key),
			ContentType:   "application/octet-stream",
			ContentLength: size,
			stream:        passthrough,
			closer:        body.Close,
		}, nil
	case symbol.TypeDsym.String():
		name, nameErr := dsymName(ctx, config, file.Key)
		if nameErr != nil {
			fmt.Println("failed to read dsym meta, falling back to a generic bundle name:", nameErr)
			name = "debuginfo"
		}
		return &BuildFileDownload{
			Filename:      name + ".dSYM.zip",
			ContentType:   "application/zip",
			ContentLength: -1,
			stream: func(w io.Writer) error {
				return writeDsymBundleZip(w, name, file.VersionName, file.VersionCode, body)
			},
			closer: body.Close,
		}, nil
	}

	if closeErr := body.Close(); closeErr != nil {
		fmt.Println("failed to close symbol object reader:", closeErr)
	}

	return nil, fmt.Errorf("failed to recognize mapping type %q", file.MappingType)
}

// GetBuildFile reads a single build mapping file row of an app.
func GetBuildFile(ctx context.Context, pg *pgxpool.Pool, appID, buildFileID uuid.UUID) (file BuildFile, err error) {
	stmt := sqlf.PostgreSQL.From("build_mappings").
		Select("id").
		Select("version_name").
		Select("version_code").
		Select("patch_id").
		Select("mapping_type").
		Select("key").
		Select("file_size").
		Select("last_updated").
		Where("id = ?", buildFileID).
		Where("app_id = ?", appID).
		// an empty key means the mapping file hasn't finished uploading
		// and processing yet, so there is nothing to download
		Where("key != ''")

	defer stmt.Close()

	err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&file.ID,
		&file.VersionName,
		&file.VersionCode,
		&file.PatchID,
		&file.MappingType,
		&file.Key,
		&file.FileSize,
		&file.LastUpdated,
	)

	return file, err
}

// GetBuildsWithFilter provides a paginated list of an app's builds
// within the filter's time range, ordered by upload time, newest
// first. Mapping files uploaded for the same (version_name,
// version_code, patch_id) group are packaged into one build, keeping
// the latest file of each mapping type. Pagination applies to
// builds, not to their files.
func GetBuildsWithFilter(ctx context.Context, pg *pgxpool.Pool, af *filter.AppFilter) (builds []Build, next, previous bool, err error) {
	// latest keeps the most recently uploaded file of each mapping
	// type within every (version_name, version_code, patch_id) group
	latest := sqlf.PostgreSQL.From("build_mappings").
		Select("distinct on (version_name, version_code, patch_id, mapping_type) id").
		Select("version_name").
		Select("version_code").
		Select("patch_id").
		Select("mapping_type").
		Select("key").
		Select("file_size").
		Select("last_updated").
		Where("app_id = ?", af.AppID).
		// an empty key means the mapping file hasn't finished uploading
		// and processing yet, so there is nothing to download
		Where("key != ''").
		// id breaks ties in case last_updated is same
		OrderBy("version_name, version_code, patch_id, mapping_type, last_updated desc, id")

	if af.HasTimeRange() {
		latest.Where("last_updated >= ?", af.From)
		latest.Where("last_updated <= ?", af.To)
	}

	// page selects the builds of the requested page, ordered by
	// their newest file; the group columns break ties in case
	// last_updated is same
	page := sqlf.PostgreSQL.From("latest").
		Select("version_name").
		Select("version_code").
		Select("patch_id").
		Select("max(last_updated) as build_last_updated").
		GroupBy("version_name, version_code, patch_id").
		OrderBy("build_last_updated desc, version_name desc, version_code desc, patch_id desc")

	if af.Limit > 0 {
		// fetch one extra build to detect if a next page exists
		page.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		page.Offset(uint64(af.Offset))
	}

	stmt := sqlf.PostgreSQL.
		With("latest", latest).
		With("page", page).
		From("latest").
		Join("page", "latest.version_name = page.version_name and latest.version_code = page.version_code and latest.patch_id = page.patch_id").
		Select("latest.id").
		Select("latest.version_name").
		Select("latest.version_code").
		Select("latest.patch_id").
		Select("latest.mapping_type").
		Select("latest.key").
		Select("latest.file_size").
		Select("latest.last_updated").
		OrderBy("page.build_last_updated desc, latest.version_name desc, latest.version_code desc, latest.patch_id desc, latest.mapping_type")

	defer stmt.Close()

	rows, err := pg.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, err
	}
	defer rows.Close()

	for rows.Next() {
		var file BuildFile
		if err := rows.Scan(
			&file.ID,
			&file.VersionName,
			&file.VersionCode,
			&file.PatchID,
			&file.MappingType,
			&file.Key,
			&file.FileSize,
			&file.LastUpdated,
		); err != nil {
			return nil, false, false, err
		}

		patch := ""
		if file.PatchID != uuid.Nil {
			patch = file.PatchID.String()
		}

		// files of one build arrive consecutively, so a new build
		// starts whenever the group columns change
		if len(builds) == 0 ||
			builds[len(builds)-1].VersionName != file.VersionName ||
			builds[len(builds)-1].VersionCode != file.VersionCode ||
			builds[len(builds)-1].PatchID != patch {
			builds = append(builds, Build{
				VersionName: file.VersionName,
				VersionCode: file.VersionCode,
				PatchID:     patch,
			})
		}

		build := &builds[len(builds)-1]
		build.Files = append(build.Files, file)
		if file.LastUpdated.After(build.LastUpdated) {
			build.LastUpdated = file.LastUpdated
		}
	}

	if err = rows.Err(); err != nil {
		return nil, false, false, err
	}

	// Set pagination next & previous flags
	if af.Limit > 0 && len(builds) > af.Limit {
		builds = builds[:af.Limit]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return builds, next, previous, nil
}
