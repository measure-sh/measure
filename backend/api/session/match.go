package session

import (
	"fmt"
	"strings"
)

// ExtractMatches extracts matching text from
// various session's pre-aggregated fields. Like
// matching any text on the session's type, lifecycle
// events or user's id.
func ExtractMatches(
	needle, userId, sessionId string,
	types, customTypeNames, logStrings,
	viewClassnames, subviewClassnames, exceptionErrors []string,
	unhandledExceptions, handledExceptions, anrs []map[string]string,
	clickTargets, longclickTargets, scrollTargets [][]string,
) (matched string) {
	if needle == "" {
		return
	}

	buff := []string{}

	// user id
	if strings.Contains(strings.ToLower(userId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("User Id: %s", userId))
	}

	// session id
	if strings.Contains(strings.ToLower(sessionId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("Session Id: %s", sessionId))
	}

	// types
	for i := range types {
		if strings.Contains(strings.ToLower(types[i]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Type: %s", types[i]))
			break
		}
	}

	// custom type names
	for i := range customTypeNames {
		if strings.Contains(strings.ToLower(customTypeNames[i]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Custom Type: %s", customTypeNames[i]))
			break
		}
	}

	// log strings
	for i := range logStrings {
		if strings.Contains(strings.ToLower(logStrings[i]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Log: %s", logStrings[i]))
			break
		}
	}

	// view classnames
	for i := range viewClassnames {
		if strings.Contains(strings.ToLower(viewClassnames[i]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("View: %s", viewClassnames[i]))
			break
		}
	}

	// subview classnames
	for i := range subviewClassnames {
		if strings.Contains(strings.ToLower(subviewClassnames[i]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("SubView: %s", subviewClassnames[i]))
			break
		}
	}

	// unhandled exceptions
	for i := range unhandledExceptions {
		length := len(buff)

		// type
		if strings.Contains(strings.ToLower(unhandledExceptions[i]["type"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashType: %s", unhandledExceptions[i]["type"]))
		}

		// message
		if strings.Contains(strings.ToLower(unhandledExceptions[i]["message"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashMessage: %s", unhandledExceptions[i]["message"]))
		}

		// file name
		if strings.Contains(strings.ToLower(unhandledExceptions[i]["file_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashFile: %s", unhandledExceptions[i]["file_name"]))
		}

		// class name
		if strings.Contains(strings.ToLower(unhandledExceptions[i]["class_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashClass: %s", unhandledExceptions[i]["class_name"]))
		}

		// method name
		if strings.Contains(strings.ToLower(unhandledExceptions[i]["method_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashMethod: %s", unhandledExceptions[i]["method_name"]))
		}

		if len(buff)-length > 2 {
			break
		}
	}

	// handled exceptions
	for i := range handledExceptions {
		length := len(buff)

		// type
		if strings.Contains(strings.ToLower(handledExceptions[i]["type"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ErrorType: %s", handledExceptions[i]["type"]))
		}

		// message
		if strings.Contains(strings.ToLower(handledExceptions[i]["message"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ErrorMessage: %s", handledExceptions[i]["message"]))
		}

		// file name
		if strings.Contains(strings.ToLower(handledExceptions[i]["file_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ErrorFile: %s", handledExceptions[i]["file_name"]))
		}

		// class name
		if strings.Contains(strings.ToLower(handledExceptions[i]["class_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ErrorClass: %s", handledExceptions[i]["class_name"]))
		}

		// method name
		if strings.Contains(strings.ToLower(handledExceptions[i]["method_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ErrorMethod: %s", handledExceptions[i]["method_name"]))
		}

		if len(buff)-length > 2 {
			break
		}
	}

	// exception errors
	for i := range exceptionErrors {
		if strings.Contains(strings.ToLower(exceptionErrors[i]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Error: %s", exceptionErrors[i]))
			break
		}
	}

	// anrs
	for i := range anrs {
		length := len(buff)

		// type
		if strings.Contains(strings.ToLower(anrs[i]["type"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ANRType: %s", anrs[i]["type"]))
		}

		// message
		if strings.Contains(strings.ToLower(anrs[i]["message"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ANRMessage: %s", anrs[i]["message"]))
		}

		// file name
		if strings.Contains(strings.ToLower(anrs[i]["file_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ANRFile: %s", anrs[i]["file_name"]))
		}

		// class name
		if strings.Contains(strings.ToLower(anrs[i]["class_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ANRClass: %s", anrs[i]["class_name"]))
		}

		// method name
		if strings.Contains(strings.ToLower(anrs[i]["method_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("ANRMethod: %s", anrs[i]["method_name"]))
		}

		if len(buff)-length > 2 {
			break
		}
	}

	// click targets
	for i := range clickTargets {
		length := len(buff)

		// target class
		targetClass := clickTargets[i][0]
		if strings.Contains(strings.ToLower(targetClass), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target: %s", targetClass))
		}

		// target id
		targetId := clickTargets[i][1]
		if strings.Contains(strings.ToLower(targetId), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target ID: %s", targetId))
		}

		if len(buff)-length > 1 {
			break
		}
	}

	// longclick targets
	for i := range longclickTargets {
		length := len(buff)

		// target class
		targetClass := longclickTargets[i][0]
		if strings.Contains(strings.ToLower(targetClass), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target: %s", targetClass))
		}

		// target id
		targetId := longclickTargets[i][1]
		if strings.Contains(strings.ToLower(targetId), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target ID: %s", targetId))
		}

		if len(buff)-length > 1 {
			break
		}
	}

	// scroll targets
	for i := range scrollTargets {
		length := len(buff)

		// target class
		targetClass := scrollTargets[i][0]
		if strings.Contains(strings.ToLower(targetClass), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target: %s", targetClass))
		}

		// target id
		targetId := scrollTargets[i][1]
		if strings.Contains(strings.ToLower(targetId), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target ID: %s", targetId))
		}

		if len(buff)-length > 1 {
			break
		}
	}

	matched = strings.Join(buff, " ")

	return
}
