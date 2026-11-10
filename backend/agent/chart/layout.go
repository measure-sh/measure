package chart

import (
	"image/color"
	"math"
	"slices"
	"strings"
	"unicode"
)

type rect struct{ x0, y0, x1, y1 float64 }

func (r rect) width() float64  { return r.x1 - r.x0 }
func (r rect) height() float64 { return r.y1 - r.y0 }

// textItem is one line of text placed on the canvas.
type textItem struct {
	text   string
	origin point // start of the baseline
	style  textStyle
	angle  float64
	// quad is the box from the font's ascent to its descent along the
	// text, rotated with it. box is the axis-aligned bounding box of quad.
	quad [4]point
	box  rect
}

type axisTick struct {
	index int // x index for an x tick
	mark  rect
	label textItem
}

type barItem struct {
	rect   rect
	series int
	index  int
}

type lineRun struct {
	series int
	from   int // x index of the first point
	points []point
	dashed bool
}

type pointItem struct {
	center point
	series int
	index  int
}

type missingItem struct {
	lane  rect
	label textItem
}

type markerLabel struct {
	index int
	row   int // 0 is the row next to the plot
	label textItem
}

type markerLine struct {
	index int
	x     float64
	top   float64
	// spans are the drawn parts from top to bottom. The line leaves a gap
	// where it passes a marker label in a lower row.
	spans [][2]float64
}

type legendEntry struct {
	swatch rect
	color  color.NRGBA
	label  textItem
}

type chartLayout struct {
	height int

	plot  rect
	scale valueScale
	// xFirst is the offset from the plot's left edge to the first x
	// position, and xPitch is the distance between x positions.
	xFirst, xPitch float64

	title  textItem
	legend []legendEntry

	yTicks         []axisTick
	gridDots       []point
	inProgressBand *rect
	zeroLine       *rect

	bars     []barItem
	missings []missingItem
	lines    []lineRun
	points   []pointItem

	markerLabels []markerLabel
	markerLines  []markerLine

	xTicks []axisTick
}

func layoutChart(spec Spec) (chartLayout, error) {
	if err := validate(spec); err != nil {
		return chartLayout{}, err
	}
	n := len(spec.XLabels)
	values, dataMin, dataMax := finiteValues(spec.Series)

	l := chartLayout{scale: newValueScale(dataMin, dataMax, 5)}
	headerBottom := l.layoutHeader(spec)

	yLabels := make([]string, len(l.scale.ticks))
	widest := 0.0
	for i, v := range l.scale.ticks {
		yLabels[i] = l.scale.formatTick(v, spec.YUnit)
		widest = max(widest, measureText(yLabels[i], tickLabelStyle).width)
	}
	l.plot.x0 = math.Ceil(outerPadding + widest + tickLabelOffset)
	l.plot.x1 = Width - outerPadding
	// Bars are centered in n bands, and so is a single point. A line with
	// several points runs from the plot's left edge to its right edge.
	if spec.Kind == Bar || n == 1 {
		l.xPitch = l.plot.width() / float64(n)
		l.xFirst = l.xPitch / 2
	} else {
		l.xPitch = l.plot.width() / float64(n-1)
	}

	l.plot.y0 = headerBottom + headerGap
	if rows := l.assignMarkerRows(spec.Markers); rows > 0 {
		l.plot.y0 += float64(rows*markerRowHeight) + markerRowsGap
	}
	l.plot.y1 = l.plot.y0 + plotHeight

	l.layoutYAxis(yLabels)
	l.layoutGrid()
	l.layoutInProgressBand(spec)
	if l.scale.min < 0 && l.scale.max >= 0 {
		row := pixelRow(l.valueY(0))
		l.zeroLine = &rect{l.plot.x0, row, l.plot.x1, row + 1}
	}

	if spec.Kind == Bar {
		l.layoutBars(values)
	} else {
		l.layoutLines(values, n-spec.InProgressCount-1)
	}
	l.layoutMarkers()
	if err := l.layoutXAxis(spec); err != nil {
		return chartLayout{}, err
	}

	bottom := 0.0
	for _, tick := range l.xTicks {
		bottom = max(bottom, tick.label.box.y1)
	}
	l.height = int(math.Ceil(bottom)) + outerPadding
	return l, nil
}

// finiteValues copies the series values with each non-finite value replaced
// by NaN, and returns the range of the finite values.
func finiteValues(series []Series) (values [][]float64, dataMin, dataMax float64) {
	values = make([][]float64, len(series))
	dataMin, dataMax = math.Inf(1), math.Inf(-1)
	for s, ser := range series {
		values[s] = make([]float64, len(ser.Values))
		for i, v := range ser.Values {
			if finite(v) {
				dataMin, dataMax = min(dataMin, v), max(dataMax, v)
			} else {
				v = math.NaN()
			}
			values[s][i] = v
		}
	}
	return values, dataMin, dataMax
}

func (l *chartLayout) xAt(i int) float64 { return l.plot.x0 + l.xFirst + float64(i)*l.xPitch }

func (l *chartLayout) valueY(v float64) float64 {
	return l.plot.y1 - l.scale.fraction(v)*l.plot.height()
}

// pixelRow returns the pixel row whose center is nearest to y, and the row
// above when y is on the edge between two rows. A 1px line on that row
// lines up with the last row of a bar that ends at y.
func pixelRow(y float64) float64 { return math.Round(y - 0.5 - 1e-9) }

func (l *chartLayout) layoutInProgressBand(spec Spec) {
	if spec.InProgressCount == 0 {
		return
	}
	x0 := l.plot.x0
	switch first := len(spec.XLabels) - spec.InProgressCount; {
	case spec.Kind == Bar:
		x0 = math.Round(l.plot.x0 + float64(first)*l.xPitch)
	case first > 0:
		// Start at the last completed point to include the dashed
		// segment to the first in-progress point.
		x0 = math.Round(l.xAt(first - 1))
	}
	l.inProgressBand = &rect{x0, l.plot.y0, l.plot.x1, l.plot.y1}
}

func newTextItem(text string, origin point, style textStyle, angle float64) textItem {
	metrics := measureText(text, style)
	quad := textQuad(origin, metrics.width, metrics, angle)
	return textItem{text: text, origin: origin, style: style, angle: angle, quad: quad, box: quadBox(quad)}
}

func textQuad(origin point, width float64, metrics textMetrics, angle float64) [4]point {
	sin, cos := math.Sincos(angle)
	corner := func(x, y float64) point {
		return point{origin.x + x*cos - y*sin, origin.y + x*sin + y*cos}
	}
	return [4]point{
		corner(0, -metrics.ascent), corner(width, -metrics.ascent),
		corner(width, metrics.descent), corner(0, metrics.descent),
	}
}

func quadBox(quad [4]point) rect {
	box := rect{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
	for _, pt := range quad {
		box.x0, box.x1 = min(box.x0, pt.x), max(box.x1, pt.x)
		box.y0, box.y1 = min(box.y0, pt.y), max(box.y1, pt.y)
	}
	return box
}

// baselineCentered returns the baseline that centers the font's capital
// letters on y. A baseline at a whole pixel keeps horizontal glyph edges
// crisp.
func baselineCentered(y float64, style textStyle) float64 {
	return math.Round(y + measureText("", style).capHeight/2)
}

// baselineBelow returns the baseline that puts the top of the font's capital
// letters at top.
func baselineBelow(top float64, style textStyle) float64 {
	return top + math.Round(measureText("", style).capHeight)
}

func truncateText(text string, style textStyle, maxWidth float64) string {
	if measureText(text, style).width <= maxWidth {
		return text
	}
	runes := []rune(text)
	candidate := func(k int) string {
		return strings.TrimRightFunc(string(runes[:k]), unicode.IsSpace) + ellipsis
	}
	fits := func(k int) bool { return measureText(candidate(k), style).width <= maxWidth }
	// The width of a prefix grows with its length, so a binary search finds
	// the longest prefix that fits. Doubling hi first bounds the search by the
	// length of the result, which matters for a text much wider than maxWidth.
	last := len(runes) - 1
	lo, hi := 0, min(1, last)
	for hi < last && fits(hi) {
		lo, hi = hi, min(2*hi, last)
	}
	for lo < hi {
		mid := (lo + hi + 1) / 2
		if fits(mid) {
			lo = mid
		} else {
			hi = mid - 1
		}
	}
	return candidate(lo)
}

// layoutHeader places the title and the legend, and returns the bottom of
// the header.
func (l *chartLayout) layoutHeader(spec Spec) float64 {
	left, right, top := float64(outerPadding), float64(Width-outerPadding), float64(outerPadding)

	type entry struct {
		name  string
		color color.NRGBA
		width float64
	}
	var entries []entry
	for s, series := range spec.Series {
		entries = append(entries, entry{name: series.Name, color: seriesColor(s)})
	}
	if spec.InProgressCount > 0 {
		entries = append(entries, entry{name: inProgressLabel, color: inProgressSwatchColor})
	}
	legendWidth := 0.0
	for i := range entries {
		entries[i].name = truncateText(entries[i].name, legendStyle, right-left-legendSwatchSize-legendSwatchGap)
		entries[i].width = legendSwatchSize + legendSwatchGap + measureText(entries[i].name, legendStyle).width
		legendWidth += entries[i].width
	}
	legendWidth += legendItemGap * float64(len(entries)-1)

	place := func(e entry, x, rowTop float64) {
		swatch := rect{math.Floor(x), rowTop, math.Floor(x) + legendSwatchSize, rowTop + legendSwatchSize}
		baseline := baselineCentered(rowTop+legendSwatchSize/2, legendStyle)
		label := newTextItem(e.name, point{swatch.x1 + legendSwatchGap, baseline}, legendStyle, 0)
		l.legend = append(l.legend, legendEntry{swatch: swatch, color: e.color, label: label})
	}

	if measureText(spec.Title, titleStyle).width+legendItemGap+legendWidth <= right-left {
		l.title = newTextItem(spec.Title, point{left, baselineCentered(top+legendSwatchSize/2, titleStyle)}, titleStyle, 0)
		x := right - legendWidth
		for _, e := range entries {
			place(e, x, top)
			x += e.width + legendItemGap
		}
		return top + legendSwatchSize
	}

	baseline := baselineBelow(top, titleStyle)
	l.title = newTextItem(truncateText(spec.Title, titleStyle, right-left), point{left, baseline}, titleStyle, 0)
	rowTop := baseline + titleLegendGap
	x := left
	for _, e := range entries {
		// An entry wider than a row still gets a row of its own.
		if x > left && x+e.width > right {
			x = left
			rowTop += legendSwatchSize + legendRowGap
		}
		place(e, x, rowTop)
		x += e.width + legendItemGap
	}
	return rowTop + legendSwatchSize
}

// assignMarkerRows assigns each marker label to the first row where it keeps
// clear of the labels already there, and returns the number of rows.
// Vertical positions follow in layoutMarkers, once the plot top is known.
func (l *chartLayout) assignMarkerRows(markers []Marker) int {
	type span struct{ x0, x1 float64 }
	var rows [][]span
	for _, marker := range markers {
		text := truncateText(marker.Label, markerLabelStyle, maxMarkerLabelWidth)
		width := measureText(text, markerLabelStyle).width
		x0 := max(l.plot.x0, min(l.xAt(marker.Index)-width/2, l.plot.x1-width))
		s := span{x0, x0 + width}
		row := slices.IndexFunc(rows, func(row []span) bool {
			return !slices.ContainsFunc(row, func(other span) bool {
				return s.x0 < other.x1+markerLabelMinGap && other.x0 < s.x1+markerLabelMinGap
			})
		})
		if row < 0 {
			row = len(rows)
			rows = append(rows, nil)
		}
		rows[row] = append(rows[row], s)
		l.markerLabels = append(l.markerLabels, markerLabel{
			index: marker.Index,
			row:   row,
			label: textItem{text: text, origin: point{x0, 0}},
		})
	}
	return len(rows)
}

func (l *chartLayout) markerRowTop(row int) float64 {
	return l.plot.y0 - markerRowsGap - float64(row+1)*markerRowHeight
}

func (l *chartLayout) layoutMarkers() {
	// Markers at one index share a line, which starts below the label
	// farthest from the plot. Two overlapping translucent lines would show
	// darker than one.
	for i, ml := range l.markerLabels {
		rowTop := l.markerRowTop(ml.row)
		baseline := baselineCentered(rowTop+markerRowHeight/2, markerLabelStyle)
		l.markerLabels[i].label = newTextItem(ml.label.text, point{ml.label.origin.x, baseline}, markerLabelStyle, 0)
		top := rowTop + markerRowHeight
		if j := slices.IndexFunc(l.markerLines, func(line markerLine) bool { return line.index == ml.index }); j >= 0 {
			l.markerLines[j].top = min(l.markerLines[j].top, top)
		} else {
			l.markerLines = append(l.markerLines, markerLine{index: ml.index, x: math.Floor(l.xAt(ml.index)) + 0.5, top: top})
		}
	}
	for i := range l.markerLines {
		line := &l.markerLines[i]
		line.spans = [][2]float64{{line.top, l.plot.y1}}
		for _, ml := range l.markerLabels {
			rowTop := l.markerRowTop(ml.row)
			box := ml.label.box
			if rowTop >= line.top && line.x > box.x0-markerLabelMinGap/2 && line.x < box.x1+markerLabelMinGap/2 {
				line.spans = cutSpans(line.spans, rowTop, rowTop+markerRowHeight)
			}
		}
	}
}

func cutSpans(spans [][2]float64, from, to float64) [][2]float64 {
	var out [][2]float64
	for _, span := range spans {
		if span[0] < from {
			out = append(out, [2]float64{span[0], min(span[1], from)})
		}
		if span[1] > to {
			out = append(out, [2]float64{max(span[0], to), span[1]})
		}
	}
	return out
}
