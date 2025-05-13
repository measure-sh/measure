package symbtype

// Constants defining the symbolication types
// supported by the Sentry symbolicator
const (
	Unknown = "unknown"
	// AppleCrashReport represents Apple's
	// crash report format for symbolication
	AppleCrashReport = "apple_crash_report"

	// JVM represents Java Virtual
	// Machine symbolication format
	JVM = "jvm"

	// Native represents native
	// code symbolication format
	Native = "native"
)
