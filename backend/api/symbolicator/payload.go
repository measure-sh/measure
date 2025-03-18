package symbolicator

import (
	"slices"
)

type frameNative struct {
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

type stacktraceNative struct {
	ThreadId     int           `json:"thread_id"`
	IsRequesting bool          `json:"is_requesting"`
	Frames       []frameNative `json:"frames"`
}

type moduleNative struct {
	DebugStatus string `json:"debug_status"`
	DebugId     string `json:"debug_id"`
}

type responseNative struct {
	Status      string             `json:"status"`
	Stacktraces []stacktraceNative `json:"stacktraces"`
	Modules     []moduleNative     `json:"modules"`
}

type exceptionJVM struct {
	Type   string `json:"type"`
	Module string `json:"module"`
}

type frameJVM struct {
	Function string `json:"function"`
	Filename string `json:"filename"`
	Module   string `json:"module"`
	AbsPath  string `json:"abs_path"`
	LineNo   int    `json:"lineno"`
	InApp    bool   `json:"in_app"`
	Index    int    `json:"index"`
}

type stacktraceJVM struct {
	Frames []frameJVM `json:"frames"`
}

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
