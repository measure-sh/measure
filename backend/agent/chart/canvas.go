package chart

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"slices"

	"golang.org/x/image/vector"
)

type point struct{ x, y float64 }

func (p point) add(q point) point             { return point{p.x + q.x, p.y + q.y} }
func (p point) sub(q point) point             { return point{p.x - q.x, p.y - q.y} }
func (p point) scale(s float64) point         { return point{p.x * s, p.y * s} }
func (p point) lerp(q point, t float64) point { return point{p.x + (q.x-p.x)*t, p.y + (q.y-p.y)*t} }

type opKind int

const (
	opMove opKind = iota
	opLine
	opQuad
	opCube
)

// pathOp moves to, or draws a segment to, its last point. The points before
// the last are the control points of a quadratic or cubic segment.
type pathOp struct {
	kind   opKind
	points []point
}

// path is a list of closed subpaths. Each opMove starts a new subpath and
// closes the previous one.
//
// The rasterizer sums the signed coverage of all subpaths and clamps its
// magnitude to 1. Overlapping subpaths with the same winding therefore merge,
// and subpaths with opposite winding cancel. Stroke pieces use addPolygon,
// which gives every piece the same winding.
type path struct {
	ops []pathOp
}

func (p *path) add(kind opKind, points ...point) {
	p.ops = append(p.ops, pathOp{kind: kind, points: points})
}

func (p *path) addPolygon(points []point) {
	if len(points) < 3 {
		return
	}
	if signedArea(points) < 0 {
		points = slices.Clone(points)
		slices.Reverse(points)
	}
	p.add(opMove, points[0])
	for _, pt := range points[1:] {
		p.add(opLine, pt)
	}
}

// canvas draws antialiased shapes onto an RGBA image. Pixel (i, j) covers
// the square from (i, j) to (i+1, j+1), so its center is at (i+0.5, j+0.5).
// A canvas is not safe for concurrent use.
type canvas struct {
	rgba       *image.RGBA
	rasterizer *vector.Rasterizer
}

func newCanvas(width, height int, background color.NRGBA) *canvas {
	rgba := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(rgba, rgba.Bounds(), image.NewUniform(background), image.Point{}, draw.Src)
	return &canvas{rgba: rgba, rasterizer: &vector.Rasterizer{}}
}

func (c *canvas) width() int  { return c.rgba.Bounds().Dx() }
func (c *canvas) height() int { return c.rgba.Bounds().Dy() }

func (c *canvas) image() *image.RGBA { return c.rgba }

func (c *canvas) encodePNG() ([]byte, error) {
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, c.rgba); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func (c *canvas) fillRect(x0, y0, x1, y1 float64, col color.NRGBA) {
	c.fillPolygon([]point{{x0, y0}, {x1, y0}, {x1, y1}, {x0, y1}}, col)
}

func (c *canvas) fillCircle(center point, radius float64, col color.NRGBA) {
	if !(radius > 0) {
		return
	}
	steps, scale := arcSteps(2*math.Pi, radius)
	points := make([]point, steps)
	for i := range points {
		sin, cos := math.Sincos(2 * math.Pi * float64(i) / float64(steps))
		points[i] = point{center.x + radius*scale*cos, center.y + radius*scale*sin}
	}
	c.fillPolygon(points, col)
}

func (c *canvas) fillPolygon(points []point, col color.NRGBA) {
	var p path
	p.addPolygon(points)
	c.fillPath(&p, col)
}

// strokeLine draws an open polyline. Solid lines get round caps. Dashed lines
// get butt caps so that each dash has the length the pattern gives. The dash
// pattern continues across vertices. All dashes, joins and caps go into one
// coverage mask, so a translucent stroke composites once and overlaps do not
// show darker spots.
func (c *canvas) strokeLine(points []point, width float64, col color.NRGBA, dash []float64) {
	if !(width > 0) {
		return
	}
	var p path
	if len(dash) == 0 {
		p.addStroke(points, width/2, true)
	} else {
		for _, dashPoints := range splitDashes(points, dash) {
			p.addStroke(dashPoints, width/2, false)
		}
	}
	c.fillPath(&p, col)
}

// maxCoordinate bounds the path coordinates that fillPath draws. The
// rasterizer converts coordinates to int32 fixed point, which overflows for
// larger values, and it steps through every row and column that an edge
// crosses, so a long edge outside the mask still costs time.
const maxCoordinate = 1e5

// fillPath rasterizes the path into a mask the size of the path's bounding
// box, clipped to the canvas, and composites col through that mask with
// source-over. A path with a coordinate that is NaN, infinite or beyond
// maxCoordinate is skipped.
func (c *canvas) fillPath(p *path, col color.NRGBA) {
	if len(p.ops) == 0 {
		return
	}
	minX, minY := math.Inf(1), math.Inf(1)
	maxX, maxY := math.Inf(-1), math.Inf(-1)
	for _, op := range p.ops {
		for _, pt := range op.points {
			if !(math.Abs(pt.x) <= maxCoordinate && math.Abs(pt.y) <= maxCoordinate) {
				return
			}
			minX, maxX = min(minX, pt.x), max(maxX, pt.x)
			minY, maxY = min(minY, pt.y), max(maxY, pt.y)
		}
	}
	w, h := float64(c.width()), float64(c.height())
	// image.Rect would swap the corners of a path outside the canvas and give
	// a mask outside the image.
	bounds := image.Rectangle{
		Min: image.Pt(int(math.Floor(max(minX, 0))), int(math.Floor(max(minY, 0)))),
		Max: image.Pt(int(math.Ceil(min(maxX, w))), int(math.Ceil(min(maxY, h)))),
	}
	if bounds.Empty() {
		return
	}

	rasterizer := c.rasterizer
	rasterizer.Reset(bounds.Dx(), bounds.Dy())
	originX, originY := float64(bounds.Min.X), float64(bounds.Min.Y)
	local := func(pt point) (float32, float32) {
		return float32(pt.x - originX), float32(pt.y - originY)
	}
	for i, op := range p.ops {
		switch op.kind {
		case opMove:
			if i > 0 {
				rasterizer.ClosePath()
			}
			rasterizer.MoveTo(local(op.points[0]))
		case opLine:
			rasterizer.LineTo(local(op.points[0]))
		case opQuad:
			bx, by := local(op.points[0])
			cx, cy := local(op.points[1])
			rasterizer.QuadTo(bx, by, cx, cy)
		case opCube:
			bx, by := local(op.points[0])
			cx, cy := local(op.points[1])
			dx, dy := local(op.points[2])
			rasterizer.CubeTo(bx, by, cx, cy, dx, dy)
		}
	}
	rasterizer.ClosePath()
	rasterizer.Draw(c.rgba, bounds, image.NewUniform(col), image.Point{})
}

// addStroke adds the outline of a polyline stroke as abutting pieces: one
// hexagon per segment, a wedge on the outer side of each join, and half discs
// for round caps. Each segment's butt ends include the segment end point as a
// vertex, so a piece edge that two pieces share has the same end points in
// both pieces. The rasterizer then cancels the shared edges and the stroke
// shows no seams or doubled coverage there.
func (p *path) addStroke(points []point, half float64, roundCaps bool) {
	points = dedupe(points)
	if len(points) < 2 {
		return
	}

	type segment struct{ dir, normal point }
	segments := make([]segment, len(points)-1)
	for i := range segments {
		a, b := points[i], points[i+1]
		d := b.sub(a)
		dir := d.scale(1 / math.Hypot(d.x, d.y))
		normal := point{-dir.y, dir.x}.scale(half)
		segments[i] = segment{dir: dir, normal: normal}
		p.addPolygon([]point{a.add(normal), b.add(normal), b, b.sub(normal), a.sub(normal), a})
	}

	for i := 1; i < len(points)-1; i++ {
		before, after, join := segments[i-1], segments[i], points[i]
		cross := before.dir.x*after.dir.y - before.dir.y*after.dir.x
		dot := before.dir.x*after.dir.x + before.dir.y*after.dir.y
		turn := math.Atan2(cross, dot)
		// A non-finite point gives a NaN turn, and fillPath skips that path.
		if math.Abs(turn) < 1e-9 || math.IsNaN(turn) {
			continue
		}
		from, to := join.sub(before.normal), join.sub(after.normal)
		if turn < 0 {
			from, to = join.add(before.normal), join.add(after.normal)
		}
		p.addPolygon(arcFan(join, from, to, turn, half))
	}

	if roundCaps {
		start, end := points[0], points[len(points)-1]
		first, last := segments[0], segments[len(segments)-1]
		p.addPolygon(arcFan(start, start.sub(first.normal), start.add(first.normal), -math.Pi, half))
		p.addPolygon(arcFan(end, end.add(last.normal), end.sub(last.normal), -math.Pi, half))
	}
}

// arcFan returns a polygon from center through from, along the circle of the
// given radius by the signed angle sweep, to to. The caller computes to as a
// corner of a neighboring piece, so the polygon uses that value and not a
// rotated copy of from.
func arcFan(center, from, to point, sweep, radius float64) []point {
	steps, scale := arcSteps(sweep, radius)
	polygon := make([]point, 0, steps+2)
	polygon = append(polygon, center, from)
	offset := from.sub(center).scale(scale)
	for i := 1; i < steps; i++ {
		sin, cos := math.Sincos(sweep * float64(i) / float64(steps))
		rotated := point{offset.x*cos - offset.y*sin, offset.x*sin + offset.y*cos}
		polygon = append(polygon, center.add(rotated))
	}
	return append(polygon, to)
}

// arcSteps returns how many chords approximate an arc, and the factor for the
// chord vertex radius. Vertices at radius × scale make the polygon area equal
// to the area of the circle sector, so filled circles do not come out smaller.
// The radius must be positive and the sweep finite and not zero.
func arcSteps(sweep, radius float64) (int, float64) {
	const tolerance = 0.05
	// A radius below half the tolerance takes Acos out of its domain. A large
	// radius would need more chords than any canvas can show.
	maxStep := min(math.Pi/4, 2*math.Acos(max(-1, 1-tolerance/radius)))
	steps := int(min(math.Ceil(math.Abs(sweep)/maxStep), 1000))
	step := math.Abs(sweep) / float64(steps)
	return steps, math.Sqrt(step / math.Sin(step))
}

func signedArea(points []point) float64 {
	var area float64
	for i, a := range points {
		b := points[(i+1)%len(points)]
		area += a.x*b.y - b.x*a.y
	}
	return area / 2
}

func dedupe(points []point) []point {
	result := make([]point, 0, len(points))
	for _, pt := range points {
		if len(result) > 0 {
			last := result[len(result)-1]
			if math.Hypot(pt.x-last.x, pt.y-last.y) < 1e-9 {
				continue
			}
		}
		result = append(result, pt)
	}
	return result
}

// maxDashes bounds the work for a dash pattern that is short compared to the
// line, such as zero lengths or a line far longer than the canvas.
const maxDashes = 10_000

// splitDashes returns the "on" parts of the polyline as separate polylines.
// The pattern alternates on and off lengths, starting with on. A dash that
// spans a vertex keeps that vertex, so it gets a join there. It returns no
// dashes when the line would have more than maxDashes.
func splitDashes(points []point, pattern []float64) [][]point {
	var dashes [][]point
	var current []point
	index, remaining := 0, pattern[0]
	for i := 1; i < len(points); i++ {
		a, b := points[i-1], points[i]
		length := math.Hypot(b.x-a.x, b.y-a.y)
		for t := 0.0; t < length; {
			step := min(remaining, length-t)
			if index%2 == 0 {
				if current == nil {
					current = []point{a.lerp(b, t/length)}
				}
				current = append(current, a.lerp(b, (t+step)/length))
			}
			t += step
			remaining -= step
			if remaining <= 1e-9 {
				if current != nil {
					if len(dashes) == maxDashes {
						return nil
					}
					dashes = append(dashes, current)
					current = nil
				}
				index = (index + 1) % len(pattern)
				remaining = pattern[index]
			}
		}
	}
	if current != nil {
		dashes = append(dashes, current)
	}
	return dashes
}
