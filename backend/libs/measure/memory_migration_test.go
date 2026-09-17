//go:build integration

package measure

import (
	"context"
	"os"
	"strings"
	"testing"
)

func TestMemorySessionMigrationRollbackPreservesExistingFields(t *testing.T) {
	migration, err := os.ReadFile("../../../self-host/clickhouse/20260914130001_alter_sessions_mv.sql")
	if err != nil {
		t.Fatal(err)
	}
	up, down, ok := strings.Cut(string(migration), "-- migrate:down")
	if !ok {
		t.Fatal("memory sessions view migration is missing its rollback")
	}
	ctx := context.Background()
	t.Cleanup(func() {
		if err := deps.ChPool.Exec(ctx, up); err != nil {
			t.Errorf("restore memory sessions view: %v", err)
		}
	})
	if err := deps.ChPool.Exec(ctx, down); err != nil {
		t.Fatalf("roll back memory sessions view: %v", err)
	}
	var query string
	if err := deps.ChPool.QueryRow(ctx, "SELECT create_table_query FROM system.tables WHERE database = currentDatabase() AND name = 'sessions_mv'").Scan(&query); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{
		"maxSimpleState(attribute.patch_version)",
		"maxSimpleState(attribute.patch_id)",
		"AS unique_screen_view_names",
		"AS unique_view_controller_classnames",
	} {
		if !strings.Contains(query, field) {
			t.Errorf("rollback removed pre-existing projection %q", field)
		}
	}
	if strings.Contains(query, "maxSimpleState(attribute.device_total_memory)") {
		t.Error("rollback retained the memory migration's projection")
	}
}
