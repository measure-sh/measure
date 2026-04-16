package pipeline

import (
	"context"
	"errors"
	"fmt"
	"os"
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
	sourceClient       *drive.Service // for reading public source folders (API key)
	destClient         *drive.Service // for writing to destination (service account)
	destinationName    string
	destinationFolderID string          // optional: user-provided shared folder ID
	destinationID      string          // cached after creation/lookup
	destinationMutex   sync.Mutex
}

// NewGoogleDriveCloner creates a new Cloner with:
// - API key for reading public source folders (read-only)
// - Service account credentials for writing to destination folder
// - Optional: destinationFolderID for a user-shared folder (takes priority over destinationName)
func NewGoogleDriveCloner(destinationName, destinationFolderID string) (*GoogleDriveCloner, error) {
	// API key for reading public source folders
	apiKey, err := readAPIKey()
	if err != nil {
		return nil, fmt.Errorf("read api key: %w", err)
	}

	var sourceClient *drive.Service
	if apiKey != "" {
		sourceClient, err = drive.NewService(context.Background(), option.WithAPIKey(apiKey))
		if err != nil {
			return nil, fmt.Errorf("source drive service (api key): %w", err)
		}
	}

	// Service account credentials for writing to destination
	// Read securely from GOOGLE_APPLICATION_CREDENTIALS env var
	destClient, err := loadServiceAccountClient()
	if err != nil {
		return nil, fmt.Errorf("destination drive service: %w", err)
	}

	return &GoogleDriveCloner{
		sourceClient:       sourceClient,
		destClient:         destClient,
		destinationName:    destinationName,
		destinationFolderID: destinationFolderID,
	}, nil
}

// loadServiceAccountClient creates a Drive API client using service account credentials
// from GOOGLE_APPLICATION_CREDENTIALS environment variable (secure approach).
// Uses FindDefaultCredentials which automatically discovers credentials from the environment.
func loadServiceAccountClient() (*drive.Service, error) {
	ctx := context.Background()

	// Use Application Default Credentials (ADC)
	// This respects GOOGLE_APPLICATION_CREDENTIALS env var and validates credentials safely
	creds, err := google.FindDefaultCredentials(ctx, drive.DriveScope)
	if err != nil {
		return nil, fmt.Errorf("failed to find default credentials (ensure GOOGLE_APPLICATION_CREDENTIALS is set): %w", err)
	}

	// Create Drive service with the found credentials
	service, err := drive.NewService(ctx, option.WithCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("create drive service: %w", err)
	}

	return service, nil
}

// readAPIKey reads the Drive API key from environment variable or file.
// Priority: GOOGLE_DRIVE_API_KEY (env var) > DRIVE_API_KEY_FILE (file path)
func readAPIKey() (string, error) {
	// First, try environment variable (highest priority)
	if apiKey := strings.TrimSpace(os.Getenv("GOOGLE_DRIVE_API_KEY")); apiKey != "" {
		return apiKey, nil
	}

	// Fall back to reading from file (for Docker secrets)
	if keyFile := os.Getenv("DRIVE_API_KEY_FILE"); keyFile != "" {
		data, err := os.ReadFile(keyFile)
		if err != nil {
			return "", fmt.Errorf("read DRIVE_API_KEY_FILE: %w", err)
		}
		return strings.TrimSpace(string(data)), nil
	}

	// Neither set
	return "", nil
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
	for _, srcInfo := range sourceByID {
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

	// If folder already exists, reuse it (idempotent)
	if len(existing.Files) > 0 {
		return existing.Files[0].Id, nil
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
			Fields("files(id, name, mimeType, size), nextPageToken").
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
				// Create subfolder and recurse
				subMeta := &drive.File{
					Name:     file.Name,
					MimeType: "application/vnd.google-apps.folder",
					Parents:  []string{destFolderID},
				}
				subFolder, err := gc.destClient.Files.Create(subMeta).Context(ctx).Do()
				if err != nil {
					return fmt.Errorf("create subfolder %s: %w", file.Name, err)
				}
				if err := gc.copyFolderContents(ctx, file.Id, subFolder.Id); err != nil {
					return fmt.Errorf("copy subfolder contents: %w", err)
				}
			} else {
				// Determine the final name for the destination file
				destFileName := file.Name

				// Check if a file with the same name already exists
				existingFile, err := gc.findExistingFile(ctx, file.Name, destFolderID)
				if err != nil {
					return fmt.Errorf("check for existing file %s: %w", file.Name, err)
				}

				// If shortcut exists, check if it points to the same source file (idempotency)
				if existingFile != nil && existingFile.ShortcutDetails != nil {
					if existingFile.ShortcutDetails.TargetId == file.Id {
						// Shortcut already points to this exact source file, skip
						continue
					}
					// Different source file with same name, append suffix
					destFileName = gc.appendSuffix(file.Name, destFolderID, ctx)
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

// appendSuffix generates a new filename with a numeric suffix before the extension.
// Example: "file.txt" → "file-1.txt", "file-2.txt", etc.
func (gc *GoogleDriveCloner) appendSuffix(fileName string, parentID string, ctx context.Context) string {
	// Split filename and extension
	ext := ""
	baseName := fileName
	if lastDot := strings.LastIndex(fileName, "."); lastDot > 0 {
		baseName = fileName[:lastDot]
		ext = fileName[lastDot:]
	}

	// Find the next available suffix number
	for n := 1; n <= 1000; n++ {
		candidateName := fmt.Sprintf("%s-%d%s", baseName, n, ext)
		query := fmt.Sprintf("name='%s' and parents='%s' and trashed=false",
			escapeDriveQuery(candidateName), parentID)
		result, err := gc.destClient.Files.List().Context(ctx).
			Q(query).
			Spaces("drive").
			Fields("files(id)").
			PageSize(1).
			Do()
		if err != nil || len(result.Files) == 0 {
			// File doesn't exist, use this name
			return candidateName
		}
	}

	// Fallback (shouldn't reach here in practice)
	return fmt.Sprintf("%s-%d%s", baseName, 999, ext)
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
