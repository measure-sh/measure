// Package alertmsg builds the plain text messages and dashboard URLs
// for crash spike, ANR spike, and bug report alerts. The alerts service
// stores each message in the alerts table and hands the same string to
// the email and Slack channels, so the builders emit no markup: each
// channel applies its own formatting, email by escaping the text into
// HTML and Slack by escaping mrkdwn control characters.
package alertmsg

import "fmt"

// CrashSpikeMessage builds the plain text message for a crash spike alert.
func CrashSpikeMessage(file, method, message string) string {
	return fmt.Sprintf("%s: %s() - %s", file, method, message)
}

// AnrSpikeMessage builds the plain text message for an ANR spike alert.
func AnrSpikeMessage(file, method, message string) string {
	return fmt.Sprintf("%s: %s() - %s", file, method, message)
}

// BugReportMessage builds the plain text message for a bug report alert.
func BugReportMessage(description string) string {
	if description == "" {
		return "No description provided."
	}
	return description
}

// CrashSpikeURL builds the dashboard URL for a crash spike alert. A
// non-empty fileName joins the crash type with "@" to form the error
// group name segment of the dashboard route.
func CrashSpikeURL(siteOrigin, teamId, appId, fingerprint, crashType, fileName string) string {
	suffix := ""
	if fileName != "" {
		suffix = "@" + fileName
	}
	return fmt.Sprintf("%s/%s/errors/%s/%s/%s%s", siteOrigin, teamId, appId, fingerprint, crashType, suffix)
}

// AnrSpikeURL builds the dashboard URL for an ANR spike alert. A
// non-empty fileName joins the ANR type with "@" to form the error
// group name segment of the dashboard route.
func AnrSpikeURL(siteOrigin, teamId, appId, fingerprint, anrType, fileName string) string {
	suffix := ""
	if fileName != "" {
		suffix = "@" + fileName
	}
	return fmt.Sprintf("%s/%s/errors/%s/%s/%s%s", siteOrigin, teamId, appId, fingerprint, anrType, suffix)
}

// BugReportURL builds the dashboard URL for a bug report alert.
func BugReportURL(siteOrigin, teamId, appId, bugReportId string) string {
	return fmt.Sprintf("%s/%s/bug_reports/%s/%s", siteOrigin, teamId, appId, bugReportId)
}
