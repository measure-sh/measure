// Package journeymap builds a map of an app's screens from session events and
// layout snapshots: the screens users saw, the taps that moved them forward
// from one screen to the next, and a wireframe of each screen in each of the
// states it was seen in.
//
// A screen is the activity or view controller in front (the host), plus the
// last screen view, fragment or SwiftUI view reported inside it, for example
// "MainActivity / checkout". Going back to a screen the user came from is not
// a transition, so the map only shows forward moves.
package journeymap
