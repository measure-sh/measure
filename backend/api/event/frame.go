package event

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"backend/libs/text"
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

		// fallbacks for unsymbolicated frames
		if methodName == "" {
			methodName = f.SymbolAddress
		}

		if className == "" {
			className = f.BinaryAddress
		}

		// graceful handling for completely unsymbolicated
		// frames
		if binaryName == "" {
			binaryName = "???"
		}

		// normalize address to 0x prefix
		addr := normalizeAddress(className)

		// build the tail
		var tail string
		if fileInfo != "" {
			tail = fmt.Sprintf("   (%s)", fileInfo)
		} else {
			tail = fmt.Sprintf(" + %d", f.Offset)
		}

		// long symbol handling
		const maxSymbolLen = 55
		displayMethod := methodName
		extraLine := ""
		if len(methodName) > maxSymbolLen {
			displayMethod = methodName[:maxSymbolLen-3] + "..."
			extraLine = "\n    Full symbol:" + methodName
		}

		// final line in classic Apple .crash style:
		//   0   BinaryName   0xaddr   method + offset   (file:line)
		// keep module + address + (truncated) symbol on one line for scannability.
		// only the rare monster SwiftUI symbols get a second "Full symbol:" line.
		line := fmt.Sprintf("%3d   %-28s  %s   %s%s",
			f.FrameIndex,
			binaryName,
			addr,
			displayMethod,
			tail,
		)

		return line + extraLine
	}
}

// normalizeAddress ensures a memory address string is correctly
// formatted with a "0x" prefix and lowercase characters.
func normalizeAddress(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		return strings.ToLower(s)
	}
	if len(s) == 16 && isHexString(s) {
		return "0x" + strings.ToLower(s)
	}
	return s
}

// isHexString checks if the given string consists
// entirely of valid hexadecimal digits.
func isHexString(s string) bool {
	for _, r := range s {
		if !unicode.Is(unicode.Hex_Digit, r) {
			return false
		}
	}
	return true
}
