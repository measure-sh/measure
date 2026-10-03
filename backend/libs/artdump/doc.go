// Package artdump parses the ART thread dump Android writes when the system
// captures an ANR.
//
// A dump is a sequence of thread blocks. Each opens with a header line and
// then lists that thread's stack, with lines naming the monitors the thread
// holds or waits for.
//
// Parse never fails. Lines it does not recognise are kept verbatim, so Render
// reproduces each thread block.
package artdump
