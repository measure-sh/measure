package pipeline

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"sync/atomic"

	"golang.org/x/sync/errgroup"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/googleapi"
)

const (
	// cloneCopyConcurrency caps concurrent Files.Copy operations against
	// Drive. Each copy is server-side but synchronous (we wait for it to
	// complete) and can take tens of seconds for multi-GB files; running
	// too many at once invites rate-limiting from Drive's side.
	cloneCopyConcurrency = 4

	// cloneDeleteConcurrency caps concurrent Files.Delete operations.
	// Deletes are cheap; we can run more in parallel.
	cloneDeleteConcurrency = 8
)

var (
	reFolderID = regexp.MustCompile(`/folders/([a-zA-Z0-9_-]+)`)

	// ErrInvalidDestFolder is returned when the configured destination
	// Drive folder ID does not exist, is not a folder, or the SA cannot
	// add children to it.
	ErrInvalidDestFolder = errors.New("destination Drive folder is not usable")
)

// ExtractFolderID parses the trailing folder ID from a Google Drive URL
// of the shape `.../folders/<id>...`.
func ExtractFolderID(url string) (string, error) {
	m := reFolderID.FindStringSubmatch(url)
	if len(m) < 2 {
		return "", fmt.Errorf("cannot extract folder ID from URL: %s", url)
	}
	return m[1], nil
}

// DriveCloner manages a destination Drive folder used to bypass the
// per-public-file 24-hour download quota: it server-side-copies each
// catalog .7z into the folder via Files.Copy. Downloads against the
// resulting copies use the SA's authenticated quota instead of the
// upstream public file's per-link cap.
type DriveCloner struct {
	client       *drive.Service
	destFolderID string
}

// NewDriveCloner verifies that destFolderID points at a Drive folder the
// SA can write into, and returns a cloner ready to wipe-and-copy.
func NewDriveCloner(ctx context.Context, svc *drive.Service, destFolderID string) (*DriveCloner, error) {
	if destFolderID == "" {
		return nil, fmt.Errorf("%w: empty folder ID", ErrInvalidDestFolder)
	}
	folder, err := svc.Files.Get(destFolderID).Context(ctx).
		Fields("id, mimeType, capabilities/canAddChildren").
		SupportsAllDrives(true).
		Do()
	if err != nil {
		return nil, fmt.Errorf("%w: get %s: %w", ErrInvalidDestFolder, destFolderID, err)
	}
	if folder.MimeType != "application/vnd.google-apps.folder" {
		return nil, fmt.Errorf("%w: %s is %s, not a folder", ErrInvalidDestFolder, destFolderID, folder.MimeType)
	}
	if folder.Capabilities != nil && !folder.Capabilities.CanAddChildren {
		return nil, fmt.Errorf("%w: SA cannot add children to %s (share with Editor role)", ErrInvalidDestFolder, destFolderID)
	}
	return &DriveCloner{client: svc, destFolderID: destFolderID}, nil
}

// DestFolderID returns the destination folder this cloner targets.
// Useful for the spotter which lists the same folder for selection.
func (c *DriveCloner) DestFolderID() string { return c.destFolderID }

// WipeAndCopy deletes every .7z in the destination folder, then
// server-side-copies every .7z found across the catalog's source folders
// into the destination. Returns the count of newly created copies and
// the count of pre-existing copies that were wiped.
//
// Cross-folder duplicates (same md5 in multiple source folders) are
// deduped to a single copy at the destination. Files with empty md5
// pass through.
func (c *DriveCloner) WipeAndCopy(ctx context.Context, catalog *Catalog) (copied, wiped int, err error) {
	wiped, err = c.wipeAll(ctx)
	if err != nil {
		return 0, wiped, fmt.Errorf("wipe destination: %w", err)
	}

	sources, err := c.collectSources(ctx, catalog)
	if err != nil {
		return 0, wiped, fmt.Errorf("collect source archives: %w", err)
	}

	copied, err = c.copyAll(ctx, sources)
	if err != nil {
		return copied, wiped, fmt.Errorf("copy archives: %w", err)
	}
	return copied, wiped, nil
}

// DeleteCopy removes a single SA-owned copy by file ID. Idempotent —
// missing files (404) are not an error. Used by the fetcher right after
// a successful manifest write to bound peak Drive storage.
func (c *DriveCloner) DeleteCopy(ctx context.Context, fileID string) error {
	if fileID == "" {
		return nil
	}
	err := c.client.Files.Delete(fileID).Context(ctx).SupportsAllDrives(true).Do()
	if err == nil {
		return nil
	}
	var gErr *googleapi.Error
	if errors.As(err, &gErr) && gErr.Code == 404 {
		return nil
	}
	return err
}

// wipeAll lists every .7z under destFolderID and deletes each.
func (c *DriveCloner) wipeAll(ctx context.Context) (int, error) {
	files, err := c.listDestArchives(ctx)
	if err != nil {
		return 0, err
	}
	if len(files) == 0 {
		return 0, nil
	}

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(cloneDeleteConcurrency)
	var deleted atomic.Int64

	for _, f := range files {
		f := f
		g.Go(func() error {
			if err := c.client.Files.Delete(f.Id).Context(gctx).SupportsAllDrives(true).Do(); err != nil {
				var gErr *googleapi.Error
				if errors.As(err, &gErr) && gErr.Code == 404 {
					return nil
				}
				return fmt.Errorf("delete %s (%s): %w", f.Name, f.Id, err)
			}
			deleted.Add(1)
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return int(deleted.Load()), err
	}
	return int(deleted.Load()), nil
}

// listDestArchives returns all `.7z` files under destFolderID.
func (c *DriveCloner) listDestArchives(ctx context.Context) ([]*drive.File, error) {
	var files []*drive.File
	pageToken := ""
	for {
		query := fmt.Sprintf("'%s' in parents and trashed=false", c.destFolderID)
		result, err := c.client.Files.List().Context(ctx).
			Q(query).
			Spaces("drive").
			Fields("files(id, name, md5Checksum), nextPageToken").
			PageSize(200).
			PageToken(pageToken).
			SupportsAllDrives(true).
			IncludeItemsFromAllDrives(true).
			Do()
		if err != nil {
			return nil, fmt.Errorf("list dest folder %s: %w", c.destFolderID, err)
		}
		for _, f := range result.Files {
			if !strings.HasSuffix(f.Name, ".7z") {
				continue
			}
			files = append(files, f)
		}
		if result.NextPageToken == "" {
			break
		}
		pageToken = result.NextPageToken
	}
	return files, nil
}

// srcArchive is one .7z file in a catalog source folder, with metadata
// needed for copy + dedup.
type srcArchive struct {
	id   string
	name string
	md5  string
}

// collectSources walks every catalog folder, lists its .7z files, and
// returns a deduped (by md5) slice ready for copying.
func (c *DriveCloner) collectSources(ctx context.Context, catalog *Catalog) ([]srcArchive, error) {
	seen := make(map[string]bool)
	var out []srcArchive
	for _, folder := range catalog.Folders {
		folderID, err := ExtractFolderID(folder.URL)
		if err != nil {
			return nil, err
		}
		archives, err := c.listSourceArchives(ctx, folderID)
		if err != nil {
			return nil, fmt.Errorf("list source folder %s: %w", folderID, err)
		}
		for _, a := range archives {
			if a.md5 != "" {
				if seen[a.md5] {
					slog.Info("cloner: skipping cross-folder duplicate", "name", a.name, "md5", a.md5)
					continue
				}
				seen[a.md5] = true
			}
			out = append(out, a)
		}
	}
	return out, nil
}

// listSourceArchives returns all .7z files under a public source folder.
func (c *DriveCloner) listSourceArchives(ctx context.Context, folderID string) ([]srcArchive, error) {
	var archives []srcArchive
	pageToken := ""
	for {
		query := fmt.Sprintf("'%s' in parents and trashed=false", folderID)
		result, err := c.client.Files.List().Context(ctx).
			Q(query).
			Spaces("drive").
			Fields("files(id, name, md5Checksum), nextPageToken").
			PageSize(200).
			PageToken(pageToken).
			Do()
		if err != nil {
			return nil, err
		}
		for _, f := range result.Files {
			if !strings.HasSuffix(f.Name, ".7z") {
				continue
			}
			archives = append(archives, srcArchive{id: f.Id, name: f.Name, md5: f.Md5Checksum})
		}
		if result.NextPageToken == "" {
			break
		}
		pageToken = result.NextPageToken
	}
	return archives, nil
}

// copyAll runs Files.Copy for each source archive into destFolderID with
// bounded concurrency.
func (c *DriveCloner) copyAll(ctx context.Context, sources []srcArchive) (int, error) {
	if len(sources) == 0 {
		return 0, nil
	}

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(cloneCopyConcurrency)
	var copied atomic.Int64

	for _, src := range sources {
		src := src
		g.Go(func() error {
			body := &drive.File{
				Name:    src.name,
				Parents: []string{c.destFolderID},
			}
			_, err := c.client.Files.Copy(src.id, body).Context(gctx).
				Fields("id").
				SupportsAllDrives(true).
				Do()
			if err != nil {
				return fmt.Errorf("copy %s (%s): %w", src.name, src.id, err)
			}
			copied.Add(1)
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return int(copied.Load()), err
	}
	return int(copied.Load()), nil
}
