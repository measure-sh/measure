package chart

import (
	_ "embed"
	"image/color"
	"math"

	"golang.org/x/image/font"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

// The fonts are static instances because sfnt does not apply the axes of a
// variable font.
var (
	//go:embed fonts/WorkSans-Regular.ttf
	workSansRegular []byte
	//go:embed fonts/WorkSans-Medium.ttf
	workSansMedium []byte
)

type fontWeight int

const (
	weightRegular fontWeight = iota
	weightMedium
)

var fonts = [...]*sfnt.Font{
	weightRegular: parseFont(workSansRegular),
	weightMedium:  parseFont(workSansMedium),
}

// parseFont panics because the font data is embedded in the binary, so a
// parse error is a build defect and not a runtime condition.
func parseFont(data []byte) *sfnt.Font {
	f, err := sfnt.Parse(data)
	if err != nil {
		panic(err)
	}
	return f
}

// missingGlyph returns the first character the fonts cannot draw. It checks
// both weights because either may be unable to draw the text.
func missingGlyph(text string) (rune, bool) {
	var buffer sfnt.Buffer
	for _, r := range text {
		for _, f := range fonts {
			if index, err := f.GlyphIndex(&buffer, r); err != nil || index == 0 {
				return r, true
			}
		}
	}
	return 0, false
}

type textStyle struct {
	weight fontWeight
	size   float64 // font size in pixels per em
	color  color.NRGBA
}

type textMetrics struct {
	width     float64
	ascent    float64
	descent   float64
	capHeight float64
}

func measureText(text string, style textStyle) textMetrics {
	f, ppem := fonts[style.weight], pixelsPerEm(style.size)
	var buffer sfnt.Buffer
	var metrics textMetrics
	if fontMetrics, err := f.Metrics(&buffer, ppem, font.HintingNone); err == nil {
		metrics.ascent = fixedToFloat(fontMetrics.Ascent)
		metrics.descent = fixedToFloat(fontMetrics.Descent)
		metrics.capHeight = fixedToFloat(fontMetrics.CapHeight)
	}
	_, metrics.width = layoutText(f, &buffer, text, ppem)
	return metrics
}

// drawText draws a single line of text whose baseline starts at origin. The
// text turns about origin by angle radians, and a positive angle turns it
// clockwise on screen. All glyphs go into one coverage mask, so glyphs that
// overlap composite once.
func (c *canvas) drawText(text string, origin point, style textStyle, angle float64) {
	f, ppem := fonts[style.weight], pixelsPerEm(style.size)
	if ppem == 0 {
		return
	}
	var buffer sfnt.Buffer
	positions, _ := layoutText(f, &buffer, text, ppem)
	sin, cos := math.Sincos(angle)
	// The font's bounding box gives how far a glyph outline reaches from its
	// origin. Glyphs that cannot reach the canvas, or that have a NaN
	// position, are not loaded, so the cost of long text depends on the part
	// that is visible.
	bounds, _ := f.Bounds(&buffer, ppem, font.HintingNone)
	reach := math.Hypot(
		max(math.Abs(fixedToFloat(bounds.Min.X)), math.Abs(fixedToFloat(bounds.Max.X))),
		max(math.Abs(fixedToFloat(bounds.Min.Y)), math.Abs(fixedToFloat(bounds.Max.Y))),
	)
	w, h := float64(c.width()), float64(c.height())

	var p path
	for _, position := range positions {
		glyphX := position.x
		at := point{origin.x + glyphX*cos, origin.y + glyphX*sin}
		if !(at.x >= -reach && at.y >= -reach && at.x <= w+reach && at.y <= h+reach) {
			continue
		}
		segments, err := f.LoadGlyph(&buffer, position.index, ppem, nil)
		if err != nil {
			continue
		}
		screen := func(pt fixed.Point26_6) point {
			x, y := glyphX+fixedToFloat(pt.X), fixedToFloat(pt.Y)
			return point{origin.x + x*cos - y*sin, origin.y + x*sin + y*cos}
		}
		for _, segment := range segments {
			args := segment.Args
			switch segment.Op {
			case sfnt.SegmentOpMoveTo:
				p.add(opMove, screen(args[0]))
			case sfnt.SegmentOpLineTo:
				p.add(opLine, screen(args[0]))
			case sfnt.SegmentOpQuadTo:
				p.add(opQuad, screen(args[0]), screen(args[1]))
			case sfnt.SegmentOpCubeTo:
				p.add(opCube, screen(args[0]), screen(args[1]), screen(args[2]))
			}
		}
	}
	c.fillPath(&p, style.color)
}

type glyphPosition struct {
	index sfnt.GlyphIndex
	x     float64
}

// layoutText places the glyphs of text on a baseline that starts at x = 0 and
// returns the total advance. measureText and drawText share it, so the
// measured width matches the drawn text. A rune that the font does not map
// gets glyph index 0, which is the font's .notdef glyph. The positions add up
// in float64, because a fixed.Int26_6 sum overflows past 2^25 pixels.
func layoutText(
	f *sfnt.Font, buffer *sfnt.Buffer, text string, ppem fixed.Int26_6,
) ([]glyphPosition, float64) {
	var positions []glyphPosition
	var x float64
	for _, r := range text {
		index, err := f.GlyphIndex(buffer, r)
		if err != nil {
			index = 0
		}
		if len(positions) > 0 {
			previous := positions[len(positions)-1].index
			if kern, err := f.Kern(buffer, previous, index, ppem, font.HintingNone); err == nil {
				x += fixedToFloat(kern)
			}
		}
		positions = append(positions, glyphPosition{index: index, x: x})
		if advance, err := f.GlyphAdvance(buffer, index, ppem, font.HintingNone); err == nil {
			x += fixedToFloat(advance)
		}
	}
	return positions, x
}

// pixelsPerEm returns 0 for a size outside these limits, so that the text has
// no width and no ink. Below the minimum, glyph advances round to almost zero
// and long text puts thousands of glyphs on the canvas. Above the maximum, the
// fixed-point arithmetic in sfnt overflows.
const (
	minFontSize = 1
	maxFontSize = 1000
)

func pixelsPerEm(size float64) fixed.Int26_6 {
	if !(size >= minFontSize && size <= maxFontSize) {
		return 0
	}
	return fixed.Int26_6(math.Round(size * 64))
}

func fixedToFloat(v fixed.Int26_6) float64 { return float64(v) / 64 }
