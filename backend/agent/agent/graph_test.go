package agent

import (
	"bytes"
	"encoding/json"
	"image/png"
	"math"
	"strings"
	"testing"
	"time"

	"backend/agent/chart"
)

func chartArgs(chartType string) string {
	return `{"chart_type":"` + chartType + `","title":"Sessions over time","x_labels":["Jun 1","Jun 2","Jun 3"],"series":[{"name":"Sessions","values":[10,20,15]}]}`
}

func TestRenderChartCall(t *testing.T) {
	for _, chartType := range []string{"line", "bar"} {
		rendered, errText := renderChartCall(chartArgs(chartType), 0)
		if errText != "" {
			t.Fatalf("%s: renderChartCall error: %s", chartType, errText)
		}
		if rendered.title != "Sessions over time" || rendered.filename != "sessions-over-time.png" {
			t.Errorf("%s: title=%q filename=%q", chartType, rendered.title, rendered.filename)
		}
		img, err := png.Decode(bytes.NewReader(rendered.png))
		if err != nil {
			t.Fatalf("%s: output is not a decodable png: %v", chartType, err)
		}
		if b := img.Bounds(); b.Dx() != chart.Width {
			t.Errorf("%s: width = %d, want %d", chartType, b.Dx(), chart.Width)
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

// TestRenderChartUsesDashboardPalette checks that the first two series use
// the expected colors on a dark background.
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
		"sky-400":   {0x38, 0xbd, 0xf8},
		"amber-400": {0xfb, 0xbf, 0x24},
		"dark bg":   {0x11, 0x11, 0x11},
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
		"unknown type":                               `{"chart_type":"pie","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}]}`,
		"missing title":                              `{"chart_type":"line","title":"  ","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}]}`,
		"single point":                               `{"chart_type":"line","title":"T","x_labels":["a"],"series":[{"name":"s","values":[1]}]}`,
		"no series":                                  `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[]}`,
		"length mismatch":                            `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2,3]}]}`,
		"invalid JSON":                               `{"chart_type":`,
		"all values null":                            `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[null,null]}]}`,
		"long unit":                                  `{"chart_type":"line","title":"T","x_labels":["a","b"],"y_unit":"milliseconds","series":[{"name":"s","values":[1,2]}]}`,
		"unknown marker label":                       `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}],"markers":[{"x_label":"c","label":"release"}]}`,
		"empty marker text":                          `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}],"markers":[{"x_label":"a","label":" "}]}`,
		"too many markers":                           `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}],"markers":[{"x_label":"a","label":"1"},{"x_label":"a","label":"2"},{"x_label":"b","label":"3"},{"x_label":"b","label":"4"}]}`,
		"marker on a repeated label":                 `{"chart_type":"line","title":"T","x_labels":["Mon","Tue","Mon"],"series":[{"name":"s","values":[1,2,3]}],"markers":[{"x_label":"Mon","label":"release"}]}`,
		"in-progress on a repeated label":            `{"chart_type":"line","title":"T","x_labels":["Mon","Tue","Mon"],"series":[{"name":"s","values":[1,2,3]}],"in_progress_from":"Mon"}`,
		"value too large":                            `{"chart_type":"bar","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1.7e308,0]}]}`,
		"values too small":                           `{"chart_type":"bar","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[3e-308,0]}]}`,
		"unknown in-progress label":                  `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1,2]}],"in_progress_from":"c"}`,
		"text the font cannot draw":                  `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"Яндекс Карты","values":[1,2]}]}`,
		"bar labels become identical when shortened": `{"chart_type":"bar","title":"T","x_labels":["ProductDetailActivity","ProductDetailFragment","CheckoutActivity","SearchResultsScreen","OnboardingCarousel","SettingsActivity","NotificationsScreen"],"series":[{"name":"s","values":[1,2,3,4,5,6,7]}]}`,
		"too many series":                            `{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"1","values":[1,2]},{"name":"2","values":[1,2]},{"name":"3","values":[1,2]},{"name":"4","values":[1,2]},{"name":"5","values":[1,2]},{"name":"6","values":[1,2]}]}`,
	}
	for name, args := range cases {
		if _, errText := renderChartCall(args, 0); !strings.HasPrefix(errText, "error:") {
			t.Errorf("%s: expected an error result, got %q", name, errText)
		}
	}
}

func TestRenderChartInputSpec(t *testing.T) {
	args := `{"chart_type":"bar","title":" Crashes ","x_labels":["Mon","Tue","Wed"],"y_unit":" requests ","series":[{"name":"s","values":[1,null,3]}],"markers":[{"x_label":"Tue","label":" 1.1.0 released "}],"in_progress_from":"Tue"}`
	var in renderChartInput
	if err := json.Unmarshal([]byte(args), &in); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if err := in.validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
	spec := in.spec()
	if spec.Kind != chart.Bar || spec.Title != "Crashes" || spec.YUnit != "requests" {
		t.Errorf("kind=%v title=%q unit=%q", spec.Kind, spec.Title, spec.YUnit)
	}
	values := spec.Series[0].Values
	if values[0] != 1 || !math.IsNaN(values[1]) || values[2] != 3 {
		t.Errorf("values = %v, want [1 NaN 3]", values)
	}
	if len(spec.Markers) != 1 || spec.Markers[0].Index != 1 || spec.Markers[0].Label != "1.1.0 released" {
		t.Errorf("markers = %+v", spec.Markers)
	}
	if spec.InProgressCount != 2 {
		t.Errorf("InProgressCount = %d, want 2", spec.InProgressCount)
	}

	line := renderChartInput{ChartType: "line", XLabels: []string{"a", "b"}}
	if spec := line.spec(); spec.Kind != chart.Line || spec.InProgressCount != 0 {
		t.Errorf("line spec: kind=%v InProgressCount=%d", spec.Kind, spec.InProgressCount)
	}
}

func TestRenderChartNullValues(t *testing.T) {
	for _, chartType := range []string{"line", "bar"} {
		args := `{"chart_type":"` + chartType + `","title":"T","x_labels":["a","b","c"],"series":[{"name":"s","values":[1,null,3]}]}`
		if _, errText := renderChartCall(args, 0); errText != "" {
			t.Errorf("%s chart rejected a null value: %s", chartType, errText)
		}
	}
}

func TestRenderChartCallLimit(t *testing.T) {
	// The per-turn cap rejects the render before any work happens.
	_, errText := renderChartCall(chartArgs("line"), maxChartsPerTurn)
	if !strings.Contains(errText, "already has") {
		t.Errorf("expected the chart cap error, got %q", errText)
	}
}

func FuzzRenderChartCall(f *testing.F) {
	values := strings.Repeat("1e15,null,", 49) + "-1e15,0"
	series := strings.Repeat(`{"name":"`+strings.Repeat("s", 200)+`","values":[`+values+`]},`, 5)
	for _, args := range []string{
		chartArgs("line"),
		chartArgs("bar"),
		`{"chart_type":"bar","title":"Weekly","x_labels":["Mon","Tue","Mon","Wed"],"y_unit":" ms ","series":[{"name":"a","values":[1,null,3,null]},{"name":"b","values":[null,2,-4.5,1e15]}],"markers":[{"x_label":"Tue","label":"1.1.0 released"},{"x_label":"Wed","label":"incident"}],"in_progress_from":"Wed"}`,
		`{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":[1e400,1]}]}`,
		`{"chart_type":"line","title":"T","x_labels":["a","b"],"series":[{"name":"s","values":["1","2"]}]}`,
		"{\"chart_type\":\"line\",\"title\":\"\xff\\u0000\",\"x_labels\":[\"\xfe\",\"\\ud800\"],\"series\":[{\"name\":\"\\t\\n\",\"values\":[1e-400,-0]}]}",
		`{"chart_type":"line","title":` + strings.Repeat("[", 10001),
		`{"chart_type":"line","title":"` + strings.Repeat("Title ", 33) + `","x_labels":[` + strings.Repeat(`"x",`, 99) + `"y"],"series":[` + strings.TrimSuffix(series, ",") + `],"in_progress_from":"y"}`,
	} {
		f.Add(args)
	}
	f.Fuzz(func(t *testing.T, arguments string) {
		start := time.Now()
		rendered, errText := renderChartCall(arguments, 0)
		if elapsed := time.Since(start); elapsed > 5*time.Second {
			t.Errorf("renderChartCall took %v", elapsed)
		}
		if errText != "" {
			if !strings.HasPrefix(errText, "error:") || rendered.png != nil {
				t.Errorf("error %q with %d bytes of image", errText, len(rendered.png))
			}
			return
		}
		img, err := png.Decode(bytes.NewReader(rendered.png))
		if err != nil || img.Bounds().Dx() != chart.Width {
			t.Errorf("image does not decode to a width of %d: %v", chart.Width, err)
		}
	})
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
