package measure

import "testing"

func TestValidMemoryAppImportance(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "all states", want: true},
		{name: "foreground", value: "foreground", want: true},
		{name: "user service", value: "user_service", want: true},
		{name: "background", value: "background", want: true},
		{name: "cached", value: "cached", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validMemoryAppImportance(tt.value); got != tt.want {
				t.Fatalf("validMemoryAppImportance(%q) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

func TestMemoryDistributionBucketLabel(t *testing.T) {
	tests := []struct {
		bucket uint64
		want   string
	}{
		{bucket: 0, want: "0-100"},
		{bucket: 8, want: "800-900"},
		{bucket: 9, want: "900+"},
		{bucket: 20, want: "900+"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			if got := memoryDistributionBucketLabel(tt.bucket); got != tt.want {
				t.Fatalf("memoryDistributionBucketLabel(%d) = %q, want %q", tt.bucket, got, tt.want)
			}
		})
	}
}
