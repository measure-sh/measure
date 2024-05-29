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

func (f Frame) String() string {
	className := f.ClassName
	methodName := f.MethodName
	fileName := f.FileName
	var lineNum = ""

	if f.LineNum != 0 {
		lineNum = strconv.Itoa(f.LineNum)
	}

	codeInfo := text.JoinNonEmptyStrings(".", className, methodName)
	fileInfo := text.JoinNonEmptyStrings(":", fileName, lineNum)

	if fileInfo != "" {
		fileInfo = fmt.Sprintf(`(%s)`, fileInfo)
	}

	return fmt.Sprintf(`%s%s`, codeInfo, fileInfo)
}
