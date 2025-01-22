package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sessionator/config"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// janitor cleans up resources.
type janitor struct {
	config *config.Config
	appIds []uuid.UUID
}

// parameterize parameterizes placeholder
// values while building database queries.
func parameterize[T string | uuid.UUID](items []T) (string, []any) {
	placeholders := make([]string, len(items))
	args := make([]any, len(items))
	for i := range items {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = items[i]
	}

	return strings.Join(placeholders, ", "), args
}

// deleteAllObjects paginates & deletes all objects from a bucket.
func deleteAllObjects(ctx context.Context, bucket *string, client *s3.Client) (err error) {
	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: bucket,
	})

	for paginator.HasMorePages() {
		// get the next page of objects
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return err
		}

		// prepare the objects to be deleted
		var objectIdentifiers []types.ObjectIdentifier
		for _, object := range page.Contents {
			objectIdentifiers = append(objectIdentifiers, types.ObjectIdentifier{
				Key: object.Key,
			})
		}

		if len(objectIdentifiers) == 0 {
			continue
		}

		// delete the objects
		_, err = client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: bucket,
			Delete: &types.Delete{
				Objects: objectIdentifiers,
				Quiet:   aws.Bool(true),
			},
		})

		if err != nil {
			return fmt.Errorf("failed to delete objects: %w", err)
		}

		fmt.Printf("....removed %d objects from bucket %s\n", len(objectIdentifiers), *bucket)
	}

	return
}

// rmAppResources removes all resources associated with
// the apps in config.
func rmAppResources(ctx context.Context, c *config.Config) (err error) {
	if dryRun {
		return nil
	}

	hasApps := len(c.Apps) > 0

	if !hasApps {
		err = errors.New("no apps found in config")
		return
	}

	conn, err := pgx.Connect(ctx, c.Storage["postgres_dsn"])
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(ctx); err != nil {
			return
		}
	}()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return
	}

	defer func() {
		if err := tx.Rollback(ctx); err != nil {
			return
		}
	}()

	j := &janitor{
		config: c,
	}

	apps := []string{}
	for appKey, appValue := range c.Apps {
		apps = append(apps, appKey)

		// if optional `name` exist for an
		// app, consider it too for resolving
		// app ids.
		if appValue.Name != "" {
			apps = append(apps, appValue.Name)
		}
	}

	if err = j.resolveAppIds(ctx, conn, apps); err != nil {
		return
	}

	if err = j.rmIssueGroups(ctx, &tx); err != nil {
		return
	}

	if err = j.rmBuilds(ctx, &tx); err != nil {
		return
	}

	if err = j.rmEventReqs(ctx, &tx); err != nil {
		return
	}

	if err = j.rmShortFilters(ctx, &tx); err != nil {
		return
	}

	if err = j.rmSessions(ctx); err != nil {
		return
	}

	if err = j.rmEventFilters(ctx); err != nil {
		return
	}

	if err = j.rmEventMetrics(ctx); err != nil {
		return
	}

	if err = j.rmEvents(ctx); err != nil {
		return
	}

	if err = j.rmSpanFilters(ctx); err != nil {
		return
	}

	if err = j.rmSpanMetrics(ctx); err != nil {
		return
	}

	if err = j.rmSpans(ctx); err != nil {
		return
	}

	if err = tx.Commit(ctx); err != nil {
		return
	}

	return
}

// rmAll removes all app resources regardless of apps
// configuration in config.
func rmAll(ctx context.Context, c *config.Config) (err error) {
	if dryRun {
		return nil
	}

	pgconn, err := pgx.Connect(ctx, c.Storage["postgres_dsn"])
	if err != nil {
		return
	}

	defer func() {
		if err := pgconn.Close(ctx); err != nil {
			return
		}
	}()

	tx, err := pgconn.Begin(ctx)
	if err != nil {
		return
	}

	defer func() {
		if err := tx.Rollback(ctx); err != nil {
			return
		}
	}()

	j := &janitor{
		config: c,
	}

	symbolsClient := j.getSymbolsClient()
	symbolsBucket := aws.String(j.config.Storage["symbols_s3_bucket"])
	attachmentsClient := j.getAttachmentsClient()
	attachmentsBucket := aws.String(j.config.Storage["attachments_s3_bucket"])

	fmt.Println("removing all app resources")
	_, err = tx.Exec(ctx, "truncate table unhandled_exception_groups, anr_groups, build_mappings, build_sizes, event_reqs, short_filters")
	if err != nil {
		return
	}

	opts, err := clickhouse.ParseDSN(j.config.Storage["clickhouse_dsn"])
	if err != nil {
		return
	}

	chconn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := chconn.Close(); err != nil {
			return
		}
	}()

	if err = chconn.Exec(ctx, "truncate table sessions;"); err != nil {
		return
	}

	if err = chconn.Exec(ctx, "truncate table user_def_attrs;"); err != nil {
		return
	}

	if err = chconn.Exec(ctx, "truncate table app_filters;"); err != nil {
		return
	}

	if err = chconn.Exec(ctx, "truncate table app_metrics;"); err != nil {
		return
	}

	if err = deleteAllObjects(ctx, symbolsBucket, symbolsClient); err != nil {
		return
	}

	if err = deleteAllObjects(ctx, attachmentsBucket, attachmentsClient); err != nil {
		return
	}

	if err = chconn.Exec(ctx, "truncate table events;"); err != nil {
		return
	}

	if err = chconn.Exec(ctx, "truncate table span_filters;"); err != nil {
		return
	}

	if err = chconn.Exec(ctx, "truncate table span_metrics;"); err != nil {
		return
	}

	if err = chconn.Exec(ctx, "truncate table spans;"); err != nil {
		return
	}

	if err = tx.Commit(ctx); err != nil {
		return
	}

	return
}

// getSymbolsClient creates an S3 client for operating
// on symbols S3 bucket.
func (j *janitor) getSymbolsClient() (client *s3.Client) {
	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     j.config.Storage["symbols_access_key"],
			SecretAccessKey: j.config.Storage["symbols_secret_access_key"],
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      j.config.Storage["symbols_s3_bucket_region"],
		Credentials: credentialsProvider,
	}

	return s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := j.config.Storage["aws_endpoint_url"]
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})
}

// getAttachmentsClient creates an S3 client for operating
// on attachments S3 bucket.
func (j *janitor) getAttachmentsClient() (client *s3.Client) {
	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     j.config.Storage["symbols_access_key"],
			SecretAccessKey: j.config.Storage["symbols_secret_access_key"],
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      j.config.Storage["symbols_s3_bucket_region"],
		Credentials: credentialsProvider,
	}

	return s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := j.config.Storage["aws_endpoint_url"]
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})
}

// resolveAppIds resolves app uuids from
// app unique identifiers and stores for
// future use.
func (j *janitor) resolveAppIds(ctx context.Context, conn *pgx.Conn, apps []string) (err error) {
	placeholders, args := parameterize(apps)

	selectAppIds := fmt.Sprintf("select id from public.apps where unique_identifier in (%s) or app_name in (%s);", placeholders, placeholders)

	rows, err := conn.Query(ctx, selectAppIds, args...)
	if err != nil {
		return
	}

	appIds, err := pgx.CollectRows(rows, pgx.RowTo[uuid.UUID])
	if err != nil {
		return
	}

	j.appIds = appIds

	return
}

// rmIssueGroups removes unhandled exception and
// ANR groups for apps in config.
func (j *janitor) rmIssueGroups(ctx context.Context, tx *pgx.Tx) (err error) {
	placeholders, args := parameterize(j.appIds)

	deleteExcepGroups := fmt.Sprintf("delete from public.unhandled_exception_groups where app_id in (%s);", placeholders)
	deleteANRGroups := fmt.Sprintf("delete from public.anr_groups where app_id in (%s);", placeholders)

	fmt.Println("removing unhandled exception groups")
	_, err = (*tx).Exec(ctx, deleteExcepGroups, args...)
	if err != nil {
		return
	}

	fmt.Println("removing ANR groups")
	_, err = (*tx).Exec(ctx, deleteANRGroups, args...)
	if err != nil {
		return
	}

	return
}

// rmApps removes apps
func (j *janitor) rmApps(ctx context.Context, tx *pgx.Tx) (err error) {
	placeholders, args := parameterize(j.appIds)
	deleteApps := fmt.Sprintf("delete from apps where id in (%s);", placeholders)

	fmt.Println("removing app(s)")
	fmt.Printf("  %s\n", args)
	_, err = (*tx).Exec(ctx, deleteApps, args...)
	if err != nil {
		return
	}

	return
}

// rmBuilds removes build info for apps
// in config.
func (j *janitor) rmBuilds(ctx context.Context, tx *pgx.Tx) (err error) {
	placeholders, args := parameterize(j.appIds)
	selectBuildMappings := fmt.Sprintf("select key from public.build_mappings where app_id in (%s);", placeholders)
	deleteBuildMappings := fmt.Sprintf("delete from public.build_mappings where app_id in (%s);", placeholders)
	deleteBuildSizes := fmt.Sprintf("delete from public.build_sizes where app_id in (%s);", placeholders)

	fmt.Println("removing build mappings")
	rows, err := (*tx).Query(ctx, selectBuildMappings, args...)
	if err != nil {
		return
	}

	keys, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return
	}

	objectIds := []types.ObjectIdentifier{}
	for i := range keys {
		objectIds = append(objectIds, types.ObjectIdentifier{
			Key: aws.String(keys[i]),
		})
	}

	if err = j.rmMappingObjects(ctx, objectIds); err != nil {
		return
	}

	_, err = (*tx).Exec(ctx, deleteBuildMappings, args...)
	if err != nil {
		return
	}

	fmt.Println("removing build sizes")
	_, err = (*tx).Exec(ctx, deleteBuildSizes, args...)
	if err != nil {
		return
	}

	return
}

// rmEventReqs removes event requests for
// apps in config.
func (j *janitor) rmEventReqs(ctx context.Context, tx *pgx.Tx) (err error) {
	placeholders, args := parameterize(j.appIds)
	deleteEventReqs := fmt.Sprintf("delete from public.event_reqs where app_id in (%s);", placeholders)

	fmt.Println("removing event requests")
	_, err = (*tx).Exec(ctx, deleteEventReqs, args...)
	if err != nil {
		return
	}

	return
}

// rmShortFilters removes short filters for
// apps in config.
func (j *janitor) rmShortFilters(ctx context.Context, tx *pgx.Tx) (err error) {
	placeholders, args := parameterize(j.appIds)
	deleteShortFilters := fmt.Sprintf("delete from short_filters where app_id in (%s);", placeholders)

	fmt.Println("removing short filters")
	_, err = (*tx).Exec(ctx, deleteShortFilters, args...)
	if err != nil {
		return
	}

	return
}

// rmEventFilters removes app's event filters for
// apps in config.
func (j *janitor) rmEventFilters(ctx context.Context) (err error) {
	deleteEventFilters := `delete from app_filters where app_id = toUUID(@app_id);`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing event filters")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])

		if err := conn.Exec(ctx, deleteEventFilters, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmEventMetrics removes app's metrics for apps
// in config.
func (j *janitor) rmEventMetrics(ctx context.Context) (err error) {
	deleteEventMetrics := `delete from app_metrics where app_id = toUUID(@app_id);`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing event metrics")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])

		if err := conn.Exec(ctx, deleteEventMetrics, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmEvents removes events and its attachments
// for apps in config.
func (j *janitor) rmEvents(ctx context.Context) (err error) {
	selectAttachments := `select attachments from default.events where app_id = @app_id;`
	deleteEvents := `delete from default.events where app_id = @app_id;`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing events")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])
		rows, err := conn.Query(ctx, selectAttachments, namedAppId)
		if err != nil {
			return err
		}

		for rows.Next() {
			var attachments string
			if err := rows.Scan(&attachments); err != nil {
				return err
			}

			if err := j.rmAttachments(ctx, []byte(attachments)); err != nil {
				return err
			}
		}

		if err := conn.Exec(ctx, deleteEvents, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmSpanFilters removes app's span filters for
// apps in config.
func (j *janitor) rmSpanFilters(ctx context.Context) (err error) {
	deleteSpanFilters := `delete from span_filters where app_id = toUUID(@app_id);`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing span filters")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])

		if err := conn.Exec(ctx, deleteSpanFilters, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmSpanMetrics removes app's span filters for
// apps in config.
func (j *janitor) rmSpanMetrics(ctx context.Context) (err error) {
	deleteSpanMetrics := `delete from span_metrics where app_id = toUUID(@app_id);`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing span metrics")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])

		if err := conn.Exec(ctx, deleteSpanMetrics, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmSpans removes spans
// for apps in config.
func (j *janitor) rmSpans(ctx context.Context) (err error) {
	deleteSpans := `delete from spans where app_id = @app_id;`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing spans")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])

		if err := conn.Exec(ctx, deleteSpans, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmSessions removes app's sessions for apps
// in config.
func (j *janitor) rmSessions(ctx context.Context) (err error) {
	deleteSessions := `delete from sessions where app_id = toUUID(@app_id);`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing sessions")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])

		if err := conn.Exec(ctx, deleteSessions, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmUserDefAttrs removes app's user defined attributes
// for apps in config.
func (j *janitor) rmUserDefAttrs(ctx context.Context) (err error) {
	deleteUserDefAttrs := `delete from user_def_attrs where app_id = toUUID(@app_id);`

	dsn := j.config.Storage["clickhouse_dsn"]
	opts, err := clickhouse.ParseDSN(dsn)
	if err != nil {
		return
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		return
	}

	defer func() {
		if err := conn.Close(); err != nil {
			return
		}
	}()

	fmt.Println("removing user defined attributes")

	for i := range j.appIds {
		namedAppId := clickhouse.Named("app_id", j.appIds[i])

		if err := conn.Exec(ctx, deleteUserDefAttrs, namedAppId); err != nil {
			return err
		}
	}

	return
}

// rmAttachments prepares for attachment
// removal and commands removal of attachments.
func (j *janitor) rmAttachments(ctx context.Context, bytes []byte) (err error) {
	type attachment struct {
		Key      string `json:"key"`
		Location string `json:"location"`
	}

	attachments := []attachment{}
	if err := json.Unmarshal(bytes, &attachments); err != nil {
		return err
	}

	if len(attachments) < 1 {
		return
	}

	objectIds := []types.ObjectIdentifier{}
	for i := range attachments {
		objectIds = append(objectIds, types.ObjectIdentifier{
			Key: aws.String(attachments[i].Key),
		})
	}

	return j.rmAttachmentObjects(ctx, objectIds)
}

// rmAttachmentObjects removes attachment objects
// from object store.
func (j *janitor) rmAttachmentObjects(ctx context.Context, objectIds []types.ObjectIdentifier) (err error) {
	deleteObjectsInput := &s3.DeleteObjectsInput{
		Bucket: aws.String(j.config.Storage["attachments_s3_bucket"]),
		Delete: &types.Delete{Objects: objectIds},
	}

	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     j.config.Storage["attachments_access_key"],
			SecretAccessKey: j.config.Storage["attachments_secret_access_key"],
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      j.config.Storage["attachments_s3_bucket_region"],
		Credentials: credentialsProvider,
	}

	client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := j.config.Storage["aws_endpoint_url"]
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

	// ignoring delete objects output
	_, err = client.DeleteObjects(ctx, deleteObjectsInput)
	if err != nil {
		return
	}

	return
}

// rmMappingObjects removes mapping objects
// from object store.
func (j *janitor) rmMappingObjects(ctx context.Context, objectIds []types.ObjectIdentifier) (err error) {
	if len(objectIds) < 1 {
		return
	}
	deleteObjectsInput := &s3.DeleteObjectsInput{
		Bucket: aws.String(j.config.Storage["symbols_s3_bucket"]),
		Delete: &types.Delete{Objects: objectIds},
	}

	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     j.config.Storage["symbols_access_key"],
			SecretAccessKey: j.config.Storage["symbols_secret_access_key"],
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      j.config.Storage["symbols_s3_bucket_region"],
		Credentials: credentialsProvider,
	}

	client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := j.config.Storage["aws_endpoint_url"]
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

	// ignoring delete objects output
	_, err = client.DeleteObjects(ctx, deleteObjectsInput)
	if err != nil {
		return
	}

	return
}
