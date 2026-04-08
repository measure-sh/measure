// Package symbolicator performs de-obfuscation and symbolication of
// crash data across Android (JVM), iOS (Apple), and Flutter (Dart)
// platforms by communicating with the Sentry Symbolicator service
// over HTTP.
//
// It resolves obfuscated class names and method names (JVM/ProGuard),
// binary instruction addresses (Apple/dSYM), and native instruction
// addresses (Dart/ELF) into human-readable stack traces.
package symbolicator
