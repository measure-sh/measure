package measure

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

type RetraceFrame struct {
	ClassName  string
	MethodName string
	FileName   string
	LineNum    int
}

func joinNonEmptyStrings(delim string, strs ...string) string {
	nonEmptyStrs := []string{}
	for _, str := range strs {
		if str != "" {
			nonEmptyStrs = append(nonEmptyStrs, str)
		}
	}
	return strings.Join(nonEmptyStrs, delim)
}

// UnmarshalRetraceFrame parses a Retrace stackframe and returns the
// various parts laid out in a struct. If `p` is a non-empty string,
// `p` would be stripped from `i` first.
//
// input i should be of the form
// - "class.method(file:lineno)"
// - "class.method(file)"
// - "class.method"
//
// Returns error if the input is insufficient or if the parse
// operation fails
func UnmarshalRetraceFrame(i string, p string) (retraceFrame RetraceFrame, err error) {
	parenErr := "invalid input, no parenthesis found"
	invalid := "invalid input"
	empty := "input is empty"

	// foo.bar.baz.method
	if len(i) < 1 {
		return retraceFrame, errors.New(empty)
	}

	if len(p) > 0 {
		i = strings.TrimPrefix(i, p)
	}

	// file or line num absent
	// example: foo.bar.baz.method
	if i[len(i)-1] != ')' {
		retraceFrame.ClassName = i[:strings.LastIndex(i, ".")]
		retraceFrame.MethodName = i[strings.LastIndex(i, ".")+1:]
		return retraceFrame, nil
	}

	if strings.Count(i, "(") != 1 {
		return retraceFrame, fmt.Errorf(`%s in frame "%s"`, parenErr, i)
	}

	if strings.Count(i, ")") != 1 {
		return retraceFrame, fmt.Errorf(`%s in frame "%s"`, parenErr, i)
	}

	codeInfo, fileInfo, found := strings.Cut(i, "(")
	if !found {
		return retraceFrame, errors.New(invalid)
	}

	// strip out the last ')'
	fileInfo = string(fileInfo[:len(fileInfo)-1])

	className := codeInfo[:strings.LastIndex(codeInfo, ".")]
	methodName := codeInfo[strings.LastIndex(codeInfo, ".")+1:]
	lastIndexSep := strings.LastIndex(fileInfo, ":")

	var fileName string
	var lineNumStr string

	if lastIndexSep < 0 {
		fileName = fileInfo
		lineNumStr = ""
	} else {
		fileName = fileInfo[:lastIndexSep]
		lineNumStr = fileInfo[lastIndexSep+1:]
	}

	var lineNum int

	if lineNumStr == "" {
		lineNum = 0
	} else {
		lineNum, err = strconv.Atoi(lineNumStr)
		if err != nil {
			return retraceFrame, err
		}
	}

	retraceFrame.ClassName = className
	retraceFrame.MethodName = methodName
	retraceFrame.FileName = fileName
	retraceFrame.LineNum = lineNum

	return retraceFrame, nil
}

// MarshalRetraceFrame serializes & returns a Frame to a Retrace
// compatible stackframe string. If `p` is a non-empty string
// it would be prefixed in the output stackframe string.
//
// The `ModuleName` and `ColNum` fields of the Frame struct
// is always ignored.
//
// If `LineNum` is 0, line number is not delimited with the FileName.
// Output in that case, is of the format.
// "class.method(file)"
func MarshalRetraceFrame(f Frame, p string) string {
	className := f.ClassName
	methodName := f.MethodName
	fileName := f.FileName
	var lineNum = ""

	if f.LineNum != 0 {
		lineNum = strconv.Itoa(f.LineNum)
	}

	codeInfo := joinNonEmptyStrings(".", className, methodName)
	fileInfo := joinNonEmptyStrings(":", fileName, lineNum)

	if fileInfo != "" {
		fileInfo = fmt.Sprintf(`(%s)`, fileInfo)
	}

	return fmt.Sprintf(`%s%s%s`, p, codeInfo, fileInfo)
}
