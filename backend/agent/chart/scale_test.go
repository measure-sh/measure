package chart

import (
	"math"
	"math/rand"
	"slices"
	"testing"
)

func TestNewValueScaleTicks(t *testing.T) {
	tests := []struct {
		name   string
		lo, hi float64
		want   []float64
	}{
		{"zero to 16", 0, 16, []float64{0, 5, 10, 15, 20}},
		{"zero to 9000", 0, 9000, []float64{0, 2000, 4000, 6000, 8000, 10000}},
		{"far from zero", 40.4, 42.7, []float64{0, 10, 20, 30, 40, 50}},
		{"small", 0.001, 0.004, []float64{0, 0.001, 0.002, 0.003, 0.004}},
		{"float noise", 0.1, 0.3, []float64{0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3}},
		{"large", 1e9, 5e9, []float64{0, 1e9, 2e9, 3e9, 4e9, 5e9}},
		{"negative", -17, -3, []float64{-20, -15, -10, -5, 0}},
		{"spans zero", -3, 8, []float64{-4, -2, 0, 2, 4, 6, 8}},
		{"flat positive", 5, 5, []float64{0, 1, 2, 3, 4, 5}},
		{"flat zero", 0, 0, []float64{0, 0.2, 0.4, 0.6, 0.8, 1}},
		{"NaN", math.NaN(), 3, []float64{0, 0.2, 0.4, 0.6, 0.8, 1}},
		{"Inf", 0, math.Inf(1), []float64{0, 0.2, 0.4, 0.6, 0.8, 1}},
		{"range past the float maximum", -1.7e308, 1.7e308, []float64{0, 0.2, 0.4, 0.6, 0.8, 1}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scale := newValueScale(tt.lo, tt.hi, 5)
			if !slices.Equal(scale.ticks, tt.want) {
				t.Fatalf("ticks = %v, want %v", scale.ticks, tt.want)
			}
			if scale.min != tt.want[0] || scale.max != tt.want[len(tt.want)-1] {
				t.Fatalf("range = %v..%v, want %v..%v", scale.min, scale.max, tt.want[0], tt.want[len(tt.want)-1])
			}
		})
	}
}

// Any bounds and tick target give a scale that the layout can use: at least
// two ticks that rise by an even step and include zero.
func FuzzValueScale(f *testing.F) {
	f.Add(0.0, 16.0, 5)
	f.Add(0.0, 5e-324, 5)
	f.Add(math.NaN(), 3.0, 5)
	f.Add(-3.0, 8.0, 0)
	f.Add(0.0, 1e15, 1<<40)
	f.Add(-1e-6, 9.99e14, 5)
	f.Fuzz(func(t *testing.T, lo, hi float64, tickTarget int) {
		scale := newValueScale(lo, hi, tickTarget)
		ticks := scale.ticks
		n := len(ticks)
		if n < 2 || n > 300 || ticks[0] != scale.min || ticks[n-1] != scale.max || !slices.Contains(ticks, 0) {
			t.Fatalf("newValueScale(%v, %v, %d) = %+v", lo, hi, tickTarget, scale)
		}
		for i := 1; i < n; i++ {
			if gap := ticks[i] - ticks[i-1]; !(math.Abs(gap-scale.step) <= 1e-9*max(scale.step, math.Abs(ticks[i]))) {
				t.Fatalf("newValueScale(%v, %v, %d): gap %v differs from step %v in %v", lo, hi, tickTarget, gap, scale.step, ticks)
			}
		}
		// In the range that validate accepts, the scale covers the data up to
		// the float noise that snap allows.
		if peak := max(math.Abs(lo), math.Abs(hi)); lo <= hi && peak >= 1e-6 && peak <= 1e15 &&
			(scale.min > lo+2e-9*math.Abs(lo) || scale.max < hi-2e-9*math.Abs(hi)) {
			t.Fatalf("newValueScale(%v, %v, %d) = %v..%v does not cover the data", lo, hi, tickTarget, scale.min, scale.max)
		}
	})
}

func TestValueScaleFraction(t *testing.T) {
	scale := newValueScale(0, 16, 5)
	for v, want := range map[float64]float64{0: 0, 5: 0.25, 20: 1, -10: -0.5, 30: 1.5} {
		if got := scale.fraction(v); math.Abs(got-want) > 1e-12 {
			t.Errorf("fraction(%v) = %v, want %v", v, got, want)
		}
	}
}

func TestFormatTick(t *testing.T) {
	tests := []struct {
		name   string
		lo, hi float64
		unit   string
		want   []string
	}{
		{"percent", 40.4, 42.7, " % ", []string{"0%", "10%", "20%", "30%", "40%", "50%"}},
		{"unit after a space", 0, 16, "  ms ", []string{"0 ms", "5 ms", "10 ms", "15 ms", "20 ms"}},
		{"decimals", 0.1, 0.3, "", []string{"0", "0.05", "0.1", "0.15", "0.2", "0.25", "0.3"}},
		{"negative thousands", -3000, 0, "", []string{"-3K", "-2.5K", "-2K", "-1.5K", "-1K", "-500", "0"}},
		{"thousands steps", 1000, 1020, "", []string{"0", "200", "400", "600", "800", "1K", "1.2K"}},
		{"mixed K and M", 0, 1.5e6, "", []string{"0", "500K", "1M", "1.5M", "2M"}},
		{"billions", 1e9, 5e9, "", []string{"0", "1B", "2B", "3B", "4B", "5B"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scale := newValueScale(tt.lo, tt.hi, 5)
			var got []string
			for _, tick := range scale.ticks {
				got = append(got, scale.formatTick(tick, tt.unit))
			}
			if !slices.Equal(got, tt.want) {
				t.Fatalf("labels = %q, want %q (ticks %v)", got, tt.want, scale.ticks)
			}
		})
	}
}

// Over random data ranges, the ticks cover the data and zero, have an even
// step, and print as distinct labels.
func TestNewValueScaleProperties(t *testing.T) {
	random := rand.New(rand.NewSource(42))
	for i := range 500 {
		magnitude := math.Pow(10, float64(random.Intn(18)-3))
		lo := (random.Float64() - 0.5) * 4 * magnitude
		if random.Intn(3) == 0 {
			lo = math.Abs(lo)
		}
		hi := lo + magnitude*(0.01+random.Float64())

		scale := newValueScale(lo, hi, 5)

		n := len(scale.ticks)
		if n < 2 || n > 12 {
			t.Fatalf("case %d (%v..%v): %d ticks: %v", i, lo, hi, n, scale.ticks)
		}
		if scale.min != scale.ticks[0] || scale.max != scale.ticks[n-1] {
			t.Fatalf("case %d: min/max do not match ticks", i)
		}
		if scale.min > lo || scale.max < hi || !slices.Contains(scale.ticks, 0) {
			t.Fatalf("case %d (%v..%v): ticks %v do not cover the data and zero", i, lo, hi, scale.ticks)
		}
		seen := map[string]bool{}
		for j, tick := range scale.ticks {
			if j > 0 {
				gap := tick - scale.ticks[j-1]
				if math.Abs(gap-scale.step) > 1e-9*max(scale.step, math.Abs(tick)) {
					t.Fatalf("case %d: gap %v differs from step %v in %v", i, gap, scale.step, scale.ticks)
				}
			}
			label := scale.formatTick(tick, "")
			if seen[label] {
				t.Fatalf("case %d (%v..%v): label %q repeats in %v", i, lo, hi, label, scale.ticks)
			}
			seen[label] = true
		}
	}
}
