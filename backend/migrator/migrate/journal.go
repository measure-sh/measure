package migrate

import (
	"os"
	"time"

	"github.com/google/uuid"
)

type State int

const (
	Pending State = iota
	Applied
)

func (s State) String() string {
	return [...]string{"pending", "applied"}[s]
}

type JournalEntry struct {
	id     uuid.UUID
	action string
	state  State
	time   time.Time
}

type Journal struct {
	file    *os.File
	entries []JournalEntry
}

func NewJournal(file *os.File) (journal *Journal) {
	return &Journal{}
}
