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

// Build represents a single mapping file uploaded
// for an app version.
type Build struct {
	ID          uuid.UUID `json:"id"`
	VersionName string    `json:"version_name"`
	VersionCode string    `json:"version_code"`
	MappingType string    `json:"mapping_type"`
	Key         string    `json:"-"`
	DownloadURL string    `json:"download_url"`
	FileSize    int64     `json:"filesize"`
	LastUpdated time.Time `json:"last_updated"`
}

// BuildDownloadConfig is the storage configuration OpenBuildDownload
// needs to read mapping file artifacts from the symbols bucket.
type BuildDownloadConfig struct {
	IsCloud                bool
	AWSEndpoint            string
	SymbolsBucket          string
	SymbolsBucketRegion    string
	SymbolsAccessKey       string
	SymbolsSecretAccessKey string
}

// BuildDownload is the downloadable form of a build's mapping file:
// the filename and headers a file download response needs, plus a
// Stream method that writes the body.
type BuildDownload struct {
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
func (d *BuildDownload) Stream(w io.Writer) error {
	return d.stream(w)
}

// Close releases the underlying object reader.
func (d *BuildDownload) Close() error {
	return d.closer()
}

// openSymbolObject opens the object at key in the symbols bucket and
// returns its reader, size and object metadata. The reader's Close
// releases every underlying resource.
func openSymbolObject(ctx context.Context, config BuildDownloadConfig, key string) (body io.ReadCloser, size int64, metadata map[string]string, err error) {
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
func dsymName(ctx context.Context, config BuildDownloadConfig, debugInfoKey string) (string, error) {
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

// OpenBuildDownload opens the downloadable form of a build's mapping
// file. The stored artifact already is what developers expect for
// proguard, elf_debug and jsbundle mappings and streams through as-is;
// dsym artifacts are stored as the DWARF binary, so the download
// reconstructs the .dSYM bundle around it as a zip.
func OpenBuildDownload(ctx context.Context, config BuildDownloadConfig, build Build) (*BuildDownload, error) {
	body, size, metadata, err := openSymbolObject(ctx, config, build.Key)
	if err != nil {
		return nil, err
	}

	passthrough := func(w io.Writer) error {
		_, copyErr := io.Copy(w, body)
		return copyErr
	}

	switch build.MappingType {
	case symbol.TypeProguard.String():
		return &BuildDownload{
			Filename:      "mapping.txt",
			ContentType:   "text/plain",
			ContentLength: size,
			stream:        passthrough,
			closer:        body.Close,
		}, nil
	case symbol.TypeElfDebug.String():
		filename := metadata["original_file_name"]
		if filename == "" {
			filename = path.Base(build.Key)
		}
		return &BuildDownload{
			Filename:      filename,
			ContentType:   "application/octet-stream",
			ContentLength: size,
			stream:        passthrough,
			closer:        body.Close,
		}, nil
	case symbol.TypeJsBundle.String():
		return &BuildDownload{
			Filename:      path.Base(build.Key),
			ContentType:   "application/octet-stream",
			ContentLength: size,
			stream:        passthrough,
			closer:        body.Close,
		}, nil
	case symbol.TypeDsym.String():
		name, nameErr := dsymName(ctx, config, build.Key)
		if nameErr != nil {
			fmt.Println("failed to read dsym meta, falling back to a generic bundle name:", nameErr)
			name = "debuginfo"
		}
		return &BuildDownload{
			Filename:      name + ".dSYM.zip",
			ContentType:   "application/zip",
			ContentLength: -1,
			stream: func(w io.Writer) error {
				return writeDsymBundleZip(w, name, build.VersionName, build.VersionCode, body)
			},
			closer: body.Close,
		}, nil
	}

	if closeErr := body.Close(); closeErr != nil {
		fmt.Println("failed to close symbol object reader:", closeErr)
	}

	return nil, fmt.Errorf("failed to recognize mapping type %q", build.MappingType)
}

// GetBuild reads a single build mapping row of an app.
func GetBuild(ctx context.Context, pg *pgxpool.Pool, appID, buildID uuid.UUID) (build Build, err error) {
	stmt := sqlf.PostgreSQL.From("build_mappings").
		Select("id").
		Select("version_name").
		Select("version_code").
		Select("mapping_type").
		Select("key").
		Select("file_size").
		Select("last_updated").
		Where("id = ?", buildID).
		Where("app_id = ?", appID).
		// an empty key means the mapping file hasn't finished uploading
		// and processing yet, so there is nothing to download
		Where("key != ''")

	defer stmt.Close()

	err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&build.ID,
		&build.VersionName,
		&build.VersionCode,
		&build.MappingType,
		&build.Key,
		&build.FileSize,
		&build.LastUpdated,
	)

	return build, err
}

// GetBuildsWithFilter provides a paginated list of an app's build mapping
// files matching various filters, ordered by upload time, newest first.
func GetBuildsWithFilter(ctx context.Context, pg *pgxpool.Pool, af *filter.AppFilter) (builds []Build, next, previous bool, err error) {
	stmt := sqlf.PostgreSQL.From("build_mappings").
		Select("id").
		Select("version_name").
		Select("version_code").
		Select("mapping_type").
		Select("key").
		Select("file_size").
		Select("last_updated").
		Where("app_id = ?", af.AppID).
		// an empty key means the mapping file hasn't finished uploading
		// and processing yet, so there is nothing to download
		Where("key != ''").
		// id breaks ties in case last_updated is same
		OrderBy("last_updated desc, id")

	if af.HasTimeRange() {
		stmt.Where("last_updated >= ?", af.From)
		stmt.Where("last_updated <= ?", af.To)
	}

	if af.HasVersions() {
		stmt.Where("version_name = ANY(?)", af.Versions)
		stmt.Where("version_code = ANY(?)", af.VersionCodes)
	}

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	defer stmt.Close()

	rows, err := pg.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, err
	}
	defer rows.Close()

	for rows.Next() {
		var build Build
		if err := rows.Scan(
			&build.ID,
			&build.VersionName,
			&build.VersionCode,
			&build.MappingType,
			&build.Key,
			&build.FileSize,
			&build.LastUpdated,
		); err != nil {
			return nil, false, false, err
		}
		builds = append(builds, build)
	}

	if err = rows.Err(); err != nil {
		return nil, false, false, err
	}

	resultLen := len(builds)

	// Set pagination next & previous flags
	if af.Limit > 0 && resultLen > af.Limit {
		builds = builds[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return builds, next, previous, nil
}
