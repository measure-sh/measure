package chart

import (
	"bytes"
	"fmt"
	"math"
	"strings"
	"sync"
	"testing"
)

func TestValidate(t *testing.T) {
	values := func(v ...float64) func(*Spec) {
		return func(s *Spec) { s.Series[0].Values = v }
	}
	tests := []struct {
		name   string
		change func(*Spec)
		want   string // "" for a valid spec
	}{
		{"unknown kind", func(s *Spec) { s.Kind = Kind(7) }, "unknown kind"},
		{"no x labels", func(s *Spec) { s.XLabels = nil; s.Series[0].Values = nil }, "no x labels"},
		{"no series", func(s *Spec) { s.Series = nil }, "no series"},
		{"short series", values(1, 2), "has 2 values for 3 x labels"},
		{"long series", values(1, 2, 3, 4), "has 4 values for 3 x labels"},
		{"only non-finite values", values(math.Inf(1), nan, math.Inf(-1)), "no finite value"},
		{"marker index past the end", func(s *Spec) { s.Markers = []Marker{{Index: 0}, {Index: 3}} }, "marker 1 index 3"},
		{"negative marker index", func(s *Spec) { s.Markers = []Marker{{Index: -1}} }, "marker 0 index -1"},
		{"negative in-progress count", func(s *Spec) { s.InProgressCount = -1 }, "in-progress count -1"},
		{"in-progress count past the end", func(s *Spec) { s.InProgressCount = 4 }, "in-progress count 4"},
		{"near the float maximum", values(-1e308, 1e308, 0), "too large"},
		{"just over the largest value", values(1e16, 1, 0), "too large"},
		{"subnormal", values(5e-324, 0, 0), "too small"},
		{"below the smallest peak", values(1e-7, 2e-7, 0), "too small"},
		{"long unit", func(s *Spec) { s.YUnit = " milliseconds " }, "y unit has 12 characters"},
		{"text exceeds limit", func(s *Spec) { s.XLabels[0] = strings.Repeat("x", maxTextLength+1) }, "is 201 characters long"},
		{"character the font cannot draw", func(s *Spec) { s.Series[0].Name = "Яндекс Карты" }, "character 'Я'"},

		{"plain", nil, ""},
		{"largest value", values(1e15, 5e14, 0), ""},
		{"largest negative value", values(-1e15, 0, 0), ""},
		{"smallest peak", values(1e-6, 5e-7, 0), ""},
		{"smallest negative peak", values(-1e-6, 0, 0), ""},
		{"all zeros", values(0, 0, 0), ""},
		{"flat negative", values(-3, -3, -3), ""},
		{"infinity beside values", values(math.Inf(1), 2, 3), ""},
		{"one point", func(s *Spec) { s.XLabels = s.XLabels[:1]; s.Series[0].Values = []float64{3} }, ""},
		{"empty title, names and marker label", func(s *Spec) { s.Title, s.Series[0].Name, s.Markers = "", "", []Marker{{Index: 1}} }, ""},
		{"all in progress", func(s *Spec) { s.InProgressCount = 3 }, ""},
		{"more series than colors", func(s *Spec) {
			for range len(seriesPalette) {
				s.Series = append(s.Series, s.Series[0])
			}
		}, ""},
	}
	for _, kind := range []Kind{Line, Bar} {
		for _, tt := range tests {
			t.Run(fmt.Sprintf("kind %d %s", kind, tt.name), func(t *testing.T) {
				spec := lineSpec(1, 2, 3)
				spec.Kind = kind
				if tt.change != nil {
					tt.change(&spec)
				}
				if tt.want != "" {
					png, err := Render(spec)
					if err == nil || !strings.Contains(err.Error(), tt.want) || png != nil {
						t.Errorf("err = %v, want one containing %q and no image", err, tt.want)
					}
					return
				}
				// The value limits keep the y labels distinct.
				checkLayout(t, spec, mustLayout(t, spec))
			})
		}
	}
}

func TestRenderConcurrently(t *testing.T) {
	spec := barSpec([]string{"a", "b"}, []float64{3, nan})
	want, err := Render(spec)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for range 4 {
		wg.Go(func() {
			if got, err := Render(spec); err != nil || !bytes.Equal(got, want) {
				t.Errorf("concurrent render differs from the first render (err %v)", err)
			}
		})
	}
	wg.Wait()
}
