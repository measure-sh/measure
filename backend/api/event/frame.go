package event

import (
	"backend/api/text"
	"fmt"
	"strconv"
)

// FramePrefix is the prefix string that
// appears in Android stacktrace frames.
const FramePrefix = "\tat "

// GenericPrefix is the prefix string
// that appears in Android stacktraces.
const GenericPrefix = ": "

type FrameiOS struct {
	// FrameIndex is the sequence of the frame.
	FrameIndex int `json:"frame_index"`
	// BinaryName is the name of the iOS binary image.
	BinaryName string `json:"binary_name"`
	// BinaryAddress is the binary load address.
	BinaryAddress string `json:"binary_address"`
	// SymbolAddress is the address to symbolicate.
	SymbolAddress string `json:"symbol_address"`
	// Offset is the byte offset.
	Offset int `json:"offset"`
}

type Frame struct {
	// LineNum is the line number of the method.
	LineNum int `json:"line_num"`
	// ColNum is the column number of the method.
	ColNum int `json:"col_num"`
	// ModuleName is the name of the originating module.
	ModuleName string `json:"module_name"`
	// FileName is the name of the originating file.
	FileName string `json:"file_name"`
	// ClassName is the name of the originating class.
	ClassName string `json:"class_name"`
	// MethodName is the name of the originating method.
	MethodName string `json:"method_name"`
	// InApp is `true` if the frame originates
	// from the app module.
	InApp bool `json:"in_app"`
	// InstructionAddr is the instruction address
	// of the frame.
	InstructionAddr string `json:"instruction_address"`
	*FrameiOS
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
// version of the frame based on
// the given framework.
func (f Frame) String(frmwrk string) string {
	switch frmwrk {
	default:
		codeInfo := f.CodeInfo()
		fileInfo := f.FileInfo()

		if fileInfo != "" {
			fileInfo = fmt.Sprintf(`(%s)`, fileInfo)
		}

		return fmt.Sprintf(`%s%s`, codeInfo, fileInfo)
	case FrameworkApple:
		binaryName := f.BinaryName
		methodName := f.MethodName
		className := f.ClassName
		fileInfo := f.FileInfo()
		sep := "\t"

		// if method & class is empty
		// replace with symbol address
		// and binary address to show
		// unsymbolicated details
		{
			if methodName == "" {
				methodName = f.SymbolAddress
			}

			if className == "" {
				className = f.BinaryAddress
			}
		}

		if fileInfo == "" {
			fileInfo = fmt.Sprintf("+ %d", f.Offset)
			sep = " "
		}

		return fmt.Sprintf("%d\t%s\t\t\t\t%s\t%s%s%s", f.FrameIndex, binaryName, methodName, className, sep, fileInfo)
	}
}
