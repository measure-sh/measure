package symbolicator

import (
	"backend/libs/artdump"
	"backend/libs/event"
	"strings"
)

// artDumpEntry ties a parsed ART thread dump to the request
// stacktrace carrying each of its threads.
type artDumpEntry struct {
	dump *artdump.Dump
	// stacktraceIdx[t] is the index into the request's Stacktraces
	// for the dump's thread t.
	stacktraceIdx []int
}

// parseARTDump adds one request stacktrace per thread of a parsed
// ART thread dump, keyed by frame index, and records the dump for
// the rewrite stage.
func (js *jvmSymbolicator) parseARTDump(dump *artdump.Dump, index int) {
	entry := &artDumpEntry{dump: dump}

	for _, frames := range dump.Threads() {
		frameJVMs := make([]frameJVM, 0, len(frames))
		for f, frame := range frames {
			frameJVMs = append(frameJVMs, frameJVM{
				Index:    f,
				Function: frame.MethodName,
				Filename: frame.FileName,
				LineNo:   frame.LineNum,
				Module:   frame.ClassName,
			})
			js.request.AddClass(frame.ClassName)
		}
		entry.stacktraceIdx = append(entry.stacktraceIdx, len(js.request.Stacktraces))
		js.request.Stacktraces = append(js.request.Stacktraces, stacktraceJVM{
			Frames: frameJVMs,
		})
	}

	for _, class := range dump.MonitorClasses() {
		js.request.AddClass(class)
	}

	if js.artDumps == nil {
		js.artDumps = make(map[int]*artDumpEntry)
	}
	js.artDumps[index] = entry
}

// rewriteARTDumps renders each recorded dump with its symbolicated
// frames. Response frames carry the index of the request frame they
// came from; several frames at one index are an inlined call
// expanded in place. Frames the response omits (R8-synthesized
// frames are dropped by symbolicator) fall back to the classes map
// inside Render. Monitor annotations resolve through the classes
// map as well.
func (js jvmSymbolicator) rewriteARTDumps(evs []event.EventField, lambdaWorkaround bool) {
	for i, entry := range js.artDumps {
		threads := entry.dump.Threads()
		rw := artdump.Rewrite{
			Frames:  make(map[artdump.FrameKey][]artdump.Frame),
			Classes: js.response.Classes,
		}

		for t, stacktraceIdx := range entry.stacktraceIdx {
			if stacktraceIdx >= len(js.response.Stacktraces) {
				continue
			}
			for _, frame := range js.response.Stacktraces[stacktraceIdx].Frames {
				if frame.Index < 0 || frame.Index >= len(threads[t]) {
					continue
				}
				className := frame.Module
				if lambdaWorkaround && strings.Contains(className, lambdaSubstr) {
					className = js.response.rewriteClass(threads[t][frame.Index].ClassName, className)
				}
				key := artdump.FrameKey{Thread: t, Frame: frame.Index}
				rw.Frames[key] = append(rw.Frames[key], artdump.Frame{
					ClassName:  className,
					MethodName: frame.Function,
					FileName:   frame.Filename,
					LineNum:    frame.LineNo,
				})
			}
		}

		evs[i].ANR.ARTThreadDump = entry.dump.Render(rw)
	}
}
