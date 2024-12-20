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
	needle, userId string, sessionId string,
	types, logStrings, viewClassnames, subviewClassnames []string,
	exceptions, anrs, clickTargets, longclickTargets, scrollTargets []map[string]string,
) (matched string) {
	if needle == "" {
		return
	}

	buff := []string{}
	const sep = " "

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

	// exceptions
	for i := range exceptions {
		length := len(buff)

		// type
		if strings.Contains(strings.ToLower(exceptions[i]["type"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashType: %s", exceptions[i]["type"]))
		}

		// message
		if strings.Contains(strings.ToLower(exceptions[i]["message"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashMessage: %s", exceptions[i]["message"]))
		}

		// file name
		if strings.Contains(strings.ToLower(exceptions[i]["file_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashFile: %s", exceptions[i]["file_name"]))
		}

		// class name
		if strings.Contains(strings.ToLower(exceptions[i]["class_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashClass: %s", exceptions[i]["class_name"]))
		}

		// method name
		if strings.Contains(strings.ToLower(exceptions[i]["method_name"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("CrashMethod: %s", exceptions[i]["method_name"]))
		}

		if len(buff)-length > 2 {
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
		if strings.Contains(strings.ToLower(clickTargets[i]["1"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target: %s", clickTargets[i]["1"]))
		}

		// target id
		if strings.Contains(strings.ToLower(clickTargets[i]["2"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target ID: %s", clickTargets[i]["2"]))
		}

		if len(buff)-length > 1 {
			break
		}
	}

	// longclick targets
	for i := range longclickTargets {
		length := len(buff)

		// target class
		if strings.Contains(strings.ToLower(longclickTargets[i]["1"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target: %s", longclickTargets[i]["1"]))
		}

		// target id
		if strings.Contains(strings.ToLower(longclickTargets[i]["2"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target ID: %s", longclickTargets[i]["2"]))
		}

		if len(buff)-length > 1 {
			break
		}
	}

	// scroll targets
	for i := range scrollTargets {
		length := len(buff)

		// target class
		if strings.Contains(strings.ToLower(scrollTargets[i]["1"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target: %s", scrollTargets[i]["1"]))
		}

		// target id
		if strings.Contains(strings.ToLower(scrollTargets[i]["2"]), strings.ToLower(needle)) {
			buff = append(buff, fmt.Sprintf("Target ID: %s", scrollTargets[i]["2"]))
		}

		if len(buff)-length > 1 {
			break
		}
	}

	matched = strings.Join(buff, sep)

	return
}
