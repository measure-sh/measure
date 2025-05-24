package symbolicator

import (
	"backend/api/cache"
	"backend/api/event"
	"backend/api/opsys"
	"backend/api/span"
	"backend/api/symbol"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// logRequest determines if symbolicator
// should log the relevent parts of the
// request payload.
//
// set to `true` for quick debugging.
const logRequest = false

// logResponse determines if symbolicator
// should log the relevant parts of the
// response payload.
//
// set to `true` for quick debugging.
const logResponse = false

var ErrJVMSymbolicationFailure = errors.New("symbolicator received JVM errors")

// lru is a least-recently-used cache
// to cache mapping files fetched from
// database.
//
// Helps to reduce latency for repeatedly
// fetching the same mapping file again
// and again.
var lru = cache.NewLRUCache(1000)

// lineNoEntry represents a JVM stacktrace's
// frame line number(s).
//
// some JVM stacktraces may contain negative
// line numbers. since, symbolicator service
// refuses to accept negative line numbers,
// we cache it before preparing the symbolicator
// request and restore from the cache after
// symbolication.
//
// each entry is a 5 element array.
//
// [i j k l m n]
//
// where
// i - exception event's index
// j - exception's index
// k - exception frame's index
// l - exception thread's index
// m - exception thread's frame's index
// n - original line no value
//
// when j & k are -1, the entry represents
// the exception's thread's stacktrace
// when l & m are -1, the entry represents
// the exception's non-main thread's
// stacktraces.
type lineNoEntry [6]int

// stacktraceEntry represents a JVM stacktrace's
// frame parameters.
//
// each entry is a 6 element array.
//
// [i j k l m]
//
// where
//
// i - exception event's index
//
// j - exception's index
//
// k - exception frame's index
//
// l - exception thread's index
//
// m - exception thread's frame's index
//
// n - result stacktrace's frame's index
type stacktraceEntry [6]int

// jvmSymbolicator represents a JVM symbolicator request.
type jvmSymbolicator struct {
	request       *requestJVM
	response      *responseJVM
	lineNoLUT     []lineNoEntry
	stacktraceLUT []stacktraceEntry
	// ttidSpans stores the index of the TTID span
	// that needs symbolication.
	ttidSpans []int
}

// nativeSymbolicator represents a native symbolicator request.
type nativeSymbolicator struct {
	request       *requestNative
	response      *responseNative
	stacktraceLUT []stacktraceEntry
}

// appleSymbolicator represents an Apple symbolicator request.
type appleSymbolicator struct {
	appleCrashReport []byte
	response         *responseApple
}

// Symbolicator contains everything required
// to perform de-obfuscation of data in various
// events.
type Symbolicator struct {
	// Origin is the http origin of the
	// symbolicator service.
	Origin string
	// OSName represents the app's
	// OS.
	OSName string
	// Sources is a list of symbol sources
	// the symbolicator is requested to use.
	Sources []Source
	// jvmSymbolicator maintains state for
	// a JVM symbolication request.
	jvmSymbolicator *jvmSymbolicator
	// nativeSymbolicator maintains state for
	// a native symbolication request.
	nativeSymbolicator *nativeSymbolicator
	// appleSymbolicator maintains state for
	// an Apple crash report symbolication request.
	appleSymbolicator *appleSymbolicator
	// jvmLambdaWorkaround determines if each of the
	// JVM stacktrace class names should be matched
	// and replaced during the rewrite stage of
	// symbolication.
	//
	// This was introduced to work around a bug
	// in Sentry's Symbolicator, where for lambda
	// methods, it would produce non-sensical results
	// like `J3.ExceptionDemoActivity...` - where the
	// J3 is totally unwarranted.
	jvmLambdaWorkaround bool
}

// New creates a new Symbolicator instance.
func New(origin, operatingSys string, sources []Source) (symbolicator *Symbolicator) {
	symbolicator = &Symbolicator{
		Origin: origin,
		OSName: operatingSys,
	}

	if len(sources) > 0 {
		symbolicator.Sources = sources
	}

	// rewrite jvm stacktrace classnames by matching all
	// resolved classnames from symbolicator response.
	//
	// at the moment, we only replace if a special substring
	// `SyntheticLambda` is present in the obfuscated classname
	if os.Getenv("SYMBOLICATE_JVM_LAMBDA_REWRITE") != "" {
		symbolicator.jvmLambdaWorkaround = true
	}

	// initialize symbolicators for each OS
	// this can be improved in the future
	// to only initialize the symbolicators
	// which are needed based on the events
	// in the batch.
	switch opsys.ToFamily(operatingSys) {
	case opsys.Android:
		symbolicator.jvmSymbolicator = &jvmSymbolicator{}
		symbolicator.nativeSymbolicator = &nativeSymbolicator{}
	case opsys.AppleFamily:
		symbolicator.appleSymbolicator = &appleSymbolicator{}
		symbolicator.nativeSymbolicator = &nativeSymbolicator{}
	}

	return
}

// Symbolicate performs symbolication by retrieving
// appropriate mapping file and managing symbolicator
// request to response cycle.
func (s *Symbolicator) Symbolicate(ctx context.Context, conn *pgxpool.Pool, appId uuid.UUID, events []event.EventField, spans []span.SpanField) (err error) {
	for i, ev := range events {
		if !ev.NeedsSymbolication() {
			continue
		}

		// apple exceptions are symbolicated
		// in place and do not need any
		// further processing
		if ev.Type == event.TypeException && ev.Exception.GetFramework() == event.Framework.Apple {
			s.appleSymbolicator.symbolicate(ev, s.Origin, s.Sources)
			continue
		}

		// find the mapping keys and mapping types
		name := ev.Attribute.AppVersion
		code := ev.Attribute.AppBuild
		cacheKey := fmt.Sprintf("%s/%s/%s", appId.String(), name, code)
		value, ok := lru.Get(cacheKey)
		if !ok {
			keyMap, keyErr := symbol.GetMappings(ctx, conn, appId, name, code)
			if keyErr != nil {
				fmt.Printf("Error fetching mapping keys for appId %s, version %s, build %s: %v\n", appId, name, code, keyErr)
				continue
			}

			if len(keyMap) < 1 {
				// Mapping keys can be absent if the app has
				// not uploaded the mapping files or does not
				// have a need to symbolicate.
				continue
			}
			value = keyMap
			lru.Put(cacheKey, value)
		}

		mappings, ok := value.(map[string]symbol.MappingType)
		if !ok {
			fmt.Printf("Invalid mapping keys for appId %s, version %s, build %s\n", appId, name, code)
			continue
		}

		// prepare symbolicator request
		switch ev.Type {
		case event.TypeException:
			f := ev.Exception.GetFramework()
			switch f {
			case event.Framework.JVM:
				// initialize jvm symbolicator request
				s.jvmSymbolicator.ensureRequestInitialized()

				// prepare the jvm symbolicator request
				// by adding the exception and thread
				// frames to the request
				exceptions := ev.Exception.Exceptions
				threads := ev.Exception.Threads
				s.jvmSymbolicator.parseExceptions(exceptions, threads, i)

			case event.Framework.Dart:
				// initialize native symbolicator request
				s.nativeSymbolicator.ensureRequestInitialized()

				// prepare the native symbolicator request
				// by adding the exception frames to the request
				exceptions := ev.Exception.Exceptions
				s.nativeSymbolicator.parseExceptions(exceptions, i)

				// configure the module for native symbolication
				baseAddr := ev.Exception.BinaryImages[0].BaseAddr
				uuid := ev.Exception.BinaryImages[0].Uuid
				arch := ev.Exception.BinaryImages[0].Arch
				s.nativeSymbolicator.configureModule(mappings, baseAddr, uuid, arch)
			}
		case event.TypeANR:
			s.jvmSymbolicator.ensureRequestInitialized()

			// prepare the jvm symbolicator request
			// by adding the exception and thread
			// frames to the request
			exceptions := ev.ANR.Exceptions
			threads := ev.ANR.Threads
			s.jvmSymbolicator.parseExceptions(exceptions, threads, i)

		case event.TypeLifecycleActivity:
			s.jvmSymbolicator.ensureRequestInitialized()

			s.jvmSymbolicator.request.AddClass(ev.LifecycleActivity.ClassName)

		case event.TypeLifecycleFragment:
			s.jvmSymbolicator.ensureRequestInitialized()

			s.jvmSymbolicator.request.AddClass(ev.LifecycleFragment.ClassName)
			s.jvmSymbolicator.request.AddClass(ev.LifecycleFragment.ParentActivity)
			s.jvmSymbolicator.request.AddClass(ev.LifecycleFragment.ParentFragment)

		case event.TypeColdLaunch:
			s.jvmSymbolicator.ensureRequestInitialized()

			s.jvmSymbolicator.request.AddClass(ev.ColdLaunch.LaunchedActivity)

		case event.TypeWarmLaunch:
			s.jvmSymbolicator.ensureRequestInitialized()

			s.jvmSymbolicator.request.AddClass(ev.WarmLaunch.LaunchedActivity)

		case event.TypeHotLaunch:
			s.jvmSymbolicator.ensureRequestInitialized()

			s.jvmSymbolicator.request.AddClass(ev.HotLaunch.LaunchedActivity)

		case event.TypeAppExit:
			s.jvmSymbolicator.ensureRequestInitialized()

			s.jvmSymbolicator.request.AddClass(ev.AppExit.Trace)
		}

		// configure module for jvm symbolication
		if s.jvmSymbolicator != nil {
			if err := s.jvmSymbolicator.configureModule(mappings); err != nil {
				fmt.Printf("Error configuring module for app id %s, version %s, build %s: %v\n", appId, name, code, err)
				continue
			}
		}
	}

	if s.jvmSymbolicator != nil {
		s.jvmSymbolicator.symbolicate(events, spans, s.Origin, s.Sources, s.jvmLambdaWorkaround)
	}

	if s.nativeSymbolicator != nil {
		s.nativeSymbolicator.symbolicate(events, s.Origin, s.Sources)
	}

	return
}

// symbolicate performs symbolication for
// the JVM symbolicator.
func (js *jvmSymbolicator) symbolicate(events []event.EventField, spans []span.SpanField, origin string, sources []Source, lambdaWorkaround bool) (err error) {
	if js.request != nil {
		sr := &SymbolicatorRequest{}
		if err = sr.prepareJvmRequest(js, origin, sources); err != nil {
			return
		}

		var respBody []byte
		if respBody, err = sr.makeRequest(); err != nil {
			return
		}

		if err = json.Unmarshal(respBody, &js.response); err != nil {
			return
		}

		if len(js.response.Errors) > 0 {
			err = ErrJVMSymbolicationFailure
			return
		}

		if logResponse {
			bytes, err := json.MarshalIndent(js.response, "", "  ")
			if err != nil {
				panic(err)
			}
			fmt.Println(string(bytes))
		}

		js.rewriteException(events, spans, lambdaWorkaround)
	}
	return
}

// configureModule configures the module
// required by symbolicator for JVM
// symbolication.
func (js *jvmSymbolicator) configureModule(mappings map[string]symbol.MappingType) (err error) {
	if js.request == nil {
		// no JVM events to symbolicate
		return
	}
	if len(mappings) < 1 {
		// no mapping files, skip adding the modules
		return
	}

	var debugId = ""
	for key, mType := range mappings {
		if mType == symbol.TypeProguard {
			debugId = symbol.MappingKeyToDebugId(key)
		}
	}
	if debugId == "" {
		err = errors.New("no proguard mapping found")
		return
	}
	js.request.AddModule(debugId, symbol.TypeProguard.String())

	return
}

// parseExceptions parses the exceptions
// and threads from the event request
// and prepares the JVM symbolicator
// request.
func (s *jvmSymbolicator) parseExceptions(exceptions event.ExceptionUnits, threads event.Threads, index int) {
	for j, excep := range exceptions {
		s.request.Exceptions = append(s.request.Exceptions, exceptionJVM{
			Type: excep.Type,
		})

		// symbolicate each exception unit's type
		// by matching classes
		s.request.AddClass(excep.Type)

		frameJVMs := []frameJVM{}
		for k, frame := range excep.Frames {
			line := frame.LineNum
			if line < 0 {
				s.lineNoLUT = append(s.lineNoLUT, lineNoEntry{index, j, k, -1, -1, frame.LineNum})
				line = 0
			}
			frameJVMs = append(frameJVMs, frameJVM{
				Index:    k,
				Function: frame.MethodName,
				Filename: frame.FileName,
				LineNo:   line,
				Module:   frame.ClassName,
			})
			s.request.AddClass(frame.ClassName)
			s.stacktraceLUT = append(s.stacktraceLUT, stacktraceEntry{index, j, k, -1, -1, len(s.request.Stacktraces)})
		}
		s.request.Stacktraces = append(s.request.Stacktraces, stacktraceJVM{
			Frames: frameJVMs,
		})
	}

	for l, thread := range threads {
		frameJVMs := []frameJVM{}
		for m, frame := range thread.Frames {
			line := frame.LineNum
			if line < 0 {
				s.lineNoLUT = append(s.lineNoLUT, lineNoEntry{index, -1, -1, l, m, frame.LineNum})
				line = 0
			}
			frameJVMs = append(frameJVMs, frameJVM{
				Index:    m,
				Function: frame.MethodName,
				Filename: frame.FileName,
				LineNo:   line,
				Module:   frame.ClassName,
			})
			s.request.AddClass(frame.ClassName)
			s.stacktraceLUT = append(s.stacktraceLUT, stacktraceEntry{index, -1, -1, l, m, len(s.request.Stacktraces)})
		}
		s.request.Stacktraces = append(s.request.Stacktraces, stacktraceJVM{
			Frames: frameJVMs,
		})
	}
}

// rewriteException partially updates the original
// events with symbolicated data.
func (js jvmSymbolicator) rewriteException(evs []event.EventField, sps []span.SpanField, lambdaWorkaround bool) {
	stacktraces := js.response.Stacktraces
	classes := js.response.Classes
	lambdaSubstr := "SyntheticLambda"

	// exception and ANR events are handled and
	// rewritten at one go. while other kinds of
	// events are iterated and rewritten separately

	for _, entry := range js.stacktraceLUT {
		i := entry[0]
		j := entry[1]
		k := entry[2]
		l := entry[3]
		m := entry[4]
		n := entry[5]
		switch evs[i].Type {
		case event.TypeException, event.TypeANR:
			var exceptions event.ExceptionUnits
			var threads event.Threads

			if evs[i].IsException() {
				exceptions = evs[i].Exception.Exceptions
				threads = evs[i].Exception.Threads

				// rewrite each exception's unit type from
				// mapped classnames
				for eIdx := range evs[i].Exception.Exceptions {
					evs[i].Exception.Exceptions[eIdx].Type = js.response.rewriteClass(evs[i].Exception.Exceptions[eIdx].Type, evs[i].Exception.Exceptions[eIdx].Type)
				}
			} else if evs[i].IsANR() {
				exceptions = evs[i].ANR.Exceptions
				threads = evs[i].ANR.Threads

				// rewrite each anr's type from
				// mapped calssnames
				for eIdx := range evs[i].ANR.Exceptions {
					evs[i].ANR.Exceptions[eIdx].Type = js.response.rewriteClass(evs[i].ANR.Exceptions[eIdx].Type, evs[i].ANR.Exceptions[eIdx].Type)
				}
			}

			if j != -1 && k != -1 {
				if len(stacktraces) > 0 && len(exceptions) > 0 {
					origClass := exceptions[j].Frames[k].ClassName

					if len(stacktraces[n].Frames) > len(exceptions[j].Frames) {
						// when count of symbolicated output frames is more
						// than count of unsymbolicated input frames, it implies
						// that symbolicator came across an inline frame and
						// unfurled it into multiple frames.
						// so, prepare new event.Frame objects with the intention
						// to capture all the output frame data.
						frames := event.Frames{}
						for _, frameJVM := range stacktraces[n].Frames {
							className := frameJVM.Module
							if lambdaWorkaround && strings.Contains(className, lambdaSubstr) {
								className = js.response.rewriteClass(origClass, className)
							}
							frame := event.Frame{
								LineNum:    frameJVM.LineNo,
								MethodName: frameJVM.Function,
								ClassName:  className,
								FileName:   frameJVM.Filename,
							}
							frames = append(frames, frame)
						}
						exceptions[j].Frames = frames
					} else {
						// no inline frames apparently, just rewrite original frame
						// object parameters with output frame object parameters.
						exceptions[j].Frames[k].MethodName = stacktraces[n].Frames[k].Function
						exceptions[j].Frames[k].FileName = stacktraces[n].Frames[k].Filename
						className := stacktraces[n].Frames[k].Module
						if lambdaWorkaround && strings.Contains(className, lambdaSubstr) {
							className = js.response.rewriteClass(origClass, className)
						}
						exceptions[j].Frames[k].ClassName = className
						exceptions[j].Frames[k].LineNum = stacktraces[n].Frames[k].LineNo
					}
				}
			}

			if l != -1 && m != -1 {
				origClass := threads[l].Frames[m].ClassName
				if len(stacktraces[n].Frames) > len(threads[l].Frames) {
					frames := event.Frames{}
					for _, frameJVM := range stacktraces[n].Frames {
						className := frameJVM.Module
						if lambdaWorkaround && strings.Contains(className, lambdaSubstr) {
							className = js.response.rewriteClass(origClass, className)
						}
						frame := event.Frame{
							LineNum:    frameJVM.LineNo,
							MethodName: frameJVM.Function,
							ClassName:  className,
							FileName:   frameJVM.Filename,
						}
						frames = append(frames, frame)
					}
					threads[l].Frames = frames
				} else {
					threads[l].Frames[m].MethodName = stacktraces[n].Frames[m].Function
					threads[l].Frames[m].FileName = stacktraces[n].Frames[m].Filename
					className := stacktraces[n].Frames[m].Module
					if lambdaWorkaround && strings.Contains(className, lambdaSubstr) {
						className = js.response.rewriteClass(origClass, className)
					}
					threads[l].Frames[m].ClassName = className
					threads[l].Frames[m].LineNum = stacktraces[n].Frames[m].LineNo
				}
			}
		}
	}

	// restore negative line numbers
	for _, entry := range js.lineNoLUT {
		n := entry[5]
		if entry[1] != -1 && entry[2] != -1 {
			i := entry[0]
			j := entry[1]
			k := entry[2]

			switch evs[i].Type {
			case event.TypeException:
				evs[i].Exception.Exceptions[j].Frames[k].LineNum = n
			case event.TypeANR:
				evs[i].ANR.Exceptions[j].Frames[k].LineNum = n
			}
			continue
		}

		if entry[3] != -1 && entry[4] != -1 {
			i := entry[0]
			l := entry[3]
			m := entry[4]

			switch evs[i].Type {
			case event.TypeException:
				evs[i].Exception.Threads[l].Frames[m].LineNum = n
			case event.TypeANR:
				evs[i].ANR.Threads[l].Frames[m].LineNum = n
			}
		}
	}

	for i := range evs {
		switch evs[i].Type {
		case event.TypeLifecycleActivity:
			if class, ok := classes[evs[i].LifecycleActivity.ClassName]; ok {
				evs[i].LifecycleActivity.ClassName = class
			}
		case event.TypeLifecycleFragment:
			if class, ok := classes[evs[i].LifecycleFragment.ClassName]; ok {
				evs[i].LifecycleFragment.ClassName = class
			}

			if class, ok := classes[evs[i].LifecycleFragment.ParentActivity]; ok {
				evs[i].LifecycleFragment.ParentActivity = class
			}

			if class, ok := classes[evs[i].LifecycleFragment.ParentFragment]; ok {
				evs[i].LifecycleFragment.ParentFragment = class
			}
		case event.TypeColdLaunch:
			if class, ok := classes[evs[i].ColdLaunch.LaunchedActivity]; ok {
				evs[i].ColdLaunch.LaunchedActivity = class
			}
		case event.TypeWarmLaunch:
			if class, ok := classes[evs[i].WarmLaunch.LaunchedActivity]; ok {
				evs[i].WarmLaunch.LaunchedActivity = class
			}
		case event.TypeHotLaunch:
			if class, ok := classes[evs[i].HotLaunch.LaunchedActivity]; ok {
				evs[i].HotLaunch.LaunchedActivity = class
			}
		case event.TypeAppExit:
			if class, ok := classes[evs[i].AppExit.Trace]; ok {
				evs[i].AppExit.Trace = class
			}
		}
	}

	// rewrite TTID spans whose names are like
	//
	// Activity TTID {class_name}
	// Fragment TTID {class_name}
	for _, i := range js.ttidSpans {
		oldClass := sps[i].GetTTIDClass()
		if oldClass == "" {
			continue
		}

		newClass := js.response.rewriteClass(oldClass, oldClass)
		sps[i].SetTTIDClass(newClass)
	}
}

// ensureRequestInitialized initializes the
// requestJVM field if it is nil.
func (js *jvmSymbolicator) ensureRequestInitialized() {
	if js.request == nil {
		js.request = NewRequestJVM()
	}
}

// makeAppleCrashReport creates an Apple crash report
// from a list of exception events.
func (as *appleSymbolicator) makeAppleCrashReport(event event.EventField) {
	var b strings.Builder

	for j, exception := range event.Exception.Exceptions {
		// write os info
		b.WriteString(fmt.Sprintf("Version: %s (%s)\n", event.Attribute.AppVersion, event.Attribute.AppBuild))

		// write cpu arch
		b.WriteString(fmt.Sprintf("Code Type: %s\n", event.Attribute.DeviceCPUArch))

		// write os version
		b.WriteString(fmt.Sprintf("OS Version: iPhone OS %s (%s)\n", event.Attribute.OSVersion, exception.OSBuildNumber))

		b.WriteString("\n")

		// write exception type
		b.WriteString(fmt.Sprintf("Exception Type: %s\n", exception.Signal))

		// write exception codes
		b.WriteString(fmt.Sprintf("Exception Codes: #%d at 0x%s\n", exception.ThreadSequence, exception.Frames[exception.ThreadSequence].SymbolAddress))

		// write crashed thread
		b.WriteString(fmt.Sprintf("Crashed Thread: %d\n", exception.ThreadSequence))

		b.WriteString("\n")

		// write top level thread name
		if j == 0 && exception.ExceptionUnitiOS.ThreadName != "" {
			b.WriteString(exception.ExceptionUnitiOS.ThreadName + ":\n")
		}

		// write crashing thread's frames
		for _, frame := range exception.Frames {
			frameLine := fmt.Sprintf("%d    %s    0x%s 0x%s + %d\n", frame.FrameIndex, frame.BinaryName, frame.SymbolAddress, frame.BinaryAddress, frame.Offset)
			b.WriteString(frameLine)
		}
	}

	// write rest of the thread's frames
	for _, thread := range event.Exception.Threads {
		b.WriteString(thread.Name + "\n")
		for i, frame := range thread.Frames {
			frameLine := fmt.Sprintf("%d    %s    0x%s 0x%s + %d\n", frame.FrameIndex, frame.BinaryName, frame.SymbolAddress, frame.BinaryAddress, frame.Offset)
			b.WriteString(frameLine)

			// append extra newline after last
			// line
			if i == len(thread.Frames)-1 {
				b.WriteString("\n")
			}
		}
	}

	// write binary images
	for j, image := range event.Exception.BinaryImages {
		if j == 0 {
			b.WriteString("Binary Images:\n")
		}

		marker := "+"

		if image.System {
			marker = "-"
		}

		b.WriteString(fmt.Sprintf("       0x%s -        0x%s %s%s %s  <%s> %s\n", image.StartAddr, image.EndAddr, marker, image.Name, image.Arch, image.Uuid, image.Path))
	}

	as.appleCrashReport = []byte(b.String())
}

// symbolicate performs symbolication for
// an apple crash report by using symbolicator
// and rewrites the event.
func (as *appleSymbolicator) symbolicate(ev event.EventField, origin string, sources []Source) (err error) {
	as.makeAppleCrashReport(ev)
	sr := &SymbolicatorRequest{}
	if err = sr.prepareAppleRequest(as, origin, sources); err != nil {
		return
	}

	var respBody []byte
	if respBody, err = sr.makeRequest(); err != nil {
		return
	}

	if err = json.Unmarshal(respBody, &as.response); err != nil {
		return
	}

	if logResponse {
		bytes, err := json.MarshalIndent(as.response, "", "  ")
		if err != nil {
			panic(err)
		}
		fmt.Println(string(bytes))
	}

	as.rewriteAppleCrashReport(ev)
	return
}

// rewriteAppleCrashReport partially updates the original
// event with symbolicated data.
func (as appleSymbolicator) rewriteAppleCrashReport(ev event.EventField) {
	for i, st := range as.response.Stacktraces {
		for _, f := range st.Frames {
			if f.Status != "symbolicated" {
				continue
			}

			ev.Exception.Exceptions[i].Frames[f.OriginalIndex].MethodName = f.Function
			ev.Exception.Exceptions[i].Frames[f.OriginalIndex].FileName = f.Filename
			ev.Exception.Exceptions[i].Frames[f.OriginalIndex].LineNum = f.LineNo
		}
	}
}

// symbolicate performs symbolication for
// native exceptions by using symbolicator
// and rewrites the events.
func (ns *nativeSymbolicator) symbolicate(events []event.EventField, origin string, sources []Source) (err error) {
	if ns.request != nil {
		sr := &SymbolicatorRequest{}
		if err = sr.prepareNativeRequest(ns, origin, sources); err != nil {
			return
		}

		var respBody []byte
		if respBody, err = sr.makeRequest(); err != nil {
			return
		}

		if err = json.Unmarshal(respBody, &ns.response); err != nil {
			return
		}

		if logResponse {
			bytes, err := json.MarshalIndent(ns.response, "", "  ")
			if err != nil {
				panic(err)
			}
			fmt.Println(string(bytes))
		}
		ns.rewriteException(events)
	}
	return
}

// parseExceptions prepares the native exception
// for symbolicator by adding the exception frames
// to the request.
func (ns *nativeSymbolicator) parseExceptions(exceptions []event.ExceptionUnit, index int) {
	for j, excep := range exceptions {
		framesNative := []frameNative{}
		for k, frame := range excep.Frames {
			framesNative = append(framesNative, frameNative{
				OriginalIndex:   k,
				InstructionAddr: frame.InstructionAddr,
			})
			ns.stacktraceLUT = append(ns.stacktraceLUT, stacktraceEntry{index, j, k, -1, -1, len(ns.request.Stacktraces)})
		}
		ns.request.Stacktraces = append(ns.request.Stacktraces, stacktraceNative{
			Frames: framesNative,
		})
	}
}

// configureModule configures the module
// required by symbolicator for native
// symbolication. This currently
// assumes symbolication of Dart
// exceptions.
func (ns *nativeSymbolicator) configureModule(mappings map[string]symbol.MappingType, baseAddr, uuid, arch string) {
	if len(mappings) > 0 {
		baseAddr := "0x" + baseAddr

		for _, mType := range mappings {
			switch mType {
			case symbol.TypeDsym:
				ns.request.AddMachOModule(uuid, arch, baseAddr)
			case symbol.TypeElfDebug:
				ns.request.AddElfModule(uuid, arch, baseAddr)
			}
		}
	}
}

// rewriteException partially updates the original
// events with symbolicated data.
func (ns nativeSymbolicator) rewriteException(evs []event.EventField) {
	stacktraces := ns.response.Stacktraces

	for _, entry := range ns.stacktraceLUT {
		i := entry[0]
		j := entry[1]
		k := entry[2]
		n := entry[5]

		exceptions := evs[i].Exception.Exceptions

		if j != -1 && k != -1 {
			if len(stacktraces) > 0 && len(exceptions) > 0 {
				if len(stacktraces[n].Frames) > len(exceptions[j].Frames) {
					// when count of symbolicated output frames is more
					// than count of unsymbolicated input frames, it implies
					// that symbolicator came across an inline frame and
					// unfurled it into multiple frames.
					// so, prepare new event.Frame objects with the intention
					// to capture all the output frame data.
					frames := event.Frames{}
					for _, frameNative := range stacktraces[n].Frames {
						moduleName := extractDirectoryPath(frameNative.AbsPath)
						functionName := formatFunctionName(frameNative.Function)
						frame := event.Frame{
							LineNum:         frameNative.LineNo,
							MethodName:      functionName,
							FileName:        frameNative.Filename,
							InstructionAddr: frameNative.InstructionAddr,
							ModuleName:      moduleName,
						}
						frames = append(frames, frame)
					}
					exceptions[j].Frames = frames
				} else {
					moduleName := extractDirectoryPath(stacktraces[n].Frames[k].AbsPath)
					functionName := formatFunctionName(stacktraces[n].Frames[k].Function)
					// no inline frames apparently, just rewrite original frame
					// object parameters with output frame object parameters.
					exceptions[j].Frames[k].MethodName = functionName
					exceptions[j].Frames[k].FileName = stacktraces[n].Frames[k].Filename
					exceptions[j].Frames[k].LineNum = stacktraces[n].Frames[k].LineNo
					exceptions[j].Frames[k].InstructionAddr = stacktraces[n].Frames[k].InstructionAddr
					exceptions[j].Frames[k].ModuleName = moduleName
				}
			}
		}
	}
}

// ensureRequestInitialized initializes the
// requestJVM field if it is nil.
func (ns *nativeSymbolicator) ensureRequestInitialized() {
	if ns.request == nil {
		ns.request = NewRequestNative()
	}
}

// extractDirectoryPath removes the
// filename part from the absolute path
// of the Dart stacktrace.
func extractDirectoryPath(filePath string) string {
	// This regex matches everything
	// up to the last slash followed
	// by anything that doesn't contain
	// a slash.
	regex := regexp.MustCompile(`(.*/)([^/]+)$`)
	matches := regex.FindStringSubmatch(filePath)

	if len(matches) >= 2 {
		// The first capturing group
		//  contains the directory path
		return matches[1]
	}

	// If there's no match, return
	// the original string
	return filePath
}

// formatFunctionName removes the suffixed contents
// in rounded brackets for Dart. For example,
// from "MainScreen._trackError (#2)" this will
// extract "MainScreen._trackError".
func formatFunctionName(input string) string {
	re := regexp.MustCompile(`^([^(]*)`)
	match := re.FindStringSubmatch(input)
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return input
}
