// Preview generates HTML files for every email template so they
// can be opened in a browser for visual verification.
//
// Run from the repo root:
//
//	go run backend/libs/email/cmd/preview/
//
// Output is written to backend/libs/email/cmd/preview/output/.
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"backend/libs/email"
)

func applyDailySummaryThresholds(metrics []email.MetricData, goodThreshold, cautionThreshold float64) []email.MetricData {
	out := make([]email.MetricData, 0, len(metrics))
	for _, metric := range metrics {
		item := metric
		item.HasWarning = false
		item.HasError = false

		if metric.Label == "Crash free sessions" || metric.Label == "ANR free sessions" {
			value := strings.TrimSuffix(strings.TrimSpace(metric.Value), "%")
			percent, err := strconv.ParseFloat(value, 64)
			if err == nil {
				if percent < cautionThreshold {
					item.HasError = true
				} else if percent < goodThreshold {
					item.HasWarning = true
				}
			}
		}

		out = append(out, item)
	}
	return out
}

func main() {
	// resolve the directory where this source file lives
	_, src, _, _ := runtime.Caller(0)
	dir := filepath.Join(filepath.Dir(src), "output")
	if err := os.MkdirAll(dir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "failed to create output dir: %v\n", err)
		os.Exit(1)
	}

	type entry struct {
		name string
		body string
	}

	var emails []entry
	add := func(name, body string) {
		emails = append(emails, entry{name, body})
	}

	// --- API: Team emails ---

	_, body := email.AddedToTeamEmail("Acme Corp", "admin", "alice@acme.com", "https://measure.sh", "team-abc")
	add("01-added-to-team.html", body)

	_, body = email.InviteNewUserEmail("alice@acme.com", "developer", "Acme Corp", 7, "https://measure.sh", "inv-123")
	add("02-invite-new-user.html", body)

	_, body = email.InviteExistingUserEmail("alice@acme.com", "developer", "Acme Corp", "https://measure.sh")
	add("03-invite-existing-user.html", body)

	_, body = email.RemovedFromTeamEmail("Acme Corp", "alice@acme.com", "https://measure.sh", "team-abc")
	add("04-removed-from-team.html", body)

	_, body = email.RoleChangedEmail("admin", "alice@acme.com", "Acme Corp", "https://measure.sh", "team-abc")
	add("05-role-changed.html", body)

	// --- Alerts: Crash & ANR ---

	alertMsg := email.CrashAlertMessage(
		"com.example.myapp.MainActivity.java",
		"onCreate",
		"NullPointerException: Attempt to invoke virtual method on a null object reference",
	)
	alertURL := email.CrashAlertURL("https://measure.sh", "team-abc", "app-123", "fingerprint-456", "java.lang.NullPointerException", "")
	_, body = email.CrashSpikeAlertEmail("MyApp", alertMsg, alertURL)
	add("06-crash-spike-alert.html", body)

	alertMsg = email.AnrAlertMessage(
		"com.example.myapp.NetworkService.java",
		"fetchData",
		"Application Not Responding: Input dispatching timed out",
	)
	alertURL = email.AnrAlertURL("https://measure.sh", "team-abc", "app-123", "fingerprint-789", "ANR", "")
	_, body = email.AnrSpikeAlertEmail("MyApp", alertMsg, alertURL)
	add("07-anr-spike-alert.html", body)

	// --- Alerts: Bug Report ---

	alertMsg = email.BugReportAlertMessage("The app crashes when I click the login button after entering a very long password.")
	alertURL = email.BugReportAlertURL("https://measure.sh", "team-abc", "app-123", "bug-report-456")
	_, body = email.BugReportAlertEmail("MyApp", alertMsg, alertURL)
	add("07b-bug-report-alert.html", body)

	// --- Billing: Usage limits ---

	_, body = email.UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", 75)
	add("08-usage-75-percent.html", body)

	_, body = email.UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", 90)
	add("09-usage-90-percent.html", body)

	_, body = email.UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", 100)
	add("10-usage-100-percent.html", body)

	// --- Billing: Subscription ---

	_, body = email.UpgradeEmail("Acme Corp", "team-abc", "https://measure.sh")
	add("11-upgraded-to-pro.html", body)

	_, body = email.ManualDowngradeEmail("Acme Corp", "team-abc", "https://measure.sh")
	add("12-downgraded-to-free.html", body)

	// --- Alerts: Team Daily Summary ---

	summaryDate := time.Date(2026, 2, 15, 0, 0, 0, 0, time.UTC)

	healthyMetrics := []email.MetricData{
		{Value: "12.85K", Label: "Sessions", Subtitle: "Up from 11.65K yesterday", HasWarning: false, HasError: false},
		{Value: "99.72%", Label: "Crash free sessions", Subtitle: "Up from 99.69% yesterday", HasWarning: false, HasError: false},
		{Value: "99.85%", Label: "ANR free sessions", Subtitle: "No change from yesterday", HasWarning: false, HasError: false},
		{Value: "892.35ms", Label: "Cold launch p95", Subtitle: "Down from 937.53ms yesterday", HasWarning: false, HasError: false},
		{Value: "234ms", Label: "Warm launch p95", Subtitle: "Up from 222ms yesterday", HasWarning: false, HasError: false},
		{Value: "98ms", Label: "Hot launch p95", Subtitle: "No change from yesterday", HasWarning: false, HasError: false},
		{Value: "7", Label: "Bug reports", Subtitle: "Down from 10 yesterday", HasWarning: false, HasError: false},
	}

	warningMetrics := []email.MetricData{
		{Value: "8.42K", Label: "Sessions", Subtitle: "Down from 11.62K yesterday", HasWarning: false, HasError: false},
		{Value: "93.1%", Label: "Crash free sessions", Subtitle: "Down from 95.16% yesterday", HasWarning: true, HasError: false},
		{Value: "99.2%", Label: "ANR free sessions", Subtitle: "Down from 100% yesterday", HasWarning: false, HasError: false},
		{Value: "1450.6ms", Label: "Cold launch p95", Subtitle: "Up from 1130.46ms yesterday", HasWarning: false, HasError: false},
		{Value: "567ms", Label: "Warm launch p95", Subtitle: "Up from 366ms yesterday", HasWarning: false, HasError: false},
		{Value: "145ms", Label: "Hot launch p95", Subtitle: "Up from 98ms yesterday", HasWarning: false, HasError: false},
		{Value: "18", Label: "Bug reports", Subtitle: "Up from 12 yesterday", HasWarning: false, HasError: false},
	}

	errorMetrics := []email.MetricData{
		{Value: "3.1K", Label: "Sessions", Subtitle: "Down from 12.6K yesterday", HasWarning: false, HasError: false},
		{Value: "87.3%", Label: "Crash free sessions", Subtitle: "Down from 94.02% yesterday", HasWarning: false, HasError: true},
		{Value: "82.1%", Label: "ANR free sessions", Subtitle: "Down from 90.88% yesterday", HasWarning: false, HasError: true},
		{Value: "2340ms", Label: "Cold launch p95", Subtitle: "Up from 1240ms yesterday", HasWarning: false, HasError: false},
		{Value: "890ms", Label: "Warm launch p95", Subtitle: "Up from 366ms yesterday", HasWarning: false, HasError: false},
		{Value: "312ms", Label: "Hot launch p95", Subtitle: "Up from 98ms yesterday", HasWarning: false, HasError: false},
	}

	noDataMetrics := []email.MetricData{
		{Value: "412", Label: "Sessions", Subtitle: "Down from 1.2K yesterday", HasWarning: false, HasError: false},
		{Value: "100%", Label: "Crash free sessions", Subtitle: "Up from 99.42% yesterday", HasWarning: false, HasError: false},
		{Value: "100%", Label: "ANR free sessions", Subtitle: "No change from yesterday", HasWarning: false, HasError: false},
		{Value: "1024ms", Label: "Cold launch p95", Subtitle: "Up from 998.5ms yesterday", HasWarning: false, HasError: false},
		{Value: "No Data", Label: "Warm launch p95", Subtitle: "Was 366ms yesterday", HasWarning: false, HasError: false},
		{Value: "No Data", Label: "Hot launch p95", Subtitle: "No previous day data", HasWarning: false, HasError: false},
	}

	noANRMetrics := []email.MetricData{
		{Value: "6.31K", Label: "Sessions", Subtitle: "Up from 5.98K yesterday", HasWarning: false, HasError: false},
		{Value: "99.81%", Label: "Crash free sessions", Subtitle: "Down from 99.9% yesterday", HasWarning: false, HasError: false},
		{Value: "1180ms", Label: "Cold launch p95", Subtitle: "Up from 1102.4ms yesterday", HasWarning: false, HasError: false},
		{Value: "412ms", Label: "Warm launch p95", Subtitle: "Down from 455ms yesterday", HasWarning: false, HasError: false},
		{Value: "121ms", Label: "Hot launch p95", Subtitle: "No change from yesterday", HasWarning: false, HasError: false},
	}

	multiAppSummary := []email.AppDailySummary{
		{AppName: "Storefront Android", Metrics: healthyMetrics},
		{AppName: "Storefront iOS", Metrics: warningMetrics},
		{AppName: "Courier Android", Metrics: errorMetrics},
		{AppName: "Warehouse Scanner", Metrics: noDataMetrics},
		{AppName: "Kiosk iOS", Metrics: noANRMetrics},
	}
	_, body = email.TeamDailySummaryEmail("Acme Corp", summaryDate, multiAppSummary, "https://measure.sh", "team-abc")
	add("14-team-daily-summary-multi-app.html", body)

	customThresholdMetrics := []email.MetricData{
		{Value: "7.89K", Label: "Sessions", Subtitle: "Down from 8.43K yesterday", HasWarning: false, HasError: false},
		{Value: "91.2%", Label: "Crash free sessions", Subtitle: "Down from 93.6% yesterday", HasWarning: false, HasError: false},
		{Value: "88.6%", Label: "ANR free sessions", Subtitle: "Down from 90.1% yesterday", HasWarning: false, HasError: false},
		{Value: "1120ms", Label: "Cold launch p95", Subtitle: "Up from 940ms yesterday", HasWarning: false, HasError: false},
		{Value: "498ms", Label: "Warm launch p95", Subtitle: "Up from 421ms yesterday", HasWarning: false, HasError: false},
		{Value: "132ms", Label: "Hot launch p95", Subtitle: "Up from 111ms yesterday", HasWarning: false, HasError: false},
	}
	_, body = email.TeamDailySummaryEmail(
		"Acme Corp",
		summaryDate,
		[]email.AppDailySummary{{AppName: "Storefront Android", Metrics: applyDailySummaryThresholds(customThresholdMetrics, 98, 90)}},
		"https://measure.sh",
		"team-abc",
	)
	add("15-team-daily-summary-custom-thresholds-strict.html", body)

	_, body = email.TeamDailySummaryEmail(
		"Acme Corp",
		summaryDate,
		[]email.AppDailySummary{{AppName: "Storefront Android", Metrics: applyDailySummaryThresholds(customThresholdMetrics, 92, 85)}},
		"https://measure.sh",
		"team-abc",
	)
	add("16-team-daily-summary-custom-thresholds-lenient.html", body)

	singleAppSummary := []email.AppDailySummary{
		{AppName: "Storefront Android", Metrics: healthyMetrics},
	}
	_, body = email.TeamDailySummaryEmail("Acme Corp", summaryDate, singleAppSummary, "https://measure.sh", "team-abc")
	add("17-team-daily-summary-single-app.html", body)

	for _, e := range emails {
		path := filepath.Join(dir, e.name)
		if err := os.WriteFile(path, []byte(e.body), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "failed to write %s: %v\n", e.name, err)
			os.Exit(1)
		}
	}

	fmt.Println(dir)
}
