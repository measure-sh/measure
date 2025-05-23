package framework

// The types of frameworks
// for an exception event.
// This helps in differentiating
// between exceptions originated
// from different frameworks.
const (
	// Represents exceptions
	// from Apple — ios, ipad
	// and macos.
	Apple = "apple"

	// Represents exceptions
	// from Android.
	JVM = "jvm"

	// Represents exceptions
	// from Flutter/Dart.
	Dart = "dart"
)
