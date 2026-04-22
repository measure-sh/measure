package email

import (
	"fmt"
	"time"
)

// AddedToTeamEmail builds the email sent when a user is added to a team.
func AddedToTeamEmail(teamName, role, addedByEmail, siteOrigin, teamId string) (subject, body string) {
	subject = "Added to Measure team"
	msg := fmt.Sprintf("You have been added to team <b>%s</b> as <b>%s</b> by <b>%s</b>", teamName, role, addedByEmail)
	url := siteOrigin + "/" + teamId + "/overview"
	body = RenderEmailBody(subject, MessageContent(msg), "Go to Dashboard", url)
	return
}

// InviteNewUserEmail builds the email sent when a new user is invited to a team.
func InviteNewUserEmail(inviterEmail, role, teamName string, validityDays int, siteOrigin, inviteId string) (subject, body string) {
	subject = "Invitation to join Measure"
	dayStr := "day"
	if validityDays != 1 {
		dayStr = "days"
	}
	msg := fmt.Sprintf("You have been invited by <b>%s</b> as <b>%s</b> in team <b>%s</b>! <br/><br/>This invite is valid for <b>%d %s</b>.", inviterEmail, role, teamName, validityDays, dayStr)
	url := siteOrigin + "/auth/login?inviteId=" + inviteId
	body = RenderEmailBody(subject, MessageContent(msg), "Join Team", url)
	return
}

// InviteExistingUserEmail builds the email sent when an existing user is invited to a team.
func InviteExistingUserEmail(inviterEmail, role, teamName, siteOrigin string) (subject, body string) {
	subject = "Invitation to join Measure"
	msg := fmt.Sprintf("You have been invited by <b>%s</b> as <b>%s</b> in team <b>%s</b>!", inviterEmail, role, teamName)
	url := siteOrigin + "/auth/login"
	body = RenderEmailBody(subject, MessageContent(msg), "Join Team", url)
	return
}

// RemovedFromTeamEmail builds the email sent when a user is removed from a team.
func RemovedFromTeamEmail(teamName, removedByEmail, siteOrigin, memberTeamId string) (subject, body string) {
	subject = "Removed from Measure team"
	msg := fmt.Sprintf("You have been removed from team <b>%s</b> by <b>%s</b>", teamName, removedByEmail)
	url := siteOrigin + "/" + memberTeamId + "/overview"
	body = RenderEmailBody(subject, MessageContent(msg), "Go to Dashboard", url)
	return
}

// RoleChangedEmail builds the email sent when a user's role is changed.
func RoleChangedEmail(newRole, changedByEmail, teamName, siteOrigin, teamId string) (subject, body string) {
	subject = "Role changed in Measure team"
	msg := fmt.Sprintf("Your role has been changed to <b>%s</b> by <b>%s</b> in team <b>%s</b>", newRole, changedByEmail, teamName)
	url := siteOrigin + "/" + teamId + "/overview"
	body = RenderEmailBody(subject, MessageContent(msg), "Go to Dashboard", url)
	return
}

// CrashAlertMessage builds the alert message string for crash spike alerts.
// This message is shared across email, DB storage, and Slack notifications.
func CrashAlertMessage(file, method, crashMessage string) string {
	return fmt.Sprintf("Crashes are spiking at:<br><br>%s: %s() - %s", file, method, crashMessage)
}

// AnrAlertMessage builds the alert message string for ANR spike alerts.
// This message is shared across email, DB storage, and Slack notifications.
func AnrAlertMessage(file, method, anrMessage string) string {
	return fmt.Sprintf("ANRs are spiking at:<br><br>%s: %s() - %s", file, method, anrMessage)
}

// CrashAlertURL builds the dashboard URL for a crash spike alert.
// This URL is shared across email, DB storage, and Slack notifications.
func CrashAlertURL(siteOrigin, teamId, appId, fingerprint, crashType, fileName string) string {
	suffix := ""
	if fileName != "" {
		suffix = "@" + fileName
	}
	return fmt.Sprintf("%s/%s/crashes/%s/%s/%s%s", siteOrigin, teamId, appId, fingerprint, crashType, suffix)
}

// AnrAlertURL builds the dashboard URL for an ANR spike alert.
// This URL is shared across email, DB storage, and Slack notifications.
func AnrAlertURL(siteOrigin, teamId, appId, fingerprint, anrType, fileName string) string {
	suffix := ""
	if fileName != "" {
		suffix = "@" + fileName
	}
	return fmt.Sprintf("%s/%s/anrs/%s/%s/%s%s", siteOrigin, teamId, appId, fingerprint, anrType, suffix)
}

// CrashSpikeAlertEmail builds the crash spike alert email.
func CrashSpikeAlertEmail(appName, alertMsg, alertURL string) (subject, body string) {
	subject = appName + " - Crash Spike Alert"
	body = RenderEmailBody(subject, MessageContent(alertMsg), "View in Dashboard", alertURL)
	return
}

// AnrSpikeAlertEmail builds the ANR spike alert email.
func AnrSpikeAlertEmail(appName, alertMsg, alertURL string) (subject, body string) {
	subject = appName + " - ANR Spike Alert"
	body = RenderEmailBody(subject, MessageContent(alertMsg), "View in Dashboard", alertURL)
	return
}

// BugReportAlertMessage builds the alert message string for bug report alerts.
// This message is shared across email and Slack notifications.
func BugReportAlertMessage(description string) string {
	if description == "" {
		description = "No description provided."
	}
	return fmt.Sprintf("A new bug report has been submitted:<br><br>%s", description)
}

// BugReportAlertURL builds the dashboard URL for a bug report alert.
// This URL is shared across email and Slack notifications.
func BugReportAlertURL(siteOrigin, teamId, appId, bugReportId string) string {
	return fmt.Sprintf("%s/%s/bug_reports/%s/%s", siteOrigin, teamId, appId, bugReportId)
}

// BugReportAlertEmail builds the bug report alert email.
func BugReportAlertEmail(appName, alertMsg, alertURL string) (subject, body string) {
	subject = appName + " - New Bug Report"
	body = RenderEmailBody(subject, MessageContent(alertMsg), "View in Dashboard", alertURL)
	return
}

// DailySummaryEmail builds the daily summary email for an app.
func DailySummaryEmail(appName string, date time.Time, metrics []MetricData, siteOrigin, teamId, appId string) (subject, body string) {
	subject = appName + " Daily Summary"
	dashboardURL := fmt.Sprintf("%s/%s/overview?a=%s", siteOrigin, teamId, appId)
	body = RenderEmailBody(subject, DailySummaryContent(appName, date, metrics), "View Full Dashboard", dashboardURL)
	return
}

// UsageLimitEmail builds the usage limit threshold notification email.
// Percentages are safe to include (they're plan-agnostic); absolute byte
// counts are not, since the dashboard is the source of truth for plan limits.
func UsageLimitEmail(teamName, teamId, siteOrigin string, threshold int) (subject, body string) {
	dashboardURL := fmt.Sprintf("%s/%s/usage", siteOrigin, teamId)

	var title, message, ctaText string
	switch threshold {
	case 100:
		subject = fmt.Sprintf("%s - Usage Limit Reached", teamName)
		title = "Usage Limit Reached"
		message = fmt.Sprintf(`Your team <strong>%s</strong> has reached its plan's data limit this month.<br><br>Data ingestion has been paused. Upgrade to Measure Pro to resume.`, teamName)
		ctaText = "Upgrade to Measure Pro"
	default:
		subject = fmt.Sprintf("%s - %d%% of Usage Limit Reached", teamName, threshold)
		title = fmt.Sprintf("%d%% Usage Limit Reached", threshold)
		message = fmt.Sprintf(`Your team <strong>%s</strong> has used <strong>%d%%</strong> of its plan's data limit this month.<br><br>Consider upgrading to Measure Pro for unlimited usage!`, teamName, threshold)
		ctaText = "Upgrade to Measure Pro"
	}

	body = RenderEmailBody(title, UsageLimitContent(message, threshold), ctaText, dashboardURL)
	return
}

// UpgradeEmail builds the upgrade notification email.
func UpgradeEmail(teamName, teamId, siteOrigin string) (subject, body string) {
	subject = fmt.Sprintf("%s - Upgraded to Measure Pro", teamName)
	title := "Upgraded to Measure Pro"
	dashboardURL := fmt.Sprintf("%s/%s/usage", siteOrigin, teamId)
	message := fmt.Sprintf(`Your team <strong>%s</strong> has been upgraded to Measure Pro!`, teamName)
	body = RenderEmailBody(title, MessageContent(message), "Go to Dashboard", dashboardURL)
	return
}

// ManualDowngradeEmail builds the manual downgrade notification email.
func ManualDowngradeEmail(teamName, teamId, siteOrigin string) (subject, body string) {
	subject = fmt.Sprintf("%s - Downgraded to Free Plan", teamName)
	title := "Downgraded to Free Plan"
	dashboardURL := fmt.Sprintf("%s/%s/usage", siteOrigin, teamId)
	message := fmt.Sprintf(`Your team <strong>%s</strong> has been downgraded to the free plan.<br><br>Check your dashboard for the new usage and retention limits.`, teamName)
	body = RenderEmailBody(title, MessageContent(message), "Go to Dashboard", dashboardURL)
	return
}

// FormatNumber formats a number into a human-readable abbreviated string.
// For example: 1000 -> "1K", 1000000 -> "1M", 1500000 -> "1.5M".
func FormatNumber(n uint64) string {
	if n >= 1000000000 {
		val := float64(n) / 1000000000
		if val == float64(int(val)) {
			return fmt.Sprintf("%dB", int(val))
		}
		return fmt.Sprintf("%.1fB", val)
	}
	if n >= 1000000 {
		val := float64(n) / 1000000
		if val == float64(int(val)) {
			return fmt.Sprintf("%dM", int(val))
		}
		return fmt.Sprintf("%.1fM", val)
	}
	if n >= 1000 {
		val := float64(n) / 1000
		if val == float64(int(val)) {
			return fmt.Sprintf("%dK", int(val))
		}
		return fmt.Sprintf("%.1fK", val)
	}
	return fmt.Sprintf("%d", n)
}
