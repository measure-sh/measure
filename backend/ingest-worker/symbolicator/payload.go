package symbolicator

import (
	"slices"
)

// frameNative represents a native frame
// for native symbolication, used for
// Dart.
type frameNative struct {
	Status          string `json:"status"`
	OriginalIndex   int    `json:"original_index"`
	InstructionAddr string `json:"instruction_addr"`
	Symbol          string `json:"symbol"`
	Package         string `json:"package"`
	Function        string `json:"function"`
	Filename        string `json:"filename"`
	AbsPath         string `json:"abs_path"`
	LineNo          int    `json:"lineno"`
}

// stacktraceNative represents a stacktrace
// for native symbolication, used for Dart.
type stacktraceNative struct {
	ThreadId     int           `json:"thread_id"`
	IsRequesting bool          `json:"is_requesting"`
	Frames       []frameNative `json:"frames"`
}

// moduleNative represents a module
// for native symbolication, used for
// Dart.
type moduleNative struct {
	DebugStatus string `json:"debug_status"`
	DebugId     string `json:"debug_id"`
	CodeId      string `json:"code_id"`
	Arch        string `json:"arch"`
	ImageAddr   string `json:"image_addr"`
	Type        string `json:"type"`
}

// responseNative represents the payload received
// from Sentry's Symbolicator for native
// symbolication, used for Dart.
type responseNative struct {
	Status      string             `json:"status"`
	Stacktraces []stacktraceNative `json:"stacktraces"`
	Modules     []moduleNative     `json:"modules"`
}

// frameApple represents a native frame
// for native symbolication, used for
// iOS.
type frameApple struct {
	Status          string `json:"status"`
	OriginalIndex   int    `json:"original_index"`
	InstructionAddr string `json:"instruction_addr"`
	Package         string `json:"package"`
	Lang            string `json:"lang"`
	Symbol          string `json:"symbol"`
	SymAddr         string `json:"sym_addr"`
	Function        string `json:"function"`
	Filename        string `json:"filename"`
	AbsPath         string `json:"abs_path"`
	LineNo          int    `json:"lineno"`
}

// stacktraceApple represents a stacktrace
// for native symbolication, used for iOS.
type stacktraceApple struct {
	ThreadId     int          `json:"thread_id"`
	IsRequesting bool         `json:"is_requesting"`
	Frames       []frameApple `json:"frames"`
}

// moduleApple represents a module
// for native symbolication, used for
// iOS.
type moduleApple struct {
	DebugStatus string `json:"debug_status"`
	DebugId     string `json:"debug_id"`
}

// responseApple represents the payload received
// from Sentry's Symbolicator for native
// symbolication, used for iOS.
type responseApple struct {
	Status      string            `json:"status"`
	Stacktraces []stacktraceApple `json:"stacktraces"`
	Modules     []moduleApple     `json:"modules"`
}

// exceptionJVM represents an exception
// for JVM symbolication.
type exceptionJVM struct {
	Type   string `json:"type"`
	Module string `json:"module"`
}

// frameJVM represents a frame
// for JVM symbolication.
type frameJVM struct {
	Function string `json:"function"`
	Filename string `json:"filename"`
	Module   string `json:"module"`
	AbsPath  string `json:"abs_path"`
	LineNo   int    `json:"lineno"`
	InApp    bool   `json:"in_app"`
	Index    int    `json:"index"`
}

// stacktraceJVM represents a stacktrace
// for JVM symbolication.
type stacktraceJVM struct {
	Exception *exceptionJVM `json:"exception,omitempty"`
	Frames    []frameJVM    `json:"frames"`
}

// moduleJVM represents a module
// for JVM symbolication.
type moduleJVM struct {
	UUID string `json:"uuid"`
	Type string `json:"type"`
}

// responseJVM represents the payload received
// from Sentry's Symbolicator for JVM
// symbolication.
type responseJVM struct {
	Status      string            `json:"status"`
	Exceptions  []exceptionJVM    `json:"exceptions"`
	Stacktraces []stacktraceJVM   `json:"stacktraces"`
	Classes     map[string]string `json:"classes"`
	Errors      []moduleJVM       `json:"errors"`
}

// rewriteClass is a helper method to provide a mapped
// class if found or return the fallback.
func (r responseJVM) rewriteClass(needle, fallback string) string {
	if value, ok := r.Classes[needle]; ok {
		return value
	}

	return fallback
}

// requestJVM represents the payload sent
// to Sentry's Symbolicator for JVM
// symbolication.
type requestJVM struct {
	// Platform defines the platform which
	// should be 'java'.
	Platform string `json:"platform"`
	// Sources is the lists of symbol Sources
	// as defined by Sentry Symbolicator.
	// https://getsentry.github.io/symbolicator/api/
	Sources []SentrySource `json:"sources"`
	// Classes form a list of all classes that
	// needs symbolication.
	Classes []string `json:"classes"`
	// Exceptions form a list of all classes that
	// needs symbolication.
	Exceptions []exceptionJVM `json:"exceptions"`
	// Stacktraces form a list of all frames
	// of a thread that needs symbolication.
	Stacktraces []stacktraceJVM `json:"stacktraces"`
	// Modules form a list of Debug Information
	// Files and their types.
	Modules []moduleJVM `json:"modules"`
}

// requestNative represents the payload sent
// to Sentry's Symbolicator for native
// symbolication.
type requestNative struct {
	// Platform defines the platform which
	// should be 'native'.
	Platform string `json:"platform"`
	// Sources is the lists of symbol Sources
	// as defined by Sentry Symbolicator.
	// https://getsentry.github.io/symbolicator/api/
	Sources []Source `json:"sources"`
	// Classes form a list of all classes that
	// needs symbolication.
	Stacktraces []stacktraceNative `json:"stacktraces"`
	// Modules form a list of Debug Information
	// Files and their types.
	Modules []moduleNative `json:"modules"`
}

// AddModule adds a module to the JVM request
// payload only if not already present.
func (r *requestJVM) AddModule(debugId string, mType string) {
	for _, m := range r.Modules {
		if m.UUID == debugId && m.Type == mType {
			return
		}
	}

	r.Modules = append(r.Modules, moduleJVM{
		UUID: debugId,
		Type: mType,
	})
}

// AddClass adds a class to the JVM request
// payload only if not already present.
func (r *requestJVM) AddClass(className string) {
	if slices.Contains(r.Classes, className) {
		return
	}

	r.Classes = append(r.Classes, className)
}

// AddException adds an exception to the JVM
// request payload only if not already present.
func (r *requestJVM) AddException(exceptionType, module string) {
	for _, e := range r.Exceptions {
		if e.Type == exceptionType && e.Module == module {
			return
		}
	}

	r.Exceptions = append(r.Exceptions, exceptionJVM{
		Type:   exceptionType,
		Module: module,
	})
}

// NewRequestJVM creates a new request payload
// for symbolicating Android events.
func NewRequestJVM() *requestJVM {
	return &requestJVM{
		Platform:    "java",
		Classes:     []string{},
		Exceptions:  []exceptionJVM{},
		Stacktraces: []stacktraceJVM{},
		Modules:     []moduleJVM{},
	}
}

// AddModule adds a module to the JVM request
// payload only if not already present.
func (r *requestNative) AddMachOModule(codeId string, arch string, imageAddr string) {
	for _, m := range r.Modules {
		if m.CodeId == codeId {
			return
		}
	}

	r.Modules = append(r.Modules, moduleNative{
		CodeId:    codeId,
		Type:      "macho",
		Arch:      arch,
		ImageAddr: imageAddr,
	})
}

// AddModule adds a module to the JVM request
// payload only if not already present.
func (r *requestNative) AddElfModule(codeId string, arch string, imageAddr string) {
	for _, m := range r.Modules {
		if m.CodeId == codeId {
			return
		}
	}

	r.Modules = append(r.Modules, moduleNative{
		CodeId:    codeId,
		Type:      "elf",
		Arch:      arch,
		ImageAddr: imageAddr,
	})
}

// NewRequestNative creates a new response payload
// for symbolicating native events.
func NewRequestNative() *requestNative {
	return &requestNative{
		Platform:    "native",
		Stacktraces: []stacktraceNative{},
		Modules:     []moduleNative{},
	}
}

// frameJS represents a frame for JavaScript
// symbolication, used for React Native.
//
// The same struct is used for both the outbound request
// and the inbound response. On input, Symbolicator ignores
// `filename` — only `abs_path` drives lookup. On output,
// Symbolicator populates `filename` from the resolved
// sourcemap token. Hence the `omitempty` tag — we do not
// send it on input, but we read it on output.
type frameJS struct {
	Function string `json:"function"`
	Filename string `json:"filename,omitempty"`
	AbsPath  string `json:"abs_path"`
	LineNo   int    `json:"lineno"`
	ColumnNo int    `json:"colno"`
}

// stacktraceJS represents a stacktrace
// for JavaScript symbolication.
type stacktraceJS struct {
	Frames []frameJS `json:"frames"`
}

// moduleJS binds a frame's abs_path to a debug id so
// Symbolicator can resolve the sourcemap by debug id
// instead of relying on URL-based lookup.
type moduleJS struct {
	Type     string `json:"type"`
	CodeFile string `json:"code_file"`
	DebugID  string `json:"debug_id"`
}

// requestJS represents the payload sent
// to Sentry's Symbolicator for JavaScript
// symbolication, used for React Native.
type requestJS struct {
	// Platform defines the platform, must be "node".
	Platform string `json:"platform"`
	// Source is the single Sentry-typed source pointing at
	// Measure's /symbols/js endpoint. /symbolicate-js accepts
	// a singular source field, not an array.
	Source SentrySource `json:"source"`
	// Stacktraces form a list of all frames
	// that need symbolication.
	Stacktraces []stacktraceJS `json:"stacktraces"`
	// Modules binds frame abs_paths to debug ids. Empty
	// slice is valid; without entries, Symbolicator falls
	// back to URL-based lookup (gated on Release also being
	// non-empty).
	Modules []moduleJS `json:"modules"`
	// Release is required for Symbolicator's URL-fallback
	// path: without it, Symbolicator short-circuits and never
	// queries the /symbols/js endpoint with `?url=` params
	// (see crates/symbolicator-js/src/lookup.rs query gating).
	// Measure has no native release concept; we synthesize a
	// stable value from version_name + version_code so the
	// gate opens. The /symbols/js endpoint ignores the value
	// itself — scoping is done via app_id + version query
	// params on the source URL.
	Release string `json:"release,omitempty"`
}

// AddModule binds a frame's abs_path (code_file) to a debug id
// so Symbolicator resolves the sourcemap by debug id (the OTA
// patch_id path on /symbols/js). Duplicate code_files are
// ignored — all frames of one OTA build share a single debug id.
func (r *requestJS) AddModule(codeFile, debugID string) {
	for _, m := range r.Modules {
		if m.CodeFile == codeFile {
			return
		}
	}
	r.Modules = append(r.Modules, moduleJS{
		Type:     "sourcemap",
		CodeFile: codeFile,
		DebugID:  debugID,
	})
}

// responseJS represents the payload received
// from Sentry's Symbolicator for JavaScript
// symbolication.
type responseJS struct {
	Status      string         `json:"status"`
	Stacktraces []stacktraceJS `json:"stacktraces"`
}

// NewRequestJS creates a new request payload
// for symbolicating JavaScript/React Native events.
func NewRequestJS() *requestJS {
	return &requestJS{
		Platform:    "node",
		Stacktraces: []stacktraceJS{},
		Modules:     []moduleJS{},
	}
}
