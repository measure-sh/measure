package cleanup

import (
	"backend/cleanup/server"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"cloud.google.com/go/storage"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

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

func DeleteStaleData(ctx context.Context) {
	// delete stale auth sessions
	deleteStaleAuthSessions(ctx)

	// delete shortened filters
	deleteStaleShortenedFilters(ctx)

	// delete stale invites
	deleteStaleInvites(ctx)

	// delete stale pending alert messages
	deleteStalePendingAlertMessages(ctx)

	// fetch each app's retention thresholds
	appRetentions, err := fetchAppRetentions(ctx)
	if err != nil {
		fmt.Printf("Failed to fetch app retentions and stale data: %v\n", err)
		return
	}

	// delete event filters
	deleteEventFilters(ctx, appRetentions)

	// delete event metrics
	deleteEventMetrics(ctx, appRetentions)

	// delete span filters
	deleteSpanFilters(ctx, appRetentions)

	// delete span metrics
	deleteSpanMetrics(ctx, appRetentions)

	// delete user defined attributes
	deleteUserDefAttrs(ctx, appRetentions)

	// delete span user defined attributes
	deleteSpanUserDefAttrs(ctx, appRetentions)

	// delete bug reports
	deleteBugReports(ctx, appRetentions)

	// delete sessions index
	deleteSessionsIndex(ctx, appRetentions)

	// delete sessions
	deleteSessions(ctx, appRetentions)

	// delete journeys
	deleteJourneys(ctx, appRetentions)

	// delete spans
	deleteSpans(ctx, appRetentions)

	// delete events and attachments
	deleteEventsAndAttachments(ctx, appRetentions)

	// delete stale alerts
	deleteStaleAlerts(ctx, appRetentions)

	fmt.Println("Finished cleaning up stale data")
}

// deleteStaleAuthSessions deletes stale auth sessions that
// have passed the expiry time
func deleteStaleAuthSessions(ctx context.Context) {
	threshold := time.Now()
	stmt := sqlf.PostgreSQL.DeleteFrom("auth_sessions").
		Where("rt_expiry_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale auth sessions: %v\n", err)
		return
	}

	fmt.Printf("Succesfully deleted stale auth sessions\n")
}

// deleteStaleShortenedFilters deletes stale shortened filters that
// have passed the expiry threshold
func deleteStaleShortenedFilters(ctx context.Context) {
	threshold := time.Now().Add(-60 * time.Minute) // 1 hour expiry
	stmt := sqlf.PostgreSQL.DeleteFrom("short_filters").
		Where("created_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale short filter codes: %v\n", err)
		return
	}

	fmt.Printf("Succesfully deleted stale short filters\n")
}

// deleteStaleInvites deletes stale invites that
// have passed the expiry threshold
func deleteStaleInvites(ctx context.Context) {
	threshold := time.Now().Add(-7 * 24 * time.Hour) // 7 day expiry
	stmt := sqlf.PostgreSQL.DeleteFrom("invites").
		Where("updated_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale invites: %v\n", err)
		return
	}

	fmt.Printf("Succesfully deleted stale invites\n")
}

// deleteEventFilters deletes stale event filters for each
// app's retention threshold.
func deleteEventFilters(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("app_filters").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("end_of_month < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale event filters for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale event filters")
	}
}

// deleteEventMetrics deletes stale event metrics for each
// app's retention threshold.
func deleteEventMetrics(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("app_metrics").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale event metrics for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale event metrics")
	}
}

// deleteSpanFilters deletes stale span filters for each
// app's retention threshold.
func deleteSpanFilters(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("span_filters").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("end_of_month < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale span filters for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale span filters")
	}
}

// deleteSpanMetrics deletes stale span metrics for each
// app's retention threshold.
func deleteSpanMetrics(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("span_metrics").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale span metrics for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale span metrics")
	}
}

// deleteUserDefAttrs deletes stale user defined attributes
// for each app's retention threshold.
func deleteUserDefAttrs(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("user_def_attrs").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale user defined attributes for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale user defined attributes")
	}
}

// deleteSpanUserDefAttrs deletes stale span user defined attributes
// for each app's retention threshold.
func deleteSpanUserDefAttrs(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("span_user_def_attrs").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale span user defined attributes for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale span user defined attributes")
	}
}

// deleteBugReports deletes stale bug reports for each
// app's retention threshold.
func deleteBugReports(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("bug_reports").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale bug reports for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale bug reports")
	}
}

// deleteSessionsIndex deletes stale sessions index for each
// app's retention threshold.
func deleteSessionsIndex(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("sessions_index").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("first_event_timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale sessions index for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale sessions index")
	}
}

// deleteSessions deletes stale sessions for each
// app's retention threshold.
func deleteSessions(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("sessions").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("first_event_timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale sessions for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale sessions")
	}
}

// deleteJourneys deletes stale journeys for each
// app's retention threshold.
func deleteJourneys(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("journeys").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale journeys for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale journeys")
	}
}

// deleteSpans deletes stale spans for each
// app's retention threshold.
func deleteSpans(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("spans").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("start_time < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale spans for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale spans")
	}
}

// deleteEventsAndAttachments deletes stale events and their attachments for each
// app's retention threshold.
func deleteEventsAndAttachments(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {

		// Fetch attachments for current app's stale events
		fetchAttachmentsStmt := sqlf.
			Select("attachments").
			From("events final").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		defer fetchAttachmentsStmt.Close()

		attachmentRows, err := server.Server.RchPool.Query(ctx, fetchAttachmentsStmt.String(), fetchAttachmentsStmt.Args()...)
		if err != nil {
			fmt.Printf("Failed to fetch stale events from ClickHouse: %v\n", err)
			fetchAttachmentsStmt.Close()
			continue
		}

		var attachmentsJSON string
		var attachments []Attachment
		var staleAttachments []Attachment
		for attachmentRows.Next() {
			if err := attachmentRows.Scan(&attachmentsJSON); err != nil {
				fmt.Printf("Failed to scan attachment: %v\n", err)
				continue
			}

			// If event has attachments, unmarshall it. If it can't be unmarshalled, continue. Events with
			// attachments that fail unmarshalling will not be included in stale list.
			if attachmentsJSON != "[]" {
				if err := json.Unmarshal([]byte(attachmentsJSON), &attachments); err != nil {
					fmt.Printf("Failed to unmarshal attachment JSON attachmentJSON: %v, error: %v\n", attachmentsJSON, err)
					continue
				}

				staleAttachments = append(staleAttachments, attachments...)
			}
		}

		// Delete attachments from object storage
		if err := deleteAttachments(ctx, staleAttachments); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete attachments: %v\n", err)
		}

		// Delete stale events
		stmt := sqlf.
			DeleteFrom("events").
			Where("team_id = toUUID(?)", retention.TeamID).
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
			errCount += 1
			fmt.Printf("Failed to delete stale events for app id %q: %v\n", retention.AppID, err)
			stmt.Close()
			continue
		}

		stmt.Close()
	}

	if errCount < 1 {
		fmt.Println("Successfully deleted stale events and their attachments")
	}
}

func deleteAttachments(ctx context.Context, attachments []Attachment) (err error) {
	config := server.Server.Config
	if config.IsCloud() {
		client, errStorage := storage.NewClient(ctx)
		if errStorage != nil {
			return
		}

		defer func() {
			if err := client.Close(); err != nil {
				fmt.Printf("Failed to close storage client: %v\n", err)
			}
		}()

		bucket := client.Bucket(config.AttachmentsBucket)
		var failed []string

		for _, at := range attachments {
			o := bucket.Object(at.Key)
			if err := o.Delete(ctx); err != nil {
				fmt.Printf("Failed to delete attachment %q: %v\n", at.Key, err)
				failed = append(failed, at.Key)
			}
		}

		if len(failed) > 0 {
			fmt.Printf("Failed to delete %d attachments: %v\n", len(failed), failed)
		}

		return
	}

	objectIds := []types.ObjectIdentifier{}

	for _, at := range attachments {
		objectIds = append(objectIds, types.ObjectIdentifier{
			Key: aws.String(at.Key),
		})
	}

	deleteObjectsInput := &s3.DeleteObjectsInput{
		Bucket: aws.String(server.Server.Config.AttachmentsBucket),
		Delete: &types.Delete{Objects: objectIds},
	}

	var credentialsProvider aws.CredentialsProviderFunc = func(ctx context.Context) (aws.Credentials, error) {
		return aws.Credentials{
			AccessKeyID:     server.Server.Config.AttachmentsAccessKey,
			SecretAccessKey: server.Server.Config.AttachmentsSecretAccessKey,
		}, nil
	}

	awsConfig := &aws.Config{
		Region:      server.Server.Config.AttachmentsBucketRegion,
		Credentials: credentialsProvider,
	}

	client := s3.NewFromConfig(*awsConfig, func(o *s3.Options) {
		endpoint := server.Server.Config.AWSEndpoint
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = *aws.Bool(true)
		}
	})

	_, err = client.DeleteObjects(ctx, deleteObjectsInput)
	if err != nil {
		return err
	}

	return
}

// deleteStaleAlerts deletes stale alerts for each
// app's retention threshold.
func deleteStaleAlerts(ctx context.Context, retentions []AppRetention) {
	for _, retention := range retentions {
		stmt := sqlf.PostgreSQL.DeleteFrom("alerts").
			Where("app_id = ?", retention.AppID).
			Where("created_at < ?", retention.Threshold)

		defer stmt.Close()

		_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
		if err != nil {
			fmt.Printf("Failed to delete stale alerts: %v\n", err)
			return
		}
	}

	fmt.Printf("Succesfully deleted stale alerts\n")
}

// deleteStalePendingAlertMessages deletes stale pending alert messages
func deleteStalePendingAlertMessages(ctx context.Context) {
	threshold := time.Now().Add(-24 * time.Hour) // 1 day expiry
	stmt := sqlf.PostgreSQL.DeleteFrom("pending_alert_messages").
		Where("created_at < ?", threshold)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		fmt.Printf("Failed to delete stale pending alert messages: %v\n", err)
		return
	}

	fmt.Printf("Succesfully deleted stale pending alert messages\n")
}

// fetchAppRetentions fetches retention period
// for each app.
func fetchAppRetentions(ctx context.Context) (retentions []AppRetention, err error) {
	// Fetch retention periods for each app
	stmt := sqlf.PostgreSQL.
		From("apps").
		Select("id").
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
			fmt.Printf("Failed to scan row: %v\n", err)
			continue
		}

		retention.Threshold = time.Now().UTC().AddDate(0, 0, -period)
		retentions = append(retentions, retention)
	}

	err = rows.Err()

	return
}
