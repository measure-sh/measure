package chart

import (
	"image/color"
	"math"
	"slices"
)

func (l chartLayout) paint() *canvas {
	canvas := newCanvas(Width, l.height, backgroundColor)
	fillRect := func(r rect, col color.NRGBA) { canvas.fillRect(r.x0, r.y0, r.x1, r.y1, col) }
	drawText := func(item textItem) { canvas.drawText(item.text, item.origin, item.style, item.angle) }

	for _, dot := range l.gridDots {
		canvas.fillCircle(dot, gridDotRadius, gridDotColor)
	}
	if l.inProgressBand != nil {
		fillRect(*l.inProgressBand, inProgressBandColor)
	}
	if l.zeroLine != nil {
		fillRect(*l.zeroLine, tickColor)
	}
	for _, bar := range l.bars {
		fillRect(bar.rect, seriesColor(bar.series))
	}
	for _, run := range l.lines {
		var pattern []float64
		if run.dashed {
			pattern = dash
		}
		canvas.strokeLine(run.points, lineWidth, seriesColor(run.series), pattern)
	}
	for _, pt := range l.points {
		canvas.fillCircle(pt.center, isolatedPointRadius, seriesColor(pt.series))
	}
	for _, missing := range l.missings {
		drawText(missing.label)
	}
	for _, line := range l.markerLines {
		for _, span := range line.spans {
			canvas.strokeLine([]point{{line.x, span[0]}, {line.x, span[1]}}, 1, markerLineColor, dash)
		}
	}
	for _, tick := range slices.Concat(l.yTicks, l.xTicks) {
		fillRect(tick.mark, tickColor)
		drawText(tick.label)
	}
	for _, marker := range l.markerLabels {
		drawText(marker.label)
	}
	drawText(l.title)
	for _, entry := range l.legend {
		canvas.fillPolygon(roundedRect(entry.swatch, legendSwatchRadius), entry.color)
		drawText(entry.label)
	}
	return canvas
}

func roundedRect(r rect, radius float64) []point {
	radius = min(radius, r.width()/2, r.height()/2)
	const steps = 6
	corners := []struct {
		center point
		start  float64
	}{
		{point{r.x1 - radius, r.y0 + radius}, -math.Pi / 2},
		{point{r.x1 - radius, r.y1 - radius}, 0},
		{point{r.x0 + radius, r.y1 - radius}, math.Pi / 2},
		{point{r.x0 + radius, r.y0 + radius}, math.Pi},
	}
	points := make([]point, 0, 4*(steps+1))
	for _, corner := range corners {
		for i := 0; i <= steps; i++ {
			sin, cos := math.Sincos(corner.start + math.Pi/2*float64(i)/steps)
			points = append(points, point{corner.center.x + radius*cos, corner.center.y + radius*sin})
		}
	}
	return points
}
