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
	Frames []frameJVM `json:"frames"`
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
	Sources []Source `json:"sources"`
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
