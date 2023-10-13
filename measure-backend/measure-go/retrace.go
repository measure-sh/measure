package main

import (
	"errors"
	"fmt"
	"math"
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
// various parts laid out in a struct.
//
// input i should be of the form
// "class.method(file:lineno)"
//
// "lineno" is optional. for this case, input i should be of
// the form
// "class.method(file)"
//
// Returns error if the input is insufficient or if the parse
// operation fails
func UnmarshalRetraceFrame(i string) (retraceFrame RetraceFrame, err error) {
	// last char should be ')'
	parenErr := "invalid input, no parenthesis found"
	invalid := "invalid input"
	empty := "input is empty"

	// foo.bar.baz.method

	if len(i) < 1 {
		return retraceFrame, errors.New(empty)
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
	fileName, lineNumStr, _ := strings.Cut(fileInfo, ":")

	var lineNum int

	if len(lineNumStr) < 1 {
		lineNum = int(math.NaN())
	} else {
		lineNum, err = strconv.Atoi(lineNumStr)
		if err != nil {
			lineNum = int(math.NaN())
		}
	}

	retraceFrame.ClassName = className
	retraceFrame.MethodName = methodName
	retraceFrame.FileName = fileName
	retraceFrame.LineNum = lineNum

	return retraceFrame, nil
}

// MarshalRetraceFrame serializes & returns a SymbolFrame to a Retrace
// compatible stackframe string.
//
// The `ModuleName` and `ColNum` fields of the SymbolFrame struct
// is always ignored.
//
// If `LineNum` is 0, line number is not delimited with the FileName.
// Output in that case, is of the format.
// "class.method(file)"
func MarshalRetraceFrame(sf SymbolFrame) string {
	className := sf.ClassName
	methodName := sf.MethodName
	fileName := sf.FileName
	var lineNum = ""

	if sf.LineNum != 0 {
		lineNum = strconv.Itoa(sf.LineNum)
	}

	codeInfo := joinNonEmptyStrings(".", className, methodName)
	fileInfo := joinNonEmptyStrings(":", fileName, lineNum)

	if fileInfo != "" {
		fileInfo = fmt.Sprintf(`(%s)`, fileInfo)
	}

	return fmt.Sprintf(`%s%s`, codeInfo, fileInfo)
}
