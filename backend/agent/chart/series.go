package chart

import (
	"math"
	"slices"
)

// shareOneLane reports whether the bars can share one centered lane.
// Grouped lanes give empty cells a lane of their own, which can shift bars
// away from category centers. When no category has bars in multiple series,
// one centered lane shows the same data. Zero and missing values are both
// empty cells.
//
// A shared lane cannot show "n/a" for just one series. Keep lanes grouped
// when "n/a" is the only sign of missing data: a series has no values, or a
// category has no bars because some series have zero and others are missing.
func shareOneLane(values [][]float64) bool {
	for _, series := range values {
		if !slices.ContainsFunc(series, finite) {
			return false
		}
	}
	for i := range values[0] {
		bars, missing := 0, 0
		for _, series := range values {
			switch v := series[i]; {
			case math.IsNaN(v):
				missing++
			case v != 0:
				bars++
			}
		}
		if bars > 1 || (bars == 0 && missing > 0 && missing < len(values)) {
			return false
		}
	}
	return true
}

// missingInAll reports whether every series lacks a value at index i.
func missingInAll(values [][]float64, i int) bool {
	for _, series := range values {
		if !math.IsNaN(series[i]) {
			return false
		}
	}
	return true
}

func (l *chartLayout) layoutBars(values [][]float64) {
	lanes := len(values)
	if shareOneLane(values) {
		lanes = 1
	}
	room := barGroupRatio * l.xPitch
	gap := min(barLaneGap, room/float64(lanes)/4)
	laneWidth := min(maxBarWidth, (room-float64(lanes-1)*gap)/float64(lanes))
	groupWidth := float64(lanes)*laneWidth + float64(lanes-1)*gap
	zeroY := math.Round(l.valueY(0))

	for s, series := range values {
		lane := s
		if lanes == 1 {
			lane = 0
		}
		for i, v := range series {
			x0 := l.xAt(i) - groupWidth/2 + float64(lane)*(laneWidth+gap)
			x1 := x0 + laneWidth
			if laneWidth >= 3 {
				x0 = math.Round(x0)
				x1 = x0 + math.Round(laneWidth)
			}
			switch {
			case math.IsNaN(v):
				// A shared lane shows "n/a" for a category only when no
				// series has a value there.
				if lanes == 1 && (s > 0 || !missingInAll(values, i)) {
					continue
				}
				laneRect := rect{x0, l.plot.y0, x1, l.plot.y1}
				if label, ok := l.missingLabelIn(laneRect, zeroY); ok {
					l.missings = append(l.missings, missingItem{lane: laneRect, label: label})
				}
			case v != 0:
				y := math.Round(l.valueY(v))
				// A small non-zero value still shows as one pixel row.
				if y == zeroY {
					if v > 0 {
						y--
					} else {
						y++
					}
				}
				l.bars = append(l.bars, barItem{rect: rect{x0, min(y, zeroY), x1, max(y, zeroY)}, series: s, index: i})
			}
		}
	}
}

// missingLabelIn places "n/a" beside the zero line, on the side with room.
// If the text is wider than the lane, it rotates to read bottom to top. It
// returns false when even rotated text would overlap a neighboring lane.
func (l *chartLayout) missingLabelIn(lane rect, zeroY float64) (textItem, bool) {
	metrics := measureText(missingLabel, missingStyle)
	center := (lane.x0 + lane.x1) / 2
	// rise is how far the text reaches above its baseline, and drop is the
	// baseline's distance below the gap when the text goes under the zero
	// line.
	origin, angle := point{center - metrics.width/2, 0}, 0.0
	rise, drop := metrics.ascent, math.Round(metrics.capHeight)
	if metrics.width > lane.width() {
		if metrics.ascent+metrics.descent > lane.width() {
			return textItem{}, false
		}
		origin.x, angle = center+metrics.capHeight/2, -math.Pi/2
		rise, drop = metrics.width, metrics.width
	}
	if zeroY-l.plot.y0 >= rise+missingLabelGap {
		origin.y = zeroY - missingLabelGap
	} else {
		origin.y = zeroY + missingLabelGap + drop
	}
	return newTextItem(missingLabel, origin, missingStyle, angle), true
}

// layoutLines splits each series into runs of finite values. Segments that
// start at or after lastDone, the last completed index, are dashed.
func (l *chartLayout) layoutLines(values [][]float64, lastDone int) {
	for s, series := range values {
		for from := 0; from < len(series); from++ {
			if math.IsNaN(series[from]) {
				continue
			}
			to := from
			for to+1 < len(series) && !math.IsNaN(series[to+1]) {
				to++
			}
			if from == to {
				l.points = append(l.points, pointItem{center: l.dataPoint(series, from), series: s, index: from})
			} else {
				if end := min(to, lastDone); end > from {
					l.lines = append(l.lines, l.run(series, s, from, end, false))
				}
				if start := max(from, lastDone); to > start {
					l.lines = append(l.lines, l.run(series, s, start, to, true))
				}
			}
			from = to
		}
	}
}

func (l *chartLayout) dataPoint(series []float64, i int) point {
	return point{l.xAt(i), l.valueY(series[i])}
}

func (l *chartLayout) run(series []float64, s, from, to int, dashed bool) lineRun {
	points := make([]point, 0, to-from+1)
	for i := from; i <= to; i++ {
		points = append(points, l.dataPoint(series, i))
	}
	return lineRun{series: s, from: from, points: points, dashed: dashed}
}
