// Package artdump parses the ART thread dump text that Android's
// ApplicationExitInfo returns for an exit, and renders it back with
// substitutions applied. Only managed frame lines and monitor
// annotation lines are interpreted; every other line passes through
// Render unchanged. A line the parser does not recognize stays as
// it was in the output, and the rest of the dump still renders
// normally.
package artdump

import (
	"regexp"
	"strconv"
	"strings"
)

// mainThreadName is what ART calls the thread an app runs its UI on.
const mainThreadName = "main"

// frameRe matches a managed frame line, like
//
//	at bl.o0.run(SourceFile:8)
var frameRe = regexp.MustCompile(`^(\s+)at ([^\s(]+)\((.*)\)$`)

// monitorRe matches a monitor annotation line, like
//
//   - waiting to lock <0x0e5c06d6> (a bl.o0) held by thread 48
//
// capturing the verb, the object class, and the holder's thread id
// when present. The verbs and object forms mirror ART's
// StackDumpVisitor::PrintObject; <@addr=0x...> appears when the
// object's identity hashcode was never computed.
var monitorRe = regexp.MustCompile(`^\s+- (waiting on|waiting to lock|waiting for lock inflation of|locked|sleeping on) <(?:@addr=)?0x[0-9a-fA-F]+> \(a ([^)]+)\)(?: held by thread (\d+))?`)

// Frame is one managed frame of a thread dump stacktrace.
type Frame struct {
	ClassName  string
	MethodName string
	FileName   string
	LineNum    int
}

// FrameKey addresses a frame by its thread's position in Threads
// and the frame's position within that thread.
type FrameKey struct {
	Thread int
	Frame  int
}

// Rewrite carries the substitutions Render applies.
type Rewrite struct {
	// Frames holds the frames replacing the addressed frame's
	// line. Several frames render as several lines in place, the
	// shape of an inlined call expanded by symbolication.
	Frames map[FrameKey][]Frame
	// Classes maps obfuscated to resolved class names. It renames
	// monitor annotation classes and the class of any frame Frames
	// has no entry for.
	Classes map[string]string
}

type parsedFrame struct {
	lineIdx int
	indent  string
	frame   Frame
}

type thread struct {
	name   string
	frames []parsedFrame
}

// monitor holds a monitor annotation's class name split from its
// wrapper (java.lang.Class<C> for class-object locks, trailing []
// pairs for array locks) so a class map resolves the core name.
type monitor struct {
	lineIdx   int
	prefix    string
	className string
	suffix    string
}

// Dump is a parsed ART thread dump.
type Dump struct {
	lines    []string
	threads  []thread
	monitors []monitor
}

// Parse parses the managed frames and monitor annotations of an ART
// thread dump, grouping frames per thread block. Native method
// frames are skipped since resolving them needs native symbols.
// Returns nil when the text contains no parseable frames.
func Parse(text string) *Dump {
	if text == "" {
		return nil
	}

	d := &Dump{lines: strings.Split(text, "\n")}
	var current thread

	flush := func() {
		if len(current.frames) > 0 {
			d.threads = append(d.threads, current)
		}
		current = thread{}
	}

	for i, line := range d.lines {
		if strings.HasPrefix(line, `"`) {
			flush()
			current.name = threadName(line)
			continue
		}

		m := frameRe.FindStringSubmatch(line)
		if m == nil {
			if mm := monitorRe.FindStringSubmatch(line); mm != nil {
				prefix, className, suffix := splitMonitorClass(mm[2])
				d.monitors = append(d.monitors, monitor{lineIdx: i, prefix: prefix, className: className, suffix: suffix})
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

		fileName, lineNum := parseLocation(location)
		current.frames = append(current.frames, parsedFrame{
			lineIdx: i,
			indent:  m[1],
			frame: Frame{
				ClassName:  callee[:dot],
				MethodName: callee[dot+1:],
				FileName:   fileName,
				LineNum:    lineNum,
			},
		})
	}
	flush()

	if len(d.threads) == 0 {
		return nil
	}
	return d
}

// Threads returns the parsed managed frames per thread block, in
// dump order. Indexes into the result address frames in a Rewrite.
func (d *Dump) Threads() [][]Frame {
	threads := make([][]Frame, len(d.threads))
	for t := range d.threads {
		frames := make([]Frame, len(d.threads[t].frames))
		for f, pf := range d.threads[t].frames {
			frames[f] = pf.frame
		}
		threads[t] = frames
	}
	return threads
}

// MainThread returns the managed frames of the thread the app runs its
// UI on, which is the one a stall is attributed to. Returns nil when the
// dump has no block named "main", such as a dump whose main thread sat
// in native code and so contributed no managed frames.
func (d *Dump) MainThread() []Frame {
	for t := range d.threads {
		if d.threads[t].name != mainThreadName {
			continue
		}
		frames := make([]Frame, len(d.threads[t].frames))
		for f, pf := range d.threads[t].frames {
			frames[f] = pf.frame
		}
		return frames
	}

	return nil
}

// MonitorClasses returns the core class names referenced by monitor
// annotations, in dump order, without duplicates.
func (d *Dump) MonitorClasses() []string {
	seen := make(map[string]struct{}, len(d.monitors))
	classes := []string{}
	for _, m := range d.monitors {
		if _, ok := seen[m.className]; ok {
			continue
		}
		seen[m.className] = struct{}{}
		classes = append(classes, m.className)
	}
	return classes
}

// Render returns the dump text with the rewrite applied. A frame
// line renders its replacement frames, falls back to a class rename
// via Classes, or stays as is. Monitor annotation lines rename
// their class via Classes. Every other line is returned byte for
// byte, so rendering an empty Rewrite reproduces the parsed text.
func (d *Dump) Render(rw Rewrite) string {
	replacements := make(map[int][]string)

	for t := range d.threads {
		for f, pf := range d.threads[t].frames {
			frames := rw.Frames[FrameKey{Thread: t, Frame: f}]
			if len(frames) == 0 {
				if mapped, ok := rw.Classes[pf.frame.ClassName]; ok && mapped != pf.frame.ClassName {
					renamed := pf.frame
					renamed.ClassName = mapped
					replacements[pf.lineIdx] = []string{renderFrame(pf.indent, renamed)}
				}
				continue
			}
			rendered := make([]string, 0, len(frames))
			for _, frame := range frames {
				rendered = append(rendered, renderFrame(pf.indent, frame))
			}
			replacements[pf.lineIdx] = rendered
		}
	}

	for _, m := range d.monitors {
		mapped, ok := rw.Classes[m.className]
		if !ok || mapped == m.className {
			continue
		}
		orig := "(a " + m.prefix + m.className + m.suffix + ")"
		renamed := "(a " + m.prefix + mapped + m.suffix + ")"
		replacements[m.lineIdx] = []string{strings.Replace(d.lines[m.lineIdx], orig, renamed, 1)}
	}

	out := make([]string, 0, len(d.lines))
	for i, line := range d.lines {
		if rendered, ok := replacements[i]; ok {
			out = append(out, rendered...)
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

// splitMonitorClass splits a monitor object type into the
// resolvable class name and its wrapper.
func splitMonitorClass(objType string) (prefix, className, suffix string) {
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

// threadName reads the name a thread block opens with, like
//
//	"main" prio=5 tid=1 Blocked
func threadName(header string) string {
	rest := header[1:]
	end := strings.IndexByte(rest, '"')
	if end < 0 {
		return ""
	}

	return rest[:end]
}

// parseLocation splits a frame location like "SourceFile:8" into
// file name and line number. "Unknown Source" and locations without
// a usable line number yield line 0, which symbolication treats as
// an unknown line.
func parseLocation(location string) (fileName string, lineNum int) {
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

func renderFrame(indent string, frame Frame) string {
	location := frame.FileName
	if location == "" {
		location = "Unknown Source"
	}
	if frame.LineNum > 0 {
		location = location + ":" + strconv.Itoa(frame.LineNum)
	}
	return indent + "at " + frame.ClassName + "." + frame.MethodName + "(" + location + ")"
}
