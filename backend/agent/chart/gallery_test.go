package chart

import (
	"fmt"
	"html"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type galleryCase struct {
	name string
	note string
	spec Spec
}

var nan = math.NaN()

func dailyLabels(month string, days int) []string {
	labels := make([]string, days)
	for i := range labels {
		labels[i] = fmt.Sprintf("%s %d", month, i+1)
	}
	return labels
}

func hourLabels() []string {
	labels := make([]string, 24)
	for i := range labels {
		labels[i] = fmt.Sprintf("%02d", i)
	}
	return labels
}

// wave returns n values that vary smoothly around base.
func wave(n int, base, amplitude, period, phase float64) []float64 {
	values := make([]float64, n)
	for i := range values {
		values[i] = math.Round(base + amplitude*math.Sin(2*math.Pi*float64(i)/period+phase))
	}
	return values
}

func scaled(values []float64, factor float64) []float64 {
	out := make([]float64, len(values))
	for i, v := range values {
		out[i] = v * factor
	}
	return out
}

func indexLabels(prefix string, n int) []string {
	labels := make([]string, n)
	for i := range labels {
		labels[i] = fmt.Sprintf("%s%d", prefix, i+1)
	}
	return labels
}

var weekdays = []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}

var galleryCases = []galleryCase{
	{
		name: "line-single-series",
		note: "A single series across a week, with its legend beside the title.",
		spec: Spec{Kind: Line, Title: "Sessions", XLabels: weekdays, Series: []Series{
			{Name: "Sessions", Values: []float64{1240, 1385, 1302, 1460, 1522, 980, 870}},
		}},
	},
	{
		name: "line-five-series",
		note: "Five series using the first five palette colors, with the legend beside the title.",
		spec: Spec{Kind: Line, Title: "Crashes by app", XLabels: weekdays, Series: []Series{
			{Name: "Android", Values: []float64{42, 38, 51, 47, 39, 22, 18}},
			{Name: "iOS", Values: []float64{31, 29, 33, 40, 36, 15, 12}},
			{Name: "Web", Values: []float64{12, 15, 11, 9, 14, 6, 5}},
			{Name: "Flutter", Values: []float64{8, 7, 10, 12, 9, 4, 3}},
			{Name: "KMP", Values: []float64{3, 5, 4, 6, 2, 1, 2}},
		}},
	},
	{
		name: "line-funnel-conversion",
		note: "A percent axis, a release marker and one in-progress day.",
		spec: Spec{Kind: Line, Title: "Checkout conversion", XLabels: dailyLabels("Jun", 30), YUnit: "%",
			Series:  []Series{{Name: "Conversion", Values: append(scaled(wave(29, 4230, 120, 7, 0), 0.01), 38.1)}},
			Markers: []Marker{{Index: 17, Label: "2.4.0 released"}}, InProgressCount: 1},
	},
	{
		name: "line-24-hours",
		note: "All 24 hourly labels are shown.",
		spec: Spec{Kind: Line, Title: "Sessions by hour", XLabels: hourLabels(), Series: []Series{
			{Name: "Today", Values: wave(24, 520, 380, 24, -math.Pi/2)},
			{Name: "Yesterday", Values: wave(24, 480, 340, 24, -math.Pi/2+0.3)},
		}},
	},
	{
		name: "line-100-points",
		note: "Labels are spaced evenly, and the last point is labeled.",
		spec: Spec{Kind: Line, Title: "Daily active users", XLabels: indexLabels("Day ", 100), Series: []Series{
			{Name: "DAU", Values: wave(100, 18200, 2600, 13, 0)},
		}},
	},
	{
		name: "line-gap",
		note: "Missing values split the line into separate segments.",
		spec: Spec{Kind: Line, Title: "Cold launch p95", XLabels: dailyLabels("May", 14), YUnit: "ms", Series: []Series{
			{Name: "p95", Values: []float64{1820, 1790, 1850, 1902, nan, nan, nan, nan, 1710, 1690, 1740, 1705, 1680, 1660}},
		}},
	},
	{
		name: "line-isolated-points",
		note: "Alternating missing values leave isolated points with no connecting line.",
		spec: Spec{Kind: Line, Title: "Weekly bug reports", XLabels: indexLabels("W", 10), Series: []Series{
			{Name: "Reports", Values: []float64{14, nan, 18, nan, 11, nan, 22, nan, 17, nan}},
		}},
	},
	{
		name: "line-flat",
		note: "With a zero baseline, a constant series appears at the top tick.",
		spec: Spec{Kind: Line, Title: "Active devices", XLabels: weekdays, Series: []Series{
			{Name: "Devices", Values: []float64{250, 250, 250, 250, 250, 250, 250}},
		}},
	},
	{
		name: "line-all-zeros",
		note: "Zero values place the line on the bottom edge.",
		spec: Spec{Kind: Line, Title: "Fatal crashes", XLabels: weekdays, Series: []Series{
			{Name: "Fatal", Values: []float64{0, 0, 0, 0, 0, 0, 0}},
		}},
	},
	{
		name: "line-negative",
		note: "Values on both sides of zero, with a zero line.",
		spec: Spec{Kind: Line, Title: "Week over week change", XLabels: indexLabels("W", 12), YUnit: "%", Series: []Series{
			{Name: "Sessions", Values: []float64{4.2, 2.1, -1.5, -3.8, -0.4, 1.9, 5.6, 3.3, -2.2, -6.1, -1.0, 2.7}},
			{Name: "Crashes", Values: []float64{-2.0, -4.5, 1.2, 3.1, 0.6, -1.1, -3.4, -0.2, 2.5, 4.8, 1.7, -0.9}},
		}},
	},
	{
		name: "line-millions",
		note: "Large values use K and M suffixes on the axis.",
		spec: Spec{Kind: Line, Title: "Events ingested", XLabels: dailyLabels("Aug", 10), Series: []Series{
			{Name: "Events", Values: scaled(wave(10, 3100, 900, 6, 0), 1000)},
		}},
	},
	{
		name: "line-small-decimals",
		note: "Tick labels use the decimal precision needed for the step.",
		spec: Spec{Kind: Line, Title: "Crash rate", XLabels: weekdays, YUnit: "%", Series: []Series{
			{Name: "Crash rate", Values: []float64{0.012, 0.018, 0.015, 0.021, 0.009, 0.011, 0.014}},
		}},
	},
	{
		name: "line-unit-ms",
		note: "The unit appears on tick labels, and the plot leaves room for them.",
		spec: Spec{Kind: Line, Title: "API latency p50", XLabels: weekdays, YUnit: "ms", Series: []Series{
			{Name: "p50", Values: []float64{12400, 13100, 12850, 14200, 13900, 11800, 11200}},
		}},
	},
	{
		name: "line-two-points",
		note: "With two points, the line spans the plot from edge to edge.",
		spec: Spec{Kind: Line, Title: "Sessions", XLabels: []string{"Last week", "This week"}, Series: []Series{
			{Name: "Sessions", Values: []float64{8420, 9135}},
		}},
	},
	{
		name: "line-one-point",
		note: "A single point appears at the center of the plot.",
		spec: Spec{Kind: Line, Title: "Sessions", XLabels: []string{"Today"}, Series: []Series{
			{Name: "Sessions", Values: []float64{1240}},
		}},
	},
	{
		name: "line-all-in-progress",
		note: "All points are in progress, so the band covers the plot and the line is dashed.",
		spec: Spec{Kind: Line, Title: "Sessions today", XLabels: hourLabels()[:10], Series: []Series{
			{Name: "Sessions", Values: wave(10, 300, 120, 12, -math.Pi/2)},
		}, InProgressCount: 10},
	},
	{
		name: "line-several-in-progress",
		note: "The last three weeks are in progress; the solid line ends at the last completed week.",
		spec: Spec{Kind: Line, Title: "Weekly conversion", XLabels: indexLabels("W", 12), YUnit: "%", Series: []Series{
			{Name: "Signup", Values: []float64{31.2, 32.0, 30.8, 33.1, 34.0, 33.6, 35.2, 34.8, 36.1, 35.0, 33.9, 30.2}},
			{Name: "Purchase", Values: []float64{8.1, 8.4, 7.9, 8.8, 9.2, 9.0, 9.6, 9.4, 9.9, 9.1, 8.2, 6.0}},
		}, InProgressCount: 3},
	},
	{
		name: "line-markers",
		note: "Markers at the first and last x positions stay inside the plot. Nearby markers use separate rows.",
		spec: Spec{Kind: Line, Title: "Crash-free sessions", XLabels: dailyLabels("Jul", 20), YUnit: "%", Series: []Series{
			{Name: "Crash-free", Values: scaled(wave(20, 9940, 30, 9, 0), 0.01)},
		}, Markers: []Marker{
			{Index: 0, Label: "1.8.0 released"},
			{Index: 1, Label: "1.8.1 hotfix"},
			{Index: 19, Label: "Payments outage"},
		}},
	},
	{
		name: "line-marker-long-label",
		note: "A marker label of 40 characters is cut with an ellipsis at 160 pixels.",
		spec: Spec{Kind: Line, Title: "Sessions", XLabels: dailyLabels("Oct", 14), Series: []Series{
			{Name: "Sessions", Values: wave(14, 5200, 800, 7, 0)},
		}, Markers: []Marker{{Index: 6, Label: "Rolled out new onboarding flow to all us"}}},
	},
	{
		name: "line-long-title",
		note: "A long title does not leave room for the legend, so the legend goes below it.",
		spec: Spec{Kind: Line, Title: "Median cold launch time across all Android devices for the last two weeks", XLabels: dailyLabels("Nov", 14), YUnit: "ms", Series: []Series{
			{Name: "Cold launch", Values: wave(14, 1450, 160, 7, 0)},
			{Name: "Warm launch", Values: wave(14, 620, 90, 7, 1)},
		}},
	},
	{
		name: "line-wrapping-legend",
		note: "Five long series names wrap into rows inside the content width. Entries on a row share a baseline.",
		spec: Spec{Kind: Line, Title: "Errors by screen", XLabels: weekdays, Series: []Series{
			{Name: "CheckoutActivity (payment step)", Values: []float64{12, 14, 11, 16, 15, 8, 7}},
			{Name: "ProductDetailFragment", Values: []float64{9, 8, 10, 7, 11, 5, 4}},
			{Name: "SearchResultsScreen with filters", Values: []float64{6, 7, 5, 8, 6, 3, 2}},
			{Name: "OnboardingCarouselView", Values: []float64{3, 4, 2, 5, 3, 1, 1}},
			{Name: "Settings > Notifications > Quiet hours", Values: []float64{1, 2, 1, 3, 2, 1, 0}},
		}},
	},
	{
		name: "line-truncated-title",
		note: "A title wider than the canvas ends with an ellipsis.",
		spec: Spec{Kind: Line, Title: "Number of sessions with at least one handled exception on the checkout screen for users on the beta channel, grouped by day, compared with last month", XLabels: weekdays, Series: []Series{
			{Name: "Sessions", Values: []float64{310, 295, 340, 362, 318, 205, 190}},
		}},
	},
	{
		name: "bar-single-series",
		note: "One series over five categories. Bars take 70% of their band.",
		spec: Spec{Kind: Bar, Title: "Crashes by OS version", XLabels: []string{"Android 11", "Android 12", "Android 13", "Android 14", "Android 15"}, Series: []Series{
			{Name: "Crashes", Values: []float64{182, 240, 315, 198, 96}},
		}},
	},
	{
		name: "bar-api-paths",
		note: "Two series grouped, with long API paths as labels. Missing values show n/a in their lane, and labels rotate when they do not fit.",
		spec: Spec{Kind: Bar, Title: "Endpoint latency p95", YUnit: "ms", XLabels: []string{"/api/payment-methods", "/api/cart/items", "/api/products/search", "/api/users/me/preferences", "/api/orders/history"}, Series: []Series{
			{Name: "Android", Values: []float64{420, 310, nan, 280, 650}},
			{Name: "iOS", Values: []float64{390, nan, 520, 240, 610}},
		}},
	},
	{
		name: "bar-five-series",
		note: "Five series grouped in each band with 2 px between lanes.",
		spec: Spec{Kind: Bar, Title: "Sessions by app", XLabels: []string{"Mon", "Tue", "Wed", "Thu"}, Series: []Series{
			{Name: "Android", Values: []float64{5200, 5400, 5100, 5600}},
			{Name: "iOS", Values: []float64{4100, 4300, 4250, 4400}},
			{Name: "Web", Values: []float64{1800, 1900, 1750, 2000}},
			{Name: "Flutter", Values: []float64{950, 1020, 980, 1100}},
			{Name: "KMP", Values: []float64{300, 340, 320, 360}},
		}},
	},
	{
		name: "bar-disjoint",
		note: "Each category has a value in only one series; the bars share a centered lane.",
		spec: Spec{Kind: Bar, Title: "Crashes by platform", XLabels: []string{"Android", "iOS", "Web"}, Series: []Series{
			{Name: "Mobile", Values: []float64{320, 210, math.NaN()}},
			{Name: "Web", Values: []float64{math.NaN(), math.NaN(), 85}},
		}},
	},
	{
		name: "bar-two-categories",
		note: "Two categories: bars stop at 64 px wide and stay centered.",
		spec: Spec{Kind: Bar, Title: "Crash-free users", YUnit: "%", XLabels: []string{"1.8.0", "1.9.0"}, Series: []Series{
			{Name: "Crash-free", Values: []float64{99.2, 99.6}},
		}},
	},
	{
		name: "bar-40-categories",
		note: "40 categories. Rotated labels still fit, so every category has a label.",
		spec: Spec{Kind: Bar, Title: "Errors by device", XLabels: indexLabels("Pixel ", 40), Series: []Series{
			{Name: "Errors", Values: wave(40, 60, 35, 11, 0)},
		}},
	},
	{
		name: "bar-100-categories",
		note: "Rotated labels collide, so labels are thinned from the last category back.",
		spec: Spec{Kind: Bar, Title: "Daily crashes", XLabels: indexLabels("D", 100), Series: []Series{
			{Name: "Crashes", Values: wave(100, 40, 25, 17, 0)},
		}},
	},
	{
		name: "bar-negative",
		note: "Negative and positive values. Bars grow from the zero line in both directions.",
		spec: Spec{Kind: Bar, Title: "Change in sessions", YUnit: "%", XLabels: []string{"Android", "iOS", "Web", "Flutter", "KMP"}, Series: []Series{
			{Name: "Change", Values: []float64{12.5, -4.2, 3.1, -9.8, 0.7}},
		}},
	},
	{
		name: "bar-zero-and-missing",
		note: "A real 0 draws no bar and no label. A missing value draws n/a.",
		spec: Spec{Kind: Bar, Title: "ANRs by build", XLabels: []string{"1.7.0", "1.8.0", "1.9.0", "2.0.0"}, Series: []Series{
			{Name: "ANRs", Values: []float64{14, 0, nan, 9}},
		}},
	},
	{
		name: "bar-in-progress-marker",
		note: "The last week is in progress and a marker is on it. The bar is drawn normally over the band.",
		spec: Spec{Kind: Bar, Title: "Weekly sessions", XLabels: []string{"Jun 2", "Jun 9", "Jun 16", "Jun 23", "Jun 30"}, Series: []Series{
			{Name: "Sessions", Values: []float64{24100, 25800, 23900, 26500, 11200}},
		}, Markers: []Marker{{Index: 4, Label: "2.0.0 released"}}, InProgressCount: 1},
	},
	{
		name: "bar-long-labels",
		note: "Long category labels rotate and are shortened to 10 characters plus an ellipsis.",
		spec: Spec{Kind: Bar, Title: "Errors by exception", XLabels: []string{
			"java.lang.IllegalStateException: Fragment not attached to a context",
			"kotlinx.coroutines.JobCancellationException",
			"java.net.SocketTimeoutException: timeout",
			"android.database.sqlite.SQLiteDatabaseLockedException",
			"OutOfMemoryError: Failed to allocate a 524304 byte allocation",
		}, Series: []Series{
			{Name: "Errors", Values: []float64{482, 315, 290, 120, 64}},
		}},
	},
	{
		name: "bar-non-ascii",
		note: "The font supports accented Latin labels.",
		spec: Spec{Kind: Bar, Title: "Sessions by country", XLabels: []string{"España", "Österreich", "São Paulo", "Côte d’Ivoire", "Türkiye"}, Series: []Series{
			{Name: "Sessions", Values: []float64{1820, 940, 1310, 260, 2210}},
		}},
	},
}

// TestGallery writes every gallery case as a PNG and an index page that
// shows them, for review by eye. Set CHART_GALLERY_DIR to the output
// directory to run it.
func TestGallery(t *testing.T) {
	dir := os.Getenv("CHART_GALLERY_DIR")
	if dir == "" {
		t.Skip("set CHART_GALLERY_DIR to write the gallery")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	var page strings.Builder
	page.WriteString(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chart gallery</title>
<style>
body { background: #1a1a1a; color: #fafafa; font-family: system-ui, -apple-system, sans-serif; margin: 0; }
main { max-width: 840px; margin: 0 auto; padding: 24px 16px; }
section { margin-bottom: 40px; }
h2 { font-size: 16px; font-weight: 500; margin: 0 0 4px; }
p { color: #a1a1a1; font-size: 14px; margin: 0 0 12px; }
img { display: block; max-width: 100%; height: auto; }
</style>
</head>
<body>
<main>
<h1>Chart gallery</h1>
`)
	for _, gc := range galleryCases {
		png, err := Render(gc.spec)
		if err != nil {
			t.Fatalf("%s: %v", gc.name, err)
		}
		if err := os.WriteFile(filepath.Join(dir, gc.name+".png"), png, 0o644); err != nil {
			t.Fatal(err)
		}
		fmt.Fprintf(&page, "<section>\n<h2>%s</h2>\n<p>%s</p>\n<img src=\"%s.png\" alt=\"%s\">\n</section>\n",
			html.EscapeString(gc.name), html.EscapeString(gc.note), html.EscapeString(gc.name), html.EscapeString(gc.spec.Title))
	}
	page.WriteString("</main>\n</body>\n</html>\n")
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(page.String()), 0o644); err != nil {
		t.Fatal(err)
	}
}
