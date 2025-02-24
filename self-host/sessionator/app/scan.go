package app

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"slices"
	"strings"

	"github.com/google/uuid"
)

// hidden validates if file or dir
// is hidden.
func hidden(name string) bool {
	return strings.HasPrefix(name, ".")
}

// ScanOpts holds the options for
// configuring app scanning on disk.
type ScanOpts struct {
	SkipApps []string
}

// Scan reads and validates session data directory
// and sets up internal data structures for apps,
// builds, events and blobs.
func Scan(rootPath string, opts *ScanOpts) (apps *Apps, err error) {
	apps = &Apps{}
	rootbase := filepath.Base(rootPath)
	if err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		name := d.Name()
		rel, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}

		parts := strings.Split(rel, "/")

		// don't process apps marked
		// to skip
		if slices.Contains(opts.SkipApps, parts[0]) {
			return fs.SkipDir
		}

		if d.IsDir() {
			// not top-level directory
			if name != rootbase && !hidden(name) {
				appMatch, err := filepath.Match("*/*", rel)
				if err != nil {
					return err
				}
				if appMatch {
					apps.Add(parts[0], parts[1])
				}
			}
		} else if d.Type().IsRegular() && !hidden(name) {
			jsonMatch, err := filepath.Match("*/*/*.json", rel)
			if err != nil {
				return err
			}
			info, err := d.Info()
			if err != nil {
				return err
			}
			if jsonMatch {
				app := apps.Lookup(parts[0], parts[1])
				if info.Size() < 1 {
					return fmt.Errorf("%q has empty an events file. check %q", app.FullName(), rel)
				}
				app.EventAndSpanFiles = append(app.EventAndSpanFiles, path)
			}

			code := filepath.Base(filepath.Dir(rel))

			buildToml, err := filepath.Match("*/*/*/build.toml", rel)
			if err != nil {
				return err
			}
			if buildToml {
				app := apps.Lookup(parts[0], parts[1])
				info, err := d.Info()
				if err != nil {
					return err
				}
				if info.Size() < 1 {
					return fmt.Errorf("%q has empty build.toml. check %q", app.FullName(), rel)
				}
				build := &Build{
					VersionCode: code,
				}
				if err := app.ReadBuild(path, &build.BuildInfo); err != nil {
					return err
				}
				if build.BuildInfo.Size < 1 {
					return fmt.Errorf("%q has zero build size. check %q", app.FullName(), rel)
				}
				if build.BuildInfo.Type == "" {
					return fmt.Errorf("%q has empty build type. check %q", app.FullName(), rel)
				}

				app.Builds[code] = build
			}

			proguardMapping, err := filepath.Match("*/*/*/mapping.txt", rel)
			if err != nil {
				return err
			}
			if proguardMapping {
				app := apps.Lookup(parts[0], parts[1])
				info, err := d.Info()
				if err != nil {
					return err
				}
				if info.Size() < 1 {
					return fmt.Errorf("%q has empty mapping.txt file. check %q", app.FullName(), rel)
				}

				app.Builds[code].MappingFiles = append(app.Builds[code].MappingFiles, path)
			}

			dSYMMapping, err := filepath.Match("*/*/*/*.tgz", rel)
			if err != nil {
				return err
			}
			if dSYMMapping {
				app := apps.Lookup(parts[0], parts[1])
				info, err := d.Info()
				if err != nil {
					return err
				}
				if info.Size() < 1 {
					return fmt.Errorf(`%q has empty dSYM mapping file. check %q`, app.FullName(), rel)
				}
				_, ok := app.Builds[code]
				if !ok {
					return fmt.Errorf("failed to create build for code: %s", code)
				}

				app.Builds[code].MappingFiles = append(app.Builds[code].MappingFiles, path)
			}

			blob, err := filepath.Match("*/*/blobs/*", rel)
			if err != nil {
				return err
			}
			if blob {
				app := apps.Lookup(parts[0], parts[1])
				info, err := d.Info()
				if err != nil {
					return err
				}

				if err := uuid.Validate(info.Name()); err != nil {
					return fmt.Errorf("%q contains blob file with invalid name. check %q", app.FullName(), rel)
				}

				if info.Size() < 1 {
					return fmt.Errorf("%q contains empty blob file. check %q", app.FullName(), rel)
				}

				app.BlobFiles = append(app.BlobFiles, path)
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return
}
