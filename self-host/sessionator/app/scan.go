package app

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
)

// hidden validates if file or dir
// is hidden.
func hidden(name string) bool {
	return strings.HasPrefix(name, ".")
}

// Scan reads and validates session data directory
// and sets up internal data structures for apps,
// builds and sessions.
func Scan(rootPath string) (apps *Apps, err error) {
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
					msg := fmt.Sprintf("%q:%q has empty session file. check %q", app.Name, app.Version, rel)
					return errors.New(msg)
				}
				app.Sessions = append(app.Sessions, path)
			}

			mapping, err := filepath.Match("*/*/mapping.txt", rel)
			if err != nil {
				return err
			}
			if mapping {
				app := apps.Lookup(parts[0], parts[1])
				info, err := d.Info()
				if err != nil {
					return err
				}
				if info.Size() < 1 {
					msg := fmt.Sprintf("%q:%q has empty mapping.txt file. check %q", app.Name, app.Version, rel)
					return errors.New(msg)
				}
				app.MappingFile = path
			}

			build, err := filepath.Match("*/*/build.toml", rel)
			if err != nil {
				return err
			}
			if build {
				app := apps.Lookup(parts[0], parts[1])
				info, err := d.Info()
				if err != nil {
					return err
				}
				if info.Size() < 1 {
					msg := fmt.Sprintf("%q:%q has empty build.toml. check %q", app.Name, app.Version, rel)
					return errors.New(msg)
				}
				if err := app.ReadBuild(path); err != nil {
					return err
				}
				if app.BuildInfo.Size < 1 {
					msg := fmt.Sprintf("%q:%q has zero build size. check %q", app.Name, app.Version, rel)
					return errors.New(msg)
				}
				if app.BuildInfo.Type == "" {
					msg := fmt.Sprintf("%q:%q has empty build type. check %q", app.Name, app.Version, rel)
					return errors.New(msg)
				}
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return
}
