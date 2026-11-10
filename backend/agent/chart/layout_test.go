package chart

import (
	"fmt"
	"math"
	"slices"
	"strings"
	"testing"
)

const epsilon = 1e-6

func near(a, b, tolerance float64) bool { return math.Abs(a-b) <= tolerance }

func mustLayout(t *testing.T, spec Spec) chartLayout {
	t.Helper()
	l, err := layoutChart(spec)
	if err != nil {
		t.Fatalf("layoutChart: %v", err)
	}
	return l
}

func lineSpec(values ...float64) Spec {
	return Spec{Kind: Line, Title: "T", XLabels: indexLabels("x", len(values)), Series: []Series{{Name: "s", Values: values}}}
}

func barSpec(labels []string, series ...[]float64) Spec {
	spec := Spec{Kind: Bar, Title: "T", XLabels: labels}
	for i, values := range series {
		spec.Series = append(spec.Series, Series{Name: fmt.Sprintf("s%d", i), Values: values})
	}
	return spec
}

func inside(outer, inner rect) bool {
	return inner.x0 >= outer.x0-epsilon && inner.x1 <= outer.x1+epsilon && inner.y0 >= outer.y0-epsilon && inner.y1 <= outer.y1+epsilon
}

func overlap(a, b rect) bool { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1 }

func centerX(r rect) float64 { return (r.x0 + r.x1) / 2 }

// quadsOverlap tests two convex quads with the separating axis theorem.
func quadsOverlap(a, b [4]point) bool {
	for _, quad := range [][4]point{a, b} {
		for i := range quad {
			next := quad[(i+1)%4]
			axis := point{quad[i].y - next.y, next.x - quad[i].x}
			project := func(q [4]point) (float64, float64) {
				lo, hi := math.Inf(1), math.Inf(-1)
				for _, pt := range q {
					d := pt.x*axis.x + pt.y*axis.y
					lo, hi = min(lo, d), max(hi, d)
				}
				return lo, hi
			}
			aLo, aHi := project(a)
			bLo, bHi := project(b)
			if aHi <= bLo+epsilon || bHi <= aLo+epsilon {
				return false
			}
		}
	}
	return true
}

func xIndices(l chartLayout) []int {
	var indices []int
	for _, tick := range l.xTicks {
		indices = append(indices, tick.index)
	}
	return indices
}

func TestLayoutInvariants(t *testing.T) {
	for _, gc := range galleryCases {
		t.Run(gc.name, func(t *testing.T) {
			checkLayout(t, gc.spec, mustLayout(t, gc.spec))
		})
	}
}

// checkLayout reports each layout property that every valid spec must have.
func checkLayout(t *testing.T, spec Spec, l chartLayout) {
	t.Helper()
	texts := []textItem{l.title}
	for _, entry := range l.legend {
		texts = append(texts, entry.label)
	}
	for _, tick := range slices.Concat(l.yTicks, l.xTicks) {
		texts = append(texts, tick.label)
	}
	for _, marker := range l.markerLabels {
		texts = append(texts, marker.label)
	}
	for _, missing := range l.missings {
		texts = append(texts, missing.label)
	}
	canvas := rect{0, 0, Width, float64(l.height)}
	for i, a := range texts {
		if a.text == "" {
			continue
		}
		if !inside(canvas, a.box) {
			t.Errorf("text %q box %+v is outside the canvas", a.text, a.box)
		}
		for _, b := range texts[i+1:] {
			if b.text != "" && overlap(a.box, b.box) && quadsOverlap(a.quad, b.quad) {
				t.Errorf("texts %q and %q overlap", a.text, b.text)
			}
		}
	}
	seen := map[string]bool{}
	for _, tick := range l.yTicks {
		if seen[tick.label.text] {
			t.Errorf("y label %q repeats", tick.label.text)
		}
		seen[tick.label.text] = true
	}

	lowest := 0.0
	for _, tick := range l.xTicks {
		lowest = max(lowest, tick.label.box.y1)
	}
	if want := int(math.Ceil(lowest)) + outerPadding; l.height != want {
		t.Errorf("height = %d, want %d below the lowest x label", l.height, want)
	}
	if !near(l.plot.height(), plotHeight, epsilon) || l.plot.width() <= 0 {
		t.Errorf("plot %+v, want a positive width and a height of %d", l.plot, plotHeight)
	}
	if last := l.xTicks[len(l.xTicks)-1].index; last != len(spec.XLabels)-1 {
		t.Errorf("last x label index = %d, want the last position", last)
	}
	for i, bar := range l.bars {
		if !inside(l.plot, bar.rect) {
			t.Errorf("bar %+v is outside the plot", bar.rect)
		}
		for _, other := range l.bars[i+1:] {
			if overlap(bar.rect, other.rect) {
				t.Errorf("bars %+v and %+v overlap", bar.rect, other.rect)
			}
		}
		for _, missing := range l.missings {
			if overlap(bar.rect, missing.label.box) {
				t.Errorf("bar %+v overlaps the missing label at %+v", bar.rect, missing.label.box)
			}
		}
	}
	points := []point{}
	for _, run := range l.lines {
		points = append(points, run.points...)
	}
	for _, pt := range l.points {
		points = append(points, pt.center)
	}
	for _, pt := range points {
		if !inside(l.plot, rect{pt.x, pt.y, pt.x, pt.y}) {
			t.Errorf("line point %+v is outside the plot", pt)
		}
	}
	if band := l.inProgressBand; band != nil && (!inside(l.plot, *band) || band.width() <= 0) {
		t.Errorf("in-progress band %+v is not inside the plot", *band)
	}
	for _, marker := range l.markerLabels {
		if box := marker.label.box; box.x0 < l.plot.x0-epsilon || box.x1 > l.plot.x1+epsilon || box.y1 > l.plot.y0 {
			t.Errorf("marker label %q box %+v is not above the plot", marker.label.text, box)
		}
	}
	// A marker line covers the pixel column of its x position, and the last
	// x position of a line chart is on the plot's right edge.
	for _, line := range l.markerLines {
		if line.x < l.plot.x0 || line.x > l.plot.x1+1 {
			t.Errorf("marker line at x %v is outside the plot", line.x)
		}
		for _, span := range line.spans {
			if span[0] >= span[1] || span[0] < line.top || span[1] > l.plot.y1 {
				t.Errorf("marker line span %v is outside %v to %v", span, line.top, l.plot.y1)
			}
			for _, marker := range l.markerLabels {
				if box := marker.label.box; marker.label.text != "" && overlap(box, rect{line.x - 0.5, span[0], line.x + 0.5, span[1]}) {
					t.Errorf("marker line at x %v crosses the label %q", line.x, marker.label.text)
				}
			}
		}
	}
	for _, entry := range l.legend {
		if entry.swatch.x0 < outerPadding || entry.label.box.x1 > Width-outerPadding+epsilon {
			t.Errorf("legend entry %q is outside the content width", entry.label.text)
		}
	}
}

func TestXPositions(t *testing.T) {
	for _, kind := range []Kind{Line, Bar} {
		for _, n := range []int{1, 2, 5} {
			spec := lineSpec(wave(n, 50, 20, 7, 0)...)
			spec.Kind = kind
			l := mustLayout(t, spec)
			for i := range n {
				want := l.plot.x0 + float64(i)*l.plot.width()/float64(n-1)
				if kind == Bar || n == 1 {
					want = l.plot.x0 + (float64(i)+0.5)*l.plot.width()/float64(n)
				}
				if !near(l.xAt(i), want, epsilon) {
					t.Errorf("kind %d n=%d: x of %d = %v, want %v", kind, n, i, l.xAt(i), want)
				}
			}
			for _, tick := range l.xTicks {
				if mark := tick.mark; !near(centerX(mark), l.xAt(tick.index), 0.5+epsilon) || mark.width() != 1 || mark.y0 != l.plot.y1 || mark.height() != tickLength {
					t.Errorf("kind %d n=%d: x tick %+v, want a 1x5 mark below the plot at %v", kind, n, mark, l.xAt(tick.index))
				}
			}
			for _, run := range l.lines {
				for k, pt := range run.points {
					if pt.x != l.xAt(run.from+k) {
						t.Errorf("kind %d n=%d: point %d x = %v", kind, n, run.from+k, pt.x)
					}
				}
			}
			for _, pt := range l.points {
				if pt.center.x != l.xAt(pt.index) {
					t.Errorf("kind %d n=%d: point %d x = %v", kind, n, pt.index, pt.center.x)
				}
			}
			for _, bar := range l.bars {
				if !near(centerX(bar.rect), l.xAt(bar.index), 1) {
					t.Errorf("kind %d n=%d: bar %d center %v, want %v", kind, n, bar.index, centerX(bar.rect), l.xAt(bar.index))
				}
			}
		}
	}
}

func TestYAxis(t *testing.T) {
	plain := lineSpec(1200, 4500, 3100)
	withUnit := plain
	withUnit.YUnit = "ms"
	a, b := mustLayout(t, plain), mustLayout(t, withUnit)
	if b.plot.x0 <= a.plot.x0 {
		t.Errorf("plot left with unit = %v, without = %v; want it further right", b.plot.x0, a.plot.x0)
	}
	for _, l := range []chartLayout{a, b} {
		if l.scale.min != 0 {
			t.Errorf("scale min = %v, want 0 for positive values", l.scale.min)
		}
		widest := 0.0
		for i, tick := range l.yTicks {
			widest = max(widest, measureText(tick.label.text, tickLabelStyle).width)
			if !near(tick.label.box.x1, l.plot.x0-tickLabelOffset, epsilon) {
				t.Errorf("y label %q ends at %v, want right-aligned at %v", tick.label.text, tick.label.box.x1, l.plot.x0-tickLabelOffset)
			}
			y := l.valueY(l.scale.ticks[i])
			if mark := tick.mark; !near((mark.y0+mark.y1)/2, y, 0.5+epsilon) || mark.height() != 1 || mark.x0 != l.plot.x0-tickLength || mark.x1 != l.plot.x0 {
				t.Errorf("y tick %+v, want a 5x1 mark left of the plot at %v", mark, y)
			}
		}
		if want := math.Ceil(outerPadding + widest + tickLabelOffset); l.plot.x0 != want {
			t.Errorf("plot left = %v, want %v", l.plot.x0, want)
		}
	}
}

func TestGridDotPositions(t *testing.T) {
	tests := []struct {
		name   string
		ticks  []float64
		length float64
		want   []float64
	}{
		{"ticks at both ends", []float64{0, 56, 112}, 112, []float64{0, 14, 28, 42, 56, 70, 84, 98, 112}},
		{"extended to the axis ends", []float64{10, 50}, 60, []float64{0, 10, 20, 30, 40, 50, 60}},
		{"half pixel tolerance", []float64{0, 40}, 50.4, []float64{0, 10, 20, 30, 40, 50}},
	}
	for _, tt := range tests {
		got := gridDotPositions(tt.ticks, tt.length)
		if !slices.EqualFunc(got, tt.want, func(a, b float64) bool { return near(a, b, epsilon) }) {
			t.Errorf("%s: got %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestLineXLabelThinning(t *testing.T) {
	for _, labels := range [][]string{hourLabels(), dailyLabels("Jun", 30), indexLabels("Day ", 100)} {
		n := len(labels)
		spec := lineSpec(wave(n, 50, 20, 7, 0)...)
		spec.XLabels = labels
		l := mustLayout(t, spec)
		indices := xIndices(l)
		step := indices[1] - indices[0]
		if wantAll := n == 24; wantAll != (step == 1) {
			t.Errorf("n=%d: step = %d", n, step)
		}
		for j := 1; j < len(indices); j++ {
			if indices[j]-indices[j-1] != step {
				t.Fatalf("n=%d: label indices %v are not evenly spaced", n, indices)
			}
		}
		if indices[len(indices)-1] != n-1 || indices[0] >= step {
			t.Errorf("n=%d: label indices %v, want them counted back from the last", n, indices)
		}
		if step > 1 && horizontalLabelsFit(l.xTicksEvery(n, step-1, func(i int) textItem { return l.horizontalXLabel(labels[i], i) })) {
			t.Errorf("n=%d: step %d also fits, want the smallest step", n, step-1)
		}
		for _, tick := range l.xTicks {
			if tick.label.angle != 0 {
				t.Fatalf("n=%d: line label %q is rotated", n, tick.label.text)
			}
		}
	}
}

func TestBarXLabels(t *testing.T) {
	short := mustLayout(t, barSpec([]string{"Android", "iOS", "Web"}, []float64{1, 2, 3}))
	for _, tick := range short.xTicks {
		if tick.label.angle != 0 || !near(centerX(tick.label.box), short.xAt(tick.index), epsilon) {
			t.Errorf("short label %q is not horizontal and centered under its band", tick.label.text)
		}
	}

	// Rotated labels keep at most 11 characters, the last one an ellipsis.
	labels := []string{"1.0.0 (100)", "/api/payment-methods/default/cards", "/api/cart/items/recalculate-totals", "/api/products/search/suggestions", "/api/orders/history/export-as-csv-file"}
	l := mustLayout(t, barSpec(labels, []float64{420, 310, 520, 280, 650}))
	if got := xIndices(l); !slices.Equal(got, []int{0, 1, 2, 3, 4}) {
		t.Fatalf("label indices = %v, want all five", got)
	}
	for k, tick := range l.xTicks {
		label := tick.label
		want := labels[k]
		if runes := []rune(want); len(runes) > maxRotatedLabelRunes {
			want = string(runes[:maxRotatedLabelRunes-1]) + ellipsis
		}
		if label.angle != rotatedLabelAngle || label.text != want {
			t.Errorf("label %q at angle %v, want %q at %v", label.text, label.angle, want, rotatedLabelAngle)
		}
		// The label starts at its tick: the middle of its near edge is on
		// the tick's vertical line.
		if !near(label.quad[0].x+label.quad[3].x, 2*l.xAt(tick.index), 1) || label.box.y0 < l.plot.y1+tickLength {
			t.Errorf("label %q does not start at its tick", label.text)
		}
	}

	sameStart := []string{"ProductDetailActivity", "ProductDetailFragment", "CheckoutActivity", "SearchResultsScreen", "OnboardingCarousel", "SettingsActivity", "NotificationsScreen"}
	if _, err := layoutChart(barSpec(sameStart, wave(len(sameStart), 40, 20, 9, 0))); err == nil || !strings.Contains(err.Error(), "both appear as") {
		t.Errorf("rotated labels that look the same after cutting: error = %v, want one that quotes both labels", err)
	}

	many := mustLayout(t, barSpec(indexLabels("Device ", 100), wave(100, 40, 20, 9, 0)))
	indices := xIndices(many)
	pitch := float64(indices[1]-indices[0]) * many.xPitch
	need := (tickLabelStyle.size + rotatedLabelClearance) / math.Sin(rotatedLabelAngle)
	if many.xTicks[0].label.angle != rotatedLabelAngle || pitch < need || pitch-many.xPitch >= need {
		t.Errorf("label pitch %v for a need of %v, want the smallest step of rotated labels that fits", pitch, need)
	}
}

func barsByIndex(l chartLayout) map[int][]barItem {
	bars := map[int][]barItem{}
	for _, bar := range l.bars {
		bars[bar.index] = append(bars[bar.index], bar)
	}
	return bars
}

func TestBarLanes(t *testing.T) {
	for _, n := range []int{2, 12} {
		l := mustLayout(t, barSpec(indexLabels("c", n), wave(n, 30, 10, 5, 0), wave(n, 20, 10, 5, 1), wave(n, 10, 5, 5, 2)))
		for i, bars := range barsByIndex(l) {
			if len(bars) != 3 {
				t.Fatalf("n=%d category %d: %d bars, want 3", n, i, len(bars))
			}
			for k, bar := range bars {
				if bar.series != k || bar.rect.width() > maxBarWidth {
					t.Errorf("n=%d category %d: bar %d is series %d, width %v", n, i, k, bar.series, bar.rect.width())
				}
				if k > 0 && bar.rect.x0 < bars[k-1].rect.x1 {
					t.Errorf("n=%d category %d: bars %d and %d overlap", n, i, k-1, k)
				}
			}
			if n == 2 && (bars[0].rect.width() != maxBarWidth || bars[1].rect.x0-bars[0].rect.x1 != barLaneGap) {
				t.Errorf("wide categories: width %v and gap %v, want %d and %d", bars[0].rect.width(), bars[1].rect.x0-bars[0].rect.x1, maxBarWidth, barLaneGap)
			}
			if center := (bars[0].rect.x0 + bars[2].rect.x1) / 2; !near(center, l.xAt(i), 1) {
				t.Errorf("n=%d category %d: group center %v, want %v", n, i, center, l.xAt(i))
			}
		}
	}

	tests := []struct {
		name     string
		series   [][]float64
		oneLane  bool
		missings int
	}{
		{"series with no shared category", [][]float64{{320, 210, 0}, {0, 0, 85}}, true, 0},
		{"series with a shared category", [][]float64{{1, 2, 0}, {0, 3, 4}}, false, 0},
		{"missing values with no shared category", [][]float64{{320, 210, nan}, {nan, nan, 85}}, true, 0},
		{"category with no value in any series", [][]float64{{320, nan, nan}, {nan, nan, 85}}, true, 1},
		{"missing values with a shared category", [][]float64{{1, 2, nan}, {nan, 3, 4}}, false, 2},
		{"series with no values", [][]float64{{1, 2, 3}, {nan, nan, nan}}, false, 3},
		{"missing value alongside zero", [][]float64{{0, 4, 1}, {nan, 0, 0}}, false, 1},
	}
	for _, tt := range tests {
		l := mustLayout(t, barSpec([]string{"a", "b", "c"}, tt.series...))
		for _, bar := range l.bars {
			if centered := near(centerX(bar.rect), l.xAt(bar.index), 1); centered != tt.oneLane {
				t.Errorf("%s: bar %d/%d centered = %v, want %v", tt.name, bar.series, bar.index, centered, tt.oneLane)
			}
		}
		if len(l.missings) != tt.missings {
			t.Errorf("%s: %d \"n/a\" labels, want %d", tt.name, len(l.missings), tt.missings)
		}
	}
}

func TestLineRuns(t *testing.T) {
	type run struct {
		from, to int
		dashed   bool
	}
	tests := []struct {
		name       string
		values     []float64
		inProgress int
		runs       []run
		points     []int
	}{
		{"no gaps", []float64{1, 2, 3, 4}, 0, []run{{0, 3, false}}, nil},
		{"gap splits the line", []float64{1, 2, nan, nan, 5, 6}, 0, []run{{0, 1, false}, {4, 5, false}}, nil},
		{"isolated points", []float64{1, nan, 3, 4, nan, 6}, 0, []run{{2, 3, false}}, []int{0, 5}},
		{"infinity is a gap", []float64{1, 2, math.Inf(1), 4, math.Inf(-1)}, 0, []run{{0, 1, false}}, []int{3}},
		{"one in progress", []float64{1, 2, 3, 4, 5}, 1, []run{{0, 3, false}, {3, 4, true}}, nil},
		{"three in progress", []float64{1, 2, 3, 4, 5}, 3, []run{{0, 1, false}, {1, 4, true}}, nil},
		{"all in progress", []float64{1, 2, 3, 4, 5}, 5, []run{{0, 4, true}}, nil},
		{"gap at the boundary", []float64{1, 2, nan, 4, 5}, 2, []run{{0, 1, false}, {3, 4, true}}, nil},
		{"run ends at the last completed point", []float64{1, 2, 3, nan, 5}, 1, []run{{0, 2, false}}, []int{4}},
	}
	for _, tt := range tests {
		spec := lineSpec(tt.values...)
		spec.InProgressCount = tt.inProgress
		l := mustLayout(t, spec)
		var runs []run
		for _, r := range l.lines {
			runs = append(runs, run{r.from, r.from + len(r.points) - 1, r.dashed})
		}
		var points []int
		for _, pt := range l.points {
			points = append(points, pt.index)
		}
		if !slices.Equal(runs, tt.runs) || !slices.Equal(points, tt.points) {
			t.Errorf("%s: runs %v points %v, want runs %v points %v", tt.name, runs, points, tt.runs, tt.points)
		}
	}
}

// missingSpec builds a bar chart with a missing value at index 1 in the
// last series.
func missingSpec(categories, series int) Spec {
	var lists [][]float64
	for s := range series {
		lists = append(lists, wave(categories, 30, 10, 5, float64(s)))
	}
	lists[series-1][1] = nan
	return barSpec(indexLabels("c", categories), lists...)
}

func TestMissingBarLabel(t *testing.T) {
	const upright, rotated = 0, -math.Pi / 2
	tests := []struct {
		name   string
		spec   Spec
		labels int
		angle  float64
		above  bool
	}{
		{"upright above zero", barSpec([]string{"a", "b", "c"}, []float64{10, 20, 30}, []float64{5, nan, 15}), 1, upright, true},
		{"below zero for negative values", barSpec([]string{"a", "b"}, []float64{-10, nan}), 1, upright, false},
		{"rotated in a narrow lane", missingSpec(12, 3), 1, rotated, true},
		{"omitted in a lane narrower than the text height", missingSpec(60, 2), 0, 0, false},
		{"no label for a real zero", barSpec([]string{"a", "b", "c"}, []float64{4, 0, 6}), 0, 0, false},
	}
	metrics := measureText(missingLabel, missingStyle)
	for _, tt := range tests {
		l := mustLayout(t, tt.spec)
		bars := 0
		for _, series := range tt.spec.Series {
			for _, v := range series.Values {
				if finite(v) && v != 0 {
					bars++
				}
			}
		}
		if len(l.bars) != bars || len(l.missings) != tt.labels {
			t.Fatalf("%s: %d bars and %d labels, want %d and %d", tt.name, len(l.bars), len(l.missings), bars, tt.labels)
		}
		if tt.labels == 0 {
			continue
		}
		missing := l.missings[0]
		box, zeroY := missing.label.box, math.Round(l.valueY(0))
		if missing.label.angle != tt.angle || missing.label.text != missingLabel {
			t.Errorf("%s: %q at angle %v, want %v", tt.name, missing.label.text, missing.label.angle, tt.angle)
		}
		if tt.angle == rotated && missing.lane.width() >= metrics.width {
			t.Errorf("%s: lane width %v is not narrower than the upright text", tt.name, missing.lane.width())
		}
		if (tt.above && box.y1 > zeroY) || (!tt.above && box.y0 < zeroY) || !inside(l.plot, box) {
			t.Errorf("%s: box %+v, want it inside the plot and above the zero line at %v = %v", tt.name, box, zeroY, tt.above)
		}
		if !near(centerX(box), centerX(missing.lane), 1.5) || box.x0 < missing.lane.x0-0.5 || box.x1 > missing.lane.x1+0.5 {
			t.Errorf("%s: box %+v is not centered in its lane %+v", tt.name, box, missing.lane)
		}
		for _, bar := range l.bars {
			if overlap(box, bar.rect) {
				t.Errorf("%s: box %+v overlaps bar %+v", tt.name, box, bar.rect)
			}
		}
	}
	if width := mustLayout(t, missingSpec(60, 2)).bars[0].rect.width(); width >= metrics.ascent+metrics.descent {
		t.Errorf("omitted case: lane width %v is not narrower than the rotated text", width)
	}
}

func TestNegativeValues(t *testing.T) {
	tests := []struct {
		name     string
		spec     Spec
		zeroLine bool
	}{
		{"positive line", lineSpec(1, 2, 3), false},
		{"line across zero", lineSpec(-2, 1, 3), true},
		{"negative line", lineSpec(-50, -10, -30), true},
		{"positive bars", barSpec([]string{"a", "b"}, []float64{1, 2}), false},
		{"bars across zero", barSpec([]string{"a", "b", "c"}, []float64{12.5, -4.2, 0.001}), true},
	}
	for _, tt := range tests {
		l := mustLayout(t, tt.spec)
		if got := l.zeroLine != nil; got != tt.zeroLine {
			t.Fatalf("%s: zero line = %v, want %v", tt.name, got, tt.zeroLine)
		}
		zeroY := math.Round(l.valueY(0))
		if z := l.zeroLine; z != nil && (z.y1 != zeroY || z.height() != 1 || z.x0 != l.plot.x0 || z.x1 != l.plot.x1) {
			t.Errorf("%s: zero line %+v, want a 1px line across the plot ending at %v", tt.name, *z, zeroY)
		}
		// Bars grow from the zero line, and a small value still shows as one
		// pixel row.
		for _, bar := range l.bars {
			v := tt.spec.Series[bar.series].Values[bar.index]
			if (v > 0 && bar.rect.y1 != zeroY) || (v < 0 && bar.rect.y0 != zeroY) || bar.rect.height() < 1 {
				t.Errorf("%s: bar %+v for %v does not grow from %v", tt.name, bar.rect, v, zeroY)
			}
		}
	}
}

func TestInProgressBand(t *testing.T) {
	tests := []struct {
		kind     Kind
		n, count int
	}{
		{Line, 10, 3}, {Line, 10, 10}, {Line, 1, 1}, {Bar, 5, 1}, {Bar, 5, 5},
	}
	for _, tt := range tests {
		spec := lineSpec(wave(tt.n, 50, 20, 7, 0)...)
		spec.Kind, spec.InProgressCount = tt.kind, tt.count
		l := mustLayout(t, spec)
		// For bars, the band starts at the first in-progress category. For a
		// line, it starts at the last completed point.
		want := l.plot.x0
		switch first := tt.n - tt.count; {
		case tt.kind == Bar:
			want = math.Round(l.plot.x0 + float64(first)*l.xPitch)
		case first > 0:
			want = math.Round(l.xAt(first - 1))
		}
		if band := l.inProgressBand; band == nil || *band != (rect{want, l.plot.y0, l.plot.x1, l.plot.y1}) {
			t.Errorf("kind %d n=%d count=%d: band %v, want from %v to the plot's right edge", tt.kind, tt.n, tt.count, band, want)
		}
		if last := l.legend[len(l.legend)-1]; len(l.legend) != 2 || last.label.text != inProgressLabel || last.color != inProgressSwatchColor {
			t.Errorf("kind %d n=%d count=%d: legend %+v, want the in-progress entry last", tt.kind, tt.n, tt.count, l.legend)
		}
	}
	if l := mustLayout(t, lineSpec(1, 2, 3)); l.inProgressBand != nil || len(l.legend) != 1 {
		t.Errorf("no in-progress positions: band %v, %d legend entries", l.inProgressBand, len(l.legend))
	}
}

func TestMarkers(t *testing.T) {
	spec := lineSpec(wave(20, 50, 20, 7, 0)...)
	spec.Markers = []Marker{{Index: 0, Label: "1.8.0 released"}, {Index: 1, Label: "1.8.1 hotfix"}, {Index: 10, Label: "release"}, {Index: 19, Label: "Payments outage started"}}
	l := mustLayout(t, spec)

	var rows []int
	for _, marker := range l.markerLabels {
		rows = append(rows, marker.row)
		if marker.label.style != markerLabelStyle {
			t.Errorf("marker %q style %+v", marker.label.text, marker.label.style)
		}
	}
	if !slices.Equal(rows, []int{0, 1, 0, 0}) {
		t.Fatalf("rows = %v, want a second row for the label that collides", rows)
	}
	if want := float64(outerPadding + legendSwatchSize + headerGap + 2*markerRowHeight + markerRowsGap); l.plot.y0 != want {
		t.Errorf("plot top = %v, want %v below two marker rows", l.plot.y0, want)
	}
	first, middle, last := l.markerLabels[0].label.box, l.markerLabels[2].label.box, l.markerLabels[3].label.box
	if !near(first.x0, l.plot.x0, epsilon) || !near(last.x1, l.plot.x1, epsilon) {
		t.Errorf("edge labels %+v and %+v are not clamped to the plot", first, last)
	}
	if overlap(first, l.markerLabels[1].label.box) {
		t.Errorf("labels in separate rows overlap")
	}

	line := l.markerLines[2]
	if line.index != 10 || line.x != math.Floor(l.xAt(10))+0.5 || !near(centerX(middle), l.xAt(10), epsilon) {
		t.Errorf("line %+v and label %+v, want both at x %v", line, middle, l.xAt(10))
	}
	if top := l.plot.y0 - markerRowsGap; !slices.Equal(line.spans, [][2]float64{{top, l.plot.y1}}) || middle.y1 > top+epsilon {
		t.Errorf("spans %v, want one from below the label at %v to the plot bottom", line.spans, top)
	}
	// The row 1 line starts below its own label and leaves a gap where it
	// passes the row 0 label.
	if spans := l.markerLines[1].spans; len(spans) != 1 || !near(spans[0][0], l.markerRowTop(0)+markerRowHeight, epsilon) {
		t.Errorf("row 1 line spans %v, want a gap at the row 0 label", spans)
	}

	same := lineSpec(1, 2, 3, 4)
	same.Markers = []Marker{{Index: 2, Label: "release"}, {Index: 2, Label: "incident"}}
	if l := mustLayout(t, same); len(l.markerLines) != 1 || l.markerLines[0].top != l.markerRowTop(1)+markerRowHeight {
		t.Errorf("markers at one index: lines %+v, want one line from the upper label", l.markerLines)
	}

	long := lineSpec(1, 2, 3, 4, 5, 6, 7)
	long.Markers = []Marker{{Index: 3, Label: "Rolled out new onboarding flow to all us"}}
	text := mustLayout(t, long).markerLabels[0].label.text
	if width := measureText(text, markerLabelStyle).width; width > maxMarkerLabelWidth || !strings.HasPrefix(long.Markers[0].Label, strings.TrimSuffix(text, ellipsis)) {
		t.Errorf("long label %q is %v wide, want a prefix cut to %d", text, width, maxMarkerLabelWidth)
	}
}

func TestHeader(t *testing.T) {
	names := func(names ...string) []Series {
		var series []Series
		for _, name := range names {
			series = append(series, Series{Name: name, Values: []float64{1, 2, 3}})
		}
		return series
	}

	t.Run("legend beside the title", func(t *testing.T) {
		spec := lineSpec(1, 2, 3)
		spec.Series = names("Crashes", "Fatal (crashes)", "Handled")
		l := mustLayout(t, spec)
		if l.title.origin.x != outerPadding || l.title.text != "T" || l.title.style != titleStyle {
			t.Errorf("title %+v", l.title)
		}
		for k, entry := range l.legend {
			if entry.swatch != (rect{entry.swatch.x0, outerPadding, entry.swatch.x0 + legendSwatchSize, outerPadding + legendSwatchSize}) {
				t.Errorf("swatch %+v, want 12x12 on the title row", entry.swatch)
			}
			if entry.label.origin != (point{entry.swatch.x1 + legendSwatchGap, l.legend[0].label.origin.y}) || entry.label.style != legendStyle {
				t.Errorf("label %q is not on the shared baseline after its swatch", entry.label.text)
			}
			if k > 0 && !near(entry.swatch.x0-l.legend[k-1].label.box.x1, legendItemGap, 1) {
				t.Errorf("gap before entry %d = %v", k, entry.swatch.x0-l.legend[k-1].label.box.x1)
			}
		}
		if right := l.legend[len(l.legend)-1].label.box.x1; !near(right, Width-outerPadding, 1) {
			t.Errorf("legend ends at %v, want right-aligned", right)
		}
		if l.plot.y0 != outerPadding+legendSwatchSize+headerGap {
			t.Errorf("plot top = %v", l.plot.y0)
		}
	})

	t.Run("legend below a long title", func(t *testing.T) {
		spec := lineSpec(1, 2, 3)
		spec.Title = "Median cold launch time across all Android devices for the last two weeks"
		spec.Series = names("Cold launch p50", "Warm launch p50")
		l := mustLayout(t, spec)
		row := l.legend[0].swatch
		if l.title.text != spec.Title || row.x0 != outerPadding || row.y0 <= l.title.box.y1 || l.legend[1].swatch.y0 != row.y0 {
			t.Errorf("title %q, legend %+v, want the whole title and one left-aligned row below it", l.title.text, l.legend)
		}
		if l.plot.y0 != row.y1+headerGap {
			t.Errorf("plot top = %v, want %v", l.plot.y0, row.y1+headerGap)
		}
	})

	t.Run("wrapping legend", func(t *testing.T) {
		spec := lineSpec(1, 2, 3)
		spec.Series = names("CheckoutActivity (payment step)", "ProductDetailFragment", "SearchResultsScreen with filters", "OnboardingCarouselView", "Settings > Notifications > Quiet hours", strings.Repeat("A very long series name ", 6))
		l := mustLayout(t, spec)
		rows := 1
		for k := 1; k < len(l.legend); k++ {
			a, b := l.legend[k-1], l.legend[k]
			switch b.swatch.y0 {
			case a.swatch.y0:
				if b.swatch.x0 < a.label.box.x1 || b.label.origin.y != a.label.origin.y || b.label.box.x1 > Width-outerPadding+epsilon {
					t.Errorf("entries %d and %d overlap, do not share a baseline or pass the content width", k-1, k)
				}
			case a.swatch.y0 + legendSwatchSize + legendRowGap:
				rows++
				if b.swatch.x0 != outerPadding {
					t.Errorf("row %d starts at %v", rows, b.swatch.x0)
				}
			default:
				t.Errorf("row pitch %v", b.swatch.y0-a.swatch.y0)
			}
		}
		last := l.legend[len(l.legend)-1]
		if rows < 3 || last.swatch.y0 == l.legend[len(l.legend)-2].swatch.y0 || !strings.HasSuffix(last.label.text, ellipsis) {
			t.Errorf("%d rows; an entry wider than a row, %q, shares its row or is not truncated", rows, last.label.text)
		}
	})

	t.Run("truncated title", func(t *testing.T) {
		spec := lineSpec(1, 2, 3)
		spec.Title = strings.Repeat("Sessions with a handled exception on checkout ", 4)
		l := mustLayout(t, spec)
		text := strings.TrimSuffix(l.title.text, ellipsis)
		if text == l.title.text || strings.HasSuffix(text, " ") || measureText(l.title.text, titleStyle).width > Width-2*outerPadding {
			t.Errorf("title %q, want it cut at a word with an ellipsis inside the content width", l.title.text)
		}
		if l.legend[0].swatch.y0 <= l.title.origin.y {
			t.Errorf("legend is not below the truncated title")
		}
	})
}
