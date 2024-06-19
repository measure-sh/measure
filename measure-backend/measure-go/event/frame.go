package event

import (
	"fmt"
	"measure-backend/measure-go/text"
	"strconv"
)

// FramePrefix is the prefix string that
// appears in Android stacktrace frames.
const FramePrefix = "\tat "

// GenericPrefix is the prefix string
// that appears in Android stacktraces.
const GenericPrefix = ": "

type Frame struct {
	LineNum    int    `json:"line_num"`
	ColNum     int    `json:"col_num"`
	ModuleName string `json:"module_name"`
	FileName   string `json:"file_name"`
	ClassName  string `json:"class_name"`
	MethodName string `json:"method_name"`
}

type Frames []Frame

// CodeInfo provides a serialized
// version of the frame's code information.
func (f Frame) CodeInfo() string {
	className := f.ClassName
	methodName := f.MethodName

	return text.JoinNonEmptyStrings(".", className, methodName)
}

// FileInfo provides a serialized
// version of the frame's file information.
func (f Frame) FileInfo() string {
	fileName := f.FileName
	lineNum := ""

	if f.LineNum != 0 {
		lineNum = strconv.Itoa(f.LineNum)
	}

	return text.JoinNonEmptyStrings(":", fileName, lineNum)
}

// String provides a serialized
// version of the frame.
func (f Frame) String() string {
	codeInfo := f.CodeInfo()
	fileInfo := f.FileInfo()

	if fileInfo != "" {
		fileInfo = fmt.Sprintf(`(%s)`, fileInfo)
	}

	return fmt.Sprintf(`%s%s`, codeInfo, fileInfo)
}
