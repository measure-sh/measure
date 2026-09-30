//go:build eval

package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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
	"unicode"

	"backend/libs/secret"

	"github.com/google/uuid"
)

// The evals call real models through OpenRouter and spend real tokens, so
// they only build with the eval tag.
type evalEnv struct {
	apiKey          string
	models          []string
	trials          int
	evalCostProxy   *evalCostProxy
	server          *httptest.Server
	evalJudge       *evalJudge
	calibrationCost float64
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
	if value := os.Getenv("EVAL_TRIALS"); value != "" {
		if trials, err = strconv.Atoi(value); err != nil || trials < 1 {
			t.Fatalf("EVAL_TRIALS = %q, want a positive integer", value)
		}
	}
	judgeModel := strings.TrimSpace(os.Getenv("EVAL_JUDGE_MODEL"))
	if judgeModel == "" {
		t.Fatal("EVAL_JUDGE_MODEL is not set")
	}
	evalCostProxy := &evalCostProxy{cost: map[string]float64{}}
	server := httptest.NewServer(evalCostProxy)
	t.Cleanup(server.Close)
	evalEnv := &evalEnv{apiKey: key, models: models, trials: trials, evalCostProxy: evalCostProxy, server: server}
	evalEnv.evalJudge = &evalJudge{model: judgeModel, config: evalEnv.config(judgeModel), evalCostProxy: evalCostProxy}
	return evalEnv
}

// Both model tiers get the model, since each eval exercises only one of them.
func (e *evalEnv) config(model string) *Config {
	temperature, seed := 0.0, 1
	sampling := &chatSampling{Temperature: &temperature, Seed: &seed}
	name, provider, pinned := strings.Cut(model, "@")
	if pinned {
		sampling.Provider = &chatProvider{Order: []string{provider}}
	}
	config := &Config{
		Deps:        deps,
		BaseURL:     e.server.URL,
		APIKey:      e.apiKey,
		ModelSmall:  name,
		ModelMedium: name,
		sampling:    sampling,
	}
	config.initTools()
	return config
}

// collect runs the trials inside one group subtest, which returns only once
// every parallel trial in it has finished. Trials finish in any order, so the
// results are sorted by trial.
func (e *evalEnv) collect(t *testing.T, run func(t *testing.T, record func(evalResult))) []evalResult {
	var (
		mu      sync.Mutex
		results []evalResult
	)
	t.Run("trials", func(t *testing.T) {
		run(t, func(evalResult evalResult) {
			mu.Lock()
			results = append(results, evalResult)
			mu.Unlock()
		})
	})
	slices.SortStableFunc(results, func(a, b evalResult) int { return a.trial - b.trial })
	return results
}

func (e *evalEnv) report(t *testing.T, kind string, started time.Time, surfaces []string, cases []evalCase, results []evalResult) {
	report := newEvalReport(kind, started, e.models, e.evalJudge.model, surfaces, e.trials, cases, results)
	report.JudgeCost += e.calibrationCost
	report.print(os.Stdout)
	path, err := report.writeHTML("../evals/results")
	if err != nil {
		t.Errorf("write report: %v", err)
		return
	}
	fmt.Printf("\nreport: %s\n", path)
}

func (e *evalEnv) gradeEvalRun(ctx context.Context, t *testing.T, model string, evalCase evalCase, surface string, trial int, evalRun evalRun) evalResult {
	failures, ungraded, judgeCost := evalCase.grade(ctx, e.evalJudge, evalRun)
	for _, failure := range failures {
		t.Error(failure)
	}
	for _, reason := range ungraded {
		t.Error("ungraded: " + reason)
	}
	if len(failures) > 0 || len(ungraded) > 0 {
		t.Logf("answer: %s", evalRun.answer)
	}
	return evalResult{model: model, evalCase: evalCase, surface: surface, trial: trial + 1, run: evalRun,
		failures: failures, ungraded: ungraded, judgeCost: judgeCost}
}

// evalCase is one conversation whose last answer, and the tool calls behind
// it, are graded. An empty mcpApps sends every app of the team, as an MCP
// caller does. checks cover what code decides without error, and the judge
// grades the claims.
type evalCase struct {
	id        string
	questions []string
	mcpApps   []uuid.UUID
	checks    []evalCheck
	claims    []evalClaim
	// textDescription tells the judge what the graded text is; when empty, the
	// text is an answer to the questions.
	textDescription string
	numberClaims    func(answer string) []evalClaim
	// fixtures are texts with a known outcome, which the judge must grade
	// correctly before any model is graded.
	fixtures []judgeFixture
}

func (ec evalCase) describeText() string {
	if ec.textDescription != "" {
		return ec.textDescription
	}
	var prompt strings.Builder
	prompt.WriteString("The text is an assistant's answer to the last of these questions from a user, asked in order in one conversation:\n")
	for i, question := range ec.questions {
		fmt.Fprintf(&prompt, "%d. %s\n", i+1, question)
	}
	return prompt.String()
}

func (ec evalCase) claimsFor(answer string) []evalClaim {
	claims := slices.Clone(ec.claims)
	if ec.numberClaims != nil {
		claims = append(claims, ec.numberClaims(answer)...)
	}
	return claims
}

// On Slack the model picks the apps itself and is offered the chart tool.
const (
	evalSurfaceMCP   = "mcp"
	evalSurfaceSlack = "slack"
)

// An MCP call starts a new conversation every time, so a case with follow-up
// questions runs on Slack only, where the thread's history is kept.
func (ec evalCase) surfaces(requested []string) []string {
	if len(ec.questions) > 1 {
		return slices.DeleteFunc(slices.Clone(requested), func(s string) bool { return s == evalSurfaceMCP })
	}
	return requested
}

// evalCheck returns what is wrong with a run, or "" when the run passes.
type evalCheck func(evalRun evalRun) string

// The checks are skipped for a turn that returned an error, since they would
// only repeat that the answer is missing, and the judge is skipped once a
// check has failed the run.
func (ec evalCase) grade(ctx context.Context, evalJudge *evalJudge, evalRun evalRun) (failures, ungraded []string, judgeCost float64) {
	if evalRun.err != nil {
		return []string{"turn failed: " + evalRun.err.Error()}, nil, 0
	}
	for _, check := range ec.checks {
		if failure := check(evalRun); failure != "" {
			failures = append(failures, failure)
		}
	}
	claims := ec.claimsFor(evalRun.answer)
	if len(failures) > 0 || len(claims) == 0 {
		return failures, nil, 0
	}
	return evalJudge.grade(ctx, ec.describeText(), evalRun.answer, claims)
}

// answer, toolCalls, toolResults and llmCalls are for the last question;
// tokens, cost and duration add up every question in the case.
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

// A run with ungraded reasons and no failures could not be graded, because a
// judge's verdict could not be checked against the answer. It counts as not
// passed, so ungraded runs can never raise a model's pass rate.
type evalResult struct {
	model     string
	evalCase  evalCase
	surface   string
	trial     int
	run       evalRun
	failures  []string
	ungraded  []string
	judgeCost float64
}

func (r evalResult) passed() bool     { return len(r.failures) == 0 && len(r.ungraded) == 0 }
func (r evalResult) isUngraded() bool { return len(r.failures) == 0 && len(r.ungraded) > 0 }

// evalCostProxy forwards the agent's chat calls to OpenRouter and adds up the
// cost OpenRouter reports for each, per session_id, which the agent sets to
// the conversation id.
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

	forwarded, err := http.NewRequestWithContext(r.Context(), r.Method, openRouterURL+r.URL.Path, bytes.NewReader(body))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Only these two headers are forwarded. Copying the agent's
	// Accept-Encoding would stop this client from decompressing the
	// response, and the agent would receive gzip bytes it cannot decode.
	forwarded.Header.Set("Authorization", r.Header.Get("Authorization"))
	forwarded.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	resp, err := http.DefaultClient.Do(forwarded)
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

// exceptionClass is an exception type without its package, the way an answer
// usually names it.
func exceptionClass(errType string) string { return errType[strings.LastIndex(errType, ".")+1:] }

func fileStem(fileName string) string {
	stem, _, _ := strings.Cut(fileName, ".")
	return stem
}

var uuidPattern = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

// evalClaim is a statement about what a graded text says, which the judge
// finds stated, contradicted or absent. anchors are text that every correct
// wording of the claim contains, such as a count or a version, and the
// passage the judge quotes for a stated claim must contain all of them.
type evalClaim struct {
	claim     string
	forbidden bool
	anchors   []evalAnchor
}

func states(claim string, anchors ...evalAnchor) evalClaim {
	return evalClaim{claim: claim, anchors: anchors}
}

func forbids(claim string, anchors ...evalAnchor) evalClaim {
	return evalClaim{claim: claim, forbidden: true, anchors: anchors}
}

type evalAnchor struct {
	description string
	match       func(text string) bool
	// numbers lets the answers eval check its expected counts against the
	// rest of its seeded data.
	numbers []int
}

var thousandsSeparatorPattern = regexp.MustCompile(`(\d),(\d{3})\b`)

func withoutThousandsSeparators(text string) string {
	for {
		next := thousandsSeparatorPattern.ReplaceAllString(text, "${1}${2}")
		if next == text {
			return text
		}
		text = next
	}
}

// numberAnchor matches a number written as a whole number, with or without
// thousands separators, but not inside a decimal, a date, a time, a range or
// a number scaled by k, M or B, which would be a different figure. Several
// numbers are accepted where the question leaves a definition open, such as
// whether ANRs count as crashes.
func numberAnchor(numbers ...int) evalAnchor {
	var patterns []*regexp.Regexp
	var written []string
	for _, number := range numbers {
		digits := strconv.Itoa(number)
		written = append(written, digits)
		patterns = append(patterns, regexp.MustCompile(`(^|[^\d.:/–—-])`+digits+`($|[^\d.:/–—kKmMbB-]|[mM][sS]|\.\D|\.$)`))
	}
	return evalAnchor{
		description: strings.Join(written, " or "),
		match: func(text string) bool {
			text = withoutThousandsSeparators(text)
			for _, pattern := range patterns {
				if pattern.MatchString(text) {
					return true
				}
			}
			return false
		},
		numbers: numbers,
	}
}

// nameAnchor matches a whole word, so it also matches inside
// java.lang.NullPointerException or CheckoutActivity.kt.
func nameAnchor(name string) evalAnchor {
	pattern := regexp.MustCompile(`(?i)(^|\W)` + regexp.QuoteMeta(name) + `($|\W)`)
	return evalAnchor{description: name, match: pattern.MatchString}
}

// versionAnchor matches a version, with or without a "v" prefix, but not
// inside a longer version: 2.3.1 does not match 12.3.1 or 2.3.10.
func versionAnchor(version string) evalAnchor {
	pattern := regexp.MustCompile(`(?i)(^|[^\w.])v?` + regexp.QuoteMeta(version) + `($|[^\w.]|\.(\W|$))`)
	return evalAnchor{description: version, match: pattern.MatchString}
}

var percentPattern = regexp.MustCompile(`(\d+(?:\.\d+)?)\s*(%|percent)`)

// percentAnchor matches a percentage within tolerance of want, so any
// sensible rounding matches.
func percentAnchor(want, tolerance float64) evalAnchor {
	return evalAnchor{
		description: fmt.Sprintf("%g%% ± %g", want, tolerance),
		match: func(text string) bool {
			for _, submatch := range percentPattern.FindAllStringSubmatch(text, -1) {
				if v, err := strconv.ParseFloat(submatch[1], 64); err == nil && math.Abs(v-want) <= tolerance {
					return true
				}
			}
			return false
		},
	}
}

// dateAnchor matches the day in the forms answers write it in. Word
// boundaries keep "Sep 2" from matching inside "Sep 27".
func dateAnchor(day time.Time) evalAnchor {
	months := []string{day.Format("Jan"), day.Format("January")}
	if day.Month() == time.September {
		months = append(months, "Sept")
	}
	month := "(" + strings.Join(months, "|") + `)\.?`
	dayPattern := "0?" + strconv.Itoa(day.Day()) + "(st|nd|rd|th)?"
	monthNumber, dayNumber := "0?"+strconv.Itoa(int(day.Month())), "0?"+strconv.Itoa(day.Day())
	pattern := regexp.MustCompile(`(?i)\b(` + day.Format("2006-01-02") + `(T[\d:.]+(Z|[+-]\d\d:?\d\d)?)?` + "|" + month + " " + dayPattern + "|" + dayPattern + " (of )?" + month +
		"|" + monthNumber + "/" + dayNumber + `(/\d{2,4})?` + "|" + dayNumber + "/" + monthNumber + `(/\d{2,4})?` + `)\b`)
	return evalAnchor{description: day.Format("Jan 2"), match: pattern.MatchString}
}

func (cl evalClaim) missingAnchor(text string) (string, bool) {
	for _, evalAnchor := range cl.anchors {
		if !evalAnchor.match(text) {
			return evalAnchor.description, true
		}
	}
	return "", false
}

// evalJudge's verdicts are checked against the graded text, and one that
// does not hold up leaves the run ungraded. A claim without anchors, such as
// that a question is still open, rests on the judge's reading alone, which is
// why the cases' fixtures cover those claims.
type evalJudge struct {
	model         string
	config        *Config
	evalCostProxy *evalCostProxy
}

const judgePrompt = `You check a text against a numbered list of claims about what the text says. For each claim, decide one verdict:
- "stated": the text says what the claim describes. The wording may differ, but a number counts only when the text gives the same number as the claim, unless the claim allows a rounding.
- "contradicted": the text says something that cannot be true at the same time as the claim.
- "absent": the text neither states nor contradicts the claim.
Grade only what the text says. Do not judge whether the text is true, and do not use outside knowledge.
For "stated" and "contradicted", the quote is one unbroken passage of the text, copied character for character, that contains every part of the claim the verdict rests on, including each number and name the claim gives, even when they are in different sentences or on different lines. For "absent", the quote is empty.
Reply with only a JSON object and no other text, with one entry for every claim:
{"verdicts":[{"id":"c1","verdict":"stated","quote":"..."}]}`

type judgeVerdict struct {
	ID      string `json:"id"`
	Verdict string `json:"verdict"`
	Quote   string `json:"quote"`
}

func (j *evalJudge) grade(ctx context.Context, textDescription, text string, claims []evalClaim) (failures, ungraded []string, cost float64) {
	var prompt strings.Builder
	fmt.Fprintf(&prompt, "%s\n\nText to grade:\n<<<\n%s\n>>>\n\nClaims:\n", textDescription, text)
	for i, evalClaim := range claims {
		fmt.Fprintf(&prompt, "c%d: %s\n", i+1, evalClaim.claim)
	}
	// Each call is filed under its own id, so the cost proxy keeps the
	// judge's spend apart from the conversation being graded.
	sessionID := "judge-" + uuid.NewString()
	messages := []chatMessage{
		{Role: "system", Content: judgePrompt},
		{Role: "user", Content: prompt.String()},
	}
	// Trials run in parallel, so the provider can rate limit the judge; a
	// run is only left ungraded after the retries run out.
	resp, err := j.config.chat(withConversationID(ctx, sessionID), j.config.ModelSmall, messages, nil, "")
	for attempt := 1; attempt <= 4 && errors.Is(err, errLLMRateLimited); attempt++ {
		time.Sleep(time.Duration(attempt*attempt) * 5 * time.Second)
		resp, err = j.config.chat(withConversationID(ctx, sessionID), j.config.ModelSmall, messages, nil, "")
	}
	cost = j.evalCostProxy.conversationCost(sessionID)
	if err != nil {
		return nil, []string{"judge call failed: " + err.Error()}, cost
	}
	reply := resp.Choices[0].Message.Content
	verdicts, err := parseVerdicts(reply)
	if err != nil {
		return nil, []string{fmt.Sprintf("judge reply is not valid JSON (%v): %q", err, reply)}, cost
	}
	for i, evalClaim := range claims {
		judgeVerdict, found := verdicts[fmt.Sprintf("c%d", i+1)]
		failure, reason := evalClaim.outcome(judgeVerdict, found, text)
		if failure != "" {
			failures = append(failures, failure)
		}
		if reason != "" {
			ungraded = append(ungraded, reason)
		}
	}
	return failures, ungraded, cost
}

// parseVerdicts reads the JSON object out of the judge's reply, which some
// models wrap in a code fence.
func parseVerdicts(reply string) (map[string]judgeVerdict, error) {
	start, end := strings.Index(reply, "{"), strings.LastIndex(reply, "}")
	if start < 0 || end < start {
		return nil, fmt.Errorf("no JSON object")
	}
	var parsed struct {
		Verdicts []judgeVerdict `json:"verdicts"`
	}
	if err := json.Unmarshal([]byte(reply[start:end+1]), &parsed); err != nil {
		return nil, err
	}
	verdicts := map[string]judgeVerdict{}
	for _, judgeVerdict := range parsed.Verdicts {
		if _, dup := verdicts[judgeVerdict.ID]; !dup {
			verdicts[judgeVerdict.ID] = judgeVerdict
		}
	}
	return verdicts, nil
}

// normalizeQuote keeps only the letters and digits, in order and in lower
// case, since a judge copying a passage may drop markdown, table borders,
// punctuation or spacing that are in the text.
func normalizeQuote(text string) string {
	return strings.Join(strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	}), " ")
}

// An absent verdict on a required claim is trusted only when the text lacks
// one of the claim's anchors, or the claim has none, since otherwise the
// judge may have missed a claim the text makes.
func (cl evalClaim) outcome(judgeVerdict judgeVerdict, found bool, text string) (failure, ungraded string) {
	if !found {
		return "", "judge gave no verdict on: " + cl.claim
	}
	switch judgeVerdict.Verdict {
	case "stated", "contradicted", "absent":
	default:
		return "", fmt.Sprintf("judge gave verdict %q on: %s", judgeVerdict.Verdict, cl.claim)
	}
	// A forbidden claim that is not stated passes whatever the quote says.
	if cl.forbidden && judgeVerdict.Verdict != "stated" {
		return "", ""
	}
	if judgeVerdict.Verdict != "absent" && (normalizeQuote(judgeVerdict.Quote) == "" || !strings.Contains(normalizeQuote(text), normalizeQuote(judgeVerdict.Quote))) {
		return "", fmt.Sprintf("judge's quote for %q is not in the text: %q", cl.claim, judgeVerdict.Quote)
	}

	switch {
	case judgeVerdict.Verdict == "stated":
		// A judge often quotes the sentence with the figure and leaves out a
		// name given earlier in its paragraph, such as in a heading. Checking
		// the anchors against the paragraph as written also keeps a quote cut
		// from a longer number, "158 crashes" from "1,158 crashes", from
		// supplying the number.
		if description, missing := cl.missingAnchor(quoteParagraph(text, judgeVerdict.Quote)); missing {
			return "", fmt.Sprintf("judge's quote for %q lacks %s, as does its paragraph: %q", cl.claim, description, judgeVerdict.Quote)
		}
		if description, missing := cl.missingAnchor(text); missing {
			return "", fmt.Sprintf("judge found %q stated, but the text lacks %s", cl.claim, description)
		}
		if cl.forbidden {
			return fmt.Sprintf("forbidden: %s (%q)", cl.claim, judgeVerdict.Quote), ""
		}
		return "", ""
	case judgeVerdict.Verdict == "contradicted":
		return fmt.Sprintf("contradicted: %s (%q)", cl.claim, judgeVerdict.Quote), ""
	}
	if len(cl.anchors) > 0 {
		if _, missing := cl.missingAnchor(text); !missing {
			return "", "judge found this absent, but the text contains every anchor: " + cl.claim
		}
	}
	return "absent: " + cl.claim, ""
}

// quoteParagraph falls back to the quote itself when it spans paragraphs.
func quoteParagraph(text, quote string) string {
	for _, paragraph := range strings.Split(text, "\n\n") {
		if strings.Contains(normalizeQuote(paragraph), normalizeQuote(quote)) {
			return paragraph
		}
	}
	return quote
}

// failsOn is the claim the text breaks; a fixture without one must pass.
type judgeFixture struct {
	name    string
	text    string
	failsOn evalClaim
}

func failedOn(failures []string, cl evalClaim) bool {
	return slices.ContainsFunc(failures, func(f string) bool {
		return f == "absent: "+cl.claim || strings.HasPrefix(f, "contradicted: "+cl.claim+" (") ||
			strings.HasPrefix(f, "forbidden: "+cl.claim+" (")
	})
}

// calibrateJudge stops the test when the judge grades a fixture wrongly,
// since its verdicts on the models would then be unreliable too. A failing
// fixture must fail on the claim it breaks, so a judge that fails it for
// another reason does not count as right.
func (e *evalEnv) calibrateJudge(ctx context.Context, t *testing.T, cases []evalCase) {
	t.Helper()
	var (
		wg         sync.WaitGroup
		mu         sync.Mutex
		mismatches []string
		fixtures   int
		cost       float64
	)
	for _, evalCase := range cases {
		for _, judgeFixture := range evalCase.fixtures {
			fixtures++
			wg.Go(func() {
				failures, ungraded, callCost := e.evalJudge.grade(ctx, evalCase.describeText(), judgeFixture.text, evalCase.claimsFor(judgeFixture.text))
				mu.Lock()
				defer mu.Unlock()
				cost += callCost
				want := "pass"
				right := len(failures) == 0 && len(ungraded) == 0
				if judgeFixture.failsOn.claim != "" {
					want, right = "a failure on: "+judgeFixture.failsOn.claim, failedOn(failures, judgeFixture.failsOn)
				}
				if !right {
					mismatches = append(mismatches, fmt.Sprintf("%s / %s: want %s, got failures %q, ungraded %q", evalCase.id, judgeFixture.name, want, failures, ungraded))
				}
			})
		}
	}
	wg.Wait()
	e.calibrationCost = cost
	fmt.Printf("judge calibration: %d fixtures, $%.4f\n", fixtures, cost)
	if len(mismatches) > 0 {
		t.Fatalf("the judge misgraded %d of %d fixtures:\n%s", len(mismatches), fixtures, strings.Join(mismatches, "\n"))
	}
}

func envList(name string) []string {
	var values []string
	for _, value := range strings.Split(os.Getenv(name), ",") {
		if value = strings.TrimSpace(value); value != "" {
			values = append(values, value)
		}
	}
	return values
}

type evalReport struct {
	Kind       string
	Started    time.Time
	Trials     int
	Surfaces   []string
	ModelNames []string
	JudgeModel string
	Models     []*evalModelStats
	Cases      []*evalCaseRow
	JudgeCost  float64
}

// evalModelStats, evalSurfaceStats and evalCell count every run in Trials
// and the ungraded runs among them in Ungraded.
type evalModelStats struct {
	Model             string
	Trials            int
	Ungraded          int
	Passed            int
	CaseRuns          int
	CaseRunsAllPassed int
	Cost              float64
	Tokens            int
	Duration          time.Duration
	BestValue         bool
	MostAccurate      bool
	// BySurface holds the model's trials split by surface, in the order of
	// evalReport.Surfaces.
	BySurface []*evalSurfaceStats
}

type evalSurfaceStats struct {
	Surface  string
	Trials   int
	Ungraded int
	Passed   int
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

type evalCell struct {
	Model    string
	Passed   int
	Trials   int
	Ungraded int
	Cost     float64
	LLMCalls int
	Duration time.Duration
	Runs     []evalResult
}

func (c *evalCell) Outcome() string {
	if c.Passed == 0 && c.Ungraded == c.Trials {
		return "ungraded"
	}
	switch c.Passed {
	case c.Trials:
		return "pass"
	case 0:
		return "fail"
	}
	return "flaky"
}

func (c *evalCell) AvgCost() float64 { return c.Cost / float64(c.Trials) }
func (c *evalCell) AvgLLMCalls() float64 {
	return float64(c.LLMCalls) / float64(c.Trials)
}
func (c *evalCell) AvgDuration() time.Duration {
	return (c.Duration / time.Duration(c.Trials)).Round(100 * time.Millisecond)
}

// bestValueMargin is how far below the top pass rate a model may be and still
// be named best value, so that a cheap model which fails more often does not
// win on price alone.
const bestValueMargin = 0.05

func newEvalReport(kind string, started time.Time, models []string, judgeModel string, surfaces []string, trials int, cases []evalCase, results []evalResult) *evalReport {
	evalReport := &evalReport{Kind: kind, Started: started, Trials: trials, Surfaces: surfaces, ModelNames: models, JudgeModel: judgeModel}
	byModel := map[string]*evalModelStats{}
	bySurface := map[string]*evalSurfaceStats{}
	for _, model := range models {
		evalModelStats := &evalModelStats{Model: model}
		for _, surface := range surfaces {
			evalSurfaceStats := &evalSurfaceStats{Surface: surface}
			bySurface[model+"\x00"+surface] = evalSurfaceStats
			evalModelStats.BySurface = append(evalModelStats.BySurface, evalSurfaceStats)
		}
		byModel[model] = evalModelStats
		evalReport.Models = append(evalReport.Models, evalModelStats)
	}
	cells := map[string]*evalCell{}
	for _, evalCase := range cases {
		for _, surface := range evalCase.surfaces(surfaces) {
			row := &evalCaseRow{ID: evalCase.id, Surface: surface, Questions: evalCase.questions}
			for _, model := range models {
				cell := &evalCell{Model: model}
				cells[model+"\x00"+evalCase.id+"\x00"+surface] = cell
				row.Cells = append(row.Cells, cell)
			}
			evalReport.Cases = append(evalReport.Cases, row)
		}
	}

	for _, evalResult := range results {
		evalReport.JudgeCost += evalResult.judgeCost
		evalSurfaceStats := bySurface[evalResult.model+"\x00"+evalResult.surface]
		cell := cells[evalResult.model+"\x00"+evalResult.evalCase.id+"\x00"+evalResult.surface]
		cell.Runs = append(cell.Runs, evalResult)
		evalModelStats := byModel[evalResult.model]
		if evalResult.isUngraded() {
			evalSurfaceStats.Ungraded++
			cell.Ungraded++
			evalModelStats.Ungraded++
		}

		evalSurfaceStats.Trials++
		if evalResult.passed() {
			evalSurfaceStats.Passed++
		}

		cell.Trials++
		if evalResult.passed() {
			cell.Passed++
		}
		cell.Cost += evalResult.run.cost
		cell.LLMCalls += evalResult.run.llmCalls
		cell.Duration += evalResult.run.duration

		evalModelStats.Trials++
		if evalResult.passed() {
			evalModelStats.Passed++
		}
		evalModelStats.Cost += evalResult.run.cost
		evalModelStats.Tokens += evalResult.run.tokens
		evalModelStats.Duration += evalResult.run.duration
	}
	for _, row := range evalReport.Cases {
		for _, cell := range row.Cells {
			if cell.Trials == 0 {
				continue
			}
			evalModelStats := byModel[cell.Model]
			evalModelStats.CaseRuns++
			if cell.Passed == cell.Trials {
				evalModelStats.CaseRunsAllPassed++
			}
		}
	}

	// only shows badges if more than one model is being evaluated and compared with others
	var top *evalModelStats
	compared := 0
	for _, evalModelStats := range evalReport.Models {
		if evalModelStats.Trials == 0 {
			continue
		}
		compared++
		if top == nil || evalModelStats.PassRate() > top.PassRate() ||
			(evalModelStats.PassRate() == top.PassRate() && evalModelStats.CostPerPass() < top.CostPerPass()) {
			top = evalModelStats
		}
	}
	if compared < 2 || top.Passed == 0 {
		return evalReport
	}
	top.MostAccurate = true
	var best *evalModelStats
	for _, evalModelStats := range evalReport.Models {
		if evalModelStats.Trials == 0 || evalModelStats.PassRate() < top.PassRate()-bestValueMargin {
			continue
		}
		if best == nil || evalModelStats.CostPerPass() < best.CostPerPass() {
			best = evalModelStats
		}
	}
	best.BestValue = true
	return evalReport
}

func (r *evalReport) print(w io.Writer) {
	tabWriter := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tabWriter, "\nMODEL\tCASE\tSURFACE\tPASSED\tUNGRADED\tAVG LLM CALLS\tAVG COST\tAVG DURATION")
	for _, row := range r.Cases {
		for _, evalCell := range row.Cells {
			if evalCell.Trials == 0 {
				continue
			}
			fmt.Fprintf(tabWriter, "%s\t%s\t%s\t%d/%d\t%d\t%.1f\t$%.4f\t%s\n", evalCell.Model, row.ID, row.Surface, evalCell.Passed, evalCell.Trials,
				evalCell.Ungraded, evalCell.AvgLLMCalls(), evalCell.AvgCost(), evalCell.AvgDuration())
		}
	}
	tabWriter.Flush()

	tabWriter = tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	header := "\nMODEL\tPASS RATE\tUNGRADED\tPASS^K\tTOTAL COST\tCOST PER PASS\tAVG DURATION\t"
	for _, surface := range r.Surfaces {
		header += strings.ToUpper(surface) + "\t"
	}
	fmt.Fprintln(tabWriter, header)
	for _, evalModelStats := range r.Models {
		if evalModelStats.Trials == 0 {
			continue
		}
		perSurface := ""
		for _, evalSurfaceStats := range evalModelStats.BySurface {
			if evalSurfaceStats.Trials > 0 {
				perSurface += fmt.Sprintf("%d/%d", evalSurfaceStats.Passed, evalSurfaceStats.Trials)
			}
			perSurface += "\t"
		}
		note := ""
		if evalModelStats.MostAccurate {
			note += " most accurate"
		}
		if evalModelStats.BestValue {
			note += " best value"
		}
		fmt.Fprintf(tabWriter, "%s\t%d/%d (%.0f%%)\t%d\t%d/%d case runs\t$%.4f\t$%.4f\t%s\t%s%s\n", evalModelStats.Model, evalModelStats.Passed, evalModelStats.Trials,
			100*evalModelStats.PassRate(), evalModelStats.Ungraded, evalModelStats.CaseRunsAllPassed, evalModelStats.CaseRuns, evalModelStats.Cost, evalModelStats.CostPerPass(), evalModelStats.AvgDuration(), perSurface, note)
	}
	tabWriter.Flush()
	fmt.Fprintf(w, "\nmodels compared: %s\njudge: %s, cost $%.4f\n", strings.Join(r.ModelNames, ", "), r.JudgeModel, r.JudgeCost)
}

var unsafeFileChars = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func (r *evalReport) writeHTML(dir string) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	names := make([]string, len(r.Models))
	for i, evalModelStats := range r.Models {
		names[i] = unsafeFileChars.ReplaceAllString(evalModelStats.Model, "-")
	}
	prefix := "eval-" + r.Kind + "-" + r.Started.Format("20060102-150405") + "-"
	judge := "_judged-by_" + unsafeFileChars.ReplaceAllString(r.JudgeModel, "-")
	compared := strings.Join(names, "_vs_")
	// Most file systems cap a name at 255 bytes, which a long list of models
	// can exceed. The list of compared models is shortened so that the name
	// keeps the judge.
	if maxLen := 200 - len(prefix) - len(judge); len(compared) > maxLen {
		compared = compared[:max(maxLen, 0)]
	}
	name := prefix + compared + judge
	path, err := filepath.Abs(filepath.Join(dir, name+".html"))
	if err != nil {
		return "", err
	}
	file, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	return path, evalReportTemplate.Execute(file, r)
}

var evalReportTemplate = template.Must(template.New("report").Funcs(template.FuncMap{
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
.ungraded { color: var(--muted); background: var(--line); }
.q { color: var(--muted); font-size: 13px; }
details { background: var(--card); border: 1px solid var(--line); border-radius: 8px; margin: 8px 0; }
summary { cursor: pointer; padding: 8px 12px; }
.run { border-top: 1px solid var(--line); padding: 8px 12px; }
.answer { white-space: pre-wrap; background: var(--bg); border-radius: 6px; padding: 8px; margin: 6px 0; }
.failures { color: var(--fail); margin: 4px 0; padding-left: 20px; }
.ungraded-reasons { color: var(--muted); margin: 4px 0; padding-left: 20px; }
code { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
</style>
</head>
<body>
<main>
<h1>Agent {{.Kind}} eval report</h1>
<p class="meta">{{.Started.Format "2006-01-02 15:04 MST"}} · {{len .Cases}} case runs on {{range $i, $s := .Surfaces}}{{if $i}} and {{end}}{{$s}}{{end}} · {{.Trials}} trial(s) each</p>
<p class="meta">Models compared: {{range $i, $m := .ModelNames}}{{if $i}}, {{end}}{{$m}}{{end}} · Judge: {{.JudgeModel}}</p>

<h2>Models</h2>
<div class="scroll"><table>
<tr><th>Model</th><th>Pass rate</th>{{range .Surfaces}}<th>{{.}}</th>{{end}}<th>Ungraded</th><th>Pass^k</th><th>Total cost</th><th>Cost per pass</th><th>Avg duration</th><th>Tokens</th></tr>
{{range .Models}}{{if .Trials}}<tr>
<td>{{.Model}}<br>{{if .MostAccurate}}<span class="badge">most accurate</span>{{end}}{{if .BestValue}}<span class="badge">best value</span>{{end}}</td>
<td class="num">{{.Passed}}/{{.Trials}} ({{pct .PassRate}})</td>
{{range .BySurface}}<td class="num">{{if .Trials}}{{.Passed}}/{{.Trials}} ({{pct .PassRate}}){{end}}</td>{{end}}
<td class="num">{{.Ungraded}}</td>
<td class="num">{{.CaseRunsAllPassed}}/{{.CaseRuns}} cases</td>
<td class="num">{{usd .Cost}}</td>
<td class="num">{{usd .CostPerPass}}</td>
<td class="num">{{.AvgDuration}}</td>
<td class="num">{{.Tokens}}</td>
</tr>{{end}}{{end}}
</table></div>
<p class="note">A run is ungraded when the judge's verdict could not be checked against the answer. Ungraded runs count as not passed and are also listed on their own. Pass^k counts the case runs that passed every trial. Cost per pass is the total cost divided by the passed trials. Best value is the lowest cost per pass among models within 5 points of the top pass rate. Costs are what OpenRouter reported for each call. The judge's calls, calibration included, cost {{usd .JudgeCost}} and are not in the models' costs.</p>

<h2>Cases</h2>
<div class="scroll"><table>
<tr><th>Case</th>{{range .Models}}<th>{{.Model}}</th>{{end}}</tr>
{{range .Cases}}<tr>
<td><b>{{.ID}}</b> <span class="badge">{{.Surface}}</span>{{range .Questions}}<div class="q">{{.}}</div>{{end}}</td>
{{range .Cells}}<td>{{if .Trials}}<div class="cell {{.Outcome}}"><b>{{.Passed}}/{{.Trials}}</b>{{if .Ungraded}} ({{.Ungraded}} ungraded){{end}}<small>{{usd .AvgCost}} · {{calls .AvgLLMCalls}} calls · {{.AvgDuration}}</small></div>{{end}}</td>{{end}}
</tr>{{end}}
</table></div>

<h2>Runs</h2>
{{range .Cases}}{{$id := .ID}}{{$surface := .Surface}}{{range .Cells}}{{if .Trials}}
<details{{if ne .Outcome "pass"}} open{{end}}>
<summary><b>{{$id}}</b> · {{$surface}} · {{.Model}} · <span class="cell {{.Outcome}}">{{.Passed}}/{{.Trials}}{{if .Ungraded}} ({{.Ungraded}} ungraded){{end}}</span></summary>
{{range .Runs}}<div class="run">
<div>Trial {{.Trial}} · {{.Run.LLMCalls}} llm calls · {{usd .Run.Cost}} · {{.Run.Duration}}</div>
{{if .Failures}}<ul class="failures">{{range .Failures}}<li>{{.}}</li>{{end}}</ul>{{end}}
{{if .Ungraded}}<ul class="ungraded-reasons">{{range .Ungraded}}<li>ungraded: {{.}}</li>{{end}}</ul>{{end}}
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
func (r evalResult) Ungraded() []string     { return r.ungraded }
func (r evalResult) Run() evalRun           { return r.run }
func (r evalRun) Answer() string            { return r.answer }
func (r evalRun) LLMCalls() int             { return r.llmCalls }
func (r evalRun) Cost() float64             { return r.cost }
func (r evalRun) Duration() time.Duration   { return r.duration.Round(100 * time.Millisecond) }
func (r evalRun) ToolCalls() []chatToolCall { return r.toolCalls }
