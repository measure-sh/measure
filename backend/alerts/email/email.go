package email

import (
	"backend/alerts/server"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/leporo/sqlf"
	"github.com/wneessen/go-mail"
)

type EmailInfo struct {
	From        string           `json:"from"`
	To          string           `json:"to"`
	Subject     string           `json:"subject"`
	ContentType mail.ContentType `json:"content_type"`
	Body        string           `json:"body"`
}

// SendPendingAlertEmails checks the pending alert messages in the database and sends them as emails.
// It processes up to 250 messages at a time, sending each email with a 1 second delay and deleting
// the message from the database after a successful send. If an error occurs while sending an email,
// it logs the error but continues processing the next messages.
func SendPendingAlertEmails(ctx context.Context) error {
	fmt.Println("Checking pending alert emails...")
	stmt := sqlf.From("pending_alert_messages").
		Select("id, data").
		Where("channel = ?", "email").
		OrderBy("created_at ASC").
		Limit(250)
	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to query pending alert messages: %w", err)
	}
	defer rows.Close()

	type pendingMsg struct {
		ID   string
		Data []byte
	}

	var msgs []pendingMsg
	for rows.Next() {
		var m pendingMsg
		if err := rows.Scan(&m.ID, &m.Data); err != nil {
			fmt.Printf("failed to scan row: %s\n", err)
			continue
		}
		msgs = append(msgs, m)
	}
	if rows.Err() != nil {
		return fmt.Errorf("row error: %w", rows.Err())
	}

	for _, msg := range msgs {
		fmt.Printf("Sending email for msg Id: %v\n", msg.ID)
		var email EmailInfo
		if err := json.Unmarshal(msg.Data, &email); err != nil {
			fmt.Printf("failed to unmarshal email data for id %s: %s\n", msg.ID, err)
			continue
		}
		if err := SendEmail(email); err != nil {
			fmt.Printf("failed to send email for id %s: %s\n", msg.ID, err)
			continue
		}

		// Delete after successful send
		delStmt := sqlf.DeleteFrom("pending_alert_messages").Where("id = ?", msg.ID)
		if _, err := server.Server.PgPool.Exec(ctx, delStmt.String(), delStmt.Args()...); err != nil {
			fmt.Printf("failed to delete pending alert message id %s: %s\n", msg.ID, err)
		}
		time.Sleep(1 * time.Second)
	}

	return nil
}

func SendEmail(email EmailInfo) error {
	client := server.Server.Mail
	if client == nil {
		msg := "email client is not initialized"
		fmt.Println(msg)
		return fmt.Errorf("%s", msg)
	}

	message := mail.NewMsg()
	if err := message.From(email.From); err != nil {
		fmt.Printf("failed to set From address: %s\n", err)
		return err
	}
	if err := message.To(email.To); err != nil {
		fmt.Printf("failed to set To address: %s\n", err)
		return err
	}
	message.Subject(email.Subject)
	message.SetBodyString(email.ContentType, email.Body)

	if err := client.DialAndSend(message); err != nil {
		fmt.Printf("failed to send mail: %s\n", err)
		return err
	}

	return nil
}
