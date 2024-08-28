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
	Attachments   []Attachment `json:"attachments"`
}

func DeleteStaleData(ctx context.Context) {
	staleData, err := fetchStaleData(ctx)

	if err != nil {
		fmt.Printf("Failed to fetch stale data: %v\n", err)
		return
	}

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
				fmt.Printf("Failed to delete %v events from clickhouse for app_id: %v, err: %v\n", len(st.Attachments), st.AppID, err)
				return
			}

			fmt.Printf("Deleted %v events from clickhouse for app_id: %v\n", len(st.EventIDs), st.AppID)
		}
	}

	staleDataJson, _ := json.MarshalIndent(staleData, "", "    ")
	fmt.Printf("Succesfully deleted stale data %v\n", string(staleDataJson))
}

func fetchStaleData(ctx context.Context) ([]StaleData, error) {
	var staleData []StaleData

	// Fetch retention periods from PostgreSQL
	stmt := sqlf.PostgreSQL.
		From("public.app_settings").
		Select("app_id").
		Select("retention_period")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	var appID string
	var retentionPeriod int

	// For each app_id and retention_period, fetch stale data
	for rows.Next() {
		if err := rows.Scan(&appID, &retentionPeriod); err != nil {
			fmt.Printf("Failed to scan row: %v\n", err)
			continue
		}

		retentionDate := time.Now().UTC().AddDate(0, 0, -retentionPeriod)

		// Fetch stale events from ClickHouse
		fetchStmt := sqlf.Select("id").
			Select("attachments").
			From("default.events").
			Where("app_id = ?", appID).
			Where("timestamp < ?", retentionDate)

		eventRows, err := server.Server.ChPool.Query(ctx, fetchStmt.String(), fetchStmt.Args()...)
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

		staleData = append(staleData, StaleData{
			AppID:         appID,
			RetentionDate: retentionDate,
			EventIDs:      staleEventIDs,
			Attachments:   staleAttachments,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	} else {
		return staleData, nil
	}
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
