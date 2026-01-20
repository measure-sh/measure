// Preview generates HTML files for every email template so they
// can be opened in a browser for visual verification.
//
// Run from the repo root:
//
//	go run backend/email/cmd/preview/
//
// Output is written to backend/email/cmd/preview/output/.
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"backend/email"
)

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

	// --- Billing: Usage limits ---

	_, body = email.UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", 75, 750000, 1000000)
	add("08-usage-75-percent.html", body)

	_, body = email.UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", 90, 900000, 1000000)
	add("09-usage-90-percent.html", body)

	_, body = email.UsageLimitEmail("Acme Corp", "team-abc", "https://measure.sh", 100, 1000000, 1000000)
	add("10-usage-100-percent.html", body)

	// --- Billing: Subscription ---

	_, body = email.SubscriptionFailureEmail("Acme Corp", "team-abc", "https://measure.sh")
	add("11-subscription-canceled.html", body)

	_, body = email.UpgradeEmail("Acme Corp", "team-abc", "https://measure.sh", 365)
	add("12-upgraded-to-pro.html", body)

	_, body = email.ManualDowngradeEmail("Acme Corp", "team-abc", "https://measure.sh", 1000000, 30)
	add("13-downgraded-to-free.html", body)

	// --- Alerts: Daily Summary ---

	healthyMetrics := []email.MetricData{
		{Value: "12,847", Label: "Sessions", Subtitle: "1,203 greater than yesterday", HasWarning: false, HasError: false},
		{Value: "99.72%", Label: "Crash free sessions", Subtitle: "1.01x better than yesterday", HasWarning: false, HasError: false},
		{Value: "99.85%", Label: "ANR free sessions", Subtitle: "No change from yesterday", HasWarning: false, HasError: false},
		{Value: "892ms", Label: "Cold launch p95", Subtitle: "45ms less than yesterday", HasWarning: false, HasError: false},
		{Value: "234ms", Label: "Warm launch p95", Subtitle: "12ms greater than yesterday", HasWarning: false, HasError: false},
		{Value: "98ms", Label: "Hot launch p95", Subtitle: "No change from yesterday", HasWarning: false, HasError: false},
	}
	_, body = email.DailySummaryEmail("MyApp", time.Date(2026, 2, 15, 0, 0, 0, 0, time.UTC), healthyMetrics, "https://measure.sh", "team-abc", "app-123")
	add("14-daily-summary-healthy.html", body)

	warningMetrics := []email.MetricData{
		{Value: "8,421", Label: "Sessions", Subtitle: "3,200 less than yesterday", HasWarning: false, HasError: false},
		{Value: "93.1%", Label: "Crash free sessions", Subtitle: "0.95x worse than yesterday", HasWarning: true, HasError: false},
		{Value: "99.2%", Label: "ANR free sessions", Subtitle: "No change from yesterday", HasWarning: false, HasError: false},
		{Value: "1,450ms", Label: "Cold launch p95", Subtitle: "320ms greater than yesterday", HasWarning: false, HasError: false},
		{Value: "567ms", Label: "Warm launch p95", Subtitle: "201ms greater than yesterday", HasWarning: false, HasError: false},
		{Value: "145ms", Label: "Hot launch p95", Subtitle: "47ms greater than yesterday", HasWarning: false, HasError: false},
	}
	_, body = email.DailySummaryEmail("MyApp", time.Date(2026, 2, 15, 0, 0, 0, 0, time.UTC), warningMetrics, "https://measure.sh", "team-abc", "app-123")
	add("15-daily-summary-warnings.html", body)

	errorMetrics := []email.MetricData{
		{Value: "3,102", Label: "Sessions", Subtitle: "9,500 less than yesterday", HasWarning: false, HasError: false},
		{Value: "87.3%", Label: "Crash free sessions", Subtitle: "0.89x worse than yesterday", HasWarning: false, HasError: true},
		{Value: "82.1%", Label: "ANR free sessions", Subtitle: "0.84x worse than yesterday", HasWarning: false, HasError: true},
		{Value: "2,340ms", Label: "Cold launch p95", Subtitle: "1,100ms greater than yesterday", HasWarning: false, HasError: false},
		{Value: "890ms", Label: "Warm launch p95", Subtitle: "524ms greater than yesterday", HasWarning: false, HasError: false},
		{Value: "312ms", Label: "Hot launch p95", Subtitle: "214ms greater than yesterday", HasWarning: false, HasError: false},
	}
	_, body = email.DailySummaryEmail("MyApp", time.Date(2026, 2, 15, 0, 0, 0, 0, time.UTC), errorMetrics, "https://measure.sh", "team-abc", "app-123")
	add("16-daily-summary-errors.html", body)

	for _, e := range emails {
		path := filepath.Join(dir, e.name)
		if err := os.WriteFile(path, []byte(e.body), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "failed to write %s: %v\n", e.name, err)
			os.Exit(1)
		}
	}

	fmt.Println(dir)
}
