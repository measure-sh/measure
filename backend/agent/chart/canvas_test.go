package chart

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"math"
	"testing"
)

var (
	transparent = color.NRGBA{}
	white       = color.NRGBA{255, 255, 255, 255}
	black       = color.NRGBA{0, 0, 0, 255}
)

func alphaAt(c *canvas, x, y int) uint8 { return c.image().RGBAAt(x, y).A }

func colorAt(img image.Image, x, y int) color.NRGBA {
	return color.NRGBAModel.Convert(img.At(x, y)).(color.NRGBA)
}

// coverageSum returns the sum of all pixel alphas as a fraction of full
// alpha, which approximates the filled area in square pixels.
func coverageSum(c *canvas) float64 {
	var sum float64
	for y := 0; y < c.height(); y++ {
		for x := 0; x < c.width(); x++ {
			sum += float64(alphaAt(c, x, y))
		}
	}
	return sum / 255
}

// maxAlpha returns the highest alpha on the canvas and a pixel that has it.
func maxAlpha(c *canvas) (uint8, image.Point) {
	var best uint8
	var at image.Point
	for y := 0; y < c.height(); y++ {
		for x := 0; x < c.width(); x++ {
			if a := alphaAt(c, x, y); a > best {
				best, at = a, image.Point{x, y}
			}
		}
	}
	return best, at
}

func nrgbaClose(a, b color.NRGBA, tolerance int) bool {
	d := func(x, y uint8) bool { return math.Abs(float64(x)-float64(y)) <= float64(tolerance) }
	return d(a.R, b.R) && d(a.G, b.G) && d(a.B, b.B) && d(a.A, b.A)
}

func TestEncodePNG(t *testing.T) {
	for _, background := range []color.NRGBA{{12, 34, 56, 255}, {200, 100, 50, 128}} {
		data, err := newCanvas(7, 3, background).encodePNG()
		if err != nil {
			t.Fatal(err)
		}
		decoded, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatal(err)
		}
		if got := decoded.Bounds(); got != image.Rect(0, 0, 7, 3) {
			t.Fatalf("bounds = %v", got)
		}
		if got := colorAt(decoded, 6, 2); !nrgbaClose(got, background, 1) {
			t.Errorf("pixel = %v, want %v", got, background)
		}
	}
}

func TestFillRectCrisp(t *testing.T) {
	tests := []struct {
		name           string
		x0, y0, x1, y1 int
	}{
		{"inside", 3, 4, 10, 9},
		{"reversed corners", 10, 9, 3, 4},
		{"partly outside", -5, -5, 4, 6},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newCanvas(20, 15, white)
			c.fillRect(float64(tt.x0), float64(tt.y0), float64(tt.x1), float64(tt.y1), black)
			rect := image.Rect(tt.x0, tt.y0, tt.x1, tt.y1)
			for y := 0; y < c.height(); y++ {
				for x := 0; x < c.width(); x++ {
					want := white
					if (image.Point{x, y}).In(rect) {
						want = black
					}
					if got := colorAt(c.image(), x, y); got != want {
						t.Fatalf("pixel (%d,%d) = %v, want %v", x, y, got, want)
					}
				}
			}
		})
	}
}

func TestFillRectFractional(t *testing.T) {
	c := newCanvas(10, 6, transparent)
	c.fillRect(2.5, 2, 5.5, 4, black)
	for x, want := range []uint8{0, 0, 128, 255, 255, 128, 0} {
		if got := alphaAt(c, x, 2); math.Abs(float64(got)-float64(want)) > 2 {
			t.Errorf("alpha at x = %d is %d, want %d", x, got, want)
		}
	}
}

func TestSourceOver(t *testing.T) {
	tests := []struct {
		name       string
		background color.NRGBA
		fill       color.NRGBA
	}{
		{"half black over white", white, color.NRGBA{0, 0, 0, 128}},
		{"quarter red over blue", color.NRGBA{0, 0, 255, 255}, color.NRGBA{255, 0, 0, 64}},
		{"green over transparent", transparent, color.NRGBA{0, 200, 0, 100}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newCanvas(4, 4, tt.background)
			c.fillRect(0, 0, 4, 4, tt.fill)
			if got, want := colorAt(c.image(), 1, 1), sourceOver(tt.fill, tt.background); !nrgbaClose(got, want, 1) {
				t.Errorf("pixel = %v, want %v", got, want)
			}
		})
	}
}

func sourceOver(src, dst color.NRGBA) color.NRGBA {
	sa, da := float64(src.A)/255, float64(dst.A)/255
	outA := sa + da*(1-sa)
	channel := func(s, d uint8) uint8 {
		return uint8(math.Round((float64(s)*sa + float64(d)*da*(1-sa)) / outA))
	}
	return color.NRGBA{channel(src.R, dst.R), channel(src.G, dst.G), channel(src.B, dst.B), uint8(math.Round(outA * 255))}
}

func TestFillPolygon(t *testing.T) {
	tests := []struct {
		name     string
		points   []point
		wantArea float64
	}{
		{"clockwise", []point{{0, 0}, {20, 0}, {0, 20}}, 200},
		{"counterclockwise", []point{{0, 0}, {0, 20}, {20, 0}}, 200},
		{"NaN coordinate", []point{{0, 0}, {math.NaN(), 20}, {20, 0}}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newCanvas(20, 20, transparent)
			c.fillPolygon(tt.points, black)
			if got := coverageSum(c); math.Abs(got-tt.wantArea) > 1 {
				t.Errorf("area = %.2f, want %v", got, tt.wantArea)
			}
		})
	}
}

func TestFillCircle(t *testing.T) {
	c := newCanvas(40, 40, transparent)
	c.fillCircle(point{20, 20}, 10, black)
	if got, want := coverageSum(c), math.Pi*100; math.Abs(got-want) > 1 {
		t.Errorf("area = %.2f, want %.2f", got, want)
	}
	if alphaAt(c, 13, 20) != 255 || alphaAt(c, 8, 20) != 0 {
		t.Errorf("alpha inside = %d, outside = %d", alphaAt(c, 13, 20), alphaAt(c, 8, 20))
	}
}

// A solid stroke covers width pixels across the line and ends in round caps.
func TestStrokeLineSolid(t *testing.T) {
	c := newCanvas(40, 20, transparent)
	c.strokeLine([]point{{5, 10}, {35, 10}}, 4, black, nil)
	for y := 8; y < 12; y++ {
		if got := alphaAt(c, 20, y); got != 255 {
			t.Errorf("alpha at (20,%d) = %d, want 255", y, got)
		}
	}
	if alphaAt(c, 20, 7) != 0 || alphaAt(c, 20, 12) != 0 {
		t.Error("stroke is wider than 4px")
	}
	if got, want := coverageSum(c), 30*4+math.Pi*4; math.Abs(got-want) > 1 {
		t.Errorf("area = %.2f, want %.2f", got, want)
	}
}

// A 1px line covers one pixel row when the caller passes the pixel center
// coordinate, such as y = row + 0.5. An integer coordinate puts the line on
// the border between two rows, so each row gets half coverage.
func TestOnePixelLineConvention(t *testing.T) {
	tests := []struct {
		y         float64
		wantAlpha uint8
		clearRows []int
	}{
		{5.5, 255, []int{4, 6}},
		{5, 128, []int{3, 6}},
	}
	for _, tt := range tests {
		c := newCanvas(24, 10, transparent)
		c.strokeLine([]point{{2, tt.y}, {20, tt.y}}, 1, black, nil)
		for x := 3; x < 19; x++ {
			if got := alphaAt(c, x, 5); math.Abs(float64(got)-float64(tt.wantAlpha)) > 1 {
				t.Fatalf("y = %v: alpha at (%d,5) = %d, want %d", tt.y, x, got, tt.wantAlpha)
			}
			for _, row := range tt.clearRows {
				if got := alphaAt(c, x, row); got != 0 {
					t.Fatalf("y = %v: alpha at (%d,%d) = %d, want 0", tt.y, x, row, got)
				}
			}
		}
	}
}

// Dashes have butt caps, and the pattern continues across a vertex.
func TestStrokeLineDashed(t *testing.T) {
	c := newCanvas(10, 20, transparent)
	// The horizontal run is 6.5px long, so the gap from 4px to 8px along the
	// line continues 1.5px down the vertical run.
	c.strokeLine([]point{{0, 5.5}, {6.5, 5.5}, {6.5, 19}}, 1, black, []float64{4, 4})
	tests := []struct {
		name   string
		pixels []image.Point
		want   uint8
	}{
		{"first dash", []image.Point{{0, 5}, {1, 5}, {2, 5}, {3, 5}}, 255},
		{"gap across the corner", []image.Point{{4, 5}, {5, 5}, {6, 5}, {6, 6}}, 0},
		{"second dash", []image.Point{{6, 7}, {6, 8}, {6, 9}, {6, 10}}, 255},
		{"second gap", []image.Point{{6, 11}, {6, 12}, {6, 13}, {6, 14}}, 0},
	}
	for _, tt := range tests {
		for _, p := range tt.pixels {
			if got := alphaAt(c, p.X, p.Y); got != tt.want {
				t.Errorf("%s: alpha at %v = %d, want %d", tt.name, p, got, tt.want)
			}
		}
	}
}

// A translucent stroke has the same alpha everywhere inside it, including at
// joins where segments overlap, and edge pixels match the coverage of the
// true outline away from the joins.
func TestStrokeUniformAlpha(t *testing.T) {
	tests := []struct {
		name   string
		points []point
		width  float64
	}{
		{"sharp turn", []point{{10, 10}, {90, 40}, {10, 70}}, 12},
		{"right angle", []point{{20.3, 20.3}, {80.3, 20.3}, {80.3, 80.3}}, 9},
		{"thin", []point{{10, 10}, {50, 30}, {20, 90}}, 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newCanvas(100, 100, transparent)
			c.strokeLine(tt.points, tt.width, color.NRGBA{0, 0, 255, 128}, nil)
			half := tt.width / 2
			joins := tt.points[1 : len(tt.points)-1]
			for y := 0; y < c.height(); y++ {
				for x := 0; x < c.width(); x++ {
					center := point{float64(x) + 0.5, float64(y) + 0.5}
					distance := distanceToPolyline(center, tt.points)
					got := float64(alphaAt(c, x, y))
					switch {
					case distance <= half-1:
						if math.Abs(got-128) > 1 {
							t.Fatalf("alpha inside the stroke at (%d,%d) = %.0f, want 128", x, y, got)
						}
					case distance >= half+1:
						if got != 0 {
							t.Fatalf("alpha outside the stroke at (%d,%d) = %.0f, want 0", x, y, got)
						}
					case distanceToPoints(center, joins) > half+2:
						want := max(0, min(1, half-distance+0.5)) * 128
						if math.Abs(got-want) > 0.3*128 {
							t.Fatalf("alpha at the edge at (%d,%d) = %.0f, want %.0f", x, y, got, want)
						}
					}
				}
			}
		})
	}

	t.Run("dashed", func(t *testing.T) {
		c := newCanvas(100, 100, transparent)
		c.strokeLine([]point{{10, 10}, {90, 40}, {10, 70}}, 10, color.NRGBA{0, 0, 0, 100}, []float64{30, 5})
		if got, at := maxAlpha(c); got > 100 {
			t.Errorf("alpha at %v = %d, want at most 100", at, got)
		}
		// The second dash covers the corner at (90, 40).
		if got := alphaAt(c, 88, 39); got != 100 {
			t.Errorf("alpha at the corner = %d, want 100", got)
		}
	})
}

// Drawing with any numbers and text does not panic or hang, and shapes change
// only pixels near their points.
func FuzzDraw(f *testing.F) {
	f.Add(4.0, 6.0, 30.0, 20.0, 2.0, 4.0, "Hello")
	f.Add(math.NaN(), 1e300, -1e300, 5e-324, 0.0, 0.0, "\xff\x00")
	f.Add(-5e5, 3.0, 5e5, 4.0, 1e-9, 1e-9, "W")
	f.Add(-1e7, 30.0, 10.0, 20.0, 1e12, -1.0, "á")
	f.Fuzz(func(t *testing.T, x0, y0, x1, y1, size, dash float64, text string) {
		c := newCanvas(40, 30, transparent)
		points := []point{{x0, y0}, {x1, y1}, {x0, y1}}
		c.fillRect(x0, y0, x1, y1, black)
		c.fillPolygon(points, black)
		c.fillCircle(points[1], size/2, black)
		c.strokeLine(points, size, black, nil)
		c.strokeLine(points, size, black, []float64{dash, dash})
		// Arc vertices are slightly outside the radius, so that arcs keep
		// their area.
		margin := math.Abs(size)/2*1.06 + 1
		if math.IsNaN(size) {
			margin = 1
		}
		for y := range c.height() {
			for x := range c.width() {
				near := float64(x+1) > min(x0, x1)-margin && float64(x) < max(x0, x1)+margin &&
					float64(y+1) > min(y0, y1)-margin && float64(y) < max(y0, y1)+margin
				if alphaAt(c, x, y) != 0 && !near {
					t.Fatalf("pixel (%d,%d) is inked", x, y)
				}
			}
		}
		if width := measureText(text, textStyle{size: size}).width; math.IsNaN(width) || math.IsInf(width, 0) {
			t.Fatalf("width = %v", width)
		}
		c.drawText(text, points[0], textStyle{size: size, color: black}, dash)
	})
}

func distanceToPolyline(p point, points []point) float64 {
	best := math.Inf(1)
	for i := 0; i+1 < len(points); i++ {
		a, b := points[i], points[i+1]
		d := b.sub(a)
		t := ((p.x-a.x)*d.x + (p.y-a.y)*d.y) / (d.x*d.x + d.y*d.y)
		q := a.lerp(b, max(0, min(1, t)))
		best = min(best, math.Hypot(p.x-q.x, p.y-q.y))
	}
	return best
}

func distanceToPoints(p point, points []point) float64 {
	best := math.Inf(1)
	for _, q := range points {
		best = min(best, math.Hypot(p.x-q.x, p.y-q.y))
	}
	return best
}
