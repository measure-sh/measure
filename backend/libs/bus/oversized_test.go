package bus

import (
	"errors"
	"fmt"
	"testing"

	"cloud.google.com/go/pubsub/v2"
	ierror "github.com/apache/iggy/foreign/go/errors"
)

func TestIsOversized(t *testing.T) {
	// each case mirrors the wrap the matching producer applies. If a producer
	// ever stops using %w, oversized batches stop being classified & callers
	// retry a payload that can never succeed.
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "pubsub oversized",
			err:  fmt.Errorf("bus: pubsub publish failed: %w", pubsub.ErrOversizedMessage),
			want: true,
		},
		{
			name: "iggy oversized",
			err:  fmt.Errorf("bus: failed to create Iggy message: %w", ierror.ErrTooBigMessagePayload),
			want: true,
		},
		{
			name: "transient",
			err:  errors.New("context deadline exceeded"),
			want: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := IsOversized(test.err); got != test.want {
				t.Errorf("IsOversized() = %v, want %v", got, test.want)
			}
		})
	}
}
