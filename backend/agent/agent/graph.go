package agent

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"unicode"

	"github.com/go-analyze/charts"
)

// Charts are rendered server-side to PNG and shared into the Slack thread
// after the reply text, so the render_chart tool is offered on Slack turns
// only, while MCP output stays text. The charting library is confined to
// this file: everything else deals in renderChartInput and PNG bytes, which
// keeps the library swappable.
//
// The header, meaning the title and the legend, is measured, laid out and
// drawn here rather than by the library, whose own placement pushes the
// legend into the plot when a long title collides with it. The chart is
// rendered first with the header's height reserved in its top padding, and
// the header is then drawn over the background fill.

// maxChartsPerTurn bounds how many images one reply may attach, so a single
// answer cannot flood a thread.
const maxChartsPerTurn = 3

// maxChartPoints bounds how many data points a chart plots per series.
const maxChartPoints = 100

// maxChartSeries bounds how many series a chart plots.
const maxChartSeries = 5

// chartWidth is the rendered PNG's width.
const chartWidth = 800

// chartHeight is the height budget for the plot and its padding. The canvas
// grows beyond it for tall headers and rotated axis labels, so extra chrome
// never squeezes the plot itself.
const chartHeight = 400

// chartMaxHeight caps the canvas growth.
const chartMaxHeight = 2 * chartHeight

// headerGap is the vertical spacing between the title and the legend rows,
// and between the header block and the plot.
const headerGap = 24

// legendSwatchSize is the edge length of a legend color swatch, sized to the
// legend font's lowercase zone so box and label read as one unit.
const legendSwatchSize = 10

// legendSwatchGap separates a swatch from its label.
const legendSwatchGap = 8

// legendItemGap separates legend entries from each other, and the title from
// a legend sharing its row.
const legendItemGap = 24

// legendRowGap separates wrapped legend rows.
const legendRowGap = 10

// legendSwatchLift raises the swatch off the text baseline so it does not
// touch descenders.
const legendSwatchLift = 1

// xLabelClearance is the minimum space between horizontal x labels before
// they are rotated.
const xLabelClearance = 8

// rotatedLabelClearance is the minimum space between rotated x labels.
const rotatedLabelClearance = 4

// yAxisReserveEstimate approximates the horizontal space the y axis and its
// labels take from the plot. It only feeds the rotation decision; the
// library computes the real reserve at render time.
const yAxisReserveEstimate = 55

// lineFillOpacity is the alpha of the area fill under a line, the
// dashboard's 0.05 area opacity on the library's 0 to 255 scale.
const lineFillOpacity = 13

// maxBarWidth caps a bar's thickness in pixels. With few categories the
// library's auto sizing fills each lane, and a two-category chart renders
// paddle-sized bars.
const maxBarWidth = 64

// lineSymbolSize is the radius of the point markers on a line.
const lineSymbolSize = 3

// chartPadding is the margin around the whole chart. The library default of
// 20px sits the header and axis labels too close to the image edges.
var chartPadding = charts.NewBoxEqual(32)

// chartForeground is the dashboard's dark-mode --foreground.
var chartForeground = charts.ColorFromHex("#fafafa")

// chartSeriesColors is the dashboard's ordered chart palette, the Tailwind
// -400 hues from frontend shared_styles.tsx. The theme colors the plot with
// it and the legend swatches index into it, so both always agree.
var chartSeriesColors = []charts.Color{
	charts.ColorFromHex("#38bdf8"), // sky-400 (blue)
	charts.ColorFromHex("#34d399"), // emerald-400 (green)
	charts.ColorFromHex("#fbbf24"), // amber-400 (amber)
	charts.ColorFromHex("#a78bfa"), // violet-400 (violet)
	charts.ColorFromHex("#f472b6"), // pink-400 (pink)
	charts.ColorFromHex("#2dd4bf"), // teal-400 (teal)
	charts.ColorFromHex("#f87171"), // red-400 (red)
	charts.ColorFromHex("#facc15"), // yellow-400 (yellow)
}

// measureChartTheme mirrors the dashboard's charts so an image in Slack
// reads as the same product: the dashboard's series palette, its dark-mode
// background and foreground, and no grid lines, which the dashboard plots
// disable too. The theme is dark regardless of where Slack renders the
// image, since the palette is designed on the dark surface.
var measureChartTheme = charts.MakeTheme(charts.ThemeOption{
	IsDarkMode:      true,
	BackgroundColor: charts.ColorFromHex("#111111"), // --background (dark)
	TextColor:       chartForeground,
	AxisStrokeColor: charts.ColorFromHex("#525252"),
	SeriesColors:    chartSeriesColors,
})

// Fonts for the hand-drawn header, plus the axis label font used only to
// measure labels for the rotation decision; the library draws the axis
// labels itself at its 12px default.
var (
	chartTitleFont  = charts.FontStyle{FontSize: 15, FontColor: chartForeground, Font: charts.GetDefaultFont()}
	chartLegendFont = charts.FontStyle{FontSize: 13, FontColor: chartForeground, Font: charts.GetDefaultFont()}
	chartAxisFont   = charts.FontStyle{FontSize: 12, FontColor: chartForeground, Font: charts.GetDefaultFont()}
)

const renderChartToolName = "render_chart"

// renderChartTool is offered to the model on Slack turns. The description
// carries the usage guidance, so the system prompt stays surface-neutral.
var renderChartTool = chatTool{
	Type: "function",
	Function: chatToolFunction{
		Name:        renderChartToolName,
		Description: "Render a line or bar chart image that is posted below your reply. When the user asks to see, show or plot something, always render one, however little data there is. Otherwise use your judgment: chart when the answer centers on a trend over time or a comparison across categories with at least three data points, and skip it for single numbers or tiny lists. When a chart covers more than one app, plot one series per app, name each series after its app, and let the title say what is compared. Mention it as the chart below, never as an image above, and refer to it instead of repeating every value.",
		Parameters: json.RawMessage(`{
			"type": "object",
			"properties": {
				"chart_type": {"type": "string", "enum": ["line", "bar"], "description": "line for trends over time, bar for comparisons across categories"},
				"title": {"type": "string", "description": "Chart title, shown above the plot; keep it under about five words"},
				"x_labels": {"type": "array", "items": {"type": "string"}, "description": "Labels along the x axis, one per data point; keep them short (dates as \"Jun 28\", not timestamps)"},
				"series": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string", "description": "Series name, shown in the legend"}, "values": {"type": "array", "items": {"type": "number"}, "description": "One value per x label"}}, "required": ["name", "values"]}, "description": "The plotted series; every values array must have exactly one value per x label"}
			},
			"required": ["chart_type", "title", "x_labels", "series"]
		}`),
	},
}

type renderChartInput struct {
	ChartType string              `json:"chart_type"`
	Title     string              `json:"title"`
	XLabels   []string            `json:"x_labels"`
	Series    []renderChartSeries `json:"series"`
}

type renderChartSeries struct {
	Name   string    `json:"name"`
	Values []float64 `json:"values"`
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
		return renderedChart{}, fmt.Sprintf("error: at most %d charts per reply; refer to the ones already rendered", maxChartsPerTurn)
	}
	var in renderChartInput
	if err := json.Unmarshal([]byte(arguments), &in); err != nil {
		return renderedChart{}, "error: invalid arguments: " + err.Error()
	}
	if err := in.validate(); err != nil {
		return renderedChart{}, "error: " + err.Error()
	}
	png, err := renderChartPNG(in)
	if err != nil {
		return renderedChart{}, "error: failed to render chart: " + err.Error()
	}
	return renderedChart{title: in.Title, filename: chartFilename(in.Title), png: png}, ""
}

// validate rejects specs the renderer would draw badly, with messages the
// model can act on.
func (in renderChartInput) validate() error {
	if in.ChartType != "line" && in.ChartType != "bar" {
		return fmt.Errorf("chart_type must be \"line\" or \"bar\", got %q", in.ChartType)
	}
	if strings.TrimSpace(in.Title) == "" {
		return fmt.Errorf("title is required")
	}
	if n := len(in.XLabels); n < 2 || n > maxChartPoints {
		return fmt.Errorf("x_labels must have between 2 and %d entries, got %d", maxChartPoints, n)
	}
	if n := len(in.Series); n < 1 || n > maxChartSeries {
		return fmt.Errorf("series must have between 1 and %d entries, got %d", maxChartSeries, n)
	}
	for _, s := range in.Series {
		if len(s.Values) != len(in.XLabels) {
			return fmt.Errorf("series %q has %d values for %d x_labels; they must match", s.Name, len(s.Values), len(in.XLabels))
		}
	}
	return nil
}

// renderChartPNG draws a validated spec as a PNG: it measures the header and
// the axis labels, sizes the canvas, renders the plot with the header band
// reserved, and draws the header last.
func renderChartPNG(in renderChartInput) ([]byte, error) {
	values := make([][]float64, 0, len(in.Series))
	names := make([]string, 0, len(in.Series))
	for _, s := range in.Series {
		values = append(values, s.Values)
		names = append(names, s.Name)
	}

	measure := newChartPainter(chartHeight)
	innerW := chartWidth - chartPadding.Left - chartPadding.Right
	header := layoutChartHeader(measure, in.Title, names, innerW)
	rotation, labelDepth := chooseXLabelRotation(measure, in.XLabels, innerW-yAxisReserveEstimate)

	padding := chartPadding
	padding.Top += header.height

	p := newChartPainter(min(chartHeight+header.height+labelDepth, chartMaxHeight))
	var err error
	switch in.ChartType {
	case "line":
		err = p.LineChart(lineChartOption(values, in.XLabels, padding, rotation))
	case "bar":
		err = p.BarChart(barChartOption(values, in.XLabels, padding, rotation))
	default:
		err = fmt.Errorf("unsupported chart_type %q", in.ChartType)
	}
	if err != nil {
		return nil, err
	}

	drawChartHeader(p, in.Title, header)
	return p.Bytes()
}

// newChartPainter builds a PNG painter at the chart width.
func newChartPainter(height int) *charts.Painter {
	return charts.NewPainter(charts.PainterOptions{
		OutputFormat: charts.ChartOutputPNG,
		Width:        chartWidth,
		Height:       height,
	})
}

// lineChartOption builds the library options for a line chart. Line style
// follows the dashboard plots: a faint area fill under the line and small
// point markers. Lines are straight on purpose, since the library's tension
// smoothing cuts corners rather than interpolating through points, which
// floats the markers off the curve at peaks and reads as wrong data.
func lineChartOption(values [][]float64, labels []string, padding charts.Box, rotation float64) charts.LineChartOption {
	opt := charts.NewLineChartOptionWithData(values)
	opt.Theme = measureChartTheme
	opt.Padding = padding
	opt.XAxis.Labels = labels
	opt.XAxis.LabelRotation = rotation
	opt.StrokeSmoothingTension = 0
	opt.FillArea = charts.Ptr(true)
	opt.FillOpacity = lineFillOpacity
	opt.Symbol = charts.Symbol{Shape: charts.SymbolCircle, Size: lineSymbolSize}
	for i := range opt.YAxis {
		opt.YAxis[i].SplitLineShow = charts.Ptr(false)
	}
	return opt
}

// barChartOption builds the library options for a bar chart. The value axis
// starts at zero, since bars encode value as length and an auto-ranged
// baseline exaggerates differences.
func barChartOption(values [][]float64, labels []string, padding charts.Box, rotation float64) charts.BarChartOption {
	opt := charts.NewBarChartOptionWithData(values)
	opt.Theme = measureChartTheme
	opt.Padding = padding
	opt.CategoryAxis.Labels = labels
	opt.CategoryAxis.LabelRotation = rotation
	for i := range opt.ValueAxis {
		opt.ValueAxis[i].SplitLineShow = charts.Ptr(false)
		opt.ValueAxis[i].Min = charts.Ptr(0.0)
	}

	// Grouped bars split each category slot into one lane per series, and a
	// zero value still occupies its lane, pushing the visible bar away from
	// the centered category label. When the series never co-occur in a
	// category, the grouping carries no information, so the series stack
	// into one centered bar of the category's single color instead.
	lanes := len(values)
	if seriesDisjoint(values, len(labels)) {
		opt.StackSeries = charts.Ptr(true)
		lanes = 1
	}

	// BarSize is a ratio of the lane, so the cap converts through the lane
	// width, estimated the same way the rotation decision estimates the plot.
	plotW := chartWidth - padding.Left - padding.Right - yAxisReserveEstimate
	if lane := plotW / max(len(labels)*lanes, 1); lane > maxBarWidth {
		opt.BarSize = float64(maxBarWidth) / float64(lane)
	}
	return opt
}

// seriesDisjoint reports whether no category has more than one series with a
// non-zero value.
func seriesDisjoint(values [][]float64, categories int) bool {
	if len(values) < 2 {
		return false
	}
	for c := range categories {
		nonZero := 0
		for _, series := range values {
			if c < len(series) && series[c] != 0 {
				nonZero++
			}
		}
		if nonZero > 1 {
			return false
		}
	}
	return true
}

// textAscent returns a font's baseline offset, measured from a reference
// string with no descenders or brackets. MeasureText's height follows the
// actual glyphs, so "Fatal (crashes)" measures taller than "Handled", and
// deriving baselines from per-item heights would put entries of one legend
// row on visibly different baselines.
func textAscent(p *charts.Painter, font charts.FontStyle) int {
	return p.MeasureText("A0", 0, font).Height()
}

// placedLegendItem is one legend entry with its position resolved, relative
// to the header's top-left corner.
type placedLegendItem struct {
	name  string
	color charts.Color
	x, y  int
}

// chartHeaderLayout is the resolved header: every legend entry placed, the
// shared baseline offset its row's text and swatches hang from, and the
// vertical space the block claims above the plot, headerGap included.
type chartHeaderLayout struct {
	items    []placedLegendItem
	baseline int
	height   int
}

// layoutChartHeader places the title and legend without overlap for any
// title length and series count: one row with the legend right-aligned when
// title and legend fit side by side, otherwise the legend moves below the
// title, left-aligned, wrapping into as many rows as it needs.
func layoutChartHeader(p *charts.Painter, title string, names []string, innerW int) chartHeaderLayout {
	titleW := p.MeasureText(title, 0, chartTitleFont).Width()
	titleH := textAscent(p, chartTitleFont)

	// The plot's top y-axis label centers on the plot's top edge, so its
	// upper half rises into whatever sits above. The header's bottom gap is
	// padded by that half, keeping the visible header-to-plot spacing at
	// headerGap in both layouts.
	overhang := p.MeasureText("0", 0, chartAxisFont).Height() / 2

	legendH := max(legendSwatchSize, textAscent(p, chartLegendFont))
	itemW := make([]int, len(names))
	totalW := 0
	for i, name := range names {
		itemW[i] = legendSwatchSize + legendSwatchGap + p.MeasureText(name, 0, chartLegendFont).Width()
		totalW += itemW[i]
	}
	totalW += legendItemGap * (len(names) - 1)

	out := chartHeaderLayout{baseline: legendH}
	if titleW+legendItemGap+totalW <= innerW {
		rowH := max(titleH, legendH)
		x := innerW - totalW
		for i, name := range names {
			out.items = append(out.items, placedLegendItem{name: name, color: chartSeriesColors[i%len(chartSeriesColors)], x: x, y: (rowH - legendH) / 2})
			x += itemW[i] + legendItemGap
		}
		out.height = rowH + headerGap + overhang
		return out
	}

	// An entry wider than a whole row still gets its own row rather than
	// looping forever.
	y := titleH + headerGap
	x := 0
	for i, name := range names {
		if x > 0 && x+itemW[i] > innerW {
			x = 0
			y += legendH + legendRowGap
		}
		out.items = append(out.items, placedLegendItem{name: name, color: chartSeriesColors[i%len(chartSeriesColors)], x: x, y: y})
		x += itemW[i] + legendItemGap
	}
	out.height = y + legendH + headerGap + overhang
	return out
}

// drawChartHeader paints the title and the laid-out legend into the padded
// top band the chart render left empty. Painter.Text draws at the baseline,
// and every entry uses the layout's shared baseline, so labels stay level
// with each other whatever glyphs they contain. The swatch hangs from that
// baseline too: the label glyphs' visual mass sits in the lowercase zone
// just above it, so a baseline-aligned swatch reads level with the text,
// where a box centered on the full ascent rides visibly high.
func drawChartHeader(p *charts.Painter, title string, layout chartHeaderLayout) {
	p.Text(title, chartPadding.Left, chartPadding.Top+textAscent(p, chartTitleFont), 0, chartTitleFont)
	for _, item := range layout.items {
		x, y := chartPadding.Left+item.x, chartPadding.Top+item.y
		baseline := y + layout.baseline
		swatchBottom := baseline - legendSwatchLift
		p.FilledRect(x, swatchBottom-legendSwatchSize, x+legendSwatchSize, swatchBottom, item.color, item.color, 0)
		p.Text(item.name, x+legendSwatchSize+legendSwatchGap, baseline, 0, chartLegendFont)
	}
}

// chooseXLabelRotation picks the flattest rotation that keeps x labels from
// colliding: horizontal when every label fits its slot, the dashboard's
// diagonal when not, vertical for labels too long even for that. How many
// labels actually render is left to the library, whose thinning heuristic
// skips labels on dense axes. labelDepth is the vertical room rotated labels
// need beyond a horizontal row, for the caller to grow the canvas by.
func chooseXLabelRotation(p *charts.Painter, labels []string, plotW int) (radians float64, labelDepth int) {
	maxW, maxH := 0, 0
	for _, label := range labels {
		box := p.MeasureText(label, 0, chartAxisFont)
		maxW = max(maxW, box.Width())
		maxH = max(maxH, box.Height())
	}
	slot := plotW / max(len(labels), 1)
	if maxW+xLabelClearance <= slot {
		return 0, 0
	}
	// A label rotated by an angle occupies roughly its height divided by the
	// angle's sine horizontally, so about 1.5 times the height at 45 degrees
	// and exactly the height at 90. Labels wider than a quarter of the plot
	// go straight to vertical, where their footprint is smallest.
	rad := charts.DegreesToRadians(90)
	if maxH*3/2+rotatedLabelClearance <= slot && maxW < plotW/4 {
		rad = charts.DegreesToRadians(45)
	}
	return rad, max(int(float64(maxW)*math.Sin(rad))-maxH, 0)
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
