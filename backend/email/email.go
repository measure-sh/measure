package email

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/wneessen/go-mail"
)

// EmailInfo describes an email to be sent or queued.
type EmailInfo struct {
	From        string `json:"from"`
	To          string `json:"to"`
	Subject     string `json:"subject"`
	ContentType string `json:"content_type"`
	Body        string `json:"body"`
}

// MetricData describes a single metric card for the daily summary email.
type MetricData struct {
	Value      string
	Label      string
	HasWarning bool
	HasError   bool
	Subtitle   string
}

// SendEmail sends an email immediately using the provided mail client.
// Use QueueEmail instead to queue an email for later delivery.
func SendEmail(client *mail.Client, info EmailInfo) error {
	if client == nil {
		return fmt.Errorf("email client is not initialized")
	}

	message := mail.NewMsg()
	if err := message.From(info.From); err != nil {
		fmt.Printf("failed to set From address: %s\n", err)
		return err
	}
	if err := message.To(info.To); err != nil {
		fmt.Printf("failed to set To address: %s\n", err)
		return err
	}
	message.Subject(info.Subject)
	message.SetBodyString(mail.ContentType(info.ContentType), info.Body)

	if err := client.DialAndSend(message); err != nil {
		fmt.Printf("failed to send mail: %s\n", err)
		return err
	}

	return nil
}

// QueueEmail inserts an email into the pending_alert_messages table
// for later delivery by the alerts service. Use SendEmail instead
// for immediate delivery.
func QueueEmail(ctx context.Context, pool *pgxpool.Pool, teamID, appID any, info EmailInfo) error {
	if pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	dataJson, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("failed to marshal email data: %w", err)
	}

	insertStmt := sqlf.PostgreSQL.
		InsertInto("pending_alert_messages").
		Set("id", uuid.New()).
		Set("team_id", teamID).
		Set("channel", "email").
		SetExpr("data", "?::jsonb", string(dataJson)).
		Set("created_at", time.Now()).
		Set("updated_at", time.Now())

	if appID == nil {
		insertStmt.SetExpr("app_id", "NULL")
	} else {
		insertStmt.Set("app_id", appID)
	}

	_, err = pool.Exec(ctx, insertStmt.String(), insertStmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to insert pending email: %w", err)
	}

	return nil
}

// QueueEmailForTeam queues the same email payload for each member of a team.
// The "To" field in info is ignored and replaced with each team member's email.
func QueueEmailForTeam(ctx context.Context, pool *pgxpool.Pool, teamID, appID any, info EmailInfo) error {
	if pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	memberStmt := sqlf.PostgreSQL.
		Select("u.email").
		From("team_membership tm").
		Join("users u", "tm.user_id = u.id").
		Where("tm.team_id = ?", teamID)
	defer memberStmt.Close()

	memberRows, err := pool.Query(ctx, memberStmt.String(), memberStmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to fetch team members: %w", err)
	}
	defer memberRows.Close()

	for memberRows.Next() {
		var to string
		if err := memberRows.Scan(&to); err != nil {
			return fmt.Errorf("failed to scan team member email: %w", err)
		}

		pendingEmail := info
		pendingEmail.To = to
		if err := QueueEmail(ctx, pool, teamID, appID, pendingEmail); err != nil {
			return fmt.Errorf("failed to queue email for team member %s: %w", to, err)
		}
	}

	if err := memberRows.Err(); err != nil {
		return fmt.Errorf("failed to iterate team members: %w", err)
	}

	return nil
}

// RenderEmailBody produces a complete HTML email with the standard
// Measure header, footer, and CTA button. This is the single function
// that renders a full HTML document — all email types use this.
func RenderEmailBody(title, contentHTML, ctaText, ctaURL string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
    <title>%s</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Space Mono', monospace; line-height: 1.6; color: #333; background-color: #f8f9fa;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #000000; color: #ffffff; padding: 20px; display: flex; align-items: center; gap: 16px;">
            <img src="https://measure.sh/images/measure_logo.png" alt="measure" style="height: 32px; width: auto; vertical-align: middle;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.5px; font-family: 'Josefin Sans', sans-serif; margin-top: 3px;">%s</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">%s

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="%s" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px; transition: background-color 0.2s ease; font-family: 'Josefin Sans', sans-serif;">
                    %s
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #718096;">
                This notification was sent from <a href="https://measure.sh" style="text-decoration: none; color: inherit; cursor: pointer;"><strong>measure.sh</strong></a>
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #a0aec0;">
                open source tool to monitor mobile apps
            </p>
        </div>
    </div>
</body>
</html>`, title, title, contentHTML, ctaURL, ctaText)
}

// MessageContent wraps a plain text/HTML message in the standard
// styled content div. Used for simple notification emails.
func MessageContent(message string) string {
	return fmt.Sprintf(`
            <!-- Message -->
            <div style="margin-bottom: 32px; font-size: 16px; line-height: 1.6; color: #4a5568;">
                %s
            </div>`, message)
}

// UsageLimitContent renders a usage progress bar and message.
// Used for billing usage threshold notifications.
func UsageLimitContent(message string, threshold int, usageFormatted, maxUnitsFormatted string) string {
	usageBarHTML := fmt.Sprintf(`
            <!-- Usage Bar -->
            <div style="margin-bottom: 32px;">
                <div style="background-color: #e2e8f0; border-radius: 8px; height: 24px; overflow: hidden;">
                    <div style="background-color: %s; height: 100%%; width: %d%%; border-radius: 8px;"></div>
                </div>
                <div style="text-align: center; margin-top: 8px; font-size: 14px; color: #718096;">
                    %s / %s units used
                </div>
            </div>`, getProgressBarColor(threshold), threshold, usageFormatted, maxUnitsFormatted)

	return usageBarHTML + MessageContent(message)
}

// DailySummaryContent renders the date header and metrics grid
// for daily summary emails.
func DailySummaryContent(appName string, date time.Time, metrics []MetricData) string {
	formattedDate := date.Format("January 2, 2006")
	formattedDateShort := date.Format("Jan 2, 2006")
	comparisonDateShort := date.AddDate(0, 0, -1).Format("Jan 2, 2006")

	metricsHTML := ""
	for _, metric := range metrics {
		icon := ""
		if metric.HasError {
			icon = `<div style="position: absolute; top: 12px; right: 12px; width: 20px; height: 20px; background-color: #e7000b; border-radius: 50%;">
   						<table style="width: 100%; height: 100%; margin: 0; padding: 0; border: 0;" cellpadding="0" cellspacing="0">
        					<tr>
            					<td style="text-align: center; vertical-align: middle; color: #ffffff; font-size: 12px; font-weight: bold;">!</td>
        					</tr>
    					</table>
					</div>`
		} else if metric.HasWarning {
			icon = `<div style="position: absolute; top: 12px; right: 12px; width: 20px; height: 20px; background-color: #d08700; border-radius: 50%;">
   						<table style="width: 100%; height: 100%; margin: 0; padding: 0; border: 0;" cellpadding="0" cellspacing="0">
        					<tr>
            					<td style="text-align: center; vertical-align: middle; color: #ffffff; font-size: 12px; font-weight: bold;">!</td>
        					</tr>
    					</table>
					</div>`
		}

		metricsHTML += fmt.Sprintf(`
			<div style="background-color: #ffffff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; position: relative; min-height: 80px;">
				%s
				<div style="font-size: 28px; font-weight: 700; color: #1a202c; margin-bottom: 8px; font-family: 'Space Mono', monospace;">
					%s
				</div>
				<div style="font-size: 14px; color: #4a5568; font-weight: 500;">
					%s
				</div>
				<div style="font-size: 12px; color: #718096; margin-top: 4px;">
					%s
				</div>
			</div>`, icon, metric.Value, metric.Label, metric.Subtitle)
	}

	return fmt.Sprintf(`
            <!-- Date Header -->
            <div style="text-align: center; margin-bottom: 32px;">
                <h2 style="margin: 0; font-size: 18px; color: #2d3748; font-family: 'Josefin Sans', sans-serif; font-weight: 600;">
                    Summary for %s
                </h2>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #718096;">
                    Comparisons are between %s (12:00 AM UTC to 11:59 PM UTC) and %s (12:00 AM UTC to 11:59 PM UTC).
                </p>
            </div>

            <!-- Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 32px;">
                %s
            </div>`, formattedDate, formattedDateShort, comparisonDateShort, metricsHTML)
}

func getProgressBarColor(threshold int) string {
	switch threshold {
	case 75:
		return "#facc15"
	case 90:
		return "#f43f5e"
	case 100:
		return "#e11d48"
	default:
		return "#000000"
	}
}
