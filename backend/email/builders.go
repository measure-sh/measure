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

// DailySummaryEmail builds the daily summary email for an app.
func DailySummaryEmail(appName string, date time.Time, metrics []MetricData, siteOrigin, teamId, appId string) (subject, body string) {
	subject = appName + " Daily Summary"
	dashboardURL := fmt.Sprintf("%s/%s/overview?a=%s", siteOrigin, teamId, appId)
	body = RenderEmailBody(subject, DailySummaryContent(appName, date, metrics), "View Full Dashboard", dashboardURL)
	return
}

// UsageLimitEmail builds the usage limit threshold notification email.
func UsageLimitEmail(teamName, teamId, siteOrigin string, threshold int, usage, maxUnits uint64) (subject, body string) {
	dashboardURL := fmt.Sprintf("%s/%s/usage", siteOrigin, teamId)
	usageFormatted := FormatNumber(usage)
	maxUnitsFormatted := FormatNumber(maxUnits)

	var title, message, ctaText string
	switch threshold {
	case 75:
		subject = fmt.Sprintf("%s - 75%% of Usage Limit Reached", teamName)
		title = "75% Usage Limit Reached"
		message = fmt.Sprintf(`Your team <strong>%s</strong> has used <strong>%s</strong> of <strong>%s</strong> units this month (75%% of your limit).<br><br>Consider upgrading to Measure Pro for unlimited usage and extended data retention.`, teamName, usageFormatted, maxUnitsFormatted)
		ctaText = "Upgrade to Measure Pro"
	case 90:
		subject = fmt.Sprintf("%s - 90%% of Usage Limit Reached", teamName)
		title = "90% Usage Limit Reached"
		message = fmt.Sprintf(`Your team <strong>%s</strong> has used <strong>%s</strong> of <strong>%s</strong> units this month (90%% of your limit).<br><br>You're almost at your limit. Data ingestion will be paused when you reach 100%%. Upgrade to Measure Pro for unlimited usage.`, teamName, usageFormatted, maxUnitsFormatted)
		ctaText = "Upgrade to Measure Pro"
	case 100:
		subject = fmt.Sprintf("%s - Usage Limit Reached", teamName)
		title = "Usage Limit Reached"
		message = fmt.Sprintf(`Your team <strong>%s</strong> has reached its usage limit of <strong>%s</strong> units this month.<br><br>Data ingestion has been paused. Upgrade to Measure Pro to resume data collection with unlimited usage.`, teamName, maxUnitsFormatted)
		ctaText = "Upgrade to Measure Pro"
	}

	contentHTML := UsageLimitContent(message, threshold, usageFormatted, maxUnitsFormatted)
	body = RenderEmailBody(title, contentHTML, ctaText, dashboardURL)
	return
}

// SubscriptionFailureEmail builds the subscription cancellation notification email.
func SubscriptionFailureEmail(teamName, teamId, siteOrigin string) (subject, body string) {
	subject = fmt.Sprintf("%s - Subscription Canceled", teamName)
	title := "Subscription Canceled"
	dashboardURL := fmt.Sprintf("%s/%s/usage", siteOrigin, teamId)
	message := fmt.Sprintf(`The subscription for your team <strong>%s</strong> has been canceled due to a payment issue.<br><br>Your team has been downgraded to the free plan. Subscribe again to resume pro features.`, teamName)
	body = RenderEmailBody(title, MessageContent(message), "Subscribe to Measure Pro", dashboardURL)
	return
}

// UpgradeEmail builds the upgrade notification email.
func UpgradeEmail(teamName, teamId, siteOrigin string, maxRetentionDays int) (subject, body string) {
	subject = fmt.Sprintf("%s - Upgraded to Measure Pro", teamName)
	title := "Upgraded to Measure Pro"
	dashboardURL := fmt.Sprintf("%s/%s/usage", siteOrigin, teamId)
	message := fmt.Sprintf(`Your team <strong>%s</strong> has been upgraded to Measure Pro!<br><br>You now have unlimited usage and up to %d days of data retention.`, teamName, maxRetentionDays)
	body = RenderEmailBody(title, MessageContent(message), "Go to Dashboard", dashboardURL)
	return
}

// ManualDowngradeEmail builds the manual downgrade notification email.
func ManualDowngradeEmail(teamName, teamId, siteOrigin string, freePlanMaxUnits uint64, freePlanMaxRetentionDays int) (subject, body string) {
	subject = fmt.Sprintf("%s - Downgraded to Free Plan", teamName)
	title := "Downgraded to Free Plan"
	dashboardURL := fmt.Sprintf("%s/%s/usage", siteOrigin, teamId)
	maxUnitsFormatted := FormatNumber(freePlanMaxUnits)
	message := fmt.Sprintf(`Your team <strong>%s</strong> has been downgraded to the free plan.<br><br>Your usage is now limited to <strong>%s</strong> units per month with <strong>%d</strong> days of data retention.`, teamName, maxUnitsFormatted, freePlanMaxRetentionDays)
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
