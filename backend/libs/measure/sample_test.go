//go:build integration

package measure

import (
	"context"
	"strconv"
	"testing"

	"backend/libs/chquery"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
)

func TestAnalyticsQueryOverLimitsIsLimitError(t *testing.T) {
	queryErr := func(t *testing.T, settings clickhouse.Settings, query string) error {
		t.Helper()
		ctx := chquery.WithSettings(analyticsCtx(context.Background(), uuid.New(), funnelMaxMemoryBytes), settings)
		var result uint64
		err := deps.RchPool.QueryRow(ctx, query).Scan(&result)
		if err == nil {
			t.Fatalf("query %q succeeded, want an error", query)
		}
		return err
	}

	t.Run("a query over the memory limit", func(t *testing.T) {
		err := queryErr(t, clickhouse.Settings{"max_memory_usage": 1 << 20}, "select length(groupArray(number)) from numbers(10000000)")
		if !chquery.IsLimitError(err) {
			t.Errorf("IsLimitError(%v) = false, want true", err)
		}
	})

	t.Run("a query over the time limit", func(t *testing.T) {
		err := queryErr(t, clickhouse.Settings{"max_execution_time": 1}, "select count() from numbers(100000000000) where not ignore(sipHash64(number))")
		if !chquery.IsLimitError(err) {
			t.Errorf("IsLimitError(%v) = false, want true", err)
		}
	})
}

func formatSamplePercent(percent *float64) string {
	if percent == nil {
		return "nil"
	}
	return strconv.FormatFloat(*percent, 'f', -1, 64)
}
