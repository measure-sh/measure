package pipeline

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

var ErrNoMatchingArchive = errors.New("no matching archive found in cloned folders")

// archiveEntry is a parsed .7z shortcut from a cloned Drive folder.
type archiveEntry struct {
	version    string
	build      string
	arch       string
	shortcutID string // Drive file ID of the shortcut itself
	targetID   string // Drive file ID the shortcut points to
}

// GoogleDrivePlanner implements Planner using the Google Drive API.
type GoogleDrivePlanner struct {
	client *drive.Service
}

func NewGoogleDrivePlanner(creds *google.Credentials) (*GoogleDrivePlanner, error) {
	svc, err := drive.NewService(context.Background(), option.WithCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("drive service: %w", err)
	}
	return &GoogleDrivePlanner{client: svc}, nil
}

// vbaKey returns a dedup key for version+build+arch lookups.
func vbaKey(version, build, arch string) string {
	return version + "|" + build + "|" + arch
}

// Plan scans cloned folders to build an index of available archives,
// then matches each target against the index to produce a download plan.
func (p *GoogleDrivePlanner) Plan(ctx context.Context, targets []Target, folders []ClonedFolder) (*Plan, error) {
	byFileID := make(map[string]*archiveEntry) // targetID → entry
	byVBA := make(map[string]*archiveEntry)    // "version|build|arch" → entry (fallback for deduped files)
	for _, cf := range folders {
		if err := p.indexFolder(ctx, cf.ClonedID, byFileID, byVBA); err != nil {
			return nil, fmt.Errorf("index cloned folder %s: %w", cf.ClonedID, err)
		}
	}

	slog.Info("planner: indexed archives from cloned folders",
		"cloned_folders", len(folders),
		"archives_found", len(byFileID),
	)

	actions := make([]Action, 0, len(targets))
	seen := make(map[string]bool) // shortcutID → already queued (skip deduped duplicates)
	for _, target := range targets {
		entry, ok := byFileID[target.FileID]
		if !ok {
			// The cloner may have deduped this file (same content under a different Drive ID).
			// Fall back to matching by version+build+arch.
			info, parsed := ParseArchiveFilename(target.FileName)
			if parsed {
				entry, ok = byVBA[vbaKey(info.Version, info.Build, info.Arch)]
			}
		}
		if !ok {
			return nil, fmt.Errorf("%w: %s (file_id=%s)", ErrNoMatchingArchive, target.FileName, target.FileID)
		}
		if seen[entry.shortcutID] {
			slog.Info("planner: skipping deduped target",
				"file_name", target.FileName,
				"file_id", target.FileID,
				"shortcut_id", entry.shortcutID,
			)
			continue
		}
		seen[entry.shortcutID] = true
		actions = append(actions, Action{
			Target:     target,
			ShortcutID: entry.shortcutID,
		})
		slog.Info("planner: queued action",
			"version", entry.version,
			"build", entry.build,
			"arch", entry.arch,
			"shortcut_id", entry.shortcutID,
			"target_id", entry.targetID,
		)
	}

	plan := &Plan{Actions: actions}
	slog.Info("planner: plan ready",
		"total_actions", len(plan.Actions),
		"to_download", plan.DownloadCount(),
	)

	return plan, nil
}

// indexFolder lists all .7z shortcuts within a Drive folder and adds them to both indexes.
func (p *GoogleDrivePlanner) indexFolder(ctx context.Context, folderID string, byFileID, byVBA map[string]*archiveEntry) (err error) {
	pageToken := ""
	for {
		query := fmt.Sprintf("'%s' in parents and trashed=false and mimeType='application/vnd.google-apps.shortcut'", folderID)
		result, err := p.client.Files.List().Context(ctx).
			Q(query).
			Spaces("drive").
			Fields("files(id, name, shortcutDetails), nextPageToken").
			PageSize(200).
			PageToken(pageToken).
			Do()
		if err != nil {
			return fmt.Errorf("list shortcuts in %s: %w", folderID, err)
		}

		for _, f := range result.Files {
			if !strings.HasSuffix(f.Name, ".7z") {
				continue
			}
			if f.ShortcutDetails == nil {
				continue
			}
			info, ok := ParseArchiveFilename(f.Name)
			if !ok {
				slog.Warn("planner: skipping unparseable filename", "name", f.Name)
				continue
			}
			entry := &archiveEntry{
				version:    info.Version,
				build:      info.Build,
				arch:       info.Arch,
				shortcutID: f.Id,
				targetID:   f.ShortcutDetails.TargetId,
			}
			byFileID[f.ShortcutDetails.TargetId] = entry
			byVBA[vbaKey(info.Version, info.Build, info.Arch)] = entry
		}

		if result.NextPageToken == "" {
			break
		}
		pageToken = result.NextPageToken
	}
	return nil
}
