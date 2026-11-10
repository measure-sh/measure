package agent

import (
	"encoding/json"
	"fmt"
	"math"
	"slices"
	"strings"
	"unicode"

	"backend/agent/chart"
)

// Charts are rendered server-side to PNG and shared into the Slack thread
// after the reply text, so the render_chart tool is offered on Slack turns
// only, while MCP output stays text. This file defines the tool contract
// with the model; the chart package renders the image.

// maxChartsPerTurn bounds how many images one reply may attach, so a single
// answer cannot flood a thread.
const maxChartsPerTurn = 3

// maxChartPoints bounds how many data points a chart plots per series.
const maxChartPoints = 100

// maxChartSeries bounds how many series a chart plots.
const maxChartSeries = 5

// maxChartMarkers limits the number of x-axis markers on a chart.
const maxChartMarkers = 3

// maxChartMarkerLabelLen limits marker labels so they fit in their rows
// above the plot.
const maxChartMarkerLabelLen = 40

// maxChartUnitLen limits the y-axis unit length.
const maxChartUnitLen = 8

const renderChartToolName = "render_chart"

// renderChartTool is offered to the model on Slack turns. The description
// carries the usage guidance, so the system prompt stays surface-neutral.
var renderChartTool = chatTool{
	Type: "function",
	Function: chatToolFunction{
		Name:        renderChartToolName,
		Description: "Render a line or bar chart image that is posted below your reply. When the user asks to see, show or plot something, always render one, however little data there is. Otherwise use your judgment: chart when the answer centers on a trend over time or a comparison across categories with at least three data points, and skip it for single numbers or tiny lists. When a chart covers more than one app, plot one series per app, name each series after its app, and let the title say what is compared. Mention it as the chart below, never as an image above. A chart never replaces the numbers: always state the numbers the question asks for, such as totals, in your reply, and don't list every point the chart plots. Use null for points with no value; do not use 0. Set y_unit when values have a unit. To mark an event, add a marker at its x label. If the final periods are still in progress, set in_progress_from. If the user asks to show something these inputs cannot represent, explain that in your reply. Write the title, labels, and names in Latin characters; the chart font cannot draw other scripts. On bar charts, x labels longer than 11 characters may be cut to their first 10, so keep them short and different at the start.",
		Parameters: json.RawMessage(`{
			"type": "object",
			"properties": {
				"chart_type": {"type": "string", "enum": ["line", "bar"], "description": "line for trends over time, bar for comparisons across categories"},
				"title": {"type": "string", "description": "Chart title, shown above the plot; keep it under about five words"},
				"x_labels": {"type": "array", "items": {"type": "string"}, "description": "Labels along the x axis, one per data point; keep them short (dates as \"Jun 28\", not timestamps)"},
				"series": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string", "description": "Series name, shown in the legend"}, "values": {"type": "array", "items": {"type": ["number", "null"]}, "description": "One value per x label; use null when that label has no value"}}, "required": ["name", "values"]}, "description": "The plotted series; each values array must have one entry per x label"},
				"y_unit": {"type": "string", "description": "Unit shown on the y-axis labels, such as \"%\" or \"ms\"; omit for plain counts"},
				"markers": {"type": "array", "items": {"type": "object", "properties": {"x_label": {"type": "string", "description": "X label for the marker; must match an entry in x_labels"}, "label": {"type": "string", "description": "Short label for the marker, such as \"1.1.0 released\""}}, "required": ["x_label", "label"]}, "description": "Vertical lines marking events on the x axis; at most 3"},
				"in_progress_from": {"type": "string", "description": "First x label for a period still in progress; must match an entry in x_labels. This period and every later one are shown as in progress"}
			},
			"required": ["chart_type", "title", "x_labels", "series"]
		}`),
	},
}

type renderChartInput struct {
	ChartType      string              `json:"chart_type"`
	Title          string              `json:"title"`
	XLabels        []string            `json:"x_labels"`
	Series         []renderChartSeries `json:"series"`
	YUnit          string              `json:"y_unit"`
	Markers        []renderChartMarker `json:"markers"`
	InProgressFrom string              `json:"in_progress_from"`
}

// A nil value in Values marks a point with no data.
type renderChartSeries struct {
	Name   string     `json:"name"`
	Values []*float64 `json:"values"`
}

type renderChartMarker struct {
	XLabel string `json:"x_label"`
	Label  string `json:"label"`
}

// renderedChart is one chart produced during a turn, delivered into the
// thread after the reply text.
type renderedChart struct {
	title    string
	filename string
	png      []byte
}

// renderChartCall runs one render_chart tool call: parse, validate, render.
// A non-empty second return is the error text for the model; on success it
// is empty and the chart is ready to deliver. rendered is how many charts
// the turn has already produced, for the per-turn cap.
func renderChartCall(arguments string, rendered int) (renderedChart, string) {
	if rendered >= maxChartsPerTurn {
		return renderedChart{}, fmt.Sprintf("error: this reply already has %d charts; use the charts already rendered", maxChartsPerTurn)
	}
	var in renderChartInput
	if err := json.Unmarshal([]byte(arguments), &in); err != nil {
		return renderedChart{}, "error: invalid arguments: " + err.Error()
	}
	if err := in.validate(); err != nil {
		return renderedChart{}, "error: " + err.Error()
	}
	png, err := chart.Render(in.spec())
	if err != nil {
		return renderedChart{}, "error: failed to render chart: " + err.Error()
	}
	return renderedChart{title: in.Title, filename: chartFilename(in.Title), png: png}, ""
}

// validate rejects specs the renderer would draw badly, with messages the
// model can act on.
func (in renderChartInput) validate() error {
	if in.ChartType != "line" && in.ChartType != "bar" {
		return fmt.Errorf("chart_type must be \"line\" or \"bar\"; received %q", in.ChartType)
	}
	if strings.TrimSpace(in.Title) == "" {
		return fmt.Errorf("title is required")
	}
	if n := len(in.XLabels); n < 2 || n > maxChartPoints {
		return fmt.Errorf("x_labels must contain 2 to %d entries; received %d", maxChartPoints, n)
	}
	if n := len(in.Series); n < 1 || n > maxChartSeries {
		return fmt.Errorf("series must contain 1 to %d entries; received %d", maxChartSeries, n)
	}
	hasValue := false
	for _, s := range in.Series {
		if len(s.Values) != len(in.XLabels) {
			return fmt.Errorf("series %q has %d values but x_labels has %d; provide one value per x label", s.Name, len(s.Values), len(in.XLabels))
		}
		for _, v := range s.Values {
			hasValue = hasValue || v != nil
		}
	}
	if !hasValue {
		return fmt.Errorf("all values are null; provide at least one numeric value")
	}
	if n := len([]rune(strings.TrimSpace(in.YUnit))); n > maxChartUnitLen {
		return fmt.Errorf("y_unit must be no longer than %d characters, got %d", maxChartUnitLen, n)
	}
	if n := len(in.Markers); n > maxChartMarkers {
		return fmt.Errorf("markers may contain at most %d entries; received %d", maxChartMarkers, n)
	}
	for _, m := range in.Markers {
		if err := in.checkXLabelRef("marker x_label", m.XLabel); err != nil {
			return err
		}
		if n := len([]rune(strings.TrimSpace(m.Label))); n < 1 || n > maxChartMarkerLabelLen {
			return fmt.Errorf("marker label must be 1 to %d characters long, got %d", maxChartMarkerLabelLen, n)
		}
	}
	if in.InProgressFrom != "" {
		if err := in.checkXLabelRef("in_progress_from", in.InProgressFrom); err != nil {
			return err
		}
	}
	return nil
}

// checkXLabelRef requires label to match exactly one x label. Repeated labels,
// such as weekdays across two weeks, are ambiguous.
func (in renderChartInput) checkXLabelRef(field, label string) error {
	matches := 0
	for _, xLabel := range in.XLabels {
		if xLabel == label {
			matches++
		}
	}
	switch matches {
	case 0:
		return fmt.Errorf("%s %q does not match any entry in x_labels; use an existing x label", field, label)
	case 1:
		return nil
	default:
		return fmt.Errorf("%s %q matches %d entries in x_labels; use a unique x label", field, label, matches)
	}
}

// spec converts a validated input to the chart package's form.
func (in renderChartInput) spec() chart.Spec {
	spec := chart.Spec{
		Kind:    chart.Line,
		Title:   strings.TrimSpace(in.Title),
		XLabels: in.XLabels,
		YUnit:   strings.TrimSpace(in.YUnit),
	}
	if in.ChartType == "bar" {
		spec.Kind = chart.Bar
	}
	for _, s := range in.Series {
		values := make([]float64, len(s.Values))
		for i, v := range s.Values {
			if v == nil {
				values[i] = math.NaN()
			} else {
				values[i] = *v
			}
		}
		spec.Series = append(spec.Series, chart.Series{Name: s.Name, Values: values})
	}
	for _, m := range in.Markers {
		spec.Markers = append(spec.Markers, chart.Marker{
			Index: slices.Index(in.XLabels, m.XLabel),
			Label: strings.TrimSpace(m.Label),
		})
	}
	if in.InProgressFrom != "" {
		spec.InProgressCount = len(in.XLabels) - slices.Index(in.XLabels, in.InProgressFrom)
	}
	return spec
}

// chartFilename derives the uploaded file's name from the chart title:
// lowercased, with runs of anything but letters and digits collapsed to one
// dash.
func chartFilename(title string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(title) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	name := strings.TrimSuffix(b.String(), "-")
	if name == "" {
		name = "chart"
	}
	return name + ".png"
}
