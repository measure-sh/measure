package timeline

import (
	"encoding/json"
	"testing"
	"time"

	"backend/libs/event"
)

func TestComputeMemoryUsage(t *testing.T) {
	timestamp := time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC)
	tests := []struct {
		name    string
		anonRSS uint64
		swap    uint64
		want    uint64
	}{
		{name: "anonymous RSS plus swap in KB", anonRSS: 65536, swap: 8192, want: 73728},
		{name: "zero swap", anonRSS: 65536, want: 65536},
		{name: "zero anonymous RSS", swap: 8192, want: 8192},
		{name: "missing measurements default to zero", want: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			memory := &event.MemoryUsage{AnonRSS: tt.anonRSS, Swap: tt.swap, JavaMaxHeap: 262144}
			got := ComputeMemoryUsage([]event.EventField{{MemoryUsage: memory, Timestamp: timestamp}})
			if len(got) != 1 {
				t.Fatalf("expected one sample, got %d", len(got))
			}
			if got[0].DynamicMemory != tt.want {
				t.Errorf("dynamic memory = %d, want %d KB", got[0].DynamicMemory, tt.want)
			}
			if got[0].MemoryUsage != memory || !got[0].Timestamp.Equal(timestamp) {
				t.Error("original memory sample and timestamp must be preserved")
			}

			data, err := json.Marshal(got[0])
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]json.RawMessage
			if err := json.Unmarshal(data, &fields); err != nil {
				t.Fatal(err)
			}
			value, ok := fields["dynamic_memory"]
			if !ok {
				t.Fatal("dynamic_memory must be serialized even when zero")
			}
			var dynamicMemory uint64
			if err := json.Unmarshal(value, &dynamicMemory); err != nil {
				t.Fatal(err)
			}
			if dynamicMemory != tt.want {
				t.Errorf("serialized dynamic_memory = %d, want %d", dynamicMemory, tt.want)
			}
			if string(fields["java_max_heap"]) != "262144" || string(fields["timestamp"]) != `"2026-09-16T10:00:00Z"` {
				t.Errorf("existing response fields changed: %s", data)
			}
		})
	}
}
