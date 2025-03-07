package seed

import (
	"backend/api/chrono"
	"backend/api/symbol"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"github.com/bodgit/sevenzip"
	"github.com/dustin/go-humanize"
	"github.com/shirou/gopsutil/disk"
	drive "google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

var driveFolderRe = regexp.MustCompile(`(?:folders/|folderview\?id=)([a-zA-Z0-9_-]+)`)
var ErrParseArchive = errors.New("failed to extract details of archive file")
var ErrDiskFull = errors.New("not enough free disk space available")

type archive7z struct {
	name      string
	version   string
	build     string
	arch      string
	size      int64
	file      *drive.File
	entries   []string
	difs      [][]*symbol.Dif
	difsCount int
}

type AppleFramework struct {
	drive           *drive.Service
	storage         *storage.Client
	settings        Settings
	bucket          string
	sources         map[string][]string
	urls            []string
	archives        []*archive7z
	totalTargetSize int64
	processedSize   int64
	uploadCount     int
	start           time.Time
	took            time.Duration
	completion      float64
}

type Settings struct {
	Versions []string
}

func (a AppleFramework) getLatestURLs() (latest []string) {
	curr := 0
	latestKey := ""

	for k := range a.sources {
		version, ok := strings.CutPrefix(k, "ios-")
		if ok {
			n, err := strconv.Atoi(version)
			if err != nil {
				panic(err)
			}

			if n > curr {
				curr = n
				latestKey = k
			}
		}
	}

	latest, ok := a.sources[latestKey]
	if !ok {
		return
	}

	return
}

func (a AppleFramework) getBetaURLs() (beta []string) {
	beta, ok := a.sources["beta"]
	if !ok {
		return
	}
	return
}

func (a AppleFramework) getAllURLs() (urls []string) {
	for _, v := range a.sources {
		urls = append(urls, v...)
	}

	return
}

func (a AppleFramework) GetURLs() (urls []string) {
	for _, version := range a.settings.Versions {
		if version == "latest" {
			urls = append(urls, a.getLatestURLs()...)
		}

		if version == "beta" {
			urls = append(urls, a.getBetaURLs()...)
		}

		for k, v := range a.sources {
			id := version
			// extract version before the first dot
			// character
			if index := strings.Index(id, "."); index != -1 {
				id = id[:index]
			}
			key := "ios-" + id

			if k == key {
				urls = append(urls, v...)
			}
		}
	}

	// remove duplicates
	seen := make(map[string]struct{})
	var result []string

	for _, str := range urls {
		if _, exists := seen[str]; !exists {
			seen[str] = struct{}{}
			result = append(result, str)
		}
	}

	urls = result

	return
}

func (a AppleFramework) totalFileCount() (count int) {
	for _, archive := range a.archives {
		count += len(archive.entries)
	}
	return
}

func (a AppleFramework) getDifs() (difs [][]*symbol.Dif) {
	for _, archive := range a.archives {
		difs = append(difs, archive.difs...)
	}

	return
}

func (a AppleFramework) getDifsCount() (count int) {
	for _, archive := range a.archives {
		count += archive.difsCount
	}

	return
}

// PrintIntro logs current configuration and what
// information is going to be processed.
func (a AppleFramework) PrintIntro() {
	fmt.Println("Version settings:", a.settings.Versions)
	fmt.Printf("\n")

	fmt.Println("Fetching and processing the following")
	for i, a := range a.archives {
		fmt.Printf("%d. Version: %s\tFilename: %s\tArchitecture: %s\tBuild %s\n", i+1, a.version, a.name, a.arch, a.build)
	}

	fmt.Printf("\n")
}

// PrintOutro logs result metadata after completion
// of all operations.
func (a AppleFramework) PrintOutro() {
	fmt.Printf("---\n\n")
	fmt.Println("count of archives:", len(a.archives))
	fmt.Println("count of uncompressed files:", a.totalFileCount())
	fmt.Println("count of difs:", a.getDifsCount())
	fmt.Println("count of uploaded difs:", a.uploadCount)
	fmt.Println("size of compressed download:", humanize.Bytes(uint64(a.totalTargetSize)))
	fmt.Println("size of uncompressed download:", humanize.Bytes(uint64(a.processedSize)))
	fmt.Println("time taken:", a.took)
}

func (a *AppleFramework) tick(i int) {
	total := len(a.archives)
	if total == 0 {
		a.completion = 0.0
		return
	}
	curr := i + 1
	a.completion = (float64(curr) / float64(total)) * 100
}

func (a *AppleFramework) Finish() {
	a.took = time.Since(a.start)
}

func (a *AppleFramework) ReadLinks(links []string) (err error) {
	for _, link := range links {
		id, errExtract := extractFolderID(link)
		if errExtract != nil {
			return errExtract
		}
		query := fmt.Sprintf("'%s' in parents", id)

		var files []*drive.File
		pageToken := ""

		for {
			req := a.drive.Files.List().
				Q(query).
				Fields("nextPageToken, files(id, name, size, mimeType)")
			if pageToken != "" {
				req = req.PageToken(pageToken)
			}
			res, errReq := req.Do()
			if errReq != nil {
				return errReq
			}
			files = append(files, res.Files...)
			if res.NextPageToken == "" {
				break
			}
		}

		for _, file := range files {
			if file.MimeType != "application/x-7z-compressed" {
				fmt.Printf("saw a non 7z archive file %q, ignoring", file.Name)
				continue
			}
			a.totalTargetSize += file.Size
			archive, errArchive := createArchive(file)
			if errArchive != nil {
				return errArchive
			}

			// select those archives that match
			// versions from settings
			for _, version := range a.settings.Versions {
				if !strings.Contains(version, ".") {
					a.addArchive(archive)
				} else if strings.HasPrefix(archive.version, version) {
					a.addArchive(archive)
				}
			}
		}
	}

	return
}

func (a *AppleFramework) addArchive(archive *archive7z) {
	found := false

	for _, entry := range a.archives {
		if entry.version == archive.version && entry.build == archive.build {
			found = true
			break
		}
	}

	if !found {
		a.archives = append(a.archives, archive)
	}
}

func (a *AppleFramework) DownloadAndProcess(ctx context.Context) (err error) {
	for i, archive := range a.archives {
		free, errFree := getFreeDiskSpace()
		if errFree != nil {
			return errFree
		}

		if free < uint64(archive.size) {
			err = ErrDiskFull
			return
		}

		if i != 0 && i%2 == 0 {
			fmt.Printf("Cooling off for some time...\n")
			chrono.JitterySleep(2 * time.Second)
		}

		fmt.Printf("Downloading %q...\n", archive.file.Name)

		resp, err := a.drive.Files.Get(archive.file.Id).Download()
		if err != nil {
			return fmt.Errorf("error downloading file: %q %v", archive.file.Name, err)
		}

		defer resp.Body.Close()

		temp := os.TempDir()
		path := filepath.Join(temp, archive.file.Name)

		content, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("error reading downloaded file: %q %v", archive.file.Name, err)
		}

		// write the downloaded file to disk
		// temporarily
		fmt.Printf("Writing downloaded file %q to disk\n", path)
		if err = os.WriteFile(path, content, 0666); err != nil {
			return fmt.Errorf("failed to write file to temporary path: %q %v", path, err)
		}

		rc, err := sevenzip.OpenReader(path)
		if err != nil {
			return err
		}

		defer rc.Close()

		fmt.Printf("Processing each binary file in %q archive\n", path)
		for _, f := range rc.File {
			info := f.FileInfo()

			// ignore directories
			if info.IsDir() {
				continue
			}
			// ignore dot files
			if strings.HasPrefix(filepath.Base(f.Name), ".") {
				continue
			}

			a.processedSize += int64(f.UncompressedSize)
			archive.entries = append(archive.entries, f.Name)
			difs, err := makeDif(f)
			if err != nil {
				return err
			}

			archive.difsCount += len(difs)
			if err := a.uploadToBucket(ctx, difs); err != nil {
				return fmt.Errorf("failed to upload %q: %v", f.Name, err)
			}

			a.uploadCount += 1
			// archive.difs = append(archive.difs, difs)
		}

		// delete file from disk, after we're
		// done
		fmt.Printf("Deleting %q file from disk\n", path)
		if err = os.Remove(path); err != nil {
			return err
		}

		defer func() {
			if err := os.Remove(path); err != nil {
				return
			}
		}()

		a.tick(i)

		fmt.Printf("%d out of %d archives processed. %.2f%%.", i+1, len(a.archives), a.completion)

		fmt.Printf("\n")
	}

	return
}

func (a *AppleFramework) uploadToBucket(ctx context.Context, difs []*symbol.Dif) (err error) {
	bucket := a.storage.Bucket(a.bucket)

	for _, dif := range difs {
		obj := bucket.Object(dif.Key)
		writer := obj.NewWriter(ctx)
		defer writer.Close()

		if _, err = writer.Write(dif.Data); err != nil {
			return
		}

		fmt.Printf("Uploaded %s\n", dif.Key)
	}

	return
}

func (a *AppleFramework) Init(ctx context.Context, key, bucket string, credentials []byte) (err error) {
	driveClient, err := createDriveClient(ctx, key)
	if err != nil {
		return
	}

	storage := createStorageClient(ctx, credentials)

	a.drive = driveClient
	a.storage = storage
	a.bucket = bucket
	a.start = time.Now()
	a.took = 0

	return
}

func NewAppleFramework(settings ...Settings) (fw *AppleFramework) {
	defaultSettings := Settings{
		Versions: []string{"latest"},
	}
	if len(settings) > 0 {
		defaultSettings = settings[0]
	}

	return &AppleFramework{
		sources: map[string][]string{
			"ios-12": []string{"https://drive.google.com/drive/folders/1oEpBXrpSN4DeijlzNmlI_yly27b-OLb2"},
			"ios-13": []string{"https://drive.google.com/drive/folders/1X_q_JiaFGVaappi8gaexQDzJCH9SwdSw"},
			"ios-14": []string{"https://drive.google.com/drive/folders/1EQPNNY9BPxuYmFdPovIx0eyIJcLodOtN"},
			"ios-15": []string{"https://drive.google.com/drive/folders/16w8gEDuwF3I4KYxadLAQQebSg5ZYEayC", "https://drive.google.com/drive/folders/1kH9Sj8k_HDnetRnCORKmjHQanYTosFep"},
			"ios-16": []string{"https://drive.google.com/drive/folders/13BvwiFUCeBK5IwjQOEhrdSYX_e3LnA5M", "https://drive.google.com/drive/folders/1Z2Qrhs114rNcO8MArrNY0-U4vqVv1Gjc"},
			"ios-17": []string{"https://drive.google.com/drive/folders/1wKCTyvhA5B39aJFxT8u92qpOaMA5-f19", "https://drive.google.com/drive/folders/1XX_oL9AJ-GgiCgacz61_4ntnHJmGcnMP"},
			"ios-18": []string{"https://drive.google.com/drive/folders/1jWUAHcpU9OjdA1aCSSis9qOGd4kjyAf7"},
			"beta":   []string{"https://drive.google.com/drive/folders/1YwKHYA_-KOOYXsz2L2nq8WnPuyvxqLid"},
		},
		settings: defaultSettings,
	}
}

func createDriveClient(ctx context.Context, key string) (service *drive.Service, err error) {
	service, err = drive.NewService(ctx, option.WithAPIKey(key))
	if err != nil {
		return
	}
	return
}

func createStorageClient(ctx context.Context, credentials []byte) (client *storage.Client) {
	client, err := storage.NewClient(ctx, option.WithCredentialsJSON(credentials))
	if err != nil {
		return
	}

	return
}

func extractFolderID(link string) (folderId string, err error) {
	matches := driveFolderRe.FindStringSubmatch(link)
	if len(matches) < 2 {
		err = fmt.Errorf("failed to extract drive folder id from link: %s", link)
		return
	}

	folderId = matches[1]

	return
}

func createArchive(file *drive.File) (archive *archive7z, err error) {
	archive = &archive7z{}
	parts := strings.Split(file.Name, " ")
	archive.name = file.Name
	archive.size = file.Size
	archive.version = parts[0]

	if len(parts) == 3 {
		archive.build = parts[1][1 : len(parts[1])-1]
		arch, ok := strings.CutSuffix(parts[2], ".7z")
		if !ok {
			err = ErrParseArchive
			return
		}

		archive.arch = arch
	} else if len(parts) == 2 {
		// older iOS symbol files are
		// of the format "12.0 (16A366).7z"
		//
		// "arch" for these files will be empty
		build, ok := strings.CutSuffix(parts[1], ".7z")
		if !ok {
			err = ErrParseArchive
			return
		}

		archive.build = build[1 : len(build)-1]
	}

	archive.file = file

	return
}

func getFreeDiskSpace() (free uint64, err error) {
	usage, err := disk.Usage("/")
	if err != nil {
		return
	}

	free = usage.Free
	return
}

func makeDif(file *sevenzip.File) (difs []*symbol.Dif, err error) {
	rc, err := file.Open()
	if err != nil {
		return
	}

	defer rc.Close()

	contents, err := io.ReadAll(rc)
	if err != nil {
		return
	}

	bytesReader := bytes.NewReader(contents)

	if err = symbol.VerifyMachO(bytesReader); err != nil {
		err = fmt.Errorf("failed to verify mach-o file %q: %v", file.Name, err)
		return
	}

	debugId, err := symbol.GetMachOUUID(bytesReader)
	if err != nil {
		return
	}

	if debugId == "" {
		err = fmt.Errorf("debugId is empty for %q", file.Name)
		return
	}

	type meta struct {
		Name       string `json:"name"`
		Arch       string `json:"arch"`
		FileFormat string `json:"file_format"`
	}

	m := meta{
		Name:       file.Name,
		Arch:       "arm64",
		FileFormat: "macho",
	}

	metaJson, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	unifiedPath := symbol.BuildUnifiedLayout(debugId)

	difs = []*symbol.Dif{
		{
			Data: contents,
			Meta: false,
			Key:  unifiedPath + "/debuginfo",
		},
		{
			Data: metaJson,
			Meta: true,
			Key:  unifiedPath + "/meta",
		},
	}

	return
}
