package chquery

import (
	"errors"
	"fmt"
	"testing"

	"github.com/ClickHouse/clickhouse-go/v2"
)

func TestIsLimitError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"timeout", &clickhouse.Exception{Code: timeoutExceeded}, true},
		{"estimated too slow", &clickhouse.Exception{Code: tooSlow}, true},
		{"memory", &clickhouse.Exception{Code: memoryLimitExceeded}, true},
		{"wrapped", fmt.Errorf("failed to query: %w", &clickhouse.Exception{Code: memoryLimitExceeded}), true},
		{"syntax error", &clickhouse.Exception{Code: 62}, false},
		{"not a ClickHouse error", errors.New("connection refused"), false},
		{"no error", nil, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := IsLimitError(test.err); got != test.want {
				t.Errorf("IsLimitError(%v) = %v, want %v", test.err, got, test.want)
			}
		})
	}
}
