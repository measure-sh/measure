package cleanup

import (
	"backend/cleanup/server"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

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
	AppID     string    `json:"app_id"`
	Threshold time.Time `json:"threshold"`
}

func DeleteStaleData(ctx context.Context) {
	// delete shortened filters
	deleteStaleShortenedFilters(ctx)

	// delete stale invites
	deleteStaleInvites(ctx)

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

	// delete sessions
	deleteSessions(ctx, appRetentions)

	// delete spans
	deleteSpans(ctx, appRetentions)

	// delete events and attachments
	deleteEventsAndAttachments(ctx, appRetentions)

	fmt.Println("Finished cleaning up stale data")
}

// deleteStaleShortenedFilters deletes stale shortened filters that
// have passed the expiry threshold
func deleteStaleShortenedFilters(ctx context.Context) {
	threshold := time.Now().Add(-60 * time.Minute) // 1 hour expiry
	stmt := sqlf.PostgreSQL.DeleteFrom("public.short_filters").
		Where("created_at < ?", threshold)

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
	threshold := time.Now().Add(-48 * time.Hour) // 48 hour expiry
	stmt := sqlf.PostgreSQL.DeleteFrom("public.invites").
		Where("updated_at < ?", threshold)

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
			Where("app_id = toUUID(?)", retention.AppID).
			Where("end_of_month < ?", retention.Threshold)

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
			Where("app_id = toUUID(?)", retention.AppID).
			Where("end_of_month < ?", retention.Threshold)

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

// deleteSessions deletes stale sessions for each
// app's retention threshold.
func deleteSessions(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("sessions").
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

// deleteSpans deletes stale spans for each
// app's retention threshold.
func deleteSpans(ctx context.Context, retentions []AppRetention) {
	errCount := 0
	for _, retention := range retentions {
		stmt := sqlf.
			DeleteFrom("spans").
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
			From("events").
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		attachmentRows, err := server.Server.ChPool.Query(ctx, fetchAttachmentsStmt.String(), fetchAttachmentsStmt.Args()...)
		if err != nil {
			fmt.Printf("Failed to fetch stale events from ClickHouse: %v\n", err)
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
		deleteAttachments(ctx, staleAttachments)

		// Delete stale events
		stmt := sqlf.
			DeleteFrom("events").
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

// fetchAppRetentions fetches retention period
// for each app.
func fetchAppRetentions(ctx context.Context) (retentions []AppRetention, err error) {
	// Fetch retention periods for each app
	stmt := sqlf.PostgreSQL.
		From("app_settings").
		Select("app_id").
		Select("retention_period")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var retention AppRetention
		var period int

		if err := rows.Scan(&retention.AppID, &period); err != nil {
			fmt.Printf("Failed to scan row: %v\n", err)
			continue
		}

		retention.Threshold = time.Now().UTC().AddDate(0, 0, -period)
		retentions = append(retentions, retention)
	}

	err = rows.Err()

	return
}
