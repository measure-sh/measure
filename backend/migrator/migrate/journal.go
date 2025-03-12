package migrate

import (
	"bufio"
	"encoding/json"
	"os"
	"time"
)

// State represents the different
// states a migration can be in.
type State int

// Kind represents the different
// kinds of migration task(s).
type Kind int

const (
	// Pending represents the migration
	// is in pending state
	Pending State = iota

	// Applied represents the migration
	// is in applied state
	Applied
)

const (
	// ObjectMigration represents the migration
	// task is migrating object files on a bucket
	ObjectMigration Kind = iota

	// DataMigration represents the migration task
	// is migrating data in a database. This is
	// unused for now.
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

func (k Kind) String() string {
	switch k {
	default:
		return "unknown"
	case ObjectMigration:
		return "object-migration"
	case DataMigration:
		return "data-migration"
	}
}

// JournalEntry represents each migration
// entry in the migration log journal.
type JournalEntry struct {
	ID    string    `json:"id"`
	Kind  Kind      `json:"kind"`
	State State     `json:"state"`
	Time  time.Time `json:"time"`
}

// Journal represents the migration log
// journal.
type Journal struct {
	file    string
	entries []JournalEntry
}

// Push appends a new journal entry to the
// journal.
func (j *Journal) Push(id string) (err error) {
	entry := JournalEntry{
		ID:    id,
		Kind:  ObjectMigration,
		State: Applied,
		Time:  time.Now(),
	}

	j.entries = append(j.entries, entry)

	file, err := os.Create(j.file)
	if err != nil {
		return
	}

	writer := bufio.NewWriter(file)

	for _, e := range j.entries {
		line, errLine := json.Marshal(e)
		if errLine != nil {
			return errLine
		}

		if _, err := writer.Write(append(line, '\n')); err != nil {
			return err
		}
	}

	return writer.Flush()
}

// Pop removes the latest applied migration from
// the journal.
func (j *Journal) Pop(id string) (err error) {
	file, err := os.Create(j.file)
	if err != nil {
		return
	}

	writer := bufio.NewWriter(file)

	j.entries = j.entries[:len(j.entries)-1]

	for _, e := range j.entries {
		line, errLine := json.Marshal(e)
		if errLine != nil {
			return errLine
		}

		if _, err := writer.Write(append(line, '\n')); err != nil {
			return err
		}
	}

	return writer.Flush()
}

// GetEntry returns the corresponding journal
// entry by migration id.
func (j Journal) GetEntry(id string) (entry JournalEntry) {
	for _, e := range j.entries {
		if id == e.ID {
			entry = e
			break
		}
	}

	return
}

// NewJournal creates a new journal.
func NewJournal(filePath string) (journal *Journal, err error) {
	journal = &Journal{
		file: filePath,
	}

	file, err := os.Open(filePath)
	if err != nil {
		return
	}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var entry JournalEntry
		if err = json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			return
		}

		journal.entries = append(journal.entries, entry)
	}

	if err = scanner.Err(); err != nil {
		return
	}

	return
}
