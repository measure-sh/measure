package chart

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"math"
	"testing"
)

func paintSpec(t *testing.T, spec Spec) (chartLayout, *image.RGBA) {
	t.Helper()
	l := mustLayout(t, spec)
	return l, l.paint().image()
}

func pixel(img *image.RGBA, x, y int) color.NRGBA {
	c := img.RGBAAt(x, y)
	return color.NRGBA{c.R, c.G, c.B, c.A}
}

func colorDistance(a, b color.NRGBA) int {
	abs := func(v int) int { return max(v, -v) }
	return max(abs(int(a.R)-int(b.R)), abs(int(a.G)-int(b.G)), abs(int(a.B)-int(b.B)))
}

func TestRenderPNG(t *testing.T) {
	spec := lineSpec(1, 2, 3)
	data, err := Render(spec)
	if err != nil {
		t.Fatal(err)
	}
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	bounds := img.Bounds()
	if l := mustLayout(t, spec); bounds.Dx() != Width || bounds.Dy() != l.height {
		t.Errorf("image %dx%d, want %dx%d", bounds.Dx(), bounds.Dy(), Width, l.height)
	}
	for _, corner := range []image.Point{{0, 0}, {bounds.Dx() - 1, 0}, {0, bounds.Dy() - 1}, {bounds.Dx() - 1, bounds.Dy() - 1}} {
		if got := color.NRGBAModel.Convert(img.At(corner.X, corner.Y)); got != backgroundColor {
			t.Errorf("corner %v is %+v, want the background", corner, got)
		}
	}
}

func TestPaintBars(t *testing.T) {
	l, img := paintSpec(t, barSpec([]string{"a", "b", "c"}, []float64{3, 5, 4}, []float64{4, 2, 5}))
	for _, bar := range l.bars {
		x, y := int(centerX(bar.rect)), int((bar.rect.y0+bar.rect.y1)/2)
		if got := pixel(img, x, y); got != seriesColor(bar.series) {
			t.Errorf("bar %d/%d center is %+v, want %+v", bar.series, bar.index, got, seriesColor(bar.series))
		}
		if outside := pixel(img, int(bar.rect.x0)-1, y); colorDistance(outside, seriesColor(bar.series)) < 100 {
			t.Errorf("pixel left of bar %d/%d is %+v", bar.series, bar.index, outside)
		}
	}
}

func TestPaintLineWithGap(t *testing.T) {
	l, img := paintSpec(t, lineSpec(10, 40, 25, nan, nan, 20, 10))
	for _, run := range l.lines {
		for k := 1; k < len(run.points); k++ {
			a, b := run.points[k-1], run.points[k]
			x, y := int((a.x+b.x)/2), int((a.y+b.y)/2)
			best := math.MaxInt
			for dy := -1; dy <= 1; dy++ {
				for dx := -1; dx <= 1; dx++ {
					best = min(best, colorDistance(pixel(img, x+dx, y+dy), seriesColor(run.series)))
				}
			}
			if best > 40 {
				t.Errorf("segment %d: no pixel near its midpoint has the series color", run.from+k)
			}
		}
	}
	for x := int(l.xAt(2)) + 3; x < int(l.xAt(5))-3; x++ {
		for y := int(l.plot.y0); y < int(l.plot.y1); y++ {
			if colorDistance(pixel(img, x, y), seriesColor(0)) < 80 {
				t.Fatalf("pixel (%d, %d) in the gap has the series color", x, y)
			}
		}
	}
}

func TestPaintInProgress(t *testing.T) {
	spec := lineSpec(5, 5, 5, 5, 5, 5)
	spec.InProgressCount = 2
	l, img := paintSpec(t, spec)

	// The line is solid up to the last completed point and dashed after it.
	y := int(l.valueY(5))
	for x := int(l.xAt(0)) + 2; x < int(l.xAt(3))-2; x++ {
		if got := pixel(img, x, y); got != seriesColor(0) {
			t.Fatalf("solid line pixel %d is %+v", x, got)
		}
	}
	on, off := 0, 0
	for x := int(l.xAt(3)) + 2; x < int(l.xAt(5))-2; x++ {
		if colorDistance(pixel(img, x, y), seriesColor(0)) < 40 {
			on++
		} else {
			off++
		}
	}
	if total := float64(on + off); float64(on) < 0.35*total || float64(off) < 0.35*total {
		t.Errorf("dashed row has %d inked and %d clear pixels, want about half each", on, off)
	}

	// Below the line and away from the grid dots, the band is lighter than
	// the background and the finished area is the background.
	clearPixel := func(x0, x1 float64) color.NRGBA {
		for y := int(l.plot.y0) + 8; y < int(l.plot.y1)-2; y++ {
			for x := int(x0) + 2; x < int(x1)-2; x++ {
				if !nearGridDot(l.gridDots, float64(x)+0.5, float64(y)+0.5) {
					return pixel(img, x, y)
				}
			}
		}
		t.Fatalf("no pixel clear of the grid dots between %v and %v", x0, x1)
		return color.NRGBA{}
	}
	if band := clearPixel(l.inProgressBand.x0, l.inProgressBand.x1); band.R <= backgroundColor.R || band.G <= backgroundColor.G || band.B <= backgroundColor.B {
		t.Errorf("band pixel %+v is not lighter than the background", band)
	}
	if done := clearPixel(l.plot.x0, l.inProgressBand.x0); done != backgroundColor {
		t.Errorf("finished area pixel %+v, want the background", done)
	}
}

// nearGridDot reports whether a grid dot is close enough to (x, y) to
// tint that pixel.
func nearGridDot(dots []point, x, y float64) bool {
	for _, dot := range dots {
		if math.Abs(dot.x-x) < 2 && math.Abs(dot.y-y) < 2 {
			return true
		}
	}
	return false
}
