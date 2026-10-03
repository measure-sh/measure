package artdump

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// NoLineNum is Frame.LineNum when a stack frame
// does not contain a source line number.
const NoLineNum = -1

// Labels for ANR cause.
const (
	CauseDeadlock      = "Main thread blocked by a deadlock"
	CauseBlocked       = "Main thread blocked by another thread"
	CauseSlowOperation = "Slow operation on the main thread"
	CauseWaiting       = "Main thread waiting too long"
	CauseIdle          = "Main thread idle"
)

const (
	dumpLatencyPrefix      = "DumpLatencyMs:"
	unknownObjectLock      = "  - waiting on an unknown object"
	lockStateWaitingToLock = "waiting to lock"
)

// frameworkPackagePrefixes contains
// class-name prefixes that identify
// framework code in stacktraces.
var frameworkPackagePrefixes = []string{
	"java.",
	"javax.",
	"jdk.",
	"sun.",
	"kotlin.",
	"kotlinx.",
	"android.",
	"androidx.",
	"com.android.",
	"dalvik.",
	"libcore.",
	"io.flutter.",
	"com.facebook.react.",
	"sh.measure.",
}

var (
	// Examples:
	// "main" prio=5 tid=1 Blocked
	// "1.io" prio=5 (not attached)
	threadHeaderRE = regexp.MustCompile(`^"(.*)" (?:daemon )?prio=\d+(?: tid=(\d+)(?: (\w+))?)?`)

	// Examples:
	//   at android.os.MessageQueue.next(MessageQueue.java:335)
	//   at java.lang.Thread.sleep(Native method)
	managedFrameRE = regexp.MustCompile(`^  at ([\w$.\-]+)\.([\w$\-<>]+)\((.*)\)$`)

	// Examples:
	//    - locked <0x0504af66> (a java.lang.Object)
	//   - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46
	lockRE = regexp.MustCompile(`^  - (locked|waiting on|waiting to lock|sleeping on) <(0x[0-9a-f]+)> \(a (.+)\)(?: held by thread (\d+))?$`)
)

// Dump contains a parsed ART thread dump
// along with metadata to be used for
// grouping.
//
//	Dump
//	|- Threads
//	|  |- Header
//	|  |- Frames
type Dump struct {
	Threads []Thread `json:"threads"`
	// BlockingChain represents the thread ids
	// involved in deadlock if any.
	BlockingChain []int `json:"blocking_chain,omitempty"`
	// GroupingFrame using which the
	// ANR should be grouped.
	GroupingFrame Frame `json:"grouping_frame"`
	// Cause of the ANR, one of the Cause
	// constants, or empty when the dump
	// has no main thread.
	Cause string `json:"cause,omitempty"`
}

// Thread represents one thread block
// in an ART dump.
type Thread struct {
	Header string `json:"header"`
	Name   string `json:"name"`
	Tid    int    `json:"tid"`
	// State ART printed for the thread,
	// such as Runnable or Blocked.
	State  string  `json:"state,omitempty"`
	Frames []Frame `json:"frames,omitempty"`
}

// Frame represents one line in the
// thread stacktrace.
type Frame struct {
	ClassName  string `json:"class_name,omitempty"`
	MethodName string `json:"method_name,omitempty"`
	FileName   string `json:"file_name,omitempty"`
	LineNum    int    `json:"line_num"`
	InApp      bool   `json:"in_app,omitempty"`
	RawLine    string `json:"raw,omitempty"`
	Locks      []Lock `json:"locks,omitempty"`
}

// Lock associated with the preceding frame.
type Lock struct {
	State     string `json:"state"`
	Object    string `json:"object,omitempty"`
	ClassName string `json:"class_name,omitempty"`
	HolderTid int    `json:"holder_tid,omitempty"`
}

func isThreadHeader(line string) bool {
	return threadHeaderRE.MatchString(line)
}

func parseStackLine(line string) Frame {
	m := managedFrameRE.FindStringSubmatch(line)
	if m == nil {
		// Native frames and other unrecognised stack lines
		// are preserved verbatim
		return Frame{
			LineNum: NoLineNum,
			RawLine: line,
		}
	}

	frame := Frame{
		ClassName:  m[1],
		MethodName: m[2],
		FileName:   m[3],
		LineNum:    NoLineNum,
	}

	// A managed frame may contain either a source line:
	//   Foo.java:42
	// or just a file name:
	//   Native method
	//   SourceFile
	if i := strings.LastIndex(m[3], ":"); i >= 0 {
		if lineNum, err := strconv.Atoi(m[3][i+1:]); err == nil {
			frame.FileName = m[3][:i]
			frame.LineNum = lineNum
		}
	}

	// Android 11 prints a missing line number as ":-1". Render would
	// drop it for NoLineNum, so the line is kept as ART printed it.
	if strings.HasSuffix(m[3], ":-1") {
		frame.RawLine = line
	}

	return frame
}

func parseLock(line string) (Lock, bool) {
	if line == unknownObjectLock {
		return Lock{
			State: strings.TrimPrefix(unknownObjectLock, "  - "),
		}, true
	}

	m := lockRE.FindStringSubmatch(line)
	if m == nil {
		return Lock{}, false
	}

	lock := Lock{
		State:     m[1],
		Object:    m[2],
		ClassName: m[3],
	}

	if m[4] != "" {
		holderTid, err := strconv.Atoi(m[4])
		if err != nil || holderTid == 0 {
			return Lock{}, false
		}
		lock.HolderTid = holderTid
	}

	return lock, true
}

// mainThread returns the main thread or nil
// when the dump does not contain one.
func (d *Dump) mainThread() *Thread {
	for i := range d.Threads {
		if d.Threads[i].Name == "main" {
			return &d.Threads[i]
		}
	}
	return d.threadByTid(1)
}

// HasMainFrame reports whether the main thread
// has a managed frame to group the ANR on.
func (d *Dump) HasMainFrame() bool {
	thread := d.mainThread()
	if thread == nil {
		return false
	}

	for _, frame := range thread.Frames {
		if frame.ClassName != "" {
			return true
		}
	}

	return false
}

// threadByTid returns the thread for a
// given tid or nil when the dump has no
// such thread.
func (d *Dump) threadByTid(tid int) *Thread {
	if tid == 0 {
		return nil
	}

	for i := range d.Threads {
		if d.Threads[i].Tid == tid {
			return &d.Threads[i]
		}
	}

	return nil
}

// render writes the frame in ART's format. A frame the parser kept
// verbatim is returned as it was found.
func (f *Frame) render() string {
	if f.ClassName == "" || f.RawLine != "" {
		return f.RawLine
	}

	var sb strings.Builder
	sb.WriteString("  at ")
	sb.WriteString(f.ClassName)
	sb.WriteByte('.')
	sb.WriteString(f.MethodName)
	sb.WriteByte('(')
	sb.WriteString(f.FileName)

	if f.LineNum != NoLineNum {
		sb.WriteByte(':')
		sb.WriteString(strconv.Itoa(f.LineNum))
	}

	sb.WriteByte(')')

	return sb.String()
}

// render writes the lock in ART's format.
func (l *Lock) render() string {
	var sb strings.Builder
	sb.WriteString("  - ")
	sb.WriteString(l.State)

	if l.Object != "" {
		sb.WriteString(" <")
		sb.WriteString(l.Object)
		sb.WriteString("> (a ")
		sb.WriteString(l.ClassName)
		sb.WriteString(")")
	}

	if l.HolderTid != 0 {
		sb.WriteString(" held by thread ")
		sb.WriteString(strconv.Itoa(l.HolderTid))
	}

	return sb.String()
}

func Parse(s string) *Dump {
	lines := strings.Split(s, "\n")
	dump := &Dump{}

	for len(lines) > 0 && !isThreadHeader(lines[0]) {
		lines = lines[1:]
	}

	for len(lines) > 0 && isThreadHeader(lines[0]) {
		thread := Thread{
			Header: lines[0],
		}

		if m := threadHeaderRE.FindStringSubmatch(thread.Header); m != nil {
			thread.Name = m[1]
			thread.Tid, _ = strconv.Atoi(m[2])
			thread.State = m[3]
		}

		// Parse every stack line. ART indents everything it prints in
		// place of frames, including the marker saying there are none.
		i := 1
		for ; i < len(lines) && strings.HasPrefix(lines[i], "  "); i++ {
			line := lines[i]

			if lock, ok := parseLock(line); ok && len(thread.Frames) > 0 {
				last := &thread.Frames[len(thread.Frames)-1]
				last.Locks = append(last.Locks, lock)
				continue
			}

			thread.Frames = append(thread.Frames, parseStackLine(line))
		}

		// Skip the blank line and dump latency line
		// so the next line is the thread header or end
		// of the thread dump.
		for i < len(lines) && (lines[i] == "" || strings.HasPrefix(lines[i], dumpLatencyPrefix)) {
			i++
		}

		dump.Threads = append(dump.Threads, thread)
		lines = lines[i:]
	}

	return dump
}

// Populate fills in-app frames, lock contention
// and the blamed frame state in the thread dump.
func (d *Dump) Populate() {
	// Mark frames outside framework packages as in-app.
	for i := range d.Threads {
		for j := range d.Threads[i].Frames {
			frame := &d.Threads[i].Frames[j]
			isFramework := slices.ContainsFunc(frameworkPackagePrefixes, func(prefix string) bool {
				return strings.HasPrefix(frame.ClassName, prefix)
			})
			frame.InApp = frame.ClassName != "" && !isFramework
		}
	}

	// Follow "waiting to lock" from main to the thread holding it up.
	var chain []*Thread
	seen := map[*Thread]bool{}
	thread := d.mainThread()
	for thread != nil && !seen[thread] {
		seen[thread] = true
		chain = append(chain, thread)

		holderTid := 0
		for _, frame := range thread.Frames {
			for _, lock := range frame.Locks {
				if lock.State == lockStateWaitingToLock {
					holderTid = lock.HolderTid
				}
			}
		}
		thread = d.threadByTid(holderTid)
	}
	if len(chain) > 1 {
		for _, thread := range chain {
			d.BlockingChain = append(d.BlockingChain, thread.Tid)
		}
	}

	// Group on the deepest in-app frame in the chain, else main's
	// first managed frame.
	for i := len(chain) - 1; i >= 0 && !d.GroupingFrame.InApp; i-- {
		for _, frame := range chain[i].Frames {
			if frame.InApp {
				d.GroupingFrame = frame
				break
			}
		}
	}
	if d.GroupingFrame.ClassName == "" && len(chain) > 0 {
		for _, frame := range chain[0].Frames {
			if frame.ClassName != "" {
				d.GroupingFrame = frame
				break
			}
		}
	}

	// Work out the cause. A chain that returns to a thread it already
	// passed is a deadlock, and a main thread polling the looper is
	// waiting for work rather than doing any.
	if len(chain) > 0 {
		main := chain[0]
		pollingLooper := false
		for _, frame := range main.Frames {
			if frame.ClassName != "" {
				pollingLooper = frame.ClassName == "android.os.MessageQueue" && frame.MethodName == "nativePollOnce"
				break
			}
		}

		switch {
		case thread != nil:
			d.Cause = CauseDeadlock
		case len(chain) > 1 || main.State == "Blocked":
			d.Cause = CauseBlocked
		case pollingLooper:
			d.Cause = CauseIdle
		case main.State == "Runnable" || main.State == "Native":
			d.Cause = CauseSlowOperation
		default:
			d.Cause = CauseWaiting
		}
	}

	// Sort the blamed thread first, then main, then the rest in ART's
	// order.
	if len(chain) > 0 {
		blamed, main := chain[len(chain)-1], chain[0]
		sorted := []Thread{*blamed}
		if main != blamed {
			sorted = append(sorted, *main)
		}
		for i := range d.Threads {
			if thread := &d.Threads[i]; thread != blamed && thread != main {
				sorted = append(sorted, *thread)
			}
		}
		d.Threads = sorted
	}
}

// Render writes the dump's threads in ART's format.
func (d *Dump) Render() string {
	lines := make([]string, 0, len(d.Threads)*8)

	for i := range d.Threads {
		thread := &d.Threads[i]
		lines = append(lines, thread.Header)
		lines = append(lines, thread.RenderStack()...)
	}

	return strings.Join(lines, "\n")
}

// RenderStack writes the thread's frames in ART's
// format.
func (t *Thread) RenderStack() []string {
	lines := make([]string, 0, len(t.Frames))

	for _, frame := range t.Frames {
		lines = append(lines, frame.render())

		for _, lock := range frame.Locks {
			lines = append(lines, lock.render())
		}
	}

	return lines
}
