// Package chart renders line and bar charts to PNG in the style of the
// dashboard's dark-mode charts.
package chart

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"unicode/utf8"
)

// Width is the width of every rendered PNG in pixels. The height depends on
// the header, the marker rows and the x labels.
const Width = 800

type Kind int

const (
	Line Kind = iota
	Bar
)

type Spec struct {
	Kind    Kind
	Title   string
	XLabels []string // one per data point or category
	Series  []Series
	YUnit   string // "" for plain counts; shown on the y-axis labels
	Markers []Marker
	// InProgressCount is how many trailing x positions are still in
	// progress. Zero means that every position is complete.
	InProgressCount int
}

type Series struct {
	Name   string
	Values []float64 // one per x label; math.NaN() means no value
}

// Marker marks an event at one x position.
type Marker struct {
	Index int // index into XLabels
	Label string
}

// Render draws the chart and encodes it as PNG. It returns an error for a
// spec that it cannot draw.
func Render(spec Spec) ([]byte, error) {
	layout, err := layoutChart(spec)
	if err != nil {
		return nil, err
	}
	return layout.paint().encodePNG()
}

// Values outside these limits produce axis labels that do not fit or
// distinguish adjacent ticks.
const (
	maxValueMagnitude = 1e15
	minPeakMagnitude  = 1e-6
)

// maxUnitLength limits the y unit in characters, because the y labels take
// width from the plot.
const maxUnitLength = 8

// maxTextLength limits each title, x label, series name, and marker label to
// 200 characters. Longer text is clipped in the image, and takes longer to
// measure.
const maxTextLength = 200

func validate(spec Spec) error {
	if spec.Kind != Line && spec.Kind != Bar {
		return fmt.Errorf("chart: unknown kind %d", spec.Kind)
	}
	n := len(spec.XLabels)
	if n == 0 {
		return errors.New("chart: no x labels")
	}
	if len(spec.Series) == 0 {
		return errors.New("chart: no series")
	}
	hasValue := false
	peak := 0.0
	for i, series := range spec.Series {
		if len(series.Values) != n {
			return fmt.Errorf("chart: series %d (%q) has %d values for %d x labels", i, series.Name, len(series.Values), n)
		}
		for _, v := range series.Values {
			if finite(v) {
				hasValue = true
				peak = math.Max(peak, math.Abs(v))
			}
		}
	}
	if !hasValue {
		return errors.New("chart: no finite value")
	}
	if peak > maxValueMagnitude {
		return fmt.Errorf("chart: values up to %g are too large to plot; the limit is %g", peak, maxValueMagnitude)
	}
	if peak != 0 && peak < minPeakMagnitude {
		return fmt.Errorf("chart: values up to %g are too small to plot; the largest value must be at least %g", peak, minPeakMagnitude)
	}
	if length := utf8.RuneCountInString(strings.TrimSpace(spec.YUnit)); length > maxUnitLength {
		return fmt.Errorf("chart: y unit has %d characters; the limit is %d", length, maxUnitLength)
	}
	texts := append([]string{spec.Title}, spec.XLabels...)
	for _, series := range spec.Series {
		texts = append(texts, series.Name)
	}
	for i, marker := range spec.Markers {
		if marker.Index < 0 || marker.Index >= n {
			return fmt.Errorf("chart: marker %d index %d is outside [0, %d)", i, marker.Index, n)
		}
		texts = append(texts, marker.Label)
	}
	for _, text := range append(texts, spec.YUnit) {
		if length := utf8.RuneCountInString(text); length > maxTextLength {
			return fmt.Errorf("chart: text %.20q... is %d characters long; the limit is %d", text, length, maxTextLength)
		}
		if r, missing := missingGlyph(text); missing {
			return fmt.Errorf("chart: text %q contains the character %q, which the chart font cannot draw; use Latin letters, digits, and common punctuation", text, r)
		}
	}
	if spec.InProgressCount < 0 || spec.InProgressCount > n {
		return fmt.Errorf("chart: in-progress count %d is outside [0, %d]", spec.InProgressCount, n)
	}
	return nil
}

func finite(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
