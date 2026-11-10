package chart

import (
	"image/color"
	"math"
	"testing"

	"golang.org/x/image/font/sfnt"
)

func TestFontsParse(t *testing.T) {
	for weight, want := range map[fontWeight]string{weightRegular: "Regular", weightMedium: "Medium"} {
		var buffer sfnt.Buffer
		family, _ := fonts[weight].Name(&buffer, sfnt.NameIDFamily)
		subfamily, _ := fonts[weight].Name(&buffer, sfnt.NameIDSubfamily)
		typographic, _ := fonts[weight].Name(&buffer, sfnt.NameIDTypographicSubfamily)
		if family != "Work Sans" && family != "Work Sans "+want {
			t.Errorf("weight %d: family = %q", weight, family)
		}
		if subfamily != want && typographic != want {
			t.Errorf("weight %d: subfamily = %q, typographic subfamily = %q, want %q", weight, subfamily, typographic, want)
		}
	}
}

func TestMeasureText(t *testing.T) {
	style := textStyle{size: 20}
	width := func(text string) float64 { return measureText(text, style).width }

	metrics := measureText("", style)
	if metrics.width != 0 {
		t.Errorf("empty width = %v, want 0", metrics.width)
	}
	if !(metrics.capHeight > 0.5*20 && metrics.capHeight < metrics.ascent) {
		t.Errorf("capHeight = %v, ascent = %v", metrics.capHeight, metrics.ascent)
	}
	if total := metrics.ascent + metrics.descent; total < 0.9*20 || total > 1.5*20 {
		t.Errorf("ascent + descent = %v", total)
	}

	text := "Crash-free sessions 99.2%"
	// Each glyph advance rounds to 1/64 px.
	double := measureText(text, textStyle{size: 40}).width
	if tolerance := float64(len(text)) / 64; math.Abs(double-2*width(text)) > tolerance {
		t.Errorf("width at 40px = %v, want 2 × %v", double, width(text))
	}
	if pair, separate := width("AV"), width("A")+width("V"); pair >= separate {
		t.Errorf("width of AV = %v, want less than %v from kerning", pair, separate)
	}
	if got := width("a一\U0001F600b"); got <= width("ab") {
		t.Errorf("width = %v, want room for the .notdef glyphs", got)
	}
}

type inkBox struct {
	minX, minY, maxX, maxY float64
	centerX, centerY       float64
	ink                    float64
}

// measureInk returns the bounding box of pixels with any alpha and the
// alpha-weighted center of the ink.
func measureInk(c *canvas) inkBox {
	box := inkBox{minX: math.Inf(1), minY: math.Inf(1), maxX: math.Inf(-1), maxY: math.Inf(-1)}
	for y := 0; y < c.height(); y++ {
		for x := 0; x < c.width(); x++ {
			a := float64(alphaAt(c, x, y))
			if a == 0 {
				continue
			}
			box.minX, box.maxX = min(box.minX, float64(x)), max(box.maxX, float64(x+1))
			box.minY, box.maxY = min(box.minY, float64(y)), max(box.maxY, float64(y+1))
			box.centerX += a * (float64(x) + 0.5)
			box.centerY += a * (float64(y) + 0.5)
			box.ink += a
		}
	}
	if box.ink > 0 {
		box.centerX /= box.ink
		box.centerY /= box.ink
	}
	return box
}

func TestDrawTextInsideMeasuredBox(t *testing.T) {
	tests := []struct {
		text   string
		origin point
		style  textStyle
	}{
		{"Hello 123", point{10, 40}, textStyle{weight: weightRegular, size: 20, color: black}},
		{"jgpqy", point{12.3, 30.6}, textStyle{weight: weightMedium, size: 16, color: black}},
	}
	for _, tt := range tests {
		c := newCanvas(200, 60, transparent)
		c.drawText(tt.text, tt.origin, tt.style, 0)
		box := measureInk(c)
		metrics := measureText(tt.text, tt.style)
		const slack = 2
		if box.minX < tt.origin.x-slack || box.maxX > tt.origin.x+metrics.width+slack || box.maxX < tt.origin.x+metrics.width-4 {
			t.Errorf("%q: ink x range [%v, %v], want to fill [%v, %v]", tt.text, box.minX, box.maxX, tt.origin.x, tt.origin.x+metrics.width)
		}
		if box.minY < tt.origin.y-metrics.ascent-slack || box.maxY > tt.origin.y+metrics.descent+slack {
			t.Errorf("%q: ink y range [%v, %v], want inside [%v, %v]", tt.text, box.minY, box.maxY, tt.origin.y-metrics.ascent, tt.origin.y+metrics.descent)
		}
	}
}

// Text on an integer baseline has a crisp bottom edge.
func TestDrawTextCrispBaseline(t *testing.T) {
	c := newCanvas(60, 30, transparent)
	c.drawText("HHH", point{5, 20}, textStyle{size: 16, color: black}, 0)
	if box := measureInk(c); box.maxY != 20 {
		t.Errorf("ink bottom = %v, want 20", box.maxY)
	}
	full := 0
	for x := 0; x < c.width(); x++ {
		if alphaAt(c, x, 19) == 255 {
			full++
		}
	}
	if full == 0 {
		t.Error("no fully covered pixel on the row above the baseline")
	}
}

// A positive angle turns the text clockwise on screen about its origin.
func TestDrawTextRotated(t *testing.T) {
	origin := point{100, 100}
	style := textStyle{size: 16, color: black}
	metrics := measureText("Rotated", style)
	const slack = 2

	c := newCanvas(200, 200, transparent)
	c.drawText("Rotated", origin, style, -math.Pi/2)
	box := measureInk(c)
	if box.maxY > origin.y+slack || box.minY < origin.y-metrics.width-slack {
		t.Errorf("bottom to top: y range [%v, %v], want inside [%v, %v]", box.minY, box.maxY, origin.y-metrics.width, origin.y)
	}
	if box.minX < origin.x-metrics.ascent-slack || box.maxX > origin.x+metrics.descent+slack || box.centerX >= origin.x {
		t.Errorf("bottom to top: x range [%v, %v] center %v, want the ink left of %v", box.minX, box.maxX, box.centerX, origin.x)
	}

	c = newCanvas(200, 200, transparent)
	c.drawText("Rotated", origin, style, math.Pi/4)
	if box := measureInk(c); box.centerX <= origin.x || box.centerY <= origin.y {
		t.Errorf("down and right: ink center (%v, %v), want below and right of origin", box.centerX, box.centerY)
	}
}

func TestDrawTextTranslucentGlyphsCompositeOnce(t *testing.T) {
	c := newCanvas(80, 40, transparent)
	c.drawText("WWW", point{5, 30}, textStyle{weight: weightMedium, size: 24, color: color.NRGBA{0, 0, 0, 100}}, 0)
	if got, at := maxAlpha(c); got != 100 {
		t.Errorf("highest alpha = %d at %v, want 100", got, at)
	}
}
