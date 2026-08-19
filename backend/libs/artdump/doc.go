// Package artdump parses the ART thread dump Android writes when the system
// captures an ANR.
//
// A dump is a sequence of thread blocks, each opening with a header line and
// followed by that thread's stack, annotated with the monitors the thread holds
// or waits for.
//
// Only what symbolication rewrites is broken up: JVM frames and the class name
// on a lock. Everything else, headers and native frames included, is kept as
// ART wrote it.
//
// Parse never fails. Any line it does not recognise is retained verbatim, so
// Render reproduces its input byte for byte and the parsed representation can be
// stored in place of the original text.
package artdump
