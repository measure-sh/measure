package chart

import (
	"image/color"
	"math"
)

func rgb(hex uint32) color.NRGBA {
	return color.NRGBA{uint8(hex >> 16), uint8(hex >> 8), uint8(hex), 255}
}

func withAlpha(c color.NRGBA, alpha float64) color.NRGBA {
	c.A = uint8(math.Round(alpha * 255))
	return c
}

var (
	backgroundColor      = rgb(0x111111)
	foregroundColor      = rgb(0xfafafa)
	mutedForegroundColor = rgb(0xa1a1a1)
	tickColor            = rgb(0x777777)

	gridDotColor          = withAlpha(mutedForegroundColor, 0.1)
	markerLineColor       = withAlpha(mutedForegroundColor, 0.6)
	inProgressBandColor   = withAlpha(foregroundColor, 0.06)
	inProgressSwatchColor = withAlpha(foregroundColor, 0.10)

	seriesPalette = []color.NRGBA{
		rgb(0x38bdf8),
		rgb(0xfbbf24),
		rgb(0xa78bfa),
		rgb(0x34d399),
		rgb(0xf472b6),
		rgb(0x2dd4bf),
		rgb(0xf87171),
		rgb(0xfacc15),
	}
)

func seriesColor(series int) color.NRGBA {
	return seriesPalette[series%len(seriesPalette)]
}

var (
	titleStyle       = textStyle{weight: weightMedium, size: 15, color: foregroundColor}
	legendStyle      = textStyle{weight: weightRegular, size: 12, color: mutedForegroundColor}
	tickLabelStyle   = textStyle{weight: weightRegular, size: 11, color: mutedForegroundColor}
	markerLabelStyle = textStyle{weight: weightRegular, size: 11, color: mutedForegroundColor}
	missingStyle     = textStyle{weight: weightRegular, size: 10, color: mutedForegroundColor}
)

const (
	missingLabel    = "n/a"
	inProgressLabel = "In progress"
	ellipsis        = "…"
)

const (
	outerPadding = 24
	headerGap    = 24
	plotHeight   = 280
)

const (
	// titleLegendGap is the space from the title's baseline to the first
	// legend row when the legend goes below the title.
	titleLegendGap     = 12
	legendRowGap       = 8
	legendSwatchSize   = 12
	legendSwatchGap    = 8
	legendItemGap      = 16
	legendSwatchRadius = 4
)

const (
	tickLength = 5
	// tickLabelOffset is the distance from the plot edge to the near side of
	// a tick label: the tick, then 8px of space.
	tickLabelOffset = tickLength + 8
	xLabelMinGap    = 8
	// labelEdgeMargin keeps clamped labels a few pixels away from the canvas
	// edge.
	labelEdgeMargin = 4

	rotatedLabelAngle     = math.Pi / 3
	maxRotatedLabelRunes  = 11
	rotatedLabelClearance = 2

	gridDotRadius   = 1
	gridDotsPerTick = 4
)

const (
	markerRowHeight = 14
	// markerRowsGap keeps marker labels clear of the top y tick and its
	// label, which a label at the plot's left edge would otherwise touch.
	markerRowsGap       = 6
	maxMarkerLabelWidth = 160
	markerLabelMinGap   = 8
)

const (
	lineWidth           = 2
	isolatedPointRadius = 3

	barGroupRatio   = 0.7
	barLaneGap      = 2
	maxBarWidth     = 64
	missingLabelGap = 3
)

var dash = []float64{4, 4}
