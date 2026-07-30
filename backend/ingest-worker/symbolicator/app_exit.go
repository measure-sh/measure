package symbolicator

import (
	"backend/libs/event"
	"regexp"
	"strconv"
	"strings"
)

// appExitFrameRe matches a managed frame line in an
// ApplicationExitInfo thread dump, like
//
//	at bl.o0.run(SourceFile:8)
var appExitFrameRe = regexp.MustCompile(`^(\s+)at ([^\s(]+)\((.*)\)$`)

// appExitMonitorRe matches a monitor annotation line in an
// ApplicationExitInfo thread dump, like
//
//   - waiting to lock <0x0e5c06d6> (a bl.o0) held by thread 48
//
// The verbs and object forms mirror ART's
// StackDumpVisitor::PrintObject; <@addr=0x...> appears when the
// object's identity hashcode was never computed.
var appExitMonitorRe = regexp.MustCompile(`^\s+- (?:waiting on|waiting to lock|waiting for lock inflation of|locked|sleeping on) <(?:@addr=)?0x[0-9a-fA-F]+> \(a ([^)]+)\)`)

type appExitFrame struct {
	lineIdx    int
	indent     string
	className  string
	methodName string
	fileName   string
	lineNum    int
}

// appExitThread groups the managed frames of one thread block and
// remembers which request stacktrace carries them.
type appExitThread struct {
	frames        []appExitFrame
	stacktraceIdx int
}

// appExitMonitor holds a monitor annotation's class name split
// from its wrapper (java.lang.Class<C> or C[]) so the ProGuard
// class map resolves the core name.
type appExitMonitor struct {
	lineIdx   int
	prefix    string
	className string
	suffix    string
}

// appExitTrace is an app_exit trace split into lines with its
// managed frames and monitor annotations parsed out for
// symbolication. All other lines pass through rebuild untouched.
type appExitTrace struct {
	lines    []string
	threads  []appExitThread
	monitors []appExitMonitor
}

// isAppExitThreadHeader reports whether the line starts a thread
// block, like `"main" prio=5 tid=1 Blocked`.
func isAppExitThreadHeader(line string) bool {
	return strings.HasPrefix(line, `"`)
}

// parseAppExitTrace parses the managed frame lines of an
// ApplicationExitInfo thread dump, grouping frames per thread
// block. Native method frames are skipped since resolving them needs
// native symbols, which aren't available yet. Returns nil when the
// trace contains no parseable frames.
func parseAppExitTrace(trace string) *appExitTrace {
	if trace == "" {
		return nil
	}

	t := &appExitTrace{lines: strings.Split(trace, "\n")}
	current := appExitThread{stacktraceIdx: -1}

	flush := func() {
		if len(current.frames) > 0 {
			t.threads = append(t.threads, current)
		}
		current = appExitThread{stacktraceIdx: -1}
	}

	for i, line := range t.lines {
		if isAppExitThreadHeader(line) {
			flush()
			continue
		}

		m := appExitFrameRe.FindStringSubmatch(line)
		if m == nil {
			if mm := appExitMonitorRe.FindStringSubmatch(line); mm != nil {
				prefix, className, suffix := splitAppExitMonitorClass(mm[1])
				t.monitors = append(t.monitors, appExitMonitor{lineIdx: i, prefix: prefix, className: className, suffix: suffix})
			}
			continue
		}

		callee := m[2]
		dot := strings.LastIndex(callee, ".")
		if dot < 0 {
			continue
		}

		location := m[3]
		if strings.EqualFold(location, "native method") {
			continue
		}

		fileName, lineNum := parseAppExitLocation(location)
		current.frames = append(current.frames, appExitFrame{
			lineIdx:    i,
			indent:     m[1],
			className:  callee[:dot],
			methodName: callee[dot+1:],
			fileName:   fileName,
			lineNum:    lineNum,
		})
	}
	flush()

	if len(t.threads) == 0 {
		return nil
	}
	return t
}

// splitAppExitMonitorClass splits a monitor object type into the
// resolvable class name and its wrapper: java.lang.Class<C> for
// class-object locks, trailing [] pairs for array locks.
func splitAppExitMonitorClass(objType string) (prefix, className, suffix string) {
	className = objType
	if inner, ok := strings.CutPrefix(className, "java.lang.Class<"); ok && strings.HasSuffix(inner, ">") {
		prefix = "java.lang.Class<"
		suffix = ">"
		className = strings.TrimSuffix(inner, ">")
	}
	for strings.HasSuffix(className, "[]") {
		suffix = "[]" + suffix
		className = strings.TrimSuffix(className, "[]")
	}
	return prefix, className, suffix
}

// parseAppExitLocation splits a frame location like "SourceFile:8"
// into file name and line number. "Unknown Source" and locations
// without a line number yield line 0, which symbolicator accepts
// as an unknown line.
func parseAppExitLocation(location string) (fileName string, lineNum int) {
	colon := strings.LastIndex(location, ":")
	if colon < 0 {
		if strings.EqualFold(location, "unknown source") {
			return "", 0
		}
		return location, 0
	}

	num, err := strconv.Atoi(location[colon+1:])
	if err != nil || num < 0 {
		return location, 0
	}
	return location[:colon], num
}

// rebuild renders the trace with each sent frame line replaced by
// its symbolicated frames. Response frames carry the index of the
// request frame they originate from; an index with several frames
// means symbolicator expanded an inlined call, producing several
// lines at that position. Frames the response omits (R8-synthesized
// frames are dropped by symbolicator) fall back to a class-name-only
// rewrite via the classes map, as do monitor annotation lines; with
// no mapping at all the original line is kept.
func (t *appExitTrace) rebuild(resp *responseJVM, lambdaWorkaround bool) string {
	replacements := make(map[int][]string)

	for _, thread := range t.threads {
		// a nil map yields no frames for every index, so threads the
		// response has no stacktrace for fall back to the classes map
		var grouped map[int][]frameJVM
		if thread.stacktraceIdx >= 0 && thread.stacktraceIdx < len(resp.Stacktraces) {
			grouped = make(map[int][]frameJVM, len(thread.frames))
			for _, frame := range resp.Stacktraces[thread.stacktraceIdx].Frames {
				grouped[frame.Index] = append(grouped[frame.Index], frame)
			}
		}

		for i, orig := range thread.frames {
			frames := grouped[i]
			if len(frames) == 0 {
				if mapped, ok := resp.Classes[orig.className]; ok && mapped != orig.className {
					replacements[orig.lineIdx] = []string{renderAppExitFrame(orig.indent, mapped, orig.methodName, orig.fileName, orig.lineNum)}
				}
				continue
			}
			rendered := make([]string, 0, len(frames))
			for _, frame := range frames {
				className := frame.Module
				if lambdaWorkaround && strings.Contains(className, lambdaSubstr) {
					className = resp.rewriteClass(orig.className, className)
				}
				rendered = append(rendered, renderAppExitFrame(orig.indent, className, frame.Function, frame.Filename, frame.LineNo))
			}
			replacements[orig.lineIdx] = rendered
		}
	}

	for _, monitor := range t.monitors {
		if mapped, ok := resp.Classes[monitor.className]; ok && mapped != monitor.className {
			orig := "(a " + monitor.prefix + monitor.className + monitor.suffix + ")"
			renamed := "(a " + monitor.prefix + mapped + monitor.suffix + ")"
			line := strings.Replace(t.lines[monitor.lineIdx], orig, renamed, 1)
			replacements[monitor.lineIdx] = []string{line}
		}
	}

	out := make([]string, 0, len(t.lines))
	for i, line := range t.lines {
		if rendered, ok := replacements[i]; ok {
			out = append(out, rendered...)
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

// parseAppExit adds one request stacktrace per parsed thread of
// an app_exit trace and records the trace for the rewrite stage.
func (s *jvmSymbolicator) parseAppExit(trace *appExitTrace, index int) {
	for t := range trace.threads {
		thread := &trace.threads[t]
		frameJVMs := make([]frameJVM, 0, len(thread.frames))
		for k, frame := range thread.frames {
			frameJVMs = append(frameJVMs, frameJVM{
				Index:    k,
				Function: frame.methodName,
				Filename: frame.fileName,
				LineNo:   frame.lineNum,
				Module:   frame.className,
			})
			s.request.AddClass(frame.className)
		}
		thread.stacktraceIdx = len(s.request.Stacktraces)
		s.request.Stacktraces = append(s.request.Stacktraces, stacktraceJVM{
			Frames: frameJVMs,
		})
	}

	for _, monitor := range trace.monitors {
		s.request.AddClass(monitor.className)
	}

	if s.appExitTraces == nil {
		s.appExitTraces = make(map[int]*appExitTrace)
	}
	s.appExitTraces[index] = trace
}

func (js jvmSymbolicator) rewriteAppExits(evs []event.EventField, lambdaWorkaround bool) {
	for i, trace := range js.appExitTraces {
		evs[i].AppExit.Trace = trace.rebuild(js.response, lambdaWorkaround)
	}
}

func renderAppExitFrame(indent, className, methodName, fileName string, lineNum int) string {
	location := fileName
	if location == "" {
		location = "Unknown Source"
	}
	if lineNum > 0 {
		location = location + ":" + strconv.Itoa(lineNum)
	}
	return indent + "at " + className + "." + methodName + "(" + location + ")"
}
