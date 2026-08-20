package artdump

import (
	"regexp"
	"strconv"
	"strings"
)

// NoLineNum is Frame.LineNum when a managed stack frame does not
// contain a source line number.
const NoLineNum = -1

const (
	dumpLatencyPrefix = "DumpLatencyMs:"
	unknownObjectLock = "  - waiting on an unknown object"
)

// frameworkPackagePrefixes contains class-name prefixes that identify
// framework code rather than application code.
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
	// "main" prio=5 tid=1 Blocked
	// "1.io" prio=5 (not attached)
	threadHeaderRE = regexp.MustCompile(`^"(.*)" (?:daemon )?prio=\d+(?: tid=(\d+))?`)

	//   at android.os.MessageQueue.next(MessageQueue.java:335)
	//   at java.lang.Thread.sleep(Native method)
	managedFrameRE = regexp.MustCompile(`^  at ([\w$.\-]+)\.([\w$\-<>]+)\((.*)\)$`)

	//   - locked <0x0504af66> (a java.lang.Object)
	//   - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46
	lockRE = regexp.MustCompile(`^  - (locked|waiting on|waiting to lock|sleeping on) <(0x[0-9a-f]+)> \(a (.+)\)(?: held by thread (\d+))?$`)
)

// Dump is the thread blocks of an ART thread dump. The lines ART prints
// around and between them describe the process rather than its threads,
// and are dropped at parse.
//
//	Dump
//	|- Threads
//	|  |- Header   the thread's own first line
//	|  |- Frames
type Dump struct {
	Threads []Thread `json:"threads"`
	// BlockingChain lists the ART thread ids standing between the
	// stalled thread and whatever is holding it up, the stalled thread
	// first and the root last. Resolved once, at ingest.
	BlockingChain []int `json:"blocking_chain,omitempty"`
	// GroupingFrame is the frame the ANR is grouped and titled on.
	// Resolved once, at ingest; nil on dumps stored before it was.
	GroupingFrame *Frame `json:"grouping_frame,omitempty"`
}

// Thread represents one thread block in an ART dump.
//
// The thread header is kept verbatim because ART can include information
// beyond the name and tid, for example:
//
//	"ReferenceQueueDaemon" daemon prio=5 tid=6 Waiting
//
// "(no managed stack frames)" is a frame, since ART prints it where the
// frames would go.
type Thread struct {
	Header string  `json:"header"`
	Name   string  `json:"name"`
	Tid    int     `json:"tid"`
	Frames []Frame `json:"frames,omitempty"`
}

// Frame represents either a parsed managed stack frame or an unparsed
// native stack frame.
//
// Managed frames have ClassName, MethodName, FileName, and LineNum
// populated. Native frames are retained in RawLine.
type Frame struct {
	ClassName  string `json:"class_name,omitempty"`
	MethodName string `json:"method_name,omitempty"`
	FileName   string `json:"file_name,omitempty"`
	LineNum    int    `json:"line_num"`
	InApp      bool   `json:"in_app,omitempty"`
	RawLine    string `json:"raw,omitempty"`
	Locks      []Lock `json:"locks,omitempty"`
}

// Lock is an annotation associated with the preceding stack frame.
type Lock struct {
	State     string `json:"state"`
	Object    string `json:"object,omitempty"`
	ClassName string `json:"class_name,omitempty"`
	HolderTid int    `json:"holder_tid,omitempty"`
}

// Parse parses an ART thread dump.
func Parse(s string) *Dump {
	lines := strings.Split(s, "\n")
	dump := &Dump{}

	// Everything before the first thread header is preamble.
	for len(lines) > 0 && !isThreadHeader(lines[0]) {
		lines = lines[1:]
	}

	// Each thread runs from its header until the next one, or until a
	// line that cannot belong to a thread block.
	for len(lines) > 0 && isThreadHeader(lines[0]) {
		thread, rest := parseThread(lines)
		dump.Threads = append(dump.Threads, thread)
		lines = rest
	}

	return dump
}

// parseThread parses a thread header, stacktrace and trailing content.
func parseThread(lines []string) (Thread, []string) {
	thread := Thread{
		Header: lines[0],
	}

	// Parse the raw thread header, name and tid
	if m := threadHeaderRE.FindStringSubmatch(thread.Header); m != nil {
		thread.Name = m[1]
		thread.Tid, _ = strconv.Atoi(m[2])
	}

	// Every stack line is a frame. A lock line is attached to
	// the frame above it.
	i := 1
	for ; i < len(lines) && isStackLine(lines[i]); i++ {
		line := lines[i]

		if lock, ok := parseLock(line); ok && len(thread.Frames) > 0 {
			last := &thread.Frames[len(thread.Frames)-1]
			last.Locks = append(last.Locks, lock)
			continue
		}

		thread.Frames = append(thread.Frames, parseStackLine(line))
	}

	// Whatever closes the block runs to the end of the dump.
	for i < len(lines) && isThreadTrailer(lines[i]) {
		i++
	}

	return thread, lines[i:]
}

func isThreadHeader(line string) bool {
	return threadHeaderRE.MatchString(line)
}

// isStackLine reports whether a line is part of a thread's stack. ART
// indents everything it prints in place of frames, including the marker
// saying there are none.
func isStackLine(line string) bool {
	return strings.HasPrefix(line, "  ")
}

// isThreadTrailer reports whether a line closes a thread block. ART
// prints these flush left, unlike anything in the stack.
func isThreadTrailer(line string) bool {
	return line == "" || strings.HasPrefix(line, dumpLatencyPrefix)
}

// Render writes the dump's threads in ART's format.
func (d *Dump) Render() string {
	lines := make([]string, 0, len(d.Threads)*8)

	for i := range d.Threads {
		thread := &d.Threads[i]
		lines = append(lines, thread.Header)
		lines = append(lines, thread.Stack(nil)...)
	}

	return strings.Join(lines, "\n")
}

// Stack writes the thread's frames in ART's format, each lock following
// the frame it annotates. A lock names its holder from holders, and
// falls back to the thread id ART printed.
func (t *Thread) Stack(holders map[int]string) []string {
	lines := make([]string, 0, len(t.Frames))

	for _, frame := range t.Frames {
		lines = append(lines, frame.Render())

		for _, lock := range frame.Locks {
			lines = append(lines, lock.Render(holders[lock.HolderTid]))
		}
	}

	return lines
}

// LockHolders maps an ART thread id to the thread's name, so a lock can
// name its holder rather than a number.
func (d *Dump) LockHolders() map[int]string {
	holders := map[int]string{}

	for _, thread := range d.Threads {
		if thread.Tid != 0 {
			holders[thread.Tid] = thread.Name
		}
	}

	return holders
}

// MainThread returns the main thread, or nil when the dump does not
// contain one. The returned thread points into the dump, so writes
// through it are visible in Render and Annotate.
func (d *Dump) MainThread() *Thread {
	for i := range d.Threads {
		if d.Threads[i].Name == "main" {
			return &d.Threads[i]
		}
	}

	// An app that renames its main thread still leaves it thread id 1.
	return d.ThreadByTid(1)
}

// ThreadByTid returns the thread ART gave the id tid, or nil when the
// dump has no such thread. Tid zero never matches: it is what an
// unattached thread leaves behind, and no lock names it as holder.
func (d *Dump) ThreadByTid(tid int) *Thread {
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

// lockStateWaitingToLock is the ART annotation for a thread blocked
// entering a monitor another thread holds.
const lockStateWaitingToLock = "waiting to lock"

// Annotate marks the application frames and resolves the blocking
// chain. Call it after symbolication, so in-app classification judges
// deobfuscated class names.
func (d *Dump) Annotate() {
	d.markInApp()
	d.resolveBlockingChain()

	// Depends on both of the above.
	frame := d.resolveGroupingFrame()
	d.GroupingFrame = &frame
}

// BlameThreads returns the threads the ANR can be blamed on, the
// stalled thread first and whatever is holding it up last. It always
// contains the stalled thread, so a chain of one means nothing was
// blocking it.
func (d *Dump) BlameThreads() []*Thread {
	if chain := d.blockingThreads(); len(chain) > 0 {
		return chain
	}

	if main := d.MainThread(); main != nil {
		return []*Thread{main}
	}

	return nil
}

// BlockingThread returns the thread holding the app up, or nil when
// nothing is.
func (d *Dump) BlockingThread() *Thread {
	chain := d.BlameThreads()
	if len(chain) < 2 {
		return nil
	}

	return chain[len(chain)-1]
}

// BlamedThread returns the thread the ANR is reported on: the one
// blocking the app when something is, and the stalled thread otherwise.
func (d *Dump) BlamedThread() *Thread {
	if blocking := d.BlockingThread(); blocking != nil {
		return blocking
	}

	return d.MainThread()
}

// BlameOrder splits the dump's threads into the one the ANR is
// reported on and the rest, in the order they should be shown beneath
// it: the stalled thread first, then the others as ART printed them.
//
// Whatever renders lead and whatever renders rest cannot disagree about
// which thread is which, and cannot show one twice. lead is nil when
// the dump names no thread to blame, and then rest holds every thread.
func (d *Dump) BlameOrder() (lead *Thread, rest []*Thread) {
	lead = d.BlamedThread()

	rest = make([]*Thread, 0, len(d.Threads))
	seen := map[*Thread]bool{lead: true}

	if main := d.MainThread(); main != nil && !seen[main] {
		rest = append(rest, main)
		seen[main] = true
	}

	for i := range d.Threads {
		if thread := &d.Threads[i]; !seen[thread] {
			rest = append(rest, thread)
		}
	}

	return lead, rest
}

// BlameFrame returns the frame the ANR is grouped and titled on. A dump
// stored before the frame was recorded is resolved on read, so it
// groups as it did then.
func (d *Dump) BlameFrame() Frame {
	if d.GroupingFrame != nil {
		return *d.GroupingFrame
	}

	return d.resolveGroupingFrame()
}

// resolveGroupingFrame picks the deepest frame in the blame chain that
// runs application code, since the stalled thread is only waiting when
// something else holds the lock.
//
// Failing that it is the stalled thread's first managed frame. The zero
// frame means the chain has no managed frame at all.
func (d *Dump) resolveGroupingFrame() (frame Frame) {
	chain := d.BlameThreads()
	if len(chain) == 0 {
		return
	}

	for i := len(chain) - 1; i >= 0; i-- {
		for _, f := range chain[i].Frames {
			if f.InApp {
				return f
			}
		}
	}

	for _, f := range chain[0].Frames {
		if f.ClassName != "" {
			return f
		}
	}

	return
}

// resolveBlockingChain records which threads are holding the main
// thread up.
//
// "waiting to lock" is the only blocking relation an ART dump records.
// "waiting on" is Object.wait, where the waiter has already released
// the monitor, so its holder is not blocking anyone.
//
// The walk stops on a thread it has seen, which is a deadlock cycle,
// and is what makes it terminate.
func (d *Dump) resolveBlockingChain() {
	main := d.MainThread()
	if main == nil {
		return
	}

	chain := []*Thread{main}
	seen := map[*Thread]bool{main: true}

	for {
		holder := d.ThreadByTid(blockedOnTid(chain[len(chain)-1]))
		if holder == nil || seen[holder] {
			break
		}

		chain = append(chain, holder)
		seen[holder] = true
	}

	if len(chain) < 2 {
		return
	}

	d.BlockingChain = make([]int, 0, len(chain))
	for _, thread := range chain {
		d.BlockingChain = append(d.BlockingChain, thread.Tid)
	}
}

// blockingThreads resolves the recorded blocking chain to threads. It
// is empty when nothing was holding the main thread up.
func (d *Dump) blockingThreads() []*Thread {
	threads := make([]*Thread, 0, len(d.BlockingChain))

	for _, tid := range d.BlockingChain {
		if thread := d.ThreadByTid(tid); thread != nil {
			threads = append(threads, thread)
		}
	}

	return threads
}

// blockedOnTid returns the id of the thread holding the monitor this
// thread is blocked entering, or zero when it is not blocked on one.
func blockedOnTid(thread *Thread) int {
	for _, frame := range thread.Frames {
		for _, lock := range frame.Locks {
			if lock.State == lockStateWaitingToLock {
				return lock.HolderTid
			}
		}
	}

	return 0
}

// markInApp marks managed frames whose classes do not belong to the
// Android/Java/framework packages as application frames.
func (d *Dump) markInApp() {
	for i := range d.Threads {
		for j := range d.Threads[i].Frames {
			frame := &d.Threads[i].Frames[j]
			frame.InApp = frame.ClassName != "" && !isFrameworkClass(frame.ClassName)
		}
	}
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
	// or a location without one:
	//   Native method
	//   SourceFile
	if i := strings.LastIndex(m[3], ":"); i >= 0 {
		if lineNum, err := strconv.Atoi(m[3][i+1:]); err == nil {
			frame.FileName = m[3][:i]
			frame.LineNum = lineNum
		}
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

// Render writes the frame in the original ART format. A frame the
// parser kept verbatim is returned as it was found.
func (f *Frame) Render() string {
	if f.ClassName == "" {
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

// Render writes the lock in the original ART format. A non-empty holder
// replaces the thread id ART printed, so a reader sees which thread
// holds the monitor instead of a number.
func (l *Lock) Render(holder string) string {
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
		sb.WriteString(" held by ")
		if holder != "" {
			sb.WriteString(holder)
		} else {
			sb.WriteString("thread ")
			sb.WriteString(strconv.Itoa(l.HolderTid))
		}
	}

	return sb.String()
}

func isFrameworkClass(className string) bool {
	for _, prefix := range frameworkPackagePrefixes {
		if strings.HasPrefix(className, prefix) {
			return true
		}
	}

	return false
}
