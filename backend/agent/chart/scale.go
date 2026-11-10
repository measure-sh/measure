package chart

import (
	"math"
	"strconv"
	"strings"
)

// valueScale is a linear axis from min to max with tick values in ascending
// order. ticks[0] == min and ticks[len(ticks)-1] == max (the range is extended
// to the ticks, like d3 nice()).
type valueScale struct {
	min, max float64
	ticks    []float64
	step     float64
}

// tickStep describes a tick step of mult * 10^power, with mult one of 1, 2, 5
// or 10. Ticks are integer multiples of the step, avoiding accumulated
// rounding error.
type tickStep struct {
	mult  float64
	power int
}

func (s tickStep) value(k float64) float64 {
	var v float64
	if s.power >= 0 {
		v = k * s.mult * math.Pow(10, float64(s.power))
	} else {
		v = k * s.mult / math.Pow(10, float64(-s.power))
	}
	// A zero tick from a negative zero k is made positive so that its label
	// does not print as "-0".
	if v == 0 {
		return 0
	}
	return v
}

func (s tickStep) size() float64 { return s.value(1) }

// newValueScale builds a linear scale and ticks for the data range, extending
// the range to include zero. It targets tickTarget ticks, though the result
// may contain more or fewer.
//
// NaN or infinite bounds, an all-zero range, and a range outside 1e-300 to
// 1e300 produce a 0..1 scale. Beyond those limits, the step or the ticks do
// not fit in a float64.
func newValueScale(dataMin, dataMax float64, tickTarget int) valueScale {
	lo, hi := min(dataMin, 0), max(dataMax, 0)
	if !(hi-lo >= 1e-300 && hi-lo <= 1e300) {
		lo, hi = 0, 1
	}
	// A target below 1 gives no usable step, and a large target makes a tick
	// slice of about that length.
	tickTarget = min(max(tickTarget, 1), 100)

	// Repeat until the step stabilizes, since widening the range can change it.
	// Each pass starts from the range widened by the previous pass.
	var step tickStep
	var kLo, kHi float64
	for range 10 {
		next := chooseStep(lo, hi, tickTarget)
		if next == step {
			break
		}
		step = next
		size := step.size()
		kLo = math.Floor(snap(lo / size))
		kHi = math.Ceil(snap(hi / size))
		// Keep a tick below zero when lo is negative and above zero
		// when hi is positive, even if float noise or underflow makes
		// the bound's quotient zero.
		if lo < 0 {
			kLo = min(kLo, -1)
		}
		if hi > 0 {
			kHi = max(kHi, 1)
		}
		lo, hi = step.value(kLo), step.value(kHi)
	}

	ticks := make([]float64, 0, int(kHi-kLo)+1)
	for k := kLo; k <= kHi; k++ {
		ticks = append(ticks, step.value(k))
	}
	return valueScale{min: lo, max: hi, ticks: ticks, step: step.size()}
}

// chooseStep selects a 1, 2, 5 or 10 multiple of a power of ten near
// (hi-lo)/count.
func chooseStep(lo, hi float64, count int) tickStep {
	raw := (hi - lo) / float64(count)
	power := int(math.Floor(math.Log10(raw)))
	mantissa := raw / math.Pow(10, float64(power))
	mult := 1.0
	switch {
	case mantissa >= math.Sqrt(50):
		mult = 10
	case mantissa >= math.Sqrt(10):
		mult = 5
	case mantissa >= math.Sqrt(2):
		mult = 2
	}
	return tickStep{mult: mult, power: power}
}

// snap rounds x to the nearest integer when it is within float noise of one,
// so that a bound that is already a multiple of the step is not moved by
// floor or ceil.
func snap(x float64) float64 {
	r := math.Round(x)
	if math.Abs(x-r) < 1e-9*max(1, math.Abs(x)) {
		return r
	}
	return x
}

// fraction returns where v is between min and max: 0 at min, 1 at max. Values
// outside the range are not clamped.
func (s valueScale) fraction(v float64) float64 {
	return (v - s.min) / (s.max - s.min)
}

// formatTick formats one tick value for the axis label, with unit appended.
// unit "" -> no suffix; unit "%" -> joined ("43.5%"); any other unit -> after
// a space ("9K ms"). The unit is trimmed of surrounding spaces first.
func (s valueScale) formatTick(v float64, unit string) string {
	text := formatKMB(v, s.step)
	switch unit = strings.TrimSpace(unit); unit {
	case "":
		return text
	case "%":
		return text + "%"
	}
	return text + " " + unit
}

// formatKMB formats large values with K, M or B suffixes and removes trailing
// zeros. It uses the precision needed for the tick step.
func formatKMB(v, step float64) string {
	divisor, suffix, shift := 1.0, "", 0
	switch abs := math.Abs(v); {
	case abs >= 1e9:
		divisor, suffix, shift = 1e9, "B", 9
	case abs >= 1e6:
		divisor, suffix, shift = 1e6, "M", 6
	case abs >= 1e3:
		divisor, suffix, shift = 1e3, "K", 3
	}

	decimals, zeros := stepPrecision(step)
	if decimals == 0 {
		decimals = max(0, shift-zeros)
	}
	text := strconv.FormatFloat(v/divisor, 'f', decimals, 64)
	if strings.Contains(text, ".") {
		text = strings.TrimSuffix(strings.TrimRight(text, "0"), ".")
	}
	return text + suffix
}

const maxLabelDecimals = 15

// stepPrecision returns how many decimals the step needs, and for whole steps
// how many trailing zeros it has. Labels use it so that adjacent ticks always
// print differently.
func stepPrecision(step float64) (decimals, zeros int) {
	for d := 0; d <= maxLabelDecimals; d++ {
		x := step * math.Pow(10, float64(d))
		if math.Abs(x-math.Round(x)) < 1e-9*max(1, x) {
			if d > 0 {
				return d, 0
			}
			n := math.Round(x)
			for n >= 10 && math.Mod(n, 10) == 0 {
				n /= 10
				zeros++
			}
			return 0, zeros
		}
	}
	return maxLabelDecimals, 0
}
