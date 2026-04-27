package reporter

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"symboloader/symsync/pipeline"
)

// --- messages ---

type stageStartedMsg     struct{ name string }
type stageProgressMsg    struct{ name, detail string }
type stageFinishedMsg    struct{ name, detail string }
type stageFailedMsg      struct{ name string; err error }
type fetchStartedMsg     struct{ total int }
type fetchProgressMsg    struct{ update pipeline.FetchProgressUpdate }
type fetchResultMsg      struct{ result pipeline.FetchResult }
type fetchDoneMsg        struct{}
type janitorStartedMsg   struct{ total int }
type deleteResultMsg     struct{ result pipeline.DeleteResult }
type janitorDoneMsg      struct{}
type manifestSummaryMsg  struct{ cat ManifestCategorized }
type doneMsg             struct{ err error }

// --- public categorization ---

// ManifestCategorized partitions archive entries by their status in this run.
// The caller builds it after a successful sync from the in-memory manifest
// and the run record's added/deleted refs.
type ManifestCategorized struct {
	Added   []pipeline.ArchiveEntry // newly added in this run (rendered green / "+")
	Kept    []pipeline.ArchiveEntry // active from prior runs (muted / " ")
	Deleted []pipeline.ArchiveEntry // soft-deleted in this run (red / "-")
}

// IsEmpty reports whether all categories are empty.
func (c ManifestCategorized) IsEmpty() bool {
	return len(c.Added) == 0 && len(c.Kept) == 0 && len(c.Deleted) == 0
}

// ActiveCount returns the count of currently-active archives (added + kept).
func (c ManifestCategorized) ActiveCount() int {
	return len(c.Added) + len(c.Kept)
}

// --- state ---

type stageStatus int

const (
	stagePending stageStatus = iota
	stageRunning
	stageDone
	stageFailed
)

type stageRow struct {
	name   string
	status stageStatus
	detail string
	err    error
}

type archiveRow struct {
	filename      string
	difs          int
	bytesUploaded int64
	err           error
}

type deleteRow struct {
	vbac        string
	filename    string
	difsDeleted int
	err         error
}

type inProgressRow struct {
	filename      string
	phase         string
	bytesDone     int64
	bytesTotal    int64
	difsUploaded  int
	bytesUploaded int64
}

// --- model ---

type model struct {
	stages       []stageRow
	sp           spinner.Model
	fetchTotal   int
	fetchDone    int
	archives     []archiveRow
	inProgress   []inProgressRow
	janitorTotal int
	janitorDone  int
	deletes      []deleteRow
	manifest     ManifestCategorized
	done         bool
	finalErr     error
	width        int
}

func newModel() model {
	sp := spinner.New()
	sp.Spinner = spinner.MiniDot
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))
	return model{sp: sp, width: 80}
}

func (m *model) setInProgress(u pipeline.FetchProgressUpdate) {
	for i := range m.inProgress {
		if m.inProgress[i].filename == u.FileName {
			m.inProgress[i].phase = u.Phase
			if u.BytesTotal > 0 {
				m.inProgress[i].bytesDone = u.BytesDone
				m.inProgress[i].bytesTotal = u.BytesTotal
			}
			if u.DIFsUploaded > 0 {
				m.inProgress[i].difsUploaded = u.DIFsUploaded
				m.inProgress[i].bytesUploaded = u.BytesUploaded
			}
			return
		}
	}
	m.inProgress = append(m.inProgress, inProgressRow{
		filename:   u.FileName,
		phase:      u.Phase,
		bytesDone:  u.BytesDone,
		bytesTotal: u.BytesTotal,
	})
}

func (m *model) removeInProgress(filename string) {
	for i, row := range m.inProgress {
		if row.filename == filename {
			m.inProgress = append(m.inProgress[:i], m.inProgress[i+1:]...)
			return
		}
	}
}

func (m model) hasFailedStage() bool {
	for _, s := range m.stages {
		if s.status == stageFailed {
			return true
		}
	}
	return false
}

func (m model) pct() int {
	if m.fetchTotal == 0 {
		return 0
	}
	return m.fetchDone * 100 / m.fetchTotal
}

// --- styles ---

var (
	styleGreen = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
	styleRed   = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
	styleMuted = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	styleBold  = lipgloss.NewStyle().Bold(true)
)

const stageNameWidth = 10

// --- bubbletea interface ---

func (m model) Init() tea.Cmd {
	return m.sp.Tick
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.sp, cmd = m.sp.Update(msg)
		return m, cmd

	case stageStartedMsg:
		m.stages = append(m.stages, stageRow{name: msg.name, status: stageRunning})

	case stageProgressMsg:
		for i := range m.stages {
			if m.stages[i].name == msg.name {
				m.stages[i].detail = msg.detail
				break
			}
		}

	case stageFinishedMsg:
		for i := range m.stages {
			if m.stages[i].name == msg.name {
				m.stages[i].status = stageDone
				m.stages[i].detail = msg.detail
				break
			}
		}

	case stageFailedMsg:
		for i := range m.stages {
			if m.stages[i].name == msg.name {
				m.stages[i].status = stageFailed
				m.stages[i].err = msg.err
				break
			}
		}

	case fetchStartedMsg:
		m.fetchTotal = msg.total
		m.inProgress = nil

	case fetchProgressMsg:
		m.setInProgress(msg.update)

	case fetchResultMsg:
		r := msg.result
		m.removeInProgress(r.Target.FileName)
		m.archives = append(m.archives, archiveRow{
			filename:      r.Target.FileName,
			difs:          r.DIFsUploaded,
			bytesUploaded: r.BytesUploaded,
			err:           r.Err,
		})
		m.fetchDone++

	case fetchDoneMsg:
		// fetch results have been drained; nothing to update.

	case janitorStartedMsg:
		m.janitorTotal = msg.total

	case deleteResultMsg:
		dr := msg.result
		m.deletes = append(m.deletes, deleteRow{
			vbac:        dr.Entry.VBAC(),
			filename:    dr.Entry.Filename,
			difsDeleted: dr.DIFsDeleted,
			err:         dr.Err,
		})
		m.janitorDone++

	case janitorDoneMsg:
		// delete results have been drained; nothing to update.

	case manifestSummaryMsg:
		m.manifest = msg.cat

	case doneMsg:
		m.done = true
		m.finalErr = msg.err
		return m, tea.Quit
	}

	return m, nil
}

// --- View ---

func (m model) View() string {
	if m.done {
		return m.finalView()
	}
	return m.liveView()
}

func (m model) liveView() string {
	var b strings.Builder
	b.WriteString("\n")

	for _, s := range m.stages {
		b.WriteString(m.stageView(s))
		b.WriteString("\n")
	}

	if m.fetchTotal > 0 {
		b.WriteString("\n")
		b.WriteString(fmt.Sprintf("  %s  %s\n",
			styleBold.Render("Fetching & processing symbols"),
			styleMuted.Render(fmt.Sprintf("%d done · %d remaining · %d%%",
				m.fetchDone, m.fetchTotal-m.fetchDone, m.pct())),
		))
		b.WriteString("\n")

		for _, row := range m.inProgress {
			b.WriteString(m.inProgressView(row))
			b.WriteString("\n")
		}
		for _, a := range m.archives {
			b.WriteString(m.archiveView(a))
			b.WriteString("\n")
		}
	}

	if m.janitorTotal > 0 {
		b.WriteString("\n")
		b.WriteString(fmt.Sprintf("  %s  %s\n",
			styleBold.Render("Removing out-of-target symbols"),
			styleMuted.Render(fmt.Sprintf("%d / %d", m.janitorDone, m.janitorTotal)),
		))
		b.WriteString("\n")
		for _, d := range m.deletes {
			b.WriteString(m.deleteView(d))
			b.WriteString("\n")
		}
	}

	return b.String()
}

func (m model) finalView() string {
	var b strings.Builder
	b.WriteString("\n")

	for _, s := range m.stages {
		b.WriteString(m.stageView(s))
		b.WriteString("\n")
	}

	if m.fetchTotal > 0 {
		b.WriteString("\n")
		for _, a := range m.archives {
			b.WriteString(m.archiveView(a))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	if m.finalErr != nil {
		// Avoid duplicating the error: if a stage already rendered ✗ above
		// (StageFailed was called), the user has already seen it. Only emit
		// the standalone error line for failures that aren't tied to a stage.
		if !m.hasFailedStage() {
			b.WriteString("  " + styleRed.Render("✗  "+m.finalErr.Error()) + "\n")
		}
	} else {
		totalDIFs, failed := 0, 0
		var totalBytes int64
		for _, a := range m.archives {
			if a.err != nil {
				failed++
			} else {
				totalDIFs += a.difs
				totalBytes += a.bytesUploaded
			}
		}
		var line string
		if m.fetchTotal > 0 {
			line = fmt.Sprintf("Done  ·  %d archive(s)  ·  %d DIFs  ·  %s",
				len(m.archives), totalDIFs, formatBytes(totalBytes))
		} else {
			line = "Done"
		}
		if failed > 0 {
			line += fmt.Sprintf("  ·  %d failed", failed)
		}
		if m.janitorTotal > 0 {
			line += fmt.Sprintf("  ·  %d removed", len(m.deletes))
		}
		b.WriteString("  " + styleGreen.Render("✓  "+line) + "\n")
	}

	if m.finalErr == nil && !m.manifest.IsEmpty() {
		b.WriteString("\n")
		b.WriteString(m.manifestView())
	}

	b.WriteString("\n")
	return b.String()
}

func (m model) manifestView() string {
	var b strings.Builder
	header := fmt.Sprintf("Manifest  ·  %d active archives  ·  %d added  ·  %d deleted in this run",
		m.manifest.ActiveCount(), len(m.manifest.Added), len(m.manifest.Deleted))
	b.WriteString("  " + styleBold.Render(header) + "\n\n")

	for _, e := range sortedEntries(m.manifest.Added, false) {
		b.WriteString("    " + styleGreen.Render(formatManifestRow(e, e.CompletedAt)) + "\n")
	}
	for _, e := range sortedEntries(m.manifest.Kept, false) {
		b.WriteString("    " + styleMuted.Render(formatManifestRow(e, e.CompletedAt)) + "\n")
	}
	for _, e := range sortedEntries(m.manifest.Deleted, true) {
		b.WriteString("    " + styleRed.Render(formatManifestRow(e, e.DeletedAt)) + "\n")
	}
	return b.String()
}

func (m model) stageView(s stageRow) string {
	var icon, detail string
	switch s.status {
	case stageRunning:
		icon = m.sp.View()
		if s.detail != "" {
			detail = styleMuted.Render(s.detail)
		} else {
			detail = styleMuted.Render("running…")
		}
	case stageDone:
		icon = styleGreen.Render("✓")
		detail = styleMuted.Render(s.detail)
	case stageFailed:
		icon = styleRed.Render("✗")
		if s.err != nil {
			detail = styleRed.Render(s.err.Error())
		}
	default:
		icon = styleMuted.Render("·")
		detail = ""
	}
	name := lipgloss.NewStyle().Width(stageNameWidth).Render(s.name)
	return fmt.Sprintf("  %s  %s  %s", icon, name, detail)
}

func (m model) inProgressView(row inProgressRow) string {
	var detail string
	switch row.phase {
	case "fetching":
		if row.bytesTotal > 0 {
			pct := int(row.bytesDone * 100 / row.bytesTotal)
			detail = fmt.Sprintf("fetching  %d%%  (%s / %s)",
				pct, formatBytes(row.bytesDone), formatBytes(row.bytesTotal))
		} else {
			detail = "fetching…"
		}
	case "processing":
		if row.difsUploaded > 0 {
			detail = fmt.Sprintf("processing  %d DIFs  %s",
				row.difsUploaded, formatBytes(row.bytesUploaded))
		} else {
			detail = "processing…"
		}
	default:
		detail = row.phase + "…"
	}
	return fmt.Sprintf("  %s  %-45s  %s", m.sp.View(), row.filename, styleMuted.Render(detail))
}

func (m model) archiveView(a archiveRow) string {
	if a.err != nil {
		return fmt.Sprintf("  %s  %s  %s", styleRed.Render("✗"), a.filename, styleRed.Render(a.err.Error()))
	}
	return fmt.Sprintf("  %s  %-45s  %s",
		styleGreen.Render("✓"),
		a.filename,
		styleMuted.Render(fmt.Sprintf("%d DIFs  %s", a.difs, formatBytes(a.bytesUploaded))),
	)
}

func (m model) deleteView(d deleteRow) string {
	if d.err != nil {
		return fmt.Sprintf("  %s  %s  %s", styleRed.Render("✗"), d.filename, styleRed.Render(d.err.Error()))
	}
	return fmt.Sprintf("  %s  %-45s  %s",
		styleRed.Render("−"),
		d.filename,
		styleMuted.Render(fmt.Sprintf("%d DIFs removed", d.difsDeleted)),
	)
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

// sortedEntries returns entries sorted descending by the relevant timestamp:
// CompletedAt for added/kept, DeletedAt for deleted.
func sortedEntries(entries []pipeline.ArchiveEntry, byDeletedAt bool) []pipeline.ArchiveEntry {
	out := make([]pipeline.ArchiveEntry, len(entries))
	copy(out, entries)
	sort.Slice(out, func(i, j int) bool {
		if byDeletedAt {
			return out[i].DeletedAt.After(out[j].DeletedAt)
		}
		return out[i].CompletedAt.After(out[j].CompletedAt)
	})
	return out
}

const manifestRowFmt = "%-8s  %-9s  %-7s  %3d DIFs  %s"

func formatManifestRow(e pipeline.ArchiveEntry, ts time.Time) string {
	return fmt.Sprintf(manifestRowFmt, e.Version, e.Build, e.Arch, e.DIFsUploaded, ts.UTC().Format(time.RFC3339))
}

// writeManifestSummary renders the manifest categories to w for non-TTY mode.
// Added rows: " + ", deleted rows: " - ", kept rows: "   ".
func writeManifestSummary(w io.Writer, c ManifestCategorized) {
	fmt.Fprintf(w, "\nmanifest: %d active archives, %d added, %d deleted in this run\n\n",
		c.ActiveCount(), len(c.Added), len(c.Deleted))

	for _, e := range sortedEntries(c.Added, false) {
		fmt.Fprintf(w, " + %s\n", formatManifestRow(e, e.CompletedAt))
	}
	for _, e := range sortedEntries(c.Kept, false) {
		fmt.Fprintf(w, "   %s\n", formatManifestRow(e, e.CompletedAt))
	}
	for _, e := range sortedEntries(c.Deleted, true) {
		fmt.Fprintf(w, " - %s\n", formatManifestRow(e, e.DeletedAt))
	}
	fmt.Fprintf(w, "\n(+ = added, - = deleted in this run)\n\n")
}
