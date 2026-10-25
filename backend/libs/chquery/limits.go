package chquery

import (
	"errors"

	"github.com/ClickHouse/clickhouse-go/v2"
)

// The ClickHouse error codes of a query that needs more memory or time than
// its max_memory_usage and max_execution_time settings allow. TOO_SLOW is a
// query that ClickHouse estimates would run longer than max_execution_time.
// MEMORY_LIMIT_EXCEEDED is also the code of a query that the server stops when
// the server as a whole runs out of memory.
const (
	timeoutExceeded     = 159
	tooSlow             = 160
	memoryLimitExceeded = 241
)

// IsLimitError reports whether ClickHouse stopped a query because the query
// needed more memory or time than the server allows.
func IsLimitError(err error) bool {
	var exception *clickhouse.Exception
	if !errors.As(err, &exception) {
		return false
	}
	switch exception.Code {
	case timeoutExceeded, tooSlow, memoryLimitExceeded:
		return true
	}
	return false
}
