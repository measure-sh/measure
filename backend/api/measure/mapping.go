package measure

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"backend/api/chrono"
	"backend/api/cipher"
	"backend/api/codec"
	"backend/api/platform"
	"backend/api/server"
	"backend/api/symbol"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
)

// MappingFile represents a bundle file
// used in symbolication of stacktraces
// that is uploaded to a S3-like remote
// object store.
type MappingFile struct {
	ID             uuid.UUID
	Header         *multipart.FileHeader
	Checksum       string
	Key            string
	Location       string
	Difs           []*symbol.Dif
	ShouldUpload   bool
	UploadComplete bool
}

// BuildMapping represents the set of parameters
// for handling or storing mapping files.
type BuildMapping struct {
	AppID        uuid.UUID
	VersionName  string                  `form:"version_name" binding:"required"`
	VersionCode  string                  `form:"version_code" binding:"required"`
	Platform     string                  `form:"platform"`
	MappingTypes []string                `form:"mapping_type" binding:"required_with=File"`
	Files        []*multipart.FileHeader `form:"mapping_file" binding:"required_with=MappingType"`
	MappingFiles []*MappingFile
	Timestamp    time.Time
}

// hasMapping checks if necessary details are
// valid for mapping build info.
func (bm BuildMapping) hasMapping() bool {
	if bm.MappingType != "" && len(bm.MappingFiles) > 0 {
		return true
	}
	return false
}

func (bm BuildMapping) hasProguard() bool {
	for _, mappingType := range bm.MappingTypes {
		if mappingType == symbol.TypeProguard.String() {
			return true
		}
	}
	return false
}

// validate validates build mapping details.
func (bm *BuildMapping) validate(app *App) (code int, err error) {
	code = http.StatusBadRequest

	for i, mf := range bm.MappingFiles {
		// none of the mapping files
		// should be non-existent
		if mf.Header == nil {
			code = 0
			return
		}

		if mf.Header.Size < 1 {
			err = fmt.Errorf("%q at %d index has zero or invalid size", "mapping_file", i)
		}
	}

	pltfrm := app.Platform

	// deduce platform from app or
	// from payload. ensure we have
	// a platform or fail fast.
	if pltfrm == "" && bm.Platform != "" {
		pltfrm = bm.Platform
	}

	if pltfrm == "" {
		// Since, older Android SDKs (<=android-gradle-plugn@0.7.0) were
		// not sending `platform` parameter, we set the platform to Android
		// when the payload lacks the `platform` parameter and the mapping
		// type is `proguard`.
		//
		// This is critical for maintaining backwards
		// compatibility.
		if bm.hasProguard() {
			pltfrm = platform.Android
		} else {
			err = errors.New("failed to determine app's platform")
			return
		}
	}

	// ensure mapping types are supported for the platform
	platformMappingErr := fmt.Errorf("%q mapping type is not valid for %q platform", bm.MappingTypes, pltfrm)
	for _, mappingType := range bm.MappingTypes {
		switch mappingType {
		case symbol.TypeProguard.String():
			if pltfrm != platform.Android {
				err = platformMappingErr
				return
			}
		case symbol.TypeDsym.String():
			if pltfrm != platform.IOS {
				err = platformMappingErr
				break
			}
			for _, mf := range bm.MappingFiles {
				f, err := mf.Header.Open()
				if err != nil {
					return http.StatusInternalServerError, err
				}
				defer f.Close()
				if err := codec.IsTarGz(f); err != nil {
					return http.StatusBadRequest, err
				}
			}
		default:
			err = fmt.Errorf("unknown mapping type %q", mappingType)
			return
		}
	}
	if pltfrm == platform.IOS {
		// Since older iOS upload scripts(<=0.1.0) send a single mapping
		// type `dsym` with one or more mapping files, we set the mapping type
		// to `dsym` for all mapping files.
		//
		// This is critical for maintaining backwards
		// compatibility.
		diffLength := len(bm.MappingTypes) - len(bm.MappingFiles)
		if diffLength > 0 {
			for i := 0; i < diffLength; i++ {
				bm.MappingTypes = append(bm.MappingTypes, symbol.TypeDsym.String())
			}
		}
	}

	// mapping types and mapping files must same length
	if len(bm.MappingTypes) != len(bm.MappingFiles) {
		err = fmt.Errorf("mismatch: %d mapping types found for %d files", len(bm.MappingTypes), len(bm.MappingFiles))
		return
	}

	return
}

// prepareMappings computes the checksum and
// prepares each mapping file.
func (bm *BuildMapping) prepareMappings() (err error) {
	for _, header := range bm.Files {
		f, errFile := header.Open()
		if errFile != nil {
			err = errFile
			return
		}

		hash, errChecksum := cipher.ChecksumFnv1(f)
		if errChecksum != nil {
			err = errChecksum
			return
		}

		// seek the file offset to the beginning as
		// the checksum calculation must have moved
		// the offset towards end of the file
		if _, err := f.Seek(0, io.SeekStart); err != nil {
			return err
		}

		bm.MappingFiles = append(bm.MappingFiles, &MappingFile{
			Header:   header,
			Checksum: hash,
		})
	}

	return
}

// mark reads existing mapping files from
// database and marks each mapping file
// for upload while assigning ids smartly.
func (bm *BuildMapping) mark(ctx context.Context, tx *pgx.Tx) (err error) {
	type entry struct {
		id   uuid.UUID
		hash string
	}

	entries := []entry{}

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("fnv1_hash").
		From("build_mappings").
		Where("app_id = ?", bm.AppID).
		Where("version_name = ?", bm.VersionName).
		Where("version_code = ?", bm.VersionCode)

	defer stmt.Close()

	rows, _ := (*tx).Query(ctx, stmt.String(), stmt.Args()...)

	for rows.Next() {
		var entry entry
		if err = rows.Scan(&entry.id, &entry.hash); err != nil {
			return
		}

		entries = append(entries, entry)
	}

	if err = rows.Err(); err != nil {
		return
	}

	// if no match found, mark all for
	// upload.
	if len(entries) == 0 {
		for i := range bm.MappingFiles {
			bm.MappingFiles[i].ShouldUpload = true
		}
		return
	}

	// there can be many actions that needs
	// to be taken while handling mapping files.
	//
	// 1. an older mapping file replaced with a
	//    a new one.
	// 2. new mapping files are added to an older
	//    build mapping containing less mapping
	//    files.
	// 3. new mapping files are added to an older
	//    build mapping containing more mapping
	//    files.
	mlen := len(bm.MappingFiles)
	elen := len(entries)
	for i, entry := range entries {
		if elen <= mlen {
			// more newer, than older
			bm.MappingFiles[i].ID = entry.id
			if entry.hash != bm.MappingFiles[i].Checksum {
				bm.MappingFiles[i].ShouldUpload = true
			}
			if i == elen-1 {
				for j := i + 1; j < mlen; j++ {
					if entry.hash != bm.MappingFiles[i].Checksum {
						bm.MappingFiles[j].ShouldUpload = true
					}
				}
			}
		} else if elen > mlen {
			// more older, than newer
			if i == mlen-1 {
				for j := i; j < mlen; j++ {
					bm.MappingFiles[i].ID = entry.id
					if entry.hash != bm.MappingFiles[i].Checksum {
						bm.MappingFiles[i].ShouldUpload = true
					}
				}
				break
			}
			bm.MappingFiles[i].ID = entry.id
			if entry.hash != bm.MappingFiles[i].Checksum {
				bm.MappingFiles[i].ShouldUpload = true
			}
		}
	}

	return
}

// shouldUpload returns true if any of the mapping
// files has changed and hence should be uploaded.
func (bm BuildMapping) shouldUpload() (should bool) {
	for _, mf := range bm.MappingFiles {
		if mf.ShouldUpload {
			return true
		}
	}
	return
}

// shouldUpsert returns true if any of the mapping
// files was updated on object store and hence needs
// to be updated in the database.
func (bm BuildMapping) shouldUpsert() (should bool) {
	for _, mf := range bm.MappingFiles {
		if mf.ID != uuid.Nil && mf.Key != "" && mf.Location != "" {
			return true
		}
	}
	return
}

// insert inserts a new build mapping entry
// to database.
func (bm BuildMapping) insert(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.InsertInto(`build_mappings`)
	defer stmt.Close()

	for index, mf := range bm.MappingFiles {
		// ignore old mapping files
		if mf.ID != uuid.Nil {
			continue
		}

		mf.ID = uuid.New()

		stmt.
			NewRow().
			Set(`id`, mf.ID).
			Set(`app_id`, bm.AppID).
			Set(`version_name`, bm.VersionName).
			Set(`version_code`, bm.VersionCode).
			Set(`mapping_type`, bm.MappingTypes[index]).
			Set(`key`, mf.Key).
			Set(`location`, mf.Location).
			Set(`fnv1_hash`, mf.Checksum).
			Set(`file_size`, mf.Header.Size).
			Set(`last_updated`, time.Now())
	}

	// stop here and don't run
	// query because it may happen
	// that there is nothing to insert
	if len(stmt.Args()) < 1 {
		return
	}

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// upsert updates build mapping
// entries in database.
func (bm BuildMapping) upsert(ctx context.Context, tx *pgx.Tx) (err error) {
	now := time.Now()

	for _, mf := range bm.MappingFiles {
		if mf.ID == uuid.Nil {
			continue
		}
		stmt := sqlf.PostgreSQL.Update(`build_mappings`)

		if mf.Key != "" {
			stmt.Set(`key`, mf.Key)
		}

		if mf.Location != "" {
			stmt.Set(`location`, mf.Location)
		}

		stmt.
			Set(`fnv1_hash`, mf.Checksum).
			Set(`file_size`, mf.Header.Size).
			Set(`last_updated`, now).
			Where(`id = ?`, mf.ID)

		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		if err != nil {
			return
		}

		stmt.Close()
	}

	return
}

// extractDif extracts the debug information
// file(s) from build mapping respecting the
// mapping type.
func (bm *BuildMapping) extractDif() (err error) {
	switch bm.MappingType {
	case symbol.TypeProguard.String():
		mf := bm.MappingFiles[0]
		f, errHeader := mf.Header.Open()
		if errHeader != nil {
			return errHeader
		}

		defer func() {
			if err := f.Close(); err != nil {
				fmt.Println("failed to close proguard mapping file")
			}
		}()

		bytes, errRead := io.ReadAll(f)
		if errRead != nil {
			return errRead
		}

		// compress bytes using zstd, if not
		// already compressed
		if !codec.IsZstdCompressed(bytes) {
			bytes, err = codec.CompressZstd(bytes)
			if err != nil {
				return
			}
		}

		ns := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("guardsquare.com"))
		debugId := uuid.NewSHA1(ns, bytes)

		mf.Difs = append(mf.Difs, &symbol.Dif{
			Data: bytes,
			Key:  symbol.BuildUnifiedLayout(debugId.String()) + "/proguard",
		})
	case symbol.TypeDsym.String():
		for i := range bm.MappingFiles {
			f, errHeader := bm.MappingFiles[i].Header.Open()
			if errHeader != nil {
				return errHeader
			}

			defer func() {
				if err := f.Close(); err != nil {
					fmt.Printf("failed to close dSYM mapping file with index %d\n", i)
				}
			}()

			entities, errExtract := symbol.ExtractDsymEntities(f, func(name string) (symbol.DsymType, bool) {
				parts := strings.Split(name, "/")
				last := ""
				if len(parts) > 0 {
					last = parts[len(parts)-1]
				}
				symbolCondition := strings.Count(name, "Contents/Resources/") == 1 && !strings.HasSuffix(name, ".dSYM") && len(parts) == 5 && !strings.HasPrefix(last, "._")

				if symbolCondition {
					return symbol.TypeDsymDebug, true
				}

				return symbol.TypeDsymUnknown, false
			})

			if errExtract != nil {
				return errExtract
			}

			for _, entity := range entities {
				for _, difs := range entity {
					bm.MappingFiles[i].Difs = append(bm.MappingFiles[i].Difs, difs)
				}
			}
		}
	default:
		err = fmt.Errorf("failed to recognize mapping type %q", bm.MappingType)
	}

	return
}

// upload prepares and uploads build mapping
// files to S3-like object storage.
func (bm *BuildMapping) upload(ctx context.Context) (err error) {
	config := server.Server.Config
	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     config.SymbolsAccessKey,
			SecretAccessKey: config.SymbolsSecretAccessKey,
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      config.SymbolsBucketRegion,
		Credentials: credentialsProvider,
	}

	client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := config.AWSEndpoint
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

	metadata := map[string]string{
		"app_id":       bm.AppID.String(),
		"version_name": bm.VersionName,
		"version_code": bm.VersionCode,
		"mapping_type": bm.MappingType,
	}

	switch bm.MappingType {
	case symbol.TypeProguard.String():
		for i, mf := range bm.MappingFiles {
			if !mf.ShouldUpload {
				continue
			}
			metadata["original_file_name"] = mf.Header.Filename
			for _, dif := range mf.Difs {
				putObjectInput := &s3.PutObjectInput{
					Bucket:   aws.String(config.SymbolsBucket),
					Key:      aws.String(dif.Key),
					Body:     bytes.NewReader(dif.Data),
					Metadata: metadata,
				}
				_, err = client.PutObject(ctx, putObjectInput)
				if err != nil {
					return
				}

				bm.MappingFiles[i].Key = dif.Key
				bm.MappingFiles[i].Location = buildLocation(dif.Key)
				bm.MappingFiles[i].UploadComplete = true
			}
		}
	case symbol.TypeDsym.String():
		for i, mf := range bm.MappingFiles {
			if !mf.ShouldUpload {
				continue
			}
			metadata["original_file_name"] = mf.Header.Filename
			for _, dif := range mf.Difs {
				if !dif.Meta {
					putObjectInput := &s3.PutObjectInput{
						Bucket:   aws.String(config.SymbolsBucket),
						Key:      aws.String(dif.Key),
						Body:     bytes.NewReader(dif.Data),
						Metadata: metadata,
					}
					_, err = client.PutObject(ctx, putObjectInput)
					if err != nil {
						return
					}
					bm.MappingFiles[i].Key = dif.Key
					bm.MappingFiles[i].Location = buildLocation(dif.Key)
					bm.MappingFiles[i].UploadComplete = true
				}

				if dif.Meta {
					putObjectInput := &s3.PutObjectInput{
						Bucket:   aws.String(config.SymbolsBucket),
						Key:      aws.String(dif.Key),
						Body:     bytes.NewReader(dif.Data),
						Metadata: metadata,
					}
					_, err = client.PutObject(ctx, putObjectInput)
					if err != nil {
						return
					}
				}
			}
		}
	}

	return
}

// BuildSize represents an app build's
// size entry. This is the raw material
// for computing app size trends over time.
type BuildSize struct {
	ID          uuid.UUID
	AppID       uuid.UUID
	VersionName string `form:"version_name" binding:"required"`
	VersionCode string `form:"version_code" binding:"required"`
	BuildSize   int    `form:"build_size" binding:"required_with=BuildType,gt=100"`
	BuildType   string `form:"build_type" binding:"required_with=BuildSize,oneof=aab apk ipa"`
	CreatedAt   chrono.ISOTime
}

// upsert updates build size info to
// database.
func (bs BuildSize) upsert(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto(`public.build_sizes`).
		Set(`app_id`, bs.AppID).
		Set(`version_name`, bs.VersionName).
		Set(`version_code`, bs.VersionCode).
		Set(`build_size`, bs.BuildSize).
		Set(`build_type`, bs.BuildType).
		Clause(`on conflict (app_id, version_name, version_code, build_type) do update set build_size = excluded.build_size, updated_at = excluded.updated_at`)

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// buildLocation constructs the location of the
// mapping file object stored or to be stored
// on the remote S3-like object store.
func buildLocation(key string) (location string) {
	config := server.Server.Config
	// for now, we construct the location manually
	// implement a better solution later using
	// EndpointResolverV2 with custom resolvers
	// for non-AWS clouds like GCS
	if config.AWSEndpoint != "" {
		location = fmt.Sprintf("%s/%s/%s", config.AWSEndpoint, config.SymbolsBucket, key)
	} else {
		location = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", config.SymbolsBucket, config.SymbolsBucketRegion, key)
	}
	return
}

func PutBuild(c *gin.Context) {
	ctx := c.Request.Context()
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `failed to parse app id`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	app, err := SelectApp(ctx, appId)
	if err != nil {
		msg := "failed to read app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	bs := BuildSize{
		AppID: appId,
	}

	if err := c.ShouldBindWith(&bs, binding.FormMultipart); err != nil {
		msg := `build info validation failed. make sure both "build_size" and "build_type" have valid values`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	bm := BuildMapping{
		AppID: appId,
	}

	if err := c.ShouldBindWith(&bm, binding.FormMultipart); err != nil {
		msg := `build info validation failed. make sure both "mapping_file" and "mapping_type" have valid values`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if err := bm.prepareMappings(); err != nil {
		msg := "failed to compute checksums of files"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if code, err := bm.validate(app); err != nil {
		msg := "failed to validate build mapping"
		fmt.Println(msg, err)
		c.JSON(code, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if bm.hasMapping() {
		if err := bm.extractDif(); err != nil {
			msg := "failed to extract debug id from mapping file"
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	tx, err := server.Server.PgPool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		msg := `failed to acquire db transaction while putting builds`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	defer tx.Rollback(ctx)

	// no mapping? just process build size
	// and return early
	if !bm.hasMapping() {
		if err := bs.upsert(ctx, &tx); err != nil {
			msg := `failed to register app build size`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}
		if err := tx.Commit(ctx); err != nil {
			msg := `failed to upload build size`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": `updated build size info`,
		})

		return
	}

	if err := bm.mark(ctx, &tx); err != nil {
		fmt.Println("failed to detect mapping file upsertion:", err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to upload mapping file(s)",
			"details": err.Error(),
		})
		return
	}

	// nothing to upload? just process build size
	// and return early
	if !bm.shouldUpload() {
		if err := bs.upsert(ctx, &tx); err != nil {
			msg := `failed to register app build size`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
		if err := tx.Commit(ctx); err != nil {
			msg := `failed to upload build info`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": `uploaded build size info`,
		})

		return
	}

	if bm.shouldUpload() {
		// start span to trace mapping file upload
		mappingFileUploadTracer := otel.Tracer("mapping-file-upload-tracer")
		_, mappingFileUploadSpan := mappingFileUploadTracer.Start(ctx, "mapping-file-upload")
		if err := bm.upload(ctx); err != nil {
			fmt.Println("failed to upload mapping file(s): ", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf(`failed to upload mapping file: "%s"`, bm.Files[0].Filename),
			})
			mappingFileUploadSpan.End()
			return
		}
		mappingFileUploadSpan.End()
	}

	if bm.shouldUpsert() {
		if err := bm.upsert(ctx, &tx); err != nil {
			msg := "failed to upsert mapping file(s)"
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if err := tx.Commit(ctx); err != nil {
			msg := "failed to commit builds upsert transaction"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
		}

		msg := "existing build mapping info is already up to date"
		if bm.shouldUpload() {
			msg = "uploaded build info"
		}

		c.JSON(http.StatusOK, gin.H{
			"ok": msg,
		})
		return
	}

	if err := bm.insert(ctx, &tx); err != nil {
		msg := "failed to insert mapping file(s)"
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := bs.upsert(ctx, &tx); err != nil {
		msg := `failed to register app build size`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		msg := `failed to upload build info`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": `uploaded build info`,
	})
}
