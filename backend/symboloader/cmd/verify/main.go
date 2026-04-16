package main

import (
	"context"
	"flag"
	"fmt"
	"log"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

func main() {
	folderName := flag.String("folder", "symboloader-dev", "Destination folder name to verify")
	flag.Parse()

	// Create Drive service using Application Default Credentials (ADC)
	// This respects GOOGLE_APPLICATION_CREDENTIALS env var (modern, safe approach)
	ctx := context.Background()
	creds, err := google.FindDefaultCredentials(ctx, drive.DriveScope)
	if err != nil {
		log.Fatalf("failed to find default credentials (ensure GOOGLE_APPLICATION_CREDENTIALS is set): %v", err)
	}

	service, err := drive.NewService(ctx, option.WithCredentials(creds))
	if err != nil {
		log.Fatalf("failed to create drive service: %v", err)
	}

	// Find the destination folder
	query := fmt.Sprintf("name='%s' and mimeType='application/vnd.google-apps.folder' and trashed=false", *folderName)
	result, err := service.Files.List().
		Q(query).
		Spaces("drive").
		Fields("files(id, name, createdTime)").
		Do()
	if err != nil {
		log.Fatalf("failed to list files: %v", err)
	}

	if len(result.Files) == 0 {
		fmt.Printf("❌ Destination folder '%s' not found\n", *folderName)
		return
	}

	destFolder := result.Files[0]
	fmt.Printf("✅ Found destination folder: %s (ID: %s)\n", destFolder.Name, destFolder.Id)
	fmt.Printf("   Created: %s\n\n", destFolder.CreatedTime)

	// List contents of the destination folder
	fmt.Printf("Contents of '%s':\n", *folderName)
	contents, err := service.Files.List().
		Q(fmt.Sprintf("parents='%s' and trashed=false", destFolder.Id)).
		Spaces("drive").
		Fields("files(id, name, mimeType, size, createdTime)").
		Do()
	if err != nil {
		log.Fatalf("failed to list folder contents: %v", err)
	}

	if len(contents.Files) == 0 {
		fmt.Println("  (empty)")
		return
	}

	for i, file := range contents.Files {
		fileType := "📄"
		if file.MimeType == "application/vnd.google-apps.folder" {
			fileType = "📁"
		}
		size := ""
		if file.Size > 0 {
			size = fmt.Sprintf(" (%d bytes)", file.Size)
		}
		fmt.Printf("  %d. %s %s%s\n", i+1, fileType, file.Name, size)
		fmt.Printf("     ID: %s\n", file.Id)
		fmt.Printf("     Created: %s\n", file.CreatedTime)
	}
}
