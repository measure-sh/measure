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

type StaleData struct {
	AppID         string       `json:"app_id"`
	RetentionDate time.Time    `json:"retention_date"`
	EventIDs      []string     `json:"event_ids"`
	SpanIDs       []string     `json:"span_ids"`
	Attachments   []Attachment `json:"attachments"`
}

type AppRetention struct {
	AppID     string    `json:"app_id"`
	Threshold time.Time `json:"threshold"`
}

func DeleteStaleData(ctx context.Context) {
	// delete shortened filters
	deleteStaleShortenedFilters(ctx)

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

	// delete events, spans and attachments
	staleData := fetchStaleData(ctx, appRetentions)

	for _, st := range staleData {
		// Delete attachments from object storage
		if len(st.Attachments) > 0 {
			fmt.Printf("Deleting %v attachments for app_id: %v\n", len(st.Attachments), st.AppID)

			err := deleteAttachments(ctx, st)

			if err != nil {
				fmt.Printf("Failed to delete %v attachments for app_id: %v, err: %v\n", len(st.Attachments), st.AppID, err)
				return
			}

			fmt.Printf("Deleted %v attachments for app_id: %v\n", len(st.Attachments), st.AppID)
		}

		// Delete events from clickhouse
		if len(st.EventIDs) > 0 {
			fmt.Printf("Deleting %v events from clickhouse for app_id: %v\n", len(st.EventIDs), st.AppID)

			deleteStmt := sqlf.DeleteFrom("default.events").
				Where("app_id = ?", st.AppID).
				Where("timestamp < ?", st.RetentionDate)

			if err := server.Server.ChPool.Exec(ctx, deleteStmt.String(), deleteStmt.Args()...); err != nil {
				fmt.Printf("Failed to delete %v events from clickhouse for app_id: %v, err: %v\n", len(st.EventIDs), st.AppID, err)
				return
			}

			fmt.Printf("Deleted %v events from clickhouse for app_id: %v\n", len(st.EventIDs), st.AppID)
		}

		// Delete spans from clickhouse
		if len(st.SpanIDs) > 0 {
			fmt.Printf("Deleting %v spans from clickhouse for app_id: %v\n", len(st.SpanIDs), st.AppID)

			deleteStmt := sqlf.DeleteFrom("spans").
				Where("app_id = ?", st.AppID).
				Where("start_time < ?", st.RetentionDate)

			if err := server.Server.ChPool.Exec(ctx, deleteStmt.String(), deleteStmt.Args()...); err != nil {
				fmt.Printf("Failed to delete %v spans from clickhouse for app_id: %v, err: %v\n", len(st.SpanIDs), st.AppID, err)
				return
			}

			fmt.Printf("Deleted %v spans from clickhouse for app_id: %v\n", len(st.SpanIDs), st.AppID)
		}
	}

	staleDataJson, _ := json.MarshalIndent(staleData, "", "    ")
	fmt.Printf("Succesfully deleted stale data %v\n", string(staleDataJson))
}

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

func fetchStaleData(ctx context.Context, retentions []AppRetention) (staleData []StaleData) {
	for _, retention := range retentions {
		// Fetch stale events from ClickHouse
		fetchEventsStmt := sqlf.Select("id").
			Select("attachments").
			From("default.events").
			Where("app_id = toUUID(?)", retention.AppID).
			Where("timestamp < ?", retention.Threshold)

		eventRows, err := server.Server.ChPool.Query(ctx, fetchEventsStmt.String(), fetchEventsStmt.Args()...)
		if err != nil {
			fmt.Printf("Failed to fetch stale events from ClickHouse: %v\n", err)
			continue
		}

		var staleEventIDs []string
		var staleAttachments []Attachment
		var eventID string
		var attachmentsJSON string
		var attachments []Attachment
		for eventRows.Next() {
			if err := eventRows.Scan(&eventID, &attachmentsJSON); err != nil {
				fmt.Printf("Failed to scan event ID: %v\n", err)
				continue
			}

			// If event has attachments, unmarshall it. If it can't be unmarshalled, continue. Events with
			// attachments that fail unmarshalling will not be included in stale list.
			if attachmentsJSON != "[]" {
				if err := json.Unmarshal([]byte(attachmentsJSON), &attachments); err != nil {
					fmt.Printf("Failed to unmarshal attachment JSON for event ID: %v, attachmentJSON: %v, error: %v\n", eventID, attachmentsJSON, err)
					continue
				}

				staleAttachments = append(staleAttachments, attachments...)
			}

			staleEventIDs = append(staleEventIDs, eventID)
		}

		// Fetch stale spans from ClickHouse
		fetchSpansStmt := sqlf.Select("span_id").
			From("spans").
			Where("app_id = toUUID(?)", retention.AppID).
			Where("start_time < ?", retention.Threshold)

		spanRows, err := server.Server.ChPool.Query(ctx, fetchSpansStmt.String(), fetchSpansStmt.Args()...)
		if err != nil {
			fmt.Printf("Failed to fetch stale spans from ClickHouse: %v\n", err)
			continue
		}

		var staleSpanIDs []string
		var spanID string
		for spanRows.Next() {
			if err := spanRows.Scan(&spanID); err != nil {
				fmt.Printf("Failed to scan span ID: %v\n", err)
				continue
			}

			staleSpanIDs = append(staleSpanIDs, spanID)
		}

		staleData = append(staleData, StaleData{
			AppID:         retention.AppID,
			RetentionDate: retention.Threshold,
			EventIDs:      staleEventIDs,
			SpanIDs:       staleSpanIDs,
			Attachments:   staleAttachments,
		})
	}

	return
}

func deleteAttachments(ctx context.Context, staleData StaleData) (err error) {
	objectIds := []types.ObjectIdentifier{}

	for _, at := range staleData.Attachments {
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
