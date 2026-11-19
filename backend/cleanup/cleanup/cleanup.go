package cleanup

import (
	"backend/cleanup/server"
	"backend/libs/objstore"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"time"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// ErrAttachmentDeleteFailure is returned when attachment objects could not be deleted.
var ErrAttachmentDeleteFailure = errors.New("attachment delete failure")

// s3DeleteBatchSize is the S3 DeleteObjects per-request key limit.
const s3DeleteBatchSize = 1000

type Attachment struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name" binding:"required"`
	Type     string    `json:"type" binding:"required"`
	Reader   io.Reader `json:"-"`
	Key      string    `json:"key"`
	Location string    `json:"location"`
}

type AppRetention struct {
	TeamID    string    `json:"team_id"`
	AppID     string    `json:"app_id"`
	Threshold time.Time `json:"threshold"`
}

// DeleteStaleData runs every cleanup step & prints the total failure count.
func DeleteStaleData(ctx context.Context) {
	failures := 0

	// delete stale auth sessions
	failures += deleteStaleAuthSessions(ctx)

	// delete stale mcp auth codes
	failures += deleteStaleMCPAuthCodes(ctx)

	// delete stale mcp auth sessions
	failures += deleteStaleMCPAuthSessions(ctx)

	// delete stale invites
	failures += deleteStaleInvites(ctx)

	// delete stale pending alert messages
	failures += deleteStalePendingAlertMessages(ctx)

	// fetch each app's retention thresholds
	appRetentions, scanFailures, err := fetchAppRetentions(ctx)
	failures += scanFailures
	if err != nil {
		failures += 1
		fmt.Printf("Failed to fetch app retentions and stale data: %v\n", err)
		fmt.Println(finishedMessage(failures))
		return
	}

	// delete event filters
	failures += deleteEventFilters(ctx, appRetentions)

	// delete event metrics
	failures += deleteEventMetrics(ctx, appRetentions)

	// delete span filters
	failures += deleteSpanFilters(ctx, appRetentions)

	// delete span metrics
	failures += deleteSpanMetrics(ctx, appRetentions)

	// delete user defined attributes
	failures += deleteUserDefAttrs(ctx, appRetentions)

	// delete span user defined attributes
	failures += deleteSpanUserDefAttrs(ctx, appRetentions)

	// delete bug reports
	failures += deleteBugReports(ctx, appRetentions)

	// delete sessions index
	failures += deleteSessionsIndex(ctx, appRetentions)

	// delete sessions
	failures += deleteSessions(ctx, appRetentions)

	// delete analytics events
	failures += deleteAnalyticsEvents(ctx, appRetentions)

	// delete spans
	failures += deleteSpans(ctx, appRetentions)

	// delete http events
	failures += deleteHttpEvents(ctx, appRetentions)

	// delete http metrics
	failures += deleteHttpMetrics(ctx, appRetentions)

	// delete url patterns
	failures += deleteUrlPatterns(ctx, appRetentions)

	// delete events and attachments
	failures += deleteEventsAndAttachments(ctx, appRetentions)

	// delete stale alerts
	failures += deleteStaleAlerts(ctx, appRetentions)

	// delete stale agent conversations
	failures += deleteStaleAgentConversations(ctx, appRetentions)

	fmt.Println(finishedMessage(failures))
}

// finishedMessage returns the completion log line with the failure count.
func finishedMessage(failures int) string {
	return fmt.Sprintf("Finished cleaning up stale data. %d failures happened", failures)
}

// deleteStaleAuthSessions deletes stale auth sessions that
// have passed the expiry time
func deleteStaleAuthSessions(ctx context.Context) int {
	threshold := time.Now()
	stmt := sqlf.PostgreSQL.DeleteFrom("auth_sessions").
		Where("rt_expiry_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale auth sessions: %v\n", err)
		return 1
	}

	fmt.Printf("Successfully deleted stale auth sessions\n")

	return 0
}

// deleteStaleMCPAuthCodes deletes MCP OAuth authorization codes that
// have passed the expiry time
func deleteStaleMCPAuthCodes(ctx context.Context) int {
	threshold := time.Now()
	stmt := sqlf.PostgreSQL.DeleteFrom("mcp_auth_codes").
		Where("expires_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale mcp auth codes: %v\n", err)
		return 1
	}

	fmt.Printf("Successfully deleted stale mcp auth codes\n")

	return 0
}

// deleteStaleMCPAuthSessions deletes MCP sessions that have passed the
// expiry time of their refresh token
func deleteStaleMCPAuthSessions(ctx context.Context) int {
	threshold := time.Now()
	stmt := sqlf.PostgreSQL.DeleteFrom("mcp_auth_sessions").
		Where("rt_expiry_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale mcp auth sessions: %v\n", err)
		return 1
	}

	fmt.Printf("Successfully deleted stale mcp auth sessions\n")

	return 0
}

// deleteStaleInvites deletes stale invites that
// have passed the expiry threshold
func deleteStaleInvites(ctx context.Context) int {
	threshold := time.Now().Add(-7 * 24 * time.Hour) // 7 day expiry
	stmt := sqlf.PostgreSQL.DeleteFrom("invites").
		Where("updated_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale invites: %v\n", err)
		return 1
	}

	fmt.Printf("Successfully deleted stale invites\n")

	return 0
}

// deleteEventFilters deletes stale event filters for each
// app's retention threshold.
func deleteEventFilters(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("app_filters").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("end_of_month < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale event filters for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale event filters")
	}

	return failures
}

// deleteEventMetrics deletes stale event metrics for each
// app's retention threshold.
func deleteEventMetrics(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("app_metrics").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale event metrics for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale event metrics")
	}

	return failures
}

// deleteSpanFilters deletes stale span filters for each
// app's retention threshold.
func deleteSpanFilters(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("span_filters").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("end_of_month < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale span filters for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale span filters")
	}

	return failures
}

// deleteSpanMetrics deletes stale span metrics for each
// app's retention threshold.
func deleteSpanMetrics(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("span_metrics").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale span metrics for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale span metrics")
	}

	return failures
}

// deleteUserDefAttrs deletes stale user defined attributes
// for each app's retention threshold.
func deleteUserDefAttrs(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("user_def_attrs").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale user defined attributes for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale user defined attributes")
	}

	return failures
}

// deleteSpanUserDefAttrs deletes stale span user defined attributes
// for each app's retention threshold.
func deleteSpanUserDefAttrs(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("span_user_def_attrs").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale span user defined attributes for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale span user defined attributes")
	}

	return failures
}

// deleteBugReports deletes stale bug reports for each
// app's retention threshold.
func deleteBugReports(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("bug_reports").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale bug reports for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale bug reports")
	}

	return failures
}

// deleteSessionsIndex deletes stale sessions index for each
// app's retention threshold.
func deleteSessionsIndex(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("sessions_index").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("first_event_timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale sessions index for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale sessions index")
	}

	return failures
}

// deleteSessions deletes stale sessions for each
// app's retention threshold.
func deleteSessions(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("sessions").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("first_event_timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale sessions for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale sessions")
	}

	return failures
}

// deleteAnalyticsEvents deletes the analytics events that are older than the
// retention threshold of each app.
func deleteAnalyticsEvents(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("analytics_events").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale analytics events for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale analytics events")
	}

	return failures
}

// deleteSpans deletes stale spans for each
// app's retention threshold.
func deleteSpans(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("spans").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("start_time < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale spans for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale spans")
	}

	return failures
}

// deleteHttpEvents deletes stale http events for each
// app's retention threshold.
func deleteHttpEvents(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("http_events").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale http events for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale http events")
	}

	return failures
}

// deleteHttpMetrics deletes stale http metrics for each
// app's retention threshold.
func deleteHttpMetrics(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("http_metrics").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale http metrics for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale http metrics")
	}

	return failures
}

// deleteUrlPatterns deletes stale url patterns for each
// app's retention threshold.
func deleteUrlPatterns(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("url_patterns").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("updated_at < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale url patterns for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale url patterns")
	}

	return failures
}

// deleteEventsAndAttachments deletes stale events and their attachments for each
// app's retention threshold.
func deleteEventsAndAttachments(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {

		// Fetch attachments for current app's stale events
		fetchAttachmentsStmt := sqlf.
			Select("attachments").
			From("events final").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold).
			Where("attachments not in ('', '[]')")

		attachmentRows, err := server.Server.ChPool.Query(ctx, fetchAttachmentsStmt.String(), fetchAttachmentsStmt.Args()...)
		if err != nil {
			failures += 1
			fmt.Printf("Failed to fetch stale events from ClickHouse: %v\n", err)
			fetchAttachmentsStmt.Close()
			continue
		}

		var attachmentsJSON string
		var attachments []Attachment
		var staleAttachments []Attachment
		for attachmentRows.Next() {
			if err := attachmentRows.Scan(&attachmentsJSON); err != nil {
				failures += 1
				fmt.Printf("Failed to scan attachment: %v\n", err)
				continue
			}

			// If event has attachments, unmarshall it. If it can't be unmarshalled, continue. Events with
			// attachments that fail unmarshalling will not be included in stale list.
			if attachmentsJSON != "[]" {
				if err := json.Unmarshal([]byte(attachmentsJSON), &attachments); err != nil {
					failures += 1
					fmt.Printf("Failed to unmarshal attachment JSON attachmentJSON: %v, error: %v\n", attachmentsJSON, err)
					continue
				}

				staleAttachments = append(staleAttachments, attachments...)
			}
		}

		attachmentRows.Close()
		fetchAttachmentsStmt.Close()

		if err := attachmentRows.Err(); err != nil {
			failures += 1
			fmt.Printf("Failed to read stale attachments for app id %q: %v\n", retention.AppID, err)
			continue
		}

		// Delete attachments from object storage
		if err := deleteAttachments(ctx, staleAttachments); err != nil {
			failures += 1
			fmt.Printf("Failed to delete attachments for app id %q: %v\n", retention.AppID, err)
			continue
		}

		// Delete stale events
		stmt := sqlf.
			DeleteFrom("events").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale events for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Println("Successfully deleted stale events and their attachments")
	}

	return failures
}

// deleteAttachments deletes attachment objects from the configured object store.
func deleteAttachments(ctx context.Context, attachments []Attachment) (err error) {
	if len(attachments) == 0 {
		return nil
	}

	config := server.Server.Config
	keys := attachmentKeys(attachments)
	if config.IsCloud() {
		return deleteGCSAttachments(ctx, config.AttachmentsBucket, keys)
	}

	client := objstore.CreateS3Client(ctx, config.AttachmentsAccessKey, config.AttachmentsSecretAccessKey, config.AttachmentsBucketRegion, config.AWSEndpoint)
	return deleteS3Attachments(ctx, client, config.AttachmentsBucket, keys)
}

// attachmentKeys returns the object keys of attachments.
func attachmentKeys(attachments []Attachment) (keys []string) {
	for _, at := range attachments {
		keys = append(keys, at.Key)
	}
	return
}

// s3DeleteAPI is the S3 client surface used to delete objects.
type s3DeleteAPI interface {
	DeleteObjects(ctx context.Context, params *s3.DeleteObjectsInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error)
}

// deleteS3Attachments deletes keys in batches of s3DeleteBatchSize & stops at the first failed batch.
func deleteS3Attachments(ctx context.Context, api s3DeleteAPI, bucket string, keys []string) (err error) {
	for batch := range slices.Chunk(keys, s3DeleteBatchSize) {
		if err := deleteS3Batch(ctx, api, bucket, batch); err != nil {
			return err
		}
	}
	return nil
}

// deleteS3Batch deletes one batch of keys & fails on any per-key error.
func deleteS3Batch(ctx context.Context, api s3DeleteAPI, bucket string, keys []string) (err error) {
	objectIds := make([]types.ObjectIdentifier, 0, len(keys))
	for _, key := range keys {
		objectIds = append(objectIds, types.ObjectIdentifier{Key: aws.String(key)})
	}

	out, err := api.DeleteObjects(ctx, &s3.DeleteObjectsInput{
		Bucket: aws.String(bucket),
		Delete: &types.Delete{Objects: objectIds, Quiet: aws.Bool(true)},
	})
	if err != nil {
		return fmt.Errorf("%w: %w", ErrAttachmentDeleteFailure, err)
	}
	if len(out.Errors) > 0 {
		first := out.Errors[0]
		return fmt.Errorf("%w: %d of %d keys failed, first key %q code %q", ErrAttachmentDeleteFailure, len(out.Errors), len(keys), aws.ToString(first.Key), aws.ToString(first.Code))
	}
	return nil
}

// deleteGCSAttachments deletes keys from GCS & treats missing objects as deleted.
func deleteGCSAttachments(ctx context.Context, bucket string, keys []string) (err error) {
	client, err := objstore.CreateGCSClient(ctx)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrAttachmentDeleteFailure, err)
	}

	defer func() {
		if err := client.Close(); err != nil {
			fmt.Printf("Failed to close storage client: %v\n", err)
		}
	}()

	var failed []string
	for _, key := range keys {
		if err := client.Bucket(bucket).Object(key).Delete(ctx); err != nil && !errors.Is(err, storage.ErrObjectNotExist) {
			fmt.Printf("Failed to delete attachment %q: %v\n", key, err)
			failed = append(failed, key)
		}
	}

	if len(failed) > 0 {
		return fmt.Errorf("%w: %d attachments failed, first key %q", ErrAttachmentDeleteFailure, len(failed), failed[0])
	}
	return nil
}

// deleteStaleAlerts deletes stale alerts for each
// app's retention threshold.
func deleteStaleAlerts(ctx context.Context, retentions []AppRetention) (failures int) {
	for _, retention := range retentions {
		stmt := sqlf.PostgreSQL.DeleteFrom("alerts").
			Where("app_id = ?", retention.AppID).
			Where("created_at < ?", retention.Threshold)

		if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale alerts for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Printf("Successfully deleted stale alerts\n")
	}

	return failures
}

// deleteStaleAgentConversations deletes agent conversations whose last
// activity is past the team's retention. A conversation can span any of the
// team's apps, so the cutoff is the earliest threshold among them (the
// longest retention). Messages cascade with them.
func deleteStaleAgentConversations(ctx context.Context, retentions []AppRetention) (failures int) {
	cutoffs := map[string]time.Time{}
	for _, retention := range retentions {
		if current, ok := cutoffs[retention.TeamID]; !ok || retention.Threshold.Before(current) {
			cutoffs[retention.TeamID] = retention.Threshold
		}
	}

	for teamID, threshold := range cutoffs {
		stmt := sqlf.PostgreSQL.DeleteFrom("agent_conversations").
			Where("team_id = ?", teamID).
			Where("updated_at < ?", threshold)

		if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			failures += 1
			fmt.Printf("Failed to delete stale agent conversations for team id %q: %v\n", teamID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if failures < 1 {
		fmt.Printf("Successfully deleted stale agent conversations\n")
	}

	return failures
}

// deleteStalePendingAlertMessages deletes stale pending alert messages
func deleteStalePendingAlertMessages(ctx context.Context) int {
	threshold := time.Now().Add(-24 * time.Hour) // 1 day expiry
	stmt := sqlf.PostgreSQL.DeleteFrom("pending_alert_messages").
		Where("created_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale pending alert messages: %v\n", err)
		return 1
	}

	fmt.Printf("Successfully deleted stale pending alert messages\n")

	return 0
}

// fetchAppRetentions fetches retention period
// for each app & returns the count of rows skipped on scan failure.
func fetchAppRetentions(ctx context.Context) (retentions []AppRetention, failures int, err error) {
	// Fetch retention periods for each app
	stmt := sqlf.PostgreSQL.
		From("apps").
		Select("id").
		Select("team_id").
		Select("retention")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var retention AppRetention
		var period int

		if err := rows.Scan(&retention.AppID, &retention.TeamID, &period); err != nil {
			failures += 1
			fmt.Printf("Failed to scan row: %v\n", err)
			continue
		}

		retention.Threshold = time.Now().UTC().AddDate(0, 0, -period)
		retentions = append(retentions, retention)
	}

	err = rows.Err()

	return
}
