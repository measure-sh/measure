package reporter

import (
	"io"
	"log/slog"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/x/term"

	"symboloader/symsync/pipeline"
)

// Reporter manages all user-facing output for the sync pipeline.
// In TTY mode it renders a bubbletea TUI; otherwise all output goes through slog.
type Reporter struct {
	out   io.Writer
	isTTY bool
	prog  *tea.Program
}

// New creates a Reporter that writes to out.
// Detects TTY automatically — bubbletea TUI for terminals, slog otherwise.
func New(out io.Writer) *Reporter {
	r := &Reporter{out: out}
	if f, ok := out.(*os.File); ok {
		r.isTTY = term.IsTerminal(f.Fd())
	}
	if r.isTTY {
		slog.SetDefault(slog.New(slog.NewTextHandler(io.Discard, nil)))
		r.prog = tea.NewProgram(newModel(), tea.WithOutput(out))
	}
	return r
}

// Run executes fn while the reporter lifecycle is active.
// For TTY: bubbletea runs in the foreground; fn runs in a goroutine.
// For non-TTY: fn runs directly.
func (r *Reporter) Run(fn func() error) error {
	if !r.isTTY {
		return fn()
	}
	var fnErr error
	go func() {
		fnErr = fn()
		r.prog.Send(doneMsg{err: fnErr})
	}()
	if _, err := r.prog.Run(); err != nil {
		return err
	}
	return fnErr
}

// StageStarted marks a pipeline stage as in progress.
func (r *Reporter) StageStarted(name string) {
	if r.isTTY {
		r.prog.Send(stageStartedMsg{name: name})
		return
	}
	slog.Info("stage started", "stage", name)
}

// StageFinished marks a pipeline stage as successfully completed.
func (r *Reporter) StageFinished(name, detail string) {
	if r.isTTY {
		r.prog.Send(stageFinishedMsg{name: name, detail: detail})
		return
	}
	slog.Info("stage finished", "stage", name, "detail", detail)
}

// StageFailed marks a pipeline stage as failed.
func (r *Reporter) StageFailed(name string, err error) {
	if r.isTTY {
		r.prog.Send(stageFailedMsg{name: name, err: err})
		return
	}
	slog.Error("stage failed", "stage", name, "error", err)
}

// DrainFetch reads all FetchResults from results and reports each one.
// Blocks until results is closed.
func (r *Reporter) DrainFetch(results <-chan pipeline.FetchResult) {
	if r.isTTY {
		for result := range results {
			r.prog.Send(fetchResultMsg{result: result})
		}
		r.prog.Send(fetchDoneMsg{})
		return
	}
	for range results {
	}
}

// DrainJanitor reads all DeleteResults from results and reports each one.
// Blocks until results is closed.
func (r *Reporter) DrainJanitor(results <-chan pipeline.DeleteResult) {
	if r.isTTY {
		for result := range results {
			r.prog.Send(deleteResultMsg{result: result})
		}
		r.prog.Send(janitorDoneMsg{})
		return
	}
	for range results {
	}
}

// FetchStartCallback returns a function the fetcher calls with the actual
// number of archives to process (after manifest filtering).
func (r *Reporter) FetchStartCallback() func(int) {
	if r.isTTY {
		return func(n int) { r.prog.Send(fetchStartedMsg{total: n}) }
	}
	return func(int) {}
}

// FetchProgressCallback returns a function the fetcher can call to report
// per-archive phase changes. Returns nil in non-TTY mode (slog in pipeline suffices).
func (r *Reporter) FetchProgressCallback() func(pipeline.FetchProgressUpdate) {
	if !r.isTTY {
		return nil
	}
	return func(u pipeline.FetchProgressUpdate) {
		r.prog.Send(fetchProgressMsg{update: u})
	}
}

// JanitorStartCallback returns a function the janitor calls with the actual
// number of archives to remove before any work begins.
func (r *Reporter) JanitorStartCallback() func(int) {
	if r.isTTY {
		return func(n int) { r.prog.Send(janitorStartedMsg{total: n}) }
	}
	return func(int) {}
}

// ManifestSummary renders the post-run state of the manifest with rows
// categorized as Added (this run), Kept (prior runs), or Deleted (this run).
func (r *Reporter) ManifestSummary(c ManifestCategorized) {
	if c.IsEmpty() {
		return
	}
	if r.isTTY {
		r.prog.Send(manifestSummaryMsg{cat: c})
		return
	}
	writeManifestSummary(r.out, c)
}
