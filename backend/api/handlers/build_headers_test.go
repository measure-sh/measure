package handlers

import "testing"

func TestEmitContentLength(t *testing.T) {
	tests := []struct {
		name    string
		isCloud bool
		length  int64
		want    bool
	}{
		{"self-host known size sets header", false, 42, true},
		{"self-host unknown size omits header", false, -1, false},
		{"cloud known size omits header for chunked", true, 42, false},
		{"cloud unknown size omits header", true, -1, false},
	}
	for _, tt := range tests {
		if got := emitContentLength(tt.isCloud, tt.length); got != tt.want {
			t.Errorf("%s: emitContentLength(%v, %d) = %v, want %v", tt.name, tt.isCloud, tt.length, got, tt.want)
		}
	}
}
