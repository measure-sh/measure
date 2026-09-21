package event

import (
	"encoding/json"
	"testing"
)

func TestMemoryUsageAbsHeadroomJSON(t *testing.T) {
	tests := []struct {
		name         string
		payload      string
		wantHeadroom string // Empty means the field must be omitted from JSON.
	}{
		{name: "missing", payload: `{}`},
		{name: "null", payload: `{"available_memory":null}`},
		{name: "exhausted", payload: `{"available_memory":0}`, wantHeadroom: "0"},
		{name: "available", payload: `{"available_memory":2048}`, wantHeadroom: "2048"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var memory MemoryUsageAbs
			if err := json.Unmarshal([]byte(tt.payload), &memory); err != nil {
				t.Fatalf("decode memory event: %v", err)
			}
			encoded, err := json.Marshal(memory)
			if err != nil {
				t.Fatalf("encode memory event: %v", err)
			}

			var fields map[string]json.RawMessage
			if err := json.Unmarshal(encoded, &fields); err != nil {
				t.Fatalf("decode serialized fields: %v", err)
			}
			if got := string(fields["available_memory"]); got != tt.wantHeadroom {
				t.Errorf("available_memory = %q, want %q", got, tt.wantHeadroom)
			}
		})
	}
}

func TestMemoryUsageAbsRejectsInvalidHeadroom(t *testing.T) {
	tests := []struct {
		name    string
		payload string
	}{
		{name: "negative", payload: `{"available_memory":-1}`},
		{name: "fractional", payload: `{"available_memory":0.5}`},
		{name: "overflow", payload: `{"available_memory":18446744073709551616}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var memory MemoryUsageAbs
			if err := json.Unmarshal([]byte(tt.payload), &memory); err == nil {
				t.Fatalf("accepted invalid headroom: %s", tt.payload)
			}
		})
	}
}
