package measure

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"backend/api/objstore"
	"backend/api/server"

	credentials "cloud.google.com/go/iam/credentials/apiv1"
	"cloud.google.com/go/iam/credentials/apiv1/credentialspb"
	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type Mapping struct {
	ID        uuid.UUID         `json:"id"`
	Type      string            `json:"type" binding:"required,oneof=proguard dsym elf_debug"`
	Key       string            `json:"key,omitempty"`
	Location  string            `json:"location,omitempty"`
	Checksum  string            `json:"checksum,omitempty"`
	Size      int64             `json:"size,omitempty"`
	Filename  string            `json:"filename" binding:"required"`
	UploadURL string            `json:"upload_url,omitempty"`
	ExpiresAt time.Time         `json:"expires_at"`
	Headers   map[string]string `json:"headers"`
}

type Build struct {
	AppID       uuid.UUID
	VersionName string     `json:"version_name" binding:"required"`
	VersionCode string     `json:"version_code" binding:"required"`
	Type        string     `json:"build_type" binding:"required,oneof=aab apk ipa"`
	Size        int        `json:"build_size" binding:"required,gt=0"`
	Mappings    []*Mapping `json:"mappings" binding:"dive,required"`
	AppUniqueID string     `json:"app_unique_id"`
}

type BuildResponse struct {
	Mappings []*Mapping `json:"mappings"`
}

func (b Build) hasMapping() bool {
	return len(b.Mappings) > 0
}

func (b Build) upsertSize(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto(`build_sizes`).
		Set(`app_id`, b.AppID).
		Set(`version_name`, b.VersionName).
		Set(`version_code`, b.VersionCode).
		Set(`build_size`, b.Size).
		Set(`build_type`, b.Type).
		Clause(`on conflict (app_id, version_name, version_code, build_type) do update set build_size = excluded.build_size, updated_at = excluded.updated_at`)

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

func (b Build) getMappingTypes() (types []string) {
	typeMap := make(map[string]struct{})
	for _, m := range b.Mappings {
		typeMap[m.Type] = struct{}{}
	}
	for t := range typeMap {
		types = append(types, t)
	}
	return
}

func (b Build) insertNewMappings(ctx context.Context, tx *pgx.Tx) (err error) {
	if len(b.Mappings) == 0 {
		return
	}

	stmt := sqlf.PostgreSQL.
		InsertInto(`build_mappings`)

	defer stmt.Close()

	now := time.Now()

	for _, m := range b.Mappings {
		stmt.
			NewRow().
			Set(`id`, m.ID).
			Set(`app_id`, b.AppID).
			Set(`version_name`, b.VersionName).
			Set(`version_code`, b.VersionCode).
			Set(`mapping_type`, m.Type).
			Set(`key`, m.Key).
			Set(`location`, m.Location).
			Set(`fnv1_hash`, m.Checksum).
			Set(`last_updated`, now)
	}

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

func (b *Build) upsert(ctx context.Context, tx *pgx.Tx) (err error) {
	if err = b.upsertSize(ctx, tx); err != nil {
		return
	}

	// return early if there are no
	// mapping files
	if !b.hasMapping() {
		return
	}

	existingMappings, err := b.getMappings(ctx)
	if err != nil {
		return
	}

	for _, em := range existingMappings {
		for _, rm := range b.Mappings {
			if em.Type == rm.Type && rm.ID == uuid.Nil {
				rm.ID = em.ID
				break
			}
		}
	}

	newBuild := Build{
		AppID:       b.AppID,
		VersionName: b.VersionName,
		VersionCode: b.VersionCode,
		Mappings:    []*Mapping{},
	}

	// ensure each new mapping gets
	// a new id
	for _, m := range b.Mappings {
		if m.ID != uuid.Nil {
			continue
		}
		m.ID = uuid.New()
		newBuild.Mappings = append(newBuild.Mappings, m)
	}

	// insert initial set of
	// mapping file entries
	err = newBuild.insertNewMappings(ctx, tx)

	return
}

func (b *Build) getMappings(ctx context.Context) (mappings []*Mapping, err error) {
	types := b.getMappingTypes()
	typeArgs := make([]any, len(types))
	for i, t := range types {
		typeArgs[i] = t
	}

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("mapping_type").
		Select("key").
		Select("location").
		Select("fnv1_hash").
		Select("file_size").
		From("build_mappings").
		Where("app_id = ?", b.AppID).
		Where("version_name = ?", b.VersionName).
		Where("version_code = ?", b.VersionCode)

	if len(typeArgs) > 0 {
		placeholders := make([]string, len(typeArgs))
		for i := range typeArgs {
			placeholders[i] = "?"
		}
		inClause := "mapping_type in (" + strings.Join(placeholders, ", ") + ")"
		stmt = stmt.Where(inClause, typeArgs...)
	}

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)

	for rows.Next() {
		var mapping Mapping

		if errScan := rows.Scan(&mapping.ID, &mapping.Type, &mapping.Key, &mapping.Location, &mapping.Checksum, &mapping.Size); errScan != nil {
			return
		}

		mappings = append(mappings, &mapping)
	}

	err = rows.Err()

	return
}

func PutBuilds(c *gin.Context) {
	ctx := c.Request.Context()
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `failed to parse app id`
		fmt.Println(msg, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})

		return
	}

	var build Build
	if err := c.ShouldBindJSON(&build); err != nil {
		msg := `failed to parse build info`
		fmt.Println(msg, err)

		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})

		return
	}

	build.AppID = appId

	tx, err := server.Server.PgPool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.ReadCommitted,
	})
	if err != nil {
		msg := fmt.Sprintf("failed to acquire db transaction while putting builds: %v", err)
		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	defer tx.Rollback(ctx)

	if err = build.upsert(ctx, &tx); err != nil {
		msg := fmt.Sprintf("failed to upsert build: %v", err)

		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	if err = tx.Commit(ctx); err != nil {
		msg := fmt.Sprintf("failed to commit transaction while upserting builds: %v", err)

		fmt.Println(msg)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	config := server.Server.Config

	if config.IsCloud() {
		client, err := objstore.CreateGCSClient(ctx)
		if err != nil {
			msg := fmt.Sprintf("failed to create GCS client: %v", err)

			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}

		// for creating signed URLs, we need to tie the service account
		// identity along with the credentials. otherwise, the signed
		// URLs can't be generated and won't work as expected.
		iamClient, err := credentials.NewIamCredentialsClient(ctx)
		if err != nil {
			msg := fmt.Sprintf("failed to create IAM client: %v", err)

			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})

			return
		}
		defer iamClient.Close()

		signBytes := func(b []byte) ([]byte, error) {
			resp, err := iamClient.SignBlob(ctx, &credentialspb.SignBlobRequest{
				Name:    "projects/-/serviceAccounts/" + config.ServiceAccountEmail,
				Payload: b,
			})
			if err != nil {
				return nil, err
			}
			return resp.SignedBlob, nil
		}

		for _, mapping := range build.Mappings {
			ext := filepath.Ext(mapping.Filename)
			key := fmt.Sprintf("incoming/%s%s", mapping.ID.String(), ext)
			expiry := time.Now().Add(time.Hour)
			metadata := []string{
				fmt.Sprintf("x-goog-meta-mapping_id: %s", mapping.ID.String()),
				fmt.Sprintf("x-goog-meta-original_file_name: %s", mapping.Filename),
			}

			signOptions := &storage.SignedURLOptions{
				GoogleAccessID: config.ServiceAccountEmail,
				SignBytes:      signBytes,
				Scheme:         storage.SigningSchemeV4,
				Method:         "PUT",
				Expires:        expiry,
				Headers:        metadata,
			}

			url, err := objstore.CreateGCSPUTPreSignedURL(client, config.SymbolsBucket, key, signOptions)
			if err != nil {
				msg := fmt.Sprintf("failed to create PUT pre-signed URL for %v: %v", mapping.Filename, err)

				fmt.Println(msg)

				c.JSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})

				return
			}

			mapping.UploadURL = url
			mapping.ExpiresAt = expiry
			mapping.Headers = make(map[string]string)
			mapping.Headers["x-goog-meta-mapping_id"] = mapping.ID.String()
			mapping.Headers["x-goog-meta-original_file_name"] = mapping.Filename
		}

		if !build.hasMapping() {
			c.JSON(http.StatusOK, gin.H{
				"ok": "build info updated",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"mappings": build.Mappings,
		})

		return
	}

	client := objstore.CreateS3Client(ctx, config.SymbolsAccessKey, config.SymbolsSecretAccessKey, config.SymbolsBucketRegion, config.AWSEndpoint)

	// process build mappings
	for _, mapping := range build.Mappings {
		ext := filepath.Ext(mapping.Filename)
		key := fmt.Sprintf("incoming/%s%s", mapping.ID.String(), ext)
		signedUrl, err := objstore.CreateS3PUTPreSignedURL(ctx, client, &s3.PutObjectInput{
			Bucket: aws.String(config.SymbolsBucket),
			Key:    aws.String(key),
			Metadata: map[string]string{
				"mapping_id":         mapping.ID.String(),
				"original_file_name": mapping.Filename,
			},
		}, s3.WithPresignExpires(time.Duration(time.Hour)))

		if err != nil {
			msg := fmt.Sprintf("failed to create PUT pre-signed URL for %v: %v", mapping.Filename, err)

			fmt.Println(msg)

			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		// proxy the url
		proxyUrl := fmt.Sprintf("%s/proxy/symbols?payload=%s", config.APIOrigin, url.QueryEscape(signedUrl))

		mapping.UploadURL = proxyUrl
		mapping.ExpiresAt = time.Now().Add(time.Hour)
		mapping.Headers = make(map[string]string)
		mapping.Headers["x-amz-meta-mapping_id"] = mapping.ID.String()
		mapping.Headers["x-amz-meta-original_file_name"] = mapping.Filename
	}

	if !build.hasMapping() {
		c.JSON(http.StatusOK, gin.H{
			"ok": "build info updated",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mappings": build.Mappings,
	})
}

// ProxySymbol proxies presigned S3 URLs to an S3-like
// server.
//
// We parse the payload from the incoming request's query
// string, then construct a new URL by replacing the S3 origin.
// Next, we create a reverse proxy and configure it to pipe
// response back to the original caller.
//
// The original S3 origin used when constructing the presigned
// URL must match the proxied presigned URL.
func ProxySymbol(c *gin.Context) {
	payload := c.Query("payload")
	if payload == "" {
		msg := `need payload for proxying to object store`
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	config := server.Server.Config
	presignedUrl := payload

	// if the payload already contains origin, then
	// don't prepend the origin.
	if !strings.HasPrefix(payload, config.AWSEndpoint) {
		presignedUrl = config.AWSEndpoint + payload
	}

	parsed, err := url.Parse(presignedUrl)
	if err != nil {
		msg := "failed to parse reconstructed presigned url"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(parsed)
	proxy.Director = func(req *http.Request) {
		req.URL.Scheme = parsed.Scheme
		req.URL.Host = parsed.Host
		req.URL.Path = parsed.Path
		req.URL.RawQuery = parsed.RawQuery
		req.Host = parsed.Host

		req.Header = c.Request.Header
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode != http.StatusOK {
			fmt.Printf("Symbol proxy http status: %s\n", resp.Status)
		}
		return nil
	}

	proxy.ServeHTTP(c.Writer, c.Request)
}
