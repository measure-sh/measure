package chquery

import (
	"context"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

// readerConn wraps a read-only pool & guards its read methods with a required
// scope. Embedding driver.Conn promotes the other methods unchanged, so a
// readerConn is a drop-in driver.Conn at every existing call site.
type readerConn struct {
	driver.Conn
	scopeKey string
}

// NewReaderConn wraps c so every read fails loud unless scopeKey is carried by
// the query context. Wrap the pool once at construction; call sites are unchanged.
func NewReaderConn(c driver.Conn, scopeKey string) driver.Conn {
	return readerConn{Conn: c, scopeKey: scopeKey}
}

func (r readerConn) Query(ctx context.Context, query string, args ...any) (driver.Rows, error) {
	if err := RequireScope(ctx, r.scopeKey); err != nil {
		return nil, err
	}
	return r.Conn.Query(ctx, query, args...)
}

func (r readerConn) QueryRow(ctx context.Context, query string, args ...any) driver.Row {
	if err := RequireScope(ctx, r.scopeKey); err != nil {
		return errRow{err}
	}
	return r.Conn.QueryRow(ctx, query, args...)
}

func (r readerConn) Select(ctx context.Context, dest any, query string, args ...any) error {
	if err := RequireScope(ctx, r.scopeKey); err != nil {
		return err
	}
	return r.Conn.Select(ctx, dest, query, args...)
}

// errRow carries a guard error through driver.Row, which has no error return.
type errRow struct{ err error }

func (e errRow) Err() error           { return e.err }
func (e errRow) Scan(...any) error    { return e.err }
func (e errRow) ScanStruct(any) error { return e.err }
