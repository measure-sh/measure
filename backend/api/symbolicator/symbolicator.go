package symbolicator

import (
	"backend/api/cache"
	"backend/api/chrono"
	"backend/api/event"
	"backend/api/platform"
	"backend/api/symbol"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// maxRetryCount defines the maximum
// number of times a failed symbolicator
// request will be retried.
const maxRetryCount = 5

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

// defaultRetryDuration is the default duration
// between each retry of symbolicator requests.
var defaultRetryDuration = time.Second * 10

var ErrRequestFailed = errors.New("symbolicator received non-200 status")
var ErrRetryExhausted = errors.New("symbolicator retry exhaustion")
var ErrJVMSymbolicationFailure = errors.New("symbolicator received JVM errors")
var ErrNativeSymbolicationFailure = errors.New("symbolicator received native errors")

// httpClient is a custom http client
// with modified timeout values to
// support higher throughput.
var httpClient = &http.Client{
	Timeout: 30 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
	},
}

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

// Symbolicator contains everything required
// to perform de-obfuscation of data in various
// events.
type Symbolicator struct {
	// Origin is the http origin of the
	// symbolicator service.
	Origin string
	// Platform represents the app's
	// platform.
	Platform string
	// Sources is a list of symbol sources
	// the symbolicator is requested to use.
	Sources []Source
	// appleCrashReport contains smaller
	// subset of an Apple app's crash report.
	// This report is created on-the-fly from
	// the exception event.
	appleCrashReport []byte
	// req contains the http request that is
	// sent to symbolicator service.
	req *http.Request
	// res contains the http response returned
	// from the symbolicator service.
	res []byte
	// retryCount counts the number of times
	// a symbolicator request has been retried.
	retryCount int
	// lineNoLUT is a look up table for storing
	// & restoring negative line numbers in JVM
	// stacktraces before & after symbolication.
	lineNoLUT []lineNoEntry
	// stacktraceLUT is a look up table for storing
	// & restoring JVM stacktrace frames before &
	// after symbolication.
	stacktraceLUT []stacktraceEntry
	// requestJVM contains the payload for JVM
	// symbolicator request.
	requestJVM *requestJVM
	// responseJVM contains the payload for JVM
	// symbolicator response.
	responseJVM *responseJVM
	// responseNative contains the payload for native
	// symbolicator response. Currently, used by
	// Apple platform apps.
	responseNative *responseNative
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

// New creates a new Symbolicator.
func New(origin, platform string, sources []Source) (symbolicator *Symbolicator) {
	symbolicator = &Symbolicator{
		Origin:   origin,
		Platform: platform,
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

	return
}

// Symbolicate performs symbolication by retrieving
// appropriate mapping file and managing symbolicator
// request to response cycle.
func (s *Symbolicator) Symbolicate(ctx context.Context, conn *pgxpool.Pool, appId uuid.UUID, events []event.EventField) (err error) {
	switch s.Platform {
	case platform.Android:
		if s.requestJVM == nil {
			s.requestJVM = NewRequestJVM()
		}
		for i, ev := range events {
			if ev.Attribute.Platform != platform.Android {
				continue
			}
			if !ev.NeedsSymbolication() {
				continue
			}
			name := ev.Attribute.AppVersion
			code := ev.Attribute.AppBuild
			mType := symbol.TypeProguard
			cacheKey := fmt.Sprintf("%s/%s/%s/%s", appId.String(), name, code, mType.String())

			value, ok := lru.Get(cacheKey)
			if !ok {
				key, err := symbol.GetMappingKey(ctx, conn, appId, name, code, mType)
				if errors.Is(err, pgx.ErrNoRows) {
					fmt.Printf("failed to find mapping key for appId: %q, name: %q, code: %q, mapping type: %q\n", appId, name, code, mType)
					continue
				}
				if err != nil {
					fmt.Printf("failed to find mapping key for appId: %q, name: %q, code: %q, mapping type: %q : %v\n", appId, name, code, mType, err.Error())
					continue
				}

				value = symbol.MappingKeyToDebugId(key)

				lru.Put(cacheKey, value)
			}

			debugId, ok := value.(string)
			if !ok {
				fmt.Printf("failed to acquire mapping key debugId for appId: %q, name: %q, code: %q, mapping type: %q\n", appId, name, code, mType)
				continue
			}

			switch ev.Type {
			case event.TypeException, event.TypeANR:
				exceptions := []event.ExceptionUnit{}
				threads := []event.Thread{}

				if ev.IsException() {
					exceptions = ev.Exception.Exceptions
					threads = ev.Exception.Threads
				}
				if ev.IsANR() {
					exceptions = ev.ANR.Exceptions
					threads = ev.ANR.Threads
				}

				for j, excep := range exceptions {
					s.requestJVM.Exceptions = append(s.requestJVM.Exceptions, exceptionJVM{
						Type: excep.Type,
					})

					// symbolicate each exception unit's type
					// by matching classes
					s.requestJVM.AddClass(excep.Type)

					frameJVMs := []frameJVM{}
					for k, frame := range excep.Frames {
						line := frame.LineNum
						if line < 0 {
							s.lineNoLUT = append(s.lineNoLUT, lineNoEntry{i, j, k, -1, -1, frame.LineNum})
							line = 0
						}
						frameJVMs = append(frameJVMs, frameJVM{
							Index:    k,
							Function: frame.MethodName,
							Filename: frame.FileName,
							LineNo:   line,
							Module:   frame.ClassName,
						})
						s.requestJVM.AddClass(frame.ClassName)
						s.stacktraceLUT = append(s.stacktraceLUT, stacktraceEntry{i, j, k, -1, -1, len(s.requestJVM.Stacktraces)})
					}
					s.requestJVM.Stacktraces = append(s.requestJVM.Stacktraces, stacktraceJVM{
						Frames: frameJVMs,
					})
				}

				for l, thread := range threads {
					frameJVMs := []frameJVM{}
					for m, frame := range thread.Frames {
						line := frame.LineNum
						if line < 0 {
							s.lineNoLUT = append(s.lineNoLUT, lineNoEntry{i, -1, -1, l, m, frame.LineNum})
							line = 0
						}
						frameJVMs = append(frameJVMs, frameJVM{
							Index:    m,
							Function: frame.MethodName,
							Filename: frame.FileName,
							LineNo:   line,
							Module:   frame.ClassName,
						})
						s.requestJVM.AddClass(frame.ClassName)
						s.stacktraceLUT = append(s.stacktraceLUT, stacktraceEntry{i, -1, -1, l, m, len(s.requestJVM.Stacktraces)})
					}
					s.requestJVM.Stacktraces = append(s.requestJVM.Stacktraces, stacktraceJVM{
						Frames: frameJVMs,
					})
				}
			case event.TypeLifecycleActivity:
				s.requestJVM.AddClass(ev.LifecycleActivity.ClassName)
			case event.TypeLifecycleFragment:
				s.requestJVM.AddClass(ev.LifecycleFragment.ClassName)
				s.requestJVM.AddClass(ev.LifecycleFragment.ParentActivity)
				s.requestJVM.AddClass(ev.LifecycleFragment.ParentFragment)
			case event.TypeColdLaunch:
				s.requestJVM.AddClass(ev.ColdLaunch.LaunchedActivity)
			case event.TypeWarmLaunch:
				s.requestJVM.AddClass(ev.WarmLaunch.LaunchedActivity)
			case event.TypeHotLaunch:
				s.requestJVM.AddClass(ev.HotLaunch.LaunchedActivity)
			case event.TypeAppExit:
				s.requestJVM.AddClass(ev.AppExit.Trace)
			}

			s.requestJVM.AddModule(debugId, symbol.TypeProguard.String())
		}

		if err = s.makeRequest(); err != nil {
			return
		}

		if logResponse {
			s.logResponse()
		}

		s.rewriteN(events)
		s.reset()
	case platform.IOS:
		for _, ev := range events {
			if ev.Attribute.Platform != platform.IOS {
				continue
			}

			if !ev.IsException() {
				continue
			}

			if !ev.NeedsSymbolication() {
				continue
			}

			s.appleCrashReport = makeAppleCrashReport(ev)

			if logRequest {
				fmt.Printf("apple crash report request\n%s\n", string(s.appleCrashReport))
			}

			if err = s.makeRequest(); err != nil {
				return
			}

			if logResponse {
				s.logResponse()
			}

			s.rewrite(ev)
			s.reset()
		}
	}

	return
}

// makeRequest creates a symbolicator request
// appropriate to the platform.
func (s *Symbolicator) makeRequest() (err error) {
	var reqBody bytes.Buffer
	var sources []byte
	if len(s.Sources) > 0 {
		sources, err = json.Marshal(s.Sources)
		if err != nil {
			return
		}
	}

	url := s.Origin

	switch s.Platform {
	case platform.Android:
		url += "/symbolicate-jvm"
		s.requestJVM.Sources = s.Sources

		reqBytes, errJSON := json.Marshal(s.requestJVM)
		if errJSON != nil {
			return errJSON
		}
		if _, err = reqBody.Write(reqBytes); err != nil {
			return
		}

		if logRequest {
			var dst bytes.Buffer
			if err = json.Indent(&dst, reqBytes, "", "  "); err != nil {
				return
			}
			fmt.Printf("jvm symbolicator request\n%s\n", dst.String())
		}

		s.req, err = http.NewRequest("POST", url, &reqBody)
		if err != nil {
			return
		}
		s.req.Header.Set("Content-Type", "application/json")
	case platform.IOS:
		writer := multipart.NewWriter(&reqBody)
		crashReport := s.appleCrashReport
		url += "/applecrashreport"

		// if there are sources, add the "sources"
		// form field
		if len(sources) > 0 {
			jsonHeader := make(textproto.MIMEHeader)
			jsonHeader.Set("Content-Disposition", `form-data; name="sources"`)
			jsonHeader.Set("Content-Type", "application/json")

			jsonPart, errSources := writer.CreatePart(jsonHeader)
			if errSources != nil {
				return errSources
			}

			_, err = jsonPart.Write(sources)
			if err != nil {
				return
			}
		}

		header := make(textproto.MIMEHeader)
		header.Set("Content-Disposition", `form-data; name="apple_crash_report"; filename="crash-report.txt"`)
		header.Set("Content-Type", "text/plain")

		fileWriter, errReport := writer.CreatePart(header)
		if errReport != nil {
			return errReport
		}

		if _, err = io.Copy(fileWriter, bytes.NewBuffer(crashReport)); err != nil {
			return
		}

		if err = writer.Close(); err != nil {
			return
		}

		s.req, err = http.NewRequest("POST", url, &reqBody)
		if err != nil {
			return
		}

		s.req.Header.Set("Content-Type", writer.FormDataContentType())
	}

	res, err := httpClient.Do(s.req)
	if err != nil {
		fmt.Println("failed sending symbolicator request:", err)
		return
	}

	if logResponse {
		fmt.Println("symbolicator response status code:", res.StatusCode)
	}

	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusNotFound,
		http.StatusInternalServerError,
		http.StatusServiceUnavailable,
		http.StatusBadGateway,
		http.StatusTooManyRequests:
		// retry after few seconds
		return s.retry(defaultRetryDuration)
	}

	if res.StatusCode != http.StatusOK {
		err = ErrRequestFailed
		// try parsing the error response
		// body, ignoring any parsing errors
		errBody, errParse := io.ReadAll(res.Body)
		if errParse == nil {
			fmt.Println("symbolicator error response body:", string(errBody))
		}
		return
	}

	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return
	}

	switch s.Platform {
	case platform.Android:
		if err = json.Unmarshal(respBody, &s.responseJVM); err != nil {
			return
		}

		if len(s.responseJVM.Errors) > 0 {
			err = ErrJVMSymbolicationFailure
			return
		}
	case platform.IOS:
		if err = json.Unmarshal(respBody, &s.responseNative); err != nil {
			return
		}

		if s.responseNative.Status != "completed" {
			return s.retry(defaultRetryDuration)
		}
	}

	return
}

// logResponse logs the symbolicator request's
// response body.
func (s Symbolicator) logResponse() {
	var bytes []byte
	var err error
	switch s.Platform {
	case platform.Android:
		bytes, err = json.MarshalIndent(s.responseJVM, "", "  ")
		if err != nil {
			panic(err)
		}
	case platform.IOS:
		bytes, err = json.MarshalIndent(s.responseNative, "", "  ")
		if err != nil {
			panic(err)
		}
	}

	fmt.Println("symbolicator response")
	fmt.Println(string(bytes))
}

// rewrite partially updates the original
// event with symbolicated data.
func (s Symbolicator) rewrite(ev event.EventField) {
	switch s.Platform {
	case platform.IOS:
		for i, st := range s.responseNative.Stacktraces {
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
}

// rewriteN partially updates the original
// events with symbolicated data.
func (s Symbolicator) rewriteN(evs []event.EventField) {
	switch s.Platform {
	case platform.Android:
		stacktraces := s.responseJVM.Stacktraces
		classes := s.responseJVM.Classes
		lambdaSubstr := "SyntheticLambda"

		// exception and ANR events are handled and
		// rewritten at one go. while other kinds of
		// events are iterated and rewritten separately

		for _, entry := range s.stacktraceLUT {
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
						evs[i].Exception.Exceptions[eIdx].Type = s.responseJVM.rewriteClass(evs[i].Exception.Exceptions[eIdx].Type, evs[i].Exception.Exceptions[eIdx].Type)
					}
				} else if evs[i].IsANR() {
					exceptions = evs[i].ANR.Exceptions
					threads = evs[i].ANR.Threads

					// rewrite each anr's type from
					// mapped calssnames
					for eIdx := range evs[i].ANR.Exceptions {
						evs[i].ANR.Exceptions[eIdx].Type = s.responseJVM.rewriteClass(evs[i].ANR.Exceptions[eIdx].Type, evs[i].ANR.Exceptions[eIdx].Type)
					}
				}

				if j != -1 && k != -1 {
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
							if s.jvmLambdaWorkaround && strings.Contains(className, lambdaSubstr) {
								className = s.responseJVM.rewriteClass(origClass, className)
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
						if s.jvmLambdaWorkaround && strings.Contains(className, lambdaSubstr) {
							className = s.responseJVM.rewriteClass(origClass, className)
						}
						exceptions[j].Frames[k].ClassName = className
						exceptions[j].Frames[k].LineNum = stacktraces[n].Frames[k].LineNo
					}
				}

				if l != -1 && m != -1 {
					origClass := threads[l].Frames[m].ClassName
					if len(stacktraces[n].Frames) > len(threads[l].Frames) {
						frames := event.Frames{}
						for _, frameJVM := range stacktraces[n].Frames {
							className := frameJVM.Module
							if s.jvmLambdaWorkaround && strings.Contains(className, lambdaSubstr) {
								className = s.responseJVM.rewriteClass(origClass, className)
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
						if s.jvmLambdaWorkaround && strings.Contains(className, lambdaSubstr) {
							className = s.responseJVM.rewriteClass(origClass, className)
						}
						threads[l].Frames[m].ClassName = className
						threads[l].Frames[m].LineNum = stacktraces[n].Frames[m].LineNo
					}
				}
			}
		}

		// restore negative line numbers
		for _, entry := range s.lineNoLUT {
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
			}
		}
	}
}

// reset clears out the symbolicator
// and prepares it for reuse.
func (s *Symbolicator) reset() {
	s.appleCrashReport = []byte{}
	s.req = nil
	s.res = []byte{}
	s.retryCount = 0
	s.lineNoLUT = []lineNoEntry{}
	s.stacktraceLUT = []stacktraceEntry{}
	s.requestJVM = nil
	s.responseJVM = nil
	s.responseNative = nil
}

// retry retries a failed symbolicator request
// with a randomly added duration jitter to avoid
// thundering-herd like problems.
func (s *Symbolicator) retry(d time.Duration) error {
	if s.retryCount >= maxRetryCount {
		return ErrRetryExhausted
	}

	dur := defaultRetryDuration
	if d.Seconds() > 0 {
		dur = d
	}

	s.retryCount += 1
	fmt.Printf("retrying symbolicator request for %d time(s) in about %v\n", s.retryCount, dur)
	chrono.JitterySleep(dur)

	return s.makeRequest()
}

// makeAppleCrashReport creates an Apple crash report
// from a list of exception events.
func makeAppleCrashReport(event event.EventField) (report []byte) {
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

	report = []byte(b.String())

	return
}
