package migrate

import (
	"io"
	"time"

	"github.com/google/uuid"
)

type State int
type Kind int

const (
	Pending State = iota
	Applied
)

const (
	ObjectMigration Kind = iota
	DataMigration
)

func (s State) String() string {
	switch s {
	default:
		return "unknown"
	case Pending:
		return "pending"
	case Applied:
		return "applied"
	}
}

type JournalEntry struct {
	id    uuid.UUID
	kind  Kind
	state State
	time  time.Time
}

type Journal struct {
	writer  *io.Writer
	entries []JournalEntry
}

func NewJournal(w *io.Writer) (journal *Journal) {
	return &Journal{
		writer: w,
	}
}
