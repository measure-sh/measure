package agent

import (
	"bytes"
	"fmt"
	"image/png"
	"strings"
	"testing"

	"github.com/go-analyze/charts"
)

func chartArgs(chartType string) string {
	return `{"chart_type":"` + chartType + `","title":"Sessions over time","x_labels":["Jun 1","Jun 2","Jun 3"],"series":[{"name":"Sessions","values":[10,20,15]}]}`
}

func TestRenderChartCall(t *testing.T) {
	for _, chartType := range []string{"line", "bar"} {
		chart, errText := renderChartCall(chartArgs(chartType), 0)
		if errText != "" {
			t.Fatalf("%s: renderChartCall error: %s", chartType, errText)
		}
		if chart.title != "Sessions over time" || chart.filename != "sessions-over-time.png" {
			t.Errorf("%s: title=%q filename=%q", chartType, chart.title, chart.filename)
		}
		img, err := png.Decode(bytes.NewReader(chart.png))
		if err != nil {
			t.Fatalf("%s: output is not a decodable png: %v", chartType, err)
		}
		// Height grows with the header (and rotated labels), bounded by the cap.
		if b := img.Bounds(); b.Dx() != chartWidth || b.Dy() < chartHeight || b.Dy() > chartMaxHeight {
			t.Errorf("%s: dimensions = %dx%d, want %d wide and height in [%d, %d]", chartType, b.Dx(), b.Dy(), chartWidth, chartHeight, chartMaxHeight)
		}
	}
}

func TestRenderChartCallMultiSeries(t *testing.T) {
	args := `{"chart_type":"line","title":"Errors by platform","x_labels":["Mon","Tue"],"series":[{"name":"Android","values":[3,4]},{"name":"iOS","values":[1,2]}]}`
	chart, errText := renderChartCall(args, 0)
	if errText != "" {
		t.Fatalf("renderChartCall error: %s", errText)
	}
	if _, err := png.Decode(bytes.NewReader(chart.png)); err != nil {
		t.Fatalf("output is not a decodable png: %v", err)
	}
}

// TestRenderChartUsesDashboardPalette guards the visual identity: the first
// two series must come out in the dashboard's first two chart colors
// (sky-400, emerald-400) on the dashboard's dark background.
func TestRenderChartUsesDashboardPalette(t *testing.T) {
	args := `{"chart_type":"bar","title":"T","x_labels":["a","b"],"series":[{"name":"one","values":[5,7]},{"name":"two","values":[3,4]}]}`
	chart, errText := renderChartCall(args, 0)
	if errText != "" {
		t.Fatalf("renderChartCall error: %s", errText)
	}
	img, err := png.Decode(bytes.NewReader(chart.png))
	if err != nil {
		t.Fatalf("decode png: %v", err)
	}

	found := map[string]bool{}
	wants := map[string][3]uint32{
		"sky-400":     {0x38, 0xbd, 0xf8},
		"emerald-400": {0x34, 0xd3, 0x99},
		"dark bg":     {0x11, 0x11, 0x11},
	}
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r, g, bl, _ := img.At(x, y).RGBA()
			for name, w := range wants {
				if r>>8 == w[0] && g>>8 == w[1] && bl>>8 == w[2] {
					found[name] = true
				}
			}
		}
	}
	for name := range wants {
		if !found[name] {
			t.Errorf("rendered chart has no %s pixels", name)
		}
	}
}

func TestRenderChartCallRejects(t *testing.T) {
	cases := map[string]string{
		"unknown type":    `{"chart_type":"pie","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}]}`,
		"missing title":   `{"chart_type":"line","title":"  ","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}]}`,
		"single point":    `{"chart_type":"line","title":"T","x_labels":["a"],"series":[{"name":"s","values":[1]}]}`,
		"no series":       `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[]}`,
		"length mismatch": `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2,3]}]}`,
		"undecodable":     `{"chart_type":`,
		"too many series": `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"1","values":[1,2]},{"name":"2","values":[1,2]},{"name":"3","values":[1,2]},{"name":"4","values":[1,2]},{"name":"5","values":[1,2]},{"name":"6","values":[1,2]}]}`,
	}
	for name, args := range cases {
		if _, errText := renderChartCall(args, 0); !strings.HasPrefix(errText, "error:") {
			t.Errorf("%s: expected an error result, got %q", name, errText)
		}
	}
}

func TestRenderChartCallLimit(t *testing.T) {
	// The per-turn cap rejects the render before any work happens.
	_, errText := renderChartCall(chartArgs("line"), maxChartsPerTurn)
	if !strings.Contains(errText, "at most") {
		t.Errorf("expected the chart cap error, got %q", errText)
	}
}

func measurePainter() *charts.Painter {
	return charts.NewPainter(charts.PainterOptions{OutputFormat: charts.ChartOutputPNG, Width: chartWidth, Height: chartHeight})
}

// TestLayoutChartHeader pins the no-overlap guarantees: a short title keeps
// the legend beside it on one row, a long title pushes the legend below it
// left-aligned, and many long names wrap into rows that never cross the
// inner width.
func TestLayoutChartHeader(t *testing.T) {
	p := measurePainter()
	innerW := chartWidth - chartPadding.Left - chartPadding.Right

	t.Run("short title shares the row", func(t *testing.T) {
		l := layoutChartHeader(p, "Sessions", []string{"Sessions", "Crashes"}, innerW)
		for _, item := range l.items {
			if item.y > 8 {
				t.Errorf("item %q at y=%d, want on the title row", item.name, item.y)
			}
		}
		if l.items[0].x <= innerW/2 {
			t.Errorf("legend should be right-aligned, first item at x=%d", l.items[0].x)
		}
	})

	t.Run("long title pushes legend below, left-aligned", func(t *testing.T) {
		title := "A very long chart title that certainly does not leave room for any legend beside it at all"
		l := layoutChartHeader(p, title, []string{"Sessions", "Crashes"}, innerW)
		if l.items[0].x != 0 {
			t.Errorf("stacked legend should start at x=0, got %d", l.items[0].x)
		}
		if want := textAscent(p, chartTitleFont) + headerGap; l.items[0].y != want {
			t.Errorf("stacked legend y = %d, want title ascent + headerGap = %d", l.items[0].y, want)
		}
	})

	t.Run("glyph shape does not move the baseline", func(t *testing.T) {
		// Parentheses and descenders measure taller than plain words; the
		// row baseline must not follow the tallest label around.
		plain := layoutChartHeader(p, "Errors", []string{"Fatal", "Handled"}, innerW)
		mixed := layoutChartHeader(p, "Errors", []string{"Fatal (crashes)", "Handled"}, innerW)
		if plain.baseline != mixed.baseline {
			t.Errorf("baseline moved with glyph content: plain=%d mixed=%d", plain.baseline, mixed.baseline)
		}
		if mixed.items[0].y != mixed.items[1].y {
			t.Errorf("one-row items on different rows: %d vs %d", mixed.items[0].y, mixed.items[1].y)
		}
	})

	t.Run("many long names wrap within the width", func(t *testing.T) {
		names := []string{
			"org.wikipedia.android production sessions",
			"org.wikipedia.android.dev internal sessions",
			"org.wikipedia.ios production sessions",
			"org.wikipedia.ios.beta internal sessions",
			"org.wikimedia.commons production sessions",
		}
		l := layoutChartHeader(p, "Sessions by app build", names, innerW)
		rows := map[int]bool{}
		for _, item := range l.items {
			rows[item.y] = true
			w := legendSwatchSize + legendSwatchGap + p.MeasureText(item.name, 0, chartLegendFont).Width()
			if item.x+w > innerW {
				t.Errorf("item %q overflows: x=%d w=%d innerW=%d", item.name, item.x, w, innerW)
			}
		}
		if len(rows) < 2 {
			t.Errorf("expected the legend to wrap into multiple rows, got %d", len(rows))
		}
		if l.height <= headerGap+legendSwatchSize {
			t.Errorf("header height %d too small for wrapped rows", l.height)
		}
	})
}

// TestChooseXLabelRotation pins the rotation ladder: flat when labels fit,
// 45 degrees when they collide, 90 degrees at the extreme.
func TestChooseXLabelRotation(t *testing.T) {
	p := measurePainter()
	plotW := chartWidth - chartPadding.Left - chartPadding.Right - yAxisReserveEstimate

	short := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	if rad, depth := chooseXLabelRotation(p, short, plotW); rad != 0 || depth != 0 {
		t.Errorf("short labels: rotation=%v depth=%d, want flat", rad, depth)
	}

	dates := make([]string, 24)
	for i := range dates {
		dates[i] = fmt.Sprintf("Jun %d", i+1)
	}
	if rad, depth := chooseXLabelRotation(p, dates, plotW); rad != charts.DegreesToRadians(45) || depth <= 0 {
		t.Errorf("24 date labels: rotation=%v depth=%d, want 45 degrees with extra depth", rad, depth)
	}

	long := make([]string, 48)
	for i := range long {
		long[i] = fmt.Sprintf("2026-06-%02d 12:00", i%30+1)
	}
	rad, depth := chooseXLabelRotation(p, long, plotW)
	if rad != charts.DegreesToRadians(90) {
		t.Errorf("48 long labels: rotation=%v, want 90 degrees", rad)
	}
	if depth <= 0 {
		t.Errorf("48 long labels: depth=%d, want extra depth", depth)
	}
}

// TestBarChartOptionShape pins the bar layout decisions: series that never
// co-occur in a category stack into one centered bar, co-occurring series
// stay grouped, and sparse categories get a width cap instead of
// lane-filling bars.
func TestBarChartOptionShape(t *testing.T) {
	labels := []string{"1.0.1", "1.0.2"}

	disjoint := barChartOption([][]float64{{6, 0}, {0, 3}}, labels, chartPadding, 0)
	if disjoint.StackSeries == nil || !*disjoint.StackSeries {
		t.Error("disjoint series should stack")
	}
	if disjoint.BarSize <= 0 || disjoint.BarSize >= 1 {
		t.Errorf("two categories should cap the bar width, BarSize = %v", disjoint.BarSize)
	}

	grouped := barChartOption([][]float64{{6, 2}, {4, 3}}, labels, chartPadding, 0)
	if grouped.StackSeries != nil {
		t.Error("co-occurring series should stay grouped")
	}

	single := barChartOption([][]float64{{6, 3}}, labels, chartPadding, 0)
	if single.StackSeries != nil {
		t.Error("a single series has nothing to stack")
	}

	dense := make([][]float64, 1)
	denseLabels := make([]string, 40)
	dense[0] = make([]float64, 40)
	for i := range denseLabels {
		denseLabels[i] = fmt.Sprintf("v%d", i)
		dense[0][i] = float64(i)
	}
	if opt := barChartOption(dense, denseLabels, chartPadding, 0); opt.BarSize != 0 {
		t.Errorf("dense categories should keep auto sizing, BarSize = %v", opt.BarSize)
	}
}

func TestChartFilename(t *testing.T) {
	cases := map[string]string{
		"Sessions over time":     "sessions-over-time.png",
		"Crash-free %  (weekly)": "crash-free-weekly.png",
		"###":                    "chart.png",
		"":                       "chart.png",
	}
	for title, want := range cases {
		if got := chartFilename(title); got != want {
			t.Errorf("chartFilename(%q) = %q, want %q", title, got, want)
		}
	}
}
