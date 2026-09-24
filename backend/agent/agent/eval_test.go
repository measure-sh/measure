//go:build eval

package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"text/tabwriter"
	"time"

	"backend/libs/secret"

	"github.com/google/uuid"
)

// evalEnv holds what TestEvalAnswers and TestEvalCompaction share. Both call
// real models through OpenRouter and spend real tokens, so they only build
// with the eval tag; CONTRIBUTING.md describes how to run them.
type evalEnv struct {
	key           string
	models        []string
	trials        int
	evalCostProxy *evalCostProxy
	server        *httptest.Server
}

func newEvalEnv(t *testing.T, defaultModelVar string) *evalEnv {
	t.Helper()
	key, err := secret.FromEnvOrFile("LLM_AGENT_KEY")
	if err != nil || key == "" {
		t.Skip("LLM_AGENT_KEY is not set")
	}
	models := envList("EVAL_MODELS")
	if len(models) == 0 {
		models = envList(defaultModelVar)
	}
	if len(models) == 0 {
		t.Skipf("neither EVAL_MODELS nor %s is set", defaultModelVar)
	}
	trials := 1
	if v := os.Getenv("EVAL_TRIALS"); v != "" {
		if trials, err = strconv.Atoi(v); err != nil || trials < 1 {
			t.Fatalf("EVAL_TRIALS = %q, want a positive integer", v)
		}
	}
	evalCostProxy := &evalCostProxy{cost: map[string]float64{}}
	server := httptest.NewServer(evalCostProxy)
	t.Cleanup(server.Close)
	return &evalEnv{key: key, models: models, trials: trials, evalCostProxy: evalCostProxy, server: server}
}

// config sets the model on both tiers, since each eval exercises only one of
// them.
func (e *evalEnv) config(model string) *Config {
	temperature, seed := 0.0, 1
	sampling := &chatSampling{Temperature: &temperature, Seed: &seed}
	name, provider, pinned := strings.Cut(model, "@")
	if pinned {
		sampling.Provider = &chatProvider{Order: []string{provider}}
	}
	c := &Config{
		Deps:        deps,
		BaseURL:     e.server.URL,
		APIKey:      e.key,
		ModelSmall:  name,
		ModelMedium: name,
		sampling:    sampling,
	}
	c.initTools()
	return c
}

// collect runs the trials inside one group subtest, which returns only once
// every parallel trial in it has finished, so the caller sees all the
// results. Trials finish in any order, and the report lists them by trial.
func (e *evalEnv) collect(t *testing.T, run func(t *testing.T, record func(evalResult))) []evalResult {
	var (
		mu      sync.Mutex
		results []evalResult
	)
	t.Run("trials", func(t *testing.T) {
		run(t, func(res evalResult) {
			mu.Lock()
			results = append(results, res)
			mu.Unlock()
		})
	})
	slices.SortStableFunc(results, func(a, b evalResult) int { return a.trial - b.trial })
	return results
}

func (e *evalEnv) report(t *testing.T, kind string, started time.Time, surfaces []string, cases []evalCase, results []evalResult) {
	report := newEvalReport(kind, started, e.models, surfaces, e.trials, cases, results)
	report.print(os.Stdout)
	path, err := report.writeHTML("../evals/results")
	if err != nil {
		t.Errorf("write report: %v", err)
		return
	}
	fmt.Printf("\nreport: %s\n", path)
}

func gradeEvalRun(t *testing.T, model string, ec evalCase, surface string, trial int, r evalRun) evalResult {
	failures := ec.grade(r)
	for _, f := range failures {
		t.Error(f)
	}
	if len(failures) > 0 {
		t.Logf("answer: %s", r.answer)
	}
	return evalResult{model: model, ec: ec, surface: surface, trial: trial + 1, run: r, failures: failures}
}

// evalCase is one conversation: each question is asked in turn, in one
// conversation, and the checks grade the last answer and the tool calls made
// for it. mcpApps are the app ids an MCP caller would send with the question;
// when empty, the caller sends every app of the team.
type evalCase struct {
	id        string
	questions []string
	mcpApps   []uuid.UUID
	checks    []evalCheck
}

// The surfaces a case can run on. MCP runs send the case's mcpApps the way
// an MCP caller does. Slack runs are mentions in a thread, where the model
// picks the apps itself and is offered the chart tool.
const (
	evalSurfaceMCP   = "mcp"
	evalSurfaceSlack = "slack"
)

// surfaces returns the requested surfaces the case can run on. An MCP call
// starts a new conversation every time, so a case with follow-up questions
// runs on Slack only, where the thread's stored history is sent with each
// question.
func (ec evalCase) surfaces(requested []string) []string {
	if len(ec.questions) > 1 {
		return slices.DeleteFunc(slices.Clone(requested), func(s string) bool { return s == evalSurfaceMCP })
	}
	return requested
}

// evalCheck returns what is wrong with a run, or "" when the run passes.
type evalCheck func(r evalRun) string

// grade fails a run whose turn returned an error without running the checks,
// since they would only repeat that the answer is missing.
func (ec evalCase) grade(r evalRun) []string {
	if r.err != nil {
		return []string{"turn failed: " + r.err.Error()}
	}
	var failures []string
	for _, check := range ec.checks {
		if f := check(r); f != "" {
			failures = append(failures, f)
		}
	}
	return failures
}

// evalRun is one case as the model played it, read back from the stored
// conversation. answer, toolCalls, toolResults and llmCalls are for the last
// question; tokens, cost and duration add up every question in the case.
type evalRun struct {
	answer      string
	err         error
	toolCalls   []chatToolCall
	toolResults map[string]string
	llmCalls    int
	tokens      int
	cost        float64
	duration    time.Duration
}

type evalResult struct {
	model    string
	ec       evalCase
	surface  string
	trial    int
	run      evalRun
	failures []string
}

// evalCostProxy forwards the agent's chat calls to OpenRouter and adds up the
// cost OpenRouter reports in each response, per conversation. The agent sends
// the conversation id as each call's session_id.
type evalCostProxy struct {
	mu   sync.Mutex
	cost map[string]float64
}

func (p *evalCostProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var req struct {
		SessionID string `json:"session_id"`
	}
	json.Unmarshal(body, &req)

	out, err := http.NewRequestWithContext(r.Context(), r.Method, openRouterURL+r.URL.Path, bytes.NewReader(body))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Only these two headers are forwarded. Copying the agent's
	// Accept-Encoding would stop this client from decompressing the
	// response, and the agent would receive gzip bytes it cannot decode.
	out.Header.Set("Authorization", r.Header.Get("Authorization"))
	out.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	resp, err := http.DefaultClient.Do(out)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	var usage struct {
		Usage struct {
			Cost float64 `json:"cost"`
		} `json:"usage"`
	}
	if json.Unmarshal(respBody, &usage) == nil {
		p.mu.Lock()
		p.cost[req.SessionID] += usage.Usage.Cost
		p.mu.Unlock()
	}
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

func (p *evalCostProxy) conversationCost(conversationID string) float64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.cost[conversationID]
}

var uuidRe = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

func mentions(want ...string) evalCheck {
	return func(r evalRun) string {
		for _, s := range want {
			if !strings.Contains(strings.ToLower(r.answer), strings.ToLower(s)) {
				return fmt.Sprintf("answer does not mention %q", s)
			}
		}
		return ""
	}
}

// mentionsNumber checks that the answer states one of the numbers, written
// with or without thousands separators. More than one number is accepted
// where the question leaves a definition open, such as whether ANRs count as
// crashes.
func mentionsNumber(ns ...int) evalCheck {
	var res []*regexp.Regexp
	for _, n := range ns {
		res = append(res, regexp.MustCompile(`(^|[^\d.])`+strconv.Itoa(n)+`($|[^\d.]|\.\D|\.$)`))
	}
	return func(r evalRun) string {
		answer := strings.ReplaceAll(r.answer, ",", "")
		for _, re := range res {
			if re.MatchString(answer) {
				return ""
			}
		}
		if len(ns) == 1 {
			return fmt.Sprintf("answer does not state %d", ns[0])
		}
		return fmt.Sprintf("answer states none of %v", ns)
	}
}

func envList(name string) []string {
	var out []string
	for _, v := range strings.Split(os.Getenv(name), ",") {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

type evalReport struct {
	Kind     string
	Started  time.Time
	Trials   int
	Surfaces []string
	Models   []*evalModelStats
	Cases    []*evalCaseRow
}

type evalModelStats struct {
	Model     string
	Trials    int
	Passed    int
	Cases     int
	AllPassed int
	Cost      float64
	Tokens    int
	Duration  time.Duration
	BestValue bool
	MostRight bool
	// BySurface holds the model's trials split by surface, in the order of
	// evalReport.Surfaces.
	BySurface []*evalSurfaceStats
}

type evalSurfaceStats struct {
	Surface string
	Trials  int
	Passed  int
}

func (s *evalSurfaceStats) PassRate() float64 { return float64(s.Passed) / float64(s.Trials) }

func (m *evalModelStats) PassRate() float64 { return float64(m.Passed) / float64(m.Trials) }

// CostPerPass is the value measure: what the model spent for each trial it
// got right. A model that fails more often pays for its failed trials too.
func (m *evalModelStats) CostPerPass() float64 {
	if m.Passed == 0 {
		return math.Inf(1)
	}
	return m.Cost / float64(m.Passed)
}

func (m *evalModelStats) AvgDuration() time.Duration {
	return (m.Duration / time.Duration(m.Trials)).Round(100 * time.Millisecond)
}

type evalCaseRow struct {
	ID        string
	Surface   string
	Questions []string
	Cells     []*evalCell
}

// evalCell is one case on one surface and one model, with every trial.
type evalCell struct {
	Model   string
	Passed  int
	Trials  int
	Cost    float64
	Calls   int
	Elapsed time.Duration
	Runs    []evalResult
}

func (c *evalCell) Class() string {
	switch c.Passed {
	case c.Trials:
		return "pass"
	case 0:
		return "fail"
	}
	return "flaky"
}

func (c *evalCell) AvgCost() float64 { return c.Cost / float64(c.Trials) }
func (c *evalCell) AvgCalls() float64 {
	return float64(c.Calls) / float64(c.Trials)
}
func (c *evalCell) AvgDuration() time.Duration {
	return (c.Elapsed / time.Duration(c.Trials)).Round(100 * time.Millisecond)
}

// bestValueMargin is how far below the top pass rate a model may be and still
// be named best value, so that a cheap model which fails more often does not
// win on price alone.
const bestValueMargin = 0.05

func newEvalReport(kind string, started time.Time, models, surfaces []string, trials int, cases []evalCase, results []evalResult) *evalReport {
	r := &evalReport{Kind: kind, Started: started, Trials: trials, Surfaces: surfaces}
	byModel := map[string]*evalModelStats{}
	bySurface := map[string]*evalSurfaceStats{}
	for _, m := range models {
		s := &evalModelStats{Model: m}
		for _, surface := range surfaces {
			ss := &evalSurfaceStats{Surface: surface}
			bySurface[m+"\x00"+surface] = ss
			s.BySurface = append(s.BySurface, ss)
		}
		byModel[m] = s
		r.Models = append(r.Models, s)
	}
	cells := map[string]*evalCell{}
	for _, ec := range cases {
		for _, surface := range ec.surfaces(surfaces) {
			row := &evalCaseRow{ID: ec.id, Surface: surface, Questions: ec.questions}
			for _, m := range models {
				cell := &evalCell{Model: m}
				cells[m+"\x00"+ec.id+"\x00"+surface] = cell
				row.Cells = append(row.Cells, cell)
			}
			r.Cases = append(r.Cases, row)
		}
	}

	for _, res := range results {
		ss := bySurface[res.model+"\x00"+res.surface]
		ss.Trials++
		if len(res.failures) == 0 {
			ss.Passed++
		}

		cell := cells[res.model+"\x00"+res.ec.id+"\x00"+res.surface]
		cell.Trials++
		if len(res.failures) == 0 {
			cell.Passed++
		}
		cell.Cost += res.run.cost
		cell.Calls += res.run.llmCalls
		cell.Elapsed += res.run.duration
		cell.Runs = append(cell.Runs, res)

		s := byModel[res.model]
		s.Trials++
		if len(res.failures) == 0 {
			s.Passed++
		}
		s.Cost += res.run.cost
		s.Tokens += res.run.tokens
		s.Duration += res.run.duration
	}
	for _, row := range r.Cases {
		for _, cell := range row.Cells {
			if cell.Trials == 0 {
				continue
			}
			s := byModel[cell.Model]
			s.Cases++
			if cell.Passed == cell.Trials {
				s.AllPassed++
			}
		}
	}

	var top *evalModelStats
	for _, s := range r.Models {
		if s.Trials == 0 {
			continue
		}
		if top == nil || s.PassRate() > top.PassRate() ||
			(s.PassRate() == top.PassRate() && s.CostPerPass() < top.CostPerPass()) {
			top = s
		}
	}
	if top == nil || top.Passed == 0 {
		return r
	}
	top.MostRight = true
	var best *evalModelStats
	for _, s := range r.Models {
		if s.Trials == 0 || s.PassRate() < top.PassRate()-bestValueMargin {
			continue
		}
		if best == nil || s.CostPerPass() < best.CostPerPass() {
			best = s
		}
	}
	best.BestValue = true
	return r
}

func (r *evalReport) print(w io.Writer) {
	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "\nMODEL\tCASE\tSURFACE\tPASSED\tAVG LLM CALLS\tAVG COST\tAVG DURATION")
	for _, row := range r.Cases {
		for _, c := range row.Cells {
			if c.Trials == 0 {
				continue
			}
			fmt.Fprintf(tw, "%s\t%s\t%s\t%d/%d\t%.1f\t$%.4f\t%s\n", c.Model, row.ID, row.Surface, c.Passed, c.Trials,
				c.AvgCalls(), c.AvgCost(), c.AvgDuration())
		}
	}
	tw.Flush()

	tw = tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	header := "\nMODEL\tPASS RATE\tPASS^K\tTOTAL COST\tCOST PER PASS\tAVG DURATION\t"
	for _, surface := range r.Surfaces {
		header += strings.ToUpper(surface) + "\t"
	}
	fmt.Fprintln(tw, header)
	for _, s := range r.Models {
		if s.Trials == 0 {
			continue
		}
		perSurface := ""
		for _, ss := range s.BySurface {
			if ss.Trials > 0 {
				perSurface += fmt.Sprintf("%d/%d", ss.Passed, ss.Trials)
			}
			perSurface += "\t"
		}
		note := ""
		if s.MostRight {
			note += " most accurate"
		}
		if s.BestValue {
			note += " best value"
		}
		fmt.Fprintf(tw, "%s\t%d/%d (%.0f%%)\t%d/%d case runs\t$%.4f\t$%.4f\t%s\t%s%s\n", s.Model, s.Passed, s.Trials,
			100*s.PassRate(), s.AllPassed, s.Cases, s.Cost, s.CostPerPass(), s.AvgDuration(), perSurface, note)
	}
	tw.Flush()
}

var unsafeFileChars = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func (r *evalReport) writeHTML(dir string) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	names := make([]string, len(r.Models))
	for i, m := range r.Models {
		names[i] = unsafeFileChars.ReplaceAllString(m.Model, "-")
	}
	name := "eval-" + r.Kind + "-" + r.Started.Format("20060102-150405") + "-" + strings.Join(names, "_vs_")
	// Most file systems cap a name at 255 bytes, which a long list of models
	// can exceed.
	if len(name) > 200 {
		name = name[:200]
	}
	path, err := filepath.Abs(filepath.Join(dir, name+".html"))
	if err != nil {
		return "", err
	}
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	return path, evalReportTmpl.Execute(f, r)
}

var evalReportTmpl = template.Must(template.New("report").Funcs(template.FuncMap{
	"pct":   func(f float64) string { return fmt.Sprintf("%.0f%%", 100*f) },
	"usd":   func(f float64) string { return fmt.Sprintf("$%.4f", f) },
	"calls": func(f float64) string { return fmt.Sprintf("%.1f", f) },
}).Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Eval Report</title>
<style>
:root {
  --bg: #fafafa; --fg: #1a1a1a; --muted: #666; --line: #e2e2e2; --card: #fff;
  --pass: #1f7a3a; --pass-bg: #e3f4e8; --flaky: #8a5a00; --flaky-bg: #fdf1d8;
  --fail: #b3261e; --fail-bg: #fbe4e2; --badge: #1d4ed8; --badge-bg: #e0e9ff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #141414; --fg: #e8e8e8; --muted: #9a9a9a; --line: #2e2e2e; --card: #1c1c1c;
    --pass: #6fd08c; --pass-bg: #173222; --flaky: #f0c060; --flaky-bg: #362a10;
    --fail: #f28b82; --fail-bg: #3b1a18; --badge: #9db7ff; --badge-bg: #1c2744;
  }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 64px; background: var(--bg); color: var(--fg);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
main { max-width: 1100px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 32px 0 8px; }
.meta, .note { color: var(--muted); }
.scroll { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-weight: 600; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.badge { display: inline-block; margin: 0 4px 2px 0; padding: 1px 8px; border-radius: 10px;
  font-size: 12px; color: var(--badge); background: var(--badge-bg); white-space: nowrap; }
.cell { border-radius: 6px; padding: 4px 8px; white-space: nowrap; }
.cell b { font-size: 15px; }
.cell small { display: block; opacity: .8; }
.pass { color: var(--pass); background: var(--pass-bg); }
.flaky { color: var(--flaky); background: var(--flaky-bg); }
.fail { color: var(--fail); background: var(--fail-bg); }
.q { color: var(--muted); font-size: 13px; }
details { background: var(--card); border: 1px solid var(--line); border-radius: 8px; margin: 8px 0; }
summary { cursor: pointer; padding: 8px 12px; }
.run { border-top: 1px solid var(--line); padding: 8px 12px; }
.answer { white-space: pre-wrap; background: var(--bg); border-radius: 6px; padding: 8px; margin: 6px 0; }
.failures { color: var(--fail); margin: 4px 0; padding-left: 20px; }
code { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
</style>
</head>
<body>
<main>
<h1>Agent {{.Kind}} eval report</h1>
<p class="meta">{{.Started.Format "2006-01-02 15:04 MST"}} · {{len .Cases}} case runs on {{range $i, $s := .Surfaces}}{{if $i}} and {{end}}{{$s}}{{end}} · {{.Trials}} trial(s) each</p>

<h2>Models</h2>
<div class="scroll"><table>
<tr><th>Model</th><th>Pass rate</th>{{range .Surfaces}}<th>{{.}}</th>{{end}}<th>Pass^k</th><th>Total cost</th><th>Cost per pass</th><th>Avg duration</th><th>Tokens</th></tr>
{{range .Models}}{{if .Trials}}<tr>
<td>{{.Model}}<br>{{if .MostRight}}<span class="badge">most accurate</span>{{end}}{{if .BestValue}}<span class="badge">best value</span>{{end}}</td>
<td class="num">{{.Passed}}/{{.Trials}} ({{pct .PassRate}})</td>
{{range .BySurface}}<td class="num">{{if .Trials}}{{.Passed}}/{{.Trials}} ({{pct .PassRate}}){{end}}</td>{{end}}
<td class="num">{{.AllPassed}}/{{.Cases}} cases</td>
<td class="num">{{usd .Cost}}</td>
<td class="num">{{usd .CostPerPass}}</td>
<td class="num">{{.AvgDuration}}</td>
<td class="num">{{.Tokens}}</td>
</tr>{{end}}{{end}}
</table></div>
<p class="note">Pass^k counts the case runs that passed every trial. Cost per pass is the total cost divided by the passed trials. Best value is the lowest cost per pass among models within 5 points of the top pass rate. Costs are what OpenRouter reported for each call.</p>

<h2>Cases</h2>
<div class="scroll"><table>
<tr><th>Case</th>{{range .Models}}<th>{{.Model}}</th>{{end}}</tr>
{{range .Cases}}<tr>
<td><b>{{.ID}}</b> <span class="badge">{{.Surface}}</span>{{range .Questions}}<div class="q">{{.}}</div>{{end}}</td>
{{range .Cells}}<td>{{if .Trials}}<div class="cell {{.Class}}"><b>{{.Passed}}/{{.Trials}}</b><small>{{usd .AvgCost}} · {{calls .AvgCalls}} calls · {{.AvgDuration}}</small></div>{{end}}</td>{{end}}
</tr>{{end}}
</table></div>

<h2>Runs</h2>
{{range .Cases}}{{$id := .ID}}{{$surface := .Surface}}{{range .Cells}}{{if .Trials}}
<details{{if ne .Class "pass"}} open{{end}}>
<summary><b>{{$id}}</b> · {{$surface}} · {{.Model}} · <span class="cell {{.Class}}">{{.Passed}}/{{.Trials}}</span></summary>
{{range .Runs}}<div class="run">
<div>Trial {{.Trial}} · {{.Run.LLMCalls}} llm calls · {{usd .Run.Cost}} · {{.Run.Duration}}</div>
{{if .Failures}}<ul class="failures">{{range .Failures}}<li>{{.}}</li>{{end}}</ul>{{end}}
<div class="answer">{{.Run.Answer}}</div>
{{range .Run.ToolCalls}}<div><code>{{.Function.Name}} {{.Function.Arguments}}</code></div>{{end}}
</div>{{end}}
</details>
{{end}}{{end}}{{end}}
</main>
</body>
</html>
`))

// Templates read exported names only, so the report reaches the results'
// fields through these methods.
func (r evalResult) Trial() int             { return r.trial }
func (r evalResult) Failures() []string     { return r.failures }
func (r evalResult) Run() evalRun           { return r.run }
func (r evalRun) Answer() string            { return r.answer }
func (r evalRun) LLMCalls() int             { return r.llmCalls }
func (r evalRun) Cost() float64             { return r.cost }
func (r evalRun) Duration() time.Duration   { return r.duration.Round(100 * time.Millisecond) }
func (r evalRun) ToolCalls() []chatToolCall { return r.toolCalls }
