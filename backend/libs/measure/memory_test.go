package measure

import "testing"

func TestMemoryPeakColumn(t *testing.T) {
	tests := []struct {
		name          string
		appImportance string
		wantColumn    string
		wantError     bool
	}{
		{name: "overall", wantColumn: "peak_total_memory"},
		{name: "foreground", appImportance: "foreground", wantColumn: "peak_total_memory_foreground"},
		{name: "user service", appImportance: "user_service", wantColumn: "peak_total_memory_user_service"},
		{name: "background", appImportance: "background", wantColumn: "peak_total_memory_background"},
		{name: "invalid", appImportance: "cached", wantError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := memoryPeakColumn(tt.appImportance)
			if (err != nil) != tt.wantError {
				t.Fatalf("memoryPeakColumn() error = %v, want error: %v", err, tt.wantError)
			}
			if !tt.wantError && got != tt.wantColumn {
				t.Errorf("memoryPeakColumn() = %q, want %q", got, tt.wantColumn)
			}
		})
	}
}
