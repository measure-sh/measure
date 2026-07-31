package boot

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	redis "github.com/valkey-io/valkey-go"
)

// WaitForPg blocks until the pool answers a ping or the timeout elapses.
func WaitForPg(ctx context.Context, pgPool *pgxpool.Pool, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		if err := pgPool.Ping(ctx); err == nil {
			return nil // Ready
		} else {
			fmt.Printf("PG ping failed: %v; Retrying...\n", err)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

// ConnectValkey builds a valkey client, retrying until timeout.
//
// The pg & clickhouse handles connect lazily, so they survive a dependency
// that is not up yet. valkey-go dials eagerly & returns a nil client on
// failure, which would leave the client nil for the process lifetime.
func ConnectValkey(ctx context.Context, host string, port int, clientName string, timeout time.Duration) (client redis.Client, err error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	options := redis.ClientOption{
		InitAddress: []string{fmt.Sprintf("%s:%d", host, port)},
	}

	options.ConnWriteTimeout = 30 * time.Second
	options.ClientName = clientName

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		client, err = redis.NewClient(options)
		if err == nil {
			return client, nil
		}
		fmt.Printf("Valkey client creation failed: %v; Retrying...\n", err)

		select {
		case <-ctx.Done():
			return nil, err
		case <-ticker.C:
		}
	}
}
