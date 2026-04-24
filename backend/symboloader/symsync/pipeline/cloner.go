package pipeline

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// Note: Using google.FindDefaultCredentials is the modern, secure approach for
// loading credentials from GOOGLE_APPLICATION_CREDENTIALS environment variable.

var ErrExtractingFolderID = errors.New("failed to extract folder ID from URL")
var ErrCreatingDestinationFolder = errors.New("failed to create destination folder")
var ErrCloningFolder = errors.New("failed to clone folder")

// ClonedFolder represents a Google Drive folder that has been
// cloned into the user's account for privileged download access.
type ClonedFolder struct {
	OriginalID string
	ClonedID   string
	Targets    []Target
}

// Cloner clones Google Drive folders into the user's account so
// that files can be downloaded with the user's own credentials.
type Cloner interface {
	Clone(ctx context.Context, targets []Target) ([]ClonedFolder, error)
}

// GoogleDriveCloner implements Cloner using the Google Drive API.
// It uses API key for reading public source folders and service account
// credentials for writing to the destination folder.
type GoogleDriveCloner struct {
	sourceClient        *drive.Service // for reading public source folders (API key)
	destClient          *drive.Service // for writing to destination (service account)
	destinationName     string
	destinationFolderID string // optional: user-provided shared folder ID
	destinationID       string // cached after creation/lookup
	destinationMutex    sync.Mutex
	onProgress          func(folderName string, current, total int)
}

// SetProgressCallback registers a function called before each folder is cloned,
// with the folder name and (1-based) current/total counts.
func (gc *GoogleDriveCloner) SetProgressCallback(fn func(folderName string, current, total int)) {
	gc.onProgress = fn
}

// NewGoogleDriveCloner creates a new Cloner with:
// - destCreds: service account credentials for writing to destination (from config)
// - apiKey: optional API key for reading public source folders (read-only)
// - Optional: destinationFolderID for a user-shared folder (takes priority over destinationName)
func NewGoogleDriveCloner(destCreds *google.Credentials, apiKey, destinationName, destinationFolderID string) (*GoogleDriveCloner, error) {
	ctx := context.Background()

	destClient, err := drive.NewService(ctx, option.WithCredentials(destCreds))
	if err != nil {
		return nil, fmt.Errorf("destination drive service: %w", err)
	}

	// Use API key for reading public source folders when available.
	// Fall back to the service account client — it can read public folders too.
	sourceClient := destClient
	if apiKey != "" {
		sourceClient, err = drive.NewService(ctx, option.WithAPIKey(apiKey))
		if err != nil {
			return nil, fmt.Errorf("source drive service (api key): %w", err)
		}
	}

	return &GoogleDriveCloner{
		sourceClient:        sourceClient,
		destClient:          destClient,
		destinationName:     destinationName,
		destinationFolderID: destinationFolderID,
	}, nil
}


// Clone clones the source folders to the destination folder.
func (gc *GoogleDriveCloner) Clone(ctx context.Context, targets []Target) ([]ClonedFolder, error) {
	if len(targets) == 0 {
		return []ClonedFolder{}, nil
	}

	// Create or get the destination folder
	destID, err := gc.ensureDestinationFolder(ctx)
	if err != nil {
		return nil, fmt.Errorf("destination folder: %w", err)
	}

	// Group targets by source folder
	sourceByID := make(map[string]*sourceFolderInfo)
	for _, target := range targets {
		folderID, err := extractFolderID(target.SourceFolder.URL)
		if err != nil {
			return nil, fmt.Errorf("%w: %s", ErrExtractingFolderID, target.SourceFolder.URL)
		}

		if _, exists := sourceByID[folderID]; !exists {
			sourceByID[folderID] = &sourceFolderInfo{
				originalID: folderID,
				targets:    []Target{},
			}
		}
		sourceByID[folderID].targets = append(sourceByID[folderID].targets, target)
	}

	// Clone each unique source folder
	var clonedFolders []ClonedFolder
	total := len(sourceByID)
	current := 0
	for _, srcInfo := range sourceByID {
		current++
		if gc.onProgress != nil {
			gc.onProgress(strings.Join(srcInfo.targets[0].SourceFolder.Versions, " – "), current, total)
		}
		clonedID, err := gc.cloneFolder(ctx, srcInfo.originalID, destID)
		if err != nil {
			return nil, fmt.Errorf("%w for folder %s: %w", ErrCloningFolder, srcInfo.originalID, err)
		}
		clonedFolders = append(clonedFolders, ClonedFolder{
			OriginalID: srcInfo.originalID,
			ClonedID:   clonedID,
			Targets:    srcInfo.targets,
		})
	}

	return clonedFolders, nil
}

// ensureDestinationFolder verifies or creates the destination folder.
// If destinationFolderID is set, it uses that shared folder (user-provided).
// Otherwise, it creates a folder at Drive root (original behavior).
func (gc *GoogleDriveCloner) ensureDestinationFolder(ctx context.Context) (string, error) {
	gc.destinationMutex.Lock()
	defer gc.destinationMutex.Unlock()

	if gc.destinationID != "" {
		return gc.destinationID, nil
	}

	// If folder ID is provided, use the user-shared folder
	if gc.destinationFolderID != "" {
		// Verify the folder exists and is accessible
		folder, err := gc.destClient.Files.Get(gc.destinationFolderID).Context(ctx).
			Fields("id, name, mimeType").
			Do()
		if err != nil {
			return "", fmt.Errorf("%w: user-provided folder ID %q not found or not accessible: %w",
				ErrCreatingDestinationFolder, gc.destinationFolderID, err)
		}
		if folder.MimeType != "application/vnd.google-apps.folder" {
			return "", fmt.Errorf("%w: folder ID %q is not a Google Drive folder",
				ErrCreatingDestinationFolder, gc.destinationFolderID)
		}
		gc.destinationID = folder.Id
		return gc.destinationID, nil
	}

	// Default behavior: create folder in service account's Drive root

	// Check if folder already exists at Drive root
	query := fmt.Sprintf("name='%s' and trashed=false and mimeType='application/vnd.google-apps.folder' and 'root' in parents",
		escapeDriveQuery(gc.destinationName))
	result, err := gc.destClient.Files.List().Context(ctx).
		Q(query).
		Spaces("drive").
		Fields("files(id, name)").
		PageSize(1).
		Do()
	if err != nil {
		return "", fmt.Errorf("%w: query failed: %w", ErrCreatingDestinationFolder, err)
	}

	if len(result.Files) > 0 {
		gc.destinationID = result.Files[0].Id
		return gc.destinationID, nil
	}

	// Create the folder
	folderMeta := &drive.File{
		Name:     gc.destinationName,
		MimeType: "application/vnd.google-apps.folder",
		Parents:  []string{"root"},
	}
	created, err := gc.destClient.Files.Create(folderMeta).Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("%w: create failed: %w", ErrCreatingDestinationFolder, err)
	}

	gc.destinationID = created.Id
	return gc.destinationID, nil
}

// cloneFolder copies a source folder to the destination folder.
// For idempotency, checks if a folder with the same name already exists
// and reuses it instead of creating a duplicate.
func (gc *GoogleDriveCloner) cloneFolder(ctx context.Context, srcFolderID, destParentID string) (string, error) {
	// Get source folder metadata (read from source with API key)
	srcFolder, err := gc.sourceClient.Files.Get(srcFolderID).Context(ctx).
		Fields("id, name, description").
		Do()
	if err != nil {
		return "", fmt.Errorf("get source folder: %w", err)
	}

	// Check if a folder with the same name already exists in destination (idempotency)
	query := fmt.Sprintf("name='%s' and parents='%s' and mimeType='application/vnd.google-apps.folder' and trashed=false",
		escapeDriveQuery(srcFolder.Name), destParentID)
	existing, err := gc.destClient.Files.List().Context(ctx).
		Q(query).
		Spaces("drive").
		Fields("files(id, name)").
		PageSize(1).
		Do()
	if err != nil {
		return "", fmt.Errorf("check for existing folder: %w", err)
	}

	// If folder already exists, still copy contents to merge from multiple sources
	if len(existing.Files) > 0 {
		existingID := existing.Files[0].Id
		if err := gc.copyFolderContents(ctx, srcFolderID, existingID); err != nil {
			return "", fmt.Errorf("copy contents: %w", err)
		}
		return existingID, nil
	}

	// Create cloned folder in destination (write with service account)
	cloneMeta := &drive.File{
		Name:     srcFolder.Name,
		MimeType: "application/vnd.google-apps.folder",
		Parents:  []string{destParentID},
	}
	clonedFolder, err := gc.destClient.Files.Create(cloneMeta).Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("create cloned folder: %w", err)
	}

	// Copy all files from source to cloned folder
	if err := gc.copyFolderContents(ctx, srcFolderID, clonedFolder.Id); err != nil {
		return "", fmt.Errorf("copy contents: %w", err)
	}

	return clonedFolder.Id, nil
}

// copyFolderContents recursively copies all files and subfolders from source to destination.
// For files with duplicate names but different checksums, appends a suffix (e.g., file-1.txt).
func (gc *GoogleDriveCloner) copyFolderContents(ctx context.Context, srcFolderID, destFolderID string) error {
	pageToken := ""
	for {
		query := fmt.Sprintf("'%s' in parents and trashed=false", srcFolderID)
		result, err := gc.sourceClient.Files.List().Context(ctx).
			Q(query).
			Spaces("drive").
			Fields("files(id, name, mimeType, md5Checksum), nextPageToken").
			PageSize(100).
			PageToken(pageToken).
			Do()
		if err != nil {
			return fmt.Errorf("list source files: %w", err)
		}

		for _, file := range result.Files {
			// Skip hidden files and folders (starting with '.')
			if strings.HasPrefix(file.Name, ".") {
				continue
			}

			isFolder := file.MimeType == "application/vnd.google-apps.folder"

			if isFolder {
				// Find or create subfolder in destination (idempotent merge)
				subFolderID, err := gc.ensureSubfolder(ctx, file.Name, destFolderID)
				if err != nil {
					return fmt.Errorf("ensure subfolder %s: %w", file.Name, err)
				}
				if err := gc.copyFolderContents(ctx, file.Id, subFolderID); err != nil {
					return fmt.Errorf("copy subfolder contents: %w", err)
				}
			} else {
				destFileName := file.Name

				existingFile, err := gc.findExistingFile(ctx, file.Name, destFolderID)
				if err != nil {
					return fmt.Errorf("check for existing file %s: %w", file.Name, err)
				}

				if existingFile != nil {
					if existingFile.ShortcutDetails != nil && existingFile.ShortcutDetails.TargetId == file.Id {
						// Exact same Drive file already stored, skip
						continue
					}
					// Different Drive ID — compare checksums to detect the same file stored
					// redundantly across multiple source folders (e.g. two "13.x" folders
					// both containing "13.4_17E255(arm64).7z" with identical bytes).
					if file.Md5Checksum != "" && existingFile.ShortcutDetails != nil {
						targetFile, err := gc.sourceClient.Files.Get(existingFile.ShortcutDetails.TargetId).
							Context(ctx).Fields("md5Checksum").Do()
						if err == nil && targetFile.Md5Checksum == file.Md5Checksum {
							// Same content already present, skip
							continue
						}
					}
					// Genuinely different file with the same name; find or confirm a suffix slot
					var alreadyExists bool
					destFileName, alreadyExists = gc.appendSuffix(ctx, file.Name, file.Id, file.Md5Checksum, destFolderID)
					if alreadyExists {
						continue
					}
				}

				// Copy file by creating a shortcut (efficient) and preserves reference to original
				shortcut := &drive.File{
					Name:        destFileName,
					MimeType:    "application/vnd.google-apps.shortcut",
					ShortcutDetails: &drive.FileShortcutDetails{
						TargetId: file.Id,
					},
					Parents: []string{destFolderID},
				}
				_, err = gc.destClient.Files.Create(shortcut).Context(ctx).Do()
				if err != nil {
					return fmt.Errorf("create shortcut for %s: %w", destFileName, err)
				}
			}
		}

		if result.NextPageToken == "" {
			break
		}
		pageToken = result.NextPageToken
	}

	return nil
}

// ensureSubfolder finds an existing subfolder by name or creates it if absent.
func (gc *GoogleDriveCloner) ensureSubfolder(ctx context.Context, name, parentID string) (string, error) {
	query := fmt.Sprintf("name='%s' and parents='%s' and mimeType='application/vnd.google-apps.folder' and trashed=false",
		escapeDriveQuery(name), parentID)
	result, err := gc.destClient.Files.List().Context(ctx).
		Q(query).
		Spaces("drive").
		Fields("files(id)").
		PageSize(1).
		Do()
	if err != nil {
		return "", fmt.Errorf("check for existing subfolder: %w", err)
	}
	if len(result.Files) > 0 {
		return result.Files[0].Id, nil
	}

	created, err := gc.destClient.Files.Create(&drive.File{
		Name:     name,
		MimeType: "application/vnd.google-apps.folder",
		Parents:  []string{parentID},
	}).Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("create subfolder: %w", err)
	}
	return created.Id, nil
}

// findExistingFile looks for a file with the given name in the destination folder.
// Returns the file if found (nil if not found).
func (gc *GoogleDriveCloner) findExistingFile(ctx context.Context, fileName string, parentID string) (*drive.File, error) {
	query := fmt.Sprintf("name='%s' and parents='%s' and trashed=false and mimeType='application/vnd.google-apps.shortcut'",
		escapeDriveQuery(fileName), parentID)
	result, err := gc.destClient.Files.List().Context(ctx).
		Q(query).
		Spaces("drive").
		Fields("files(id, name, shortcutDetails)").
		PageSize(1).
		Do()
	if err != nil {
		return nil, err
	}
	if len(result.Files) > 0 {
		return result.Files[0], nil
	}
	return nil, nil
}

// appendSuffix finds an available suffixed filename for a name collision.
// It walks "file-1.txt", "file-2.txt", … until it either:
//   - finds a slot that doesn't exist yet             → returns (name, false)
//   - finds a slot already pointing to targetID       → returns (name, true)
//   - finds a slot whose target has the same checksum → returns (name, true)
//
// Returns (name, true) when the file is already stored under a suffix name
// (by ID or content); the caller should skip creating a duplicate.
func (gc *GoogleDriveCloner) appendSuffix(ctx context.Context, fileName, targetID, targetChecksum, parentID string) (name string, alreadyExists bool) {
	ext := ""
	baseName := fileName
	if lastDot := strings.LastIndex(fileName, "."); lastDot > 0 {
		baseName = fileName[:lastDot]
		ext = fileName[lastDot:]
	}

	for n := 1; n <= 1000; n++ {
		candidateName := fmt.Sprintf("%s-%d%s", baseName, n, ext)
		existing, err := gc.findExistingFile(ctx, candidateName, parentID)
		if err != nil || existing == nil {
			return candidateName, false
		}
		if existing.ShortcutDetails == nil {
			continue
		}
		if existing.ShortcutDetails.TargetId == targetID {
			return candidateName, true
		}
		// Also match by checksum: same content stored under a different Drive ID
		if targetChecksum != "" {
			slotFile, err := gc.sourceClient.Files.Get(existing.ShortcutDetails.TargetId).
				Context(ctx).Fields("md5Checksum").Do()
			if err == nil && slotFile.Md5Checksum == targetChecksum {
				return candidateName, true
			}
		}
	}

	// Fallback (shouldn't reach here in practice)
	return fmt.Sprintf("%s-%d%s", baseName, 999, ext), false
}

// extractFolderID extracts the folder ID from a Google Drive folder URL.
func extractFolderID(url string) (string, error) {
	// Match patterns like:
	// https://drive.google.com/drive/folders/FOLDER_ID
	// https://drive.google.com/drive/u/0/folders/FOLDER_ID
	re := regexp.MustCompile(`/folders/([a-zA-Z0-9_-]+)`)
	matches := re.FindStringSubmatch(url)
	if len(matches) < 2 {
		return "", ErrExtractingFolderID
	}
	return matches[1], nil
}

// escapeDriveQuery escapes special characters in Google Drive query strings.
func escapeDriveQuery(s string) string {
	replacer := strings.NewReplacer(
		`\`, `\\`,
		`'`, `\'`,
		`"`, `\"`,
	)
	return replacer.Replace(s)
}

// sourceFolderInfo groups targets by their source folder.
type sourceFolderInfo struct {
	originalID string
	targets    []Target
}
