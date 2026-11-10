package chart

import (
	"fmt"
	"math"
	"slices"
)

func (l *chartLayout) layoutYAxis(labels []string) {
	for i, v := range l.scale.ticks {
		y := l.valueY(v)
		row := pixelRow(y)
		width := measureText(labels[i], tickLabelStyle).width
		origin := point{l.plot.x0 - tickLabelOffset - width, baselineCentered(y, tickLabelStyle)}
		l.yTicks = append(l.yTicks, axisTick{
			mark:  rect{l.plot.x0 - tickLength, row, l.plot.x0, row + 1},
			label: newTextItem(labels[i], origin, tickLabelStyle, 0),
		})
	}
}

// gridDotPositions follows the dashboard: four dots per tick interval, and
// the outer steps repeat beyond the first and last tick while they stay
// within the axis. ticks are pixel offsets in ascending order.
func gridDotPositions(ticks []float64, length float64) []float64 {
	const epsilon = 0.5
	var positions []float64
	firstStep := (ticks[1] - ticks[0]) / gridDotsPerTick
	for p := ticks[0] - firstStep; p >= -epsilon; p -= firstStep {
		positions = append(positions, p)
	}
	slices.Reverse(positions)
	for i := 0; i+1 < len(ticks); i++ {
		step := (ticks[i+1] - ticks[i]) / gridDotsPerTick
		for j := range gridDotsPerTick {
			positions = append(positions, ticks[i]+step*float64(j))
		}
	}
	last := ticks[len(ticks)-1]
	positions = append(positions, last)
	lastStep := (last - ticks[len(ticks)-2]) / gridDotsPerTick
	for p := last + lastStep; p <= length+epsilon; p += lastStep {
		positions = append(positions, p)
	}
	return positions
}

func (l *chartLayout) layoutGrid() {
	ticks := make([]float64, len(l.scale.ticks))
	for i, v := range l.scale.ticks {
		ticks[i] = l.valueY(v) - l.plot.y0
	}
	slices.Sort(ticks)
	ys := gridDotPositions(ticks, l.plot.height())
	spacing := ys[1] - ys[0]
	// Whole-pixel coordinates keep the dots aligned to the same pixels.
	for _, y := range ys {
		for x := 0.0; x <= l.plot.width()+0.5; x += spacing {
			l.gridDots = append(l.gridDots, point{math.Round(l.plot.x0 + x), math.Round(l.plot.y0 + y)})
		}
	}
}

func (l *chartLayout) layoutXAxis(spec Spec) error {
	n := len(spec.XLabels)
	// Thinning tries many steps, so each horizontal label is laid out once.
	horizontal := make([]textItem, n)
	for i, text := range spec.XLabels {
		horizontal[i] = l.horizontalXLabel(text, i)
	}
	horizontalAt := func(i int) textItem { return horizontal[i] }
	l.xTicks = l.xTicksEvery(n, 1, horizontalAt)
	switch {
	case horizontalLabelsFit(l.xTicks):
	case spec.Kind == Line:
		// Thinning stops at a single label, which always fits.
		for step := 2; !horizontalLabelsFit(l.xTicks); step++ {
			l.xTicks = l.xTicksEvery(n, step, horizontalAt)
		}
	default:
		pitch := (tickLabelStyle.size + rotatedLabelClearance) / math.Sin(rotatedLabelAngle)
		step := max(1, int(math.Ceil(pitch/l.xPitch-1e-9)))
		l.xTicks = l.xTicksEvery(n, step, func(i int) textItem { return l.rotatedXLabel(spec.XLabels[i], i) })
		// Images have no tooltips, so viewers cannot distinguish categories
		// with the same cut label.
		shown := map[string]string{}
		for _, tick := range l.xTicks {
			full := spec.XLabels[tick.index]
			if other, ok := shown[tick.label.text]; ok && other != full {
				return fmt.Errorf("chart: x labels %q and %q both appear as %q because long bar labels keep their first %d characters; use shorter labels that differ at the start",
					other, full, tick.label.text, maxRotatedLabelRunes-1)
			}
			shown[tick.label.text] = full
		}
	}
	return nil
}

// xTicksEvery returns a tick and a label for every step-th of n x indices,
// counted back from the last so that the last x position always has a label.
func (l *chartLayout) xTicksEvery(n, step int, label func(i int) textItem) []axisTick {
	var ticks []axisTick
	for i := n - 1; i >= 0; i -= step {
		x := math.Floor(l.xAt(i))
		ticks = append(ticks, axisTick{
			index: i,
			mark:  rect{x, l.plot.y1, x + 1, l.plot.y1 + tickLength},
			label: label(i),
		})
	}
	slices.Reverse(ticks)
	return ticks
}

func horizontalLabelsFit(ticks []axisTick) bool {
	for j := 1; j < len(ticks); j++ {
		if ticks[j].label.box.x0-ticks[j-1].label.box.x1 < xLabelMinGap {
			return false
		}
	}
	return true
}

func (l *chartLayout) horizontalXLabel(text string, i int) textItem {
	text = truncateText(text, tickLabelStyle, Width-2*labelEdgeMargin)
	width := measureText(text, tickLabelStyle).width
	x := max(labelEdgeMargin, min(l.xAt(i)-width/2, Width-labelEdgeMargin-width))
	return newTextItem(text, point{x, baselineBelow(l.plot.y1+tickLabelOffset, tickLabelStyle)}, tickLabelStyle, 0)
}

// rotatedXLabel starts the label at the tick and runs it down to the right,
// with the middle of its capital letters on the line through the tick.
func (l *chartLayout) rotatedXLabel(text string, i int) textItem {
	metrics := measureText("", tickLabelStyle)
	sin, cos := math.Sincos(rotatedLabelAngle)
	anchor := point{l.xAt(i), l.plot.y1 + tickLabelOffset}
	half := metrics.capHeight / 2
	origin := point{anchor.x - half*sin, anchor.y + half*cos}
	right := quadBox(textQuad(origin, 0, metrics, rotatedLabelAngle)).x1
	if runes := []rune(text); len(runes) > maxRotatedLabelRunes {
		text = string(runes[:maxRotatedLabelRunes-1]) + ellipsis
	}
	maxWidth := (Width - labelEdgeMargin - right) / cos
	return newTextItem(truncateText(text, tickLabelStyle, maxWidth), origin, tickLabelStyle, rotatedLabelAngle)
}
