package migrate

type MigrateFunc func() error
type RollbackFunc func() error

type ObjMigration struct {
	ID       int
	Title    string
	Migrate  MigrateFunc
	Rollback RollbackFunc
}

// migrations stores all added migrations
var migrations = []*ObjMigration{}

// func (m *ObjMigration) Migrate(ctx context.Context) {
// 	fmt.Println("perform the actual migration here")
// }

// func (m *ObjMigration) Rollback(ctx context.Context) {
// 	fmt.Println("perform the actual rollback here")
// }

// func (m *ObjMigration) Add(title string, migrateFn MigrateFunc, rollbackFn RollbackFunc) {
// 	m.ID = len(migrations)
// 	m.Title = title
// 	migrations = append(migrations, m)
// }

func NewObjMigrator(title string, migrateFn MigrateFunc, rollbackFn RollbackFunc) (objMigrator *ObjMigration) {
	migration := ObjMigration{
		ID:       len(migrations),
		Title:    title,
		Migrate:  migrateFn,
		Rollback: rollbackFn,
	}

	migrations = append(migrations, &migration)

	return &migration
}

// migrator := NewMigrator()

// migrator.Add()
