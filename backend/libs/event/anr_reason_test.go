package event

import "testing"

// The subjects below are built the way the platform builds them. Those
// marked observed came off a device and are reproduced exactly; the rest
// follow the format strings in TimeoutRecord and its callers.
func TestAnrReason(t *testing.T) {
	tests := []struct {
		name     string
		subject  string
		expected string
	}{
		{
			name:     "input dispatch, window unresponsive (observed)",
			subject:  "Input dispatching timed out (71005a5 sh.frankenstein.android/sh.frankenstein.android.MainActivity is not responding. Waited 5005ms for MotionEvent).",
			expected: "Input dispatching timed out (sh.frankenstein.android/.MainActivity)",
		},
		{
			name:     "input dispatch, stalled buffer appended",
			subject:  "Input dispatching timed out (71005a5 sh.frankenstein.android/sh.frankenstein.android.MainActivity is not responding. Waited 5005ms for MotionEvent). Buffer processing for the associated surface is stuck due to an unsignaled fence (window=sh.frankenstein.android/sh.frankenstein.android.MainActivity, bufferId=0x0000002100000004, frameNumber=12). This potentially indicates a GPU hang.",
			expected: "Input dispatching timed out (sh.frankenstein.android/.MainActivity)",
		},
		{
			name:     "input dispatch, no focused window",
			subject:  "Input dispatching timed out (Application does not have a focused window).",
			expected: "Input dispatching timed out, no focused window",
		},
		{
			name:     "input dispatch, no reason",
			subject:  "Input dispatching timed out.",
			expected: "Input dispatching timed out",
		},
		{
			name:     "broadcast (observed)",
			subject:  "Broadcast of Intent { flg=0x10000010 xflg=0x4 cmp=sh.frankenstein.android/.AnrBroadcastReceiver }",
			expected: "Broadcast of Intent (sh.frankenstein.android/.AnrBroadcastReceiver)",
		},
		{
			name:     "broadcast, with the waited suffix",
			subject:  "Broadcast of Intent { flg=0x10000010 cmp=sh.frankenstein.android/.AnrBroadcastReceiver }, waited 9871ms",
			expected: "Broadcast of Intent (sh.frankenstein.android/.AnrBroadcastReceiver)",
		},
		{
			name:     "implicit broadcast names an action, not a component",
			subject:  "Broadcast of Intent { act=android.intent.action.SCREEN_ON flg=0x50200010 }",
			expected: "Broadcast of Intent (android.intent.action.SCREEN_ON)",
		},
		{
			name:     "broadcast carrying a data uri",
			subject:  "Broadcast of Intent { act=android.intent.action.VIEW dat=content://sms/inbox flg=0x10 cmp=sh.frankenstein.android/.AnrBroadcastReceiver }",
			expected: "Broadcast of Intent (sh.frankenstein.android/.AnrBroadcastReceiver)",
		},
		{
			name:     "service exec",
			subject:  "executing service sh.frankenstein.android/.AnrService, waited 20123ms",
			expected: "Executing service (sh.frankenstein.android/.AnrService)",
		},
		{
			name:     "service start",
			subject:  "Context.startForegroundService() did not then call Service.startForeground(): ServiceRecord{a1b2c3 u0 sh.frankenstein.android/.AnrService}",
			expected: "Foreground service did not call startForeground() (sh.frankenstein.android/.AnrService)",
		},
		{
			name:     "short foreground service",
			subject:  "A foreground service of FOREGROUND_SERVICE_TYPE_SHORT_SERVICE did not stop within a timeout: ComponentInfo{sh.frankenstein.android/sh.frankenstein.android.AnrService}",
			expected: "Short foreground service did not stop (sh.frankenstein.android/.AnrService)",
		},
		{
			name:     "content provider",
			subject:  "ContentProvider not responding",
			expected: "ContentProvider not responding",
		},
		{
			name:     "job service (observed)",
			subject:  "No response to onStartJob for sh.frankenstein.android/.AnrJobService",
			expected: "No response to onStartJob (sh.frankenstein.android/.AnrJobService)",
		},
		{
			name:     "job service, identity hash before the component",
			subject:  "No response to onStopJob for a1b2c3 #u0a172/1 sh.frankenstein.android/.AnrJobService",
			expected: "No response to onStopJob (sh.frankenstein.android/.AnrJobService)",
		},
		{
			name:     "job service, no component appended",
			subject:  "No response to onStartJob",
			expected: "No response to onStartJob",
		},
		{
			name:     "job service bind",
			subject:  "Timed out while trying to bind",
			expected: "Timed out while trying to bind",
		},
		{
			name:     "job service notification",
			subject:  "required notification not provided",
			expected: "Required notification not provided",
		},
		{
			name:     "app start",
			subject:  "Process ProcessRecord{a1b2c3 8135:sh.frankenstein.android/u0a172} failed to complete startup",
			expected: "Process failed to complete startup",
		},
		{
			name:     "app requested drops the app's own words",
			subject:  "App requested: watchdog for user 41827",
			expected: "App requested",
		},
		{
			name:     "unrecognized subject has no reason",
			subject:  "Some future timeout after 5123ms",
			expected: "",
		},
		{
			name:     "no subject",
			subject:  "",
			expected: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := ANRReason(test.subject)
			if got != test.expected {
				t.Errorf("ANRReason(%q) = %q, want %q", test.subject, got, test.expected)
			}
		})
	}
}

func TestAnrReasonIsStableAcrossOccurrences(t *testing.T) {
	first := "Input dispatching timed out (71005a5 sh.frankenstein.android/sh.frankenstein.android.MainActivity is not responding. Waited 5005ms for MotionEvent)."
	second := "Input dispatching timed out (b39f01c sh.frankenstein.android/sh.frankenstein.android.MainActivity is not responding. Waited 5231ms for KeyEvent)."

	if ANRReason(first) != ANRReason(second) {
		t.Errorf("ANRReason(%q) = %q, differs from ANRReason(%q) = %q", first, ANRReason(first), second, ANRReason(second))
	}
}
