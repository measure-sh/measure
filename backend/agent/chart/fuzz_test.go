package chart

import (
	"bytes"
	"image/png"
	"math"
	"runtime"
	"strings"
	"testing"
	"time"
)

// fuzzValues are the values that one byte of fuzz input selects. The first
// is 1, so input that runs out of bytes still gives finite values.
var fuzzValues = []float64{1, 0, math.Copysign(0, -1), nan, math.Inf(1), math.Inf(-1), 5e-324, 1e-7, 1e-6, -1e-6, 1e15, -1e15, 1e16, math.MaxFloat64, 0.1, -1}

// fuzzSpec decodes fuzz input into a spec. The counts wrap into the ranges
// that Render accepts, and corrupt selects one way to break the spec. data
// gives the values and marker indices, and text gives the strings, split at
// "|".
func fuzzSpec(kind, n, series, markers, inProgress, corrupt uint8, data []byte, text string) Spec {
	next := func() (b byte) {
		if len(data) > 0 {
			b, data = data[0], data[1:]
		}
		return b
	}
	value := func() float64 {
		b := next()
		if int(b) < len(fuzzValues) {
			return fuzzValues[b]
		}
		return float64(int16(next())<<8|int16(next())) * math.Pow10(int(b)%24-8)
	}
	texts := strings.Split(text, "|")
	str := func(k int) string { return texts[k%len(texts)] }
	unit := []rune(str(1))
	count := int(n)%100 + 1
	spec := Spec{Kind: Kind(kind % 2), Title: str(0), YUnit: string(unit[:min(len(unit), maxUnitLength)]), InProgressCount: int(inProgress) % (count + 1)}
	for i := range count {
		spec.XLabels = append(spec.XLabels, str(i+2))
	}
	for s := range int(series)%12 + 1 {
		values := make([]float64, count)
		for i := range values {
			values[i] = value()
		}
		spec.Series = append(spec.Series, Series{Name: str(s + 3), Values: values})
	}
	for m := range int(markers) % 6 {
		spec.Markers = append(spec.Markers, Marker{Index: int(next()) % count, Label: str(m + 4)})
	}
	switch corrupt % 16 {
	case 1:
		spec.XLabels = spec.XLabels[1:]
	case 2:
		spec.Markers = append(spec.Markers, Marker{Index: count})
	case 3:
		spec.InProgressCount = -1
	case 4:
		spec.YUnit = strings.Repeat("u", maxUnitLength+1)
	}
	return spec
}

func FuzzRender(f *testing.F) {
	f.Add(uint8(Line), uint8(6), uint8(0), uint8(0), uint8(0), uint8(0), []byte{40, 12, 40, 30, 40, 20, 3, 40, 25}, "Sessions|ms|Mon|Tue|Wed|Thu")
	f.Add(uint8(Bar), uint8(4), uint8(1), uint8(1), uint8(1), uint8(0), []byte{3, 50, 9, 1, 0, 60, 200, 2, 9}, "Crashes by OS|%|Android 14|iOS|Web|n/a")
	f.Add(uint8(Line), uint8(99), uint8(4), uint8(3), uint8(3), uint8(0), []byte{11, 9, 34, 100, 20, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255, 99}, "A long title that pushes the legend below it|ms|Day 1|Day 2|…|مرحبا|\xff\x00\n")
	f.Add(uint8(Bar), uint8(99), uint8(11), uint8(5), uint8(99), uint8(0), []byte{60, 1, 10, 255, 3, 4, 5, 70, 80}, "/api/payment-methods/default/cards|req/s|日本|España|   ")
	f.Add(uint8(Line), uint8(2), uint8(0), uint8(2), uint8(0), uint8(2), []byte{}, "T")
	f.Fuzz(func(t *testing.T, kind, n, series, markers, inProgress, corrupt uint8, data []byte, text string) {
		spec := fuzzSpec(kind, n, series, markers, inProgress, corrupt, data, text)
		var before, after runtime.MemStats
		runtime.ReadMemStats(&before)
		start := time.Now()
		encoded, err := Render(spec)
		elapsed := time.Since(start)
		runtime.ReadMemStats(&after)
		if allocated := after.TotalAlloc - before.TotalAlloc; elapsed > 5*time.Second || allocated > 256<<20 {
			t.Errorf("render took %v and allocated %d bytes", elapsed, allocated)
		}
		if err != nil {
			if encoded != nil {
				t.Fatalf("Render returned %d bytes with the error %v", len(encoded), err)
			}
			return
		}
		l := mustLayout(t, spec)
		config, err := png.DecodeConfig(bytes.NewReader(encoded))
		// The height allows a title line, a row per legend entry and marker, and 200px of x labels.
		maxHeight := 2*outerPadding + 40 + (len(spec.Series)+1)*(legendSwatchSize+legendRowGap) + headerGap +
			len(spec.Markers)*markerRowHeight + markerRowsGap + plotHeight + tickLabelOffset + 200
		if err != nil || config.Width != Width || config.Height != l.height || config.Height > maxHeight {
			t.Errorf("image is %dx%d (%v), want %d wide and %d high, at most %d", config.Width, config.Height, err, Width, l.height, maxHeight)
		}
		checkLayout(t, spec, l)
	})
}
