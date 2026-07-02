package agent

import (
	"strings"
	"testing"
)

func TestPlatformNote(t *testing.T) {
	tests := []struct {
		name      string
		osNames   []string
		wantEmpty bool
		wantOSes  string // substring that must appear in the note
		wantANR   bool   // whether the Android-only caveat should appear
	}{
		{"no telemetry yet", nil, true, "", false},
		{"empty slice", []string{}, true, "", false},
		{"ios only", []string{"ios"}, false, "ios", true},
		{"apple family ios and ipados", []string{"ios", "ipados"}, false, "ios, ipados", true},
		{"android has anrs", []string{"android"}, false, "android", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			note := platformNote(tt.osNames)
			if tt.wantEmpty {
				if note != "" {
					t.Fatalf("want empty note, got %q", note)
				}
				return
			}
			if !strings.Contains(note, tt.wantOSes) {
				t.Errorf("note %q missing os list %q", note, tt.wantOSes)
			}
			hasCaveat := strings.Contains(note, "Android-only")
			if hasCaveat != tt.wantANR {
				t.Errorf("note %q: Android-only caveat present=%v, want %v", note, hasCaveat, tt.wantANR)
			}
		})
	}
}
