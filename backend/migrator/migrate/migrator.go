package migrate

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"
)

// MigrateFunc carries out the migration
// task.
type MigrateFunc func(context.Context) error

// RollbackFunc carries out the rollback
// task.
type RollbackFunc func(context.Context) error

// ObjMigration represents an object migration
// task.
type ObjMigration struct {
	ID       string
	Title    string
	Migrate  MigrateFunc
	Rollback RollbackFunc
}

// NewObjMigrator creates a new object migrator
// instance.
func NewObjMigrator(id, title string, migrateFn MigrateFunc, rollbackFn RollbackFunc) (objMigrator *ObjMigration) {
	migration := ObjMigration{
		ID:       id,
		Title:    title,
		Migrate:  migrateFn,
		Rollback: rollbackFn,
	}

	return &migration
}

// PrintMigrations prints all the migrations along
// with other metadata.
func PrintMigrations(migrations []*ObjMigration, journal *Journal) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "\tID\tKind\tStatus\tTitle")

	for i, migration := range migrations {
		entry := journal.GetEntry(migration.ID)

		fmt.Fprintf(w, "%d.\t%s\t%s\t%s\t%s\n", i+1, migration.ID, entry.Kind.String(), entry.State.String(), migration.Title)
	}

	w.Flush()
}

// GetPendingMigrations selects all the pending migrations.
func GetPendingMigrations(migrations []*ObjMigration, journal *Journal) (pending []*ObjMigration) {
	for _, migration := range migrations {
		entry := journal.GetEntry(migration.ID)

		if entry.State != Applied {
			pending = append(pending, migration)
		}
	}

	return
}

// GetLastAppliedMigration selects the last applied migration.
func GetLastAppliedMigration(migrations []*ObjMigration, journal *Journal) (migration *ObjMigration) {
	id := ""
	for i := len(journal.entries) - 1; i >= 0; i-- {
		if journal.entries[i].State == Applied {
			id = journal.entries[i].ID
			break
		}
	}

	for _, m := range migrations {
		if m.ID == id {
			migration = m
			return
		}
	}

	return
}
