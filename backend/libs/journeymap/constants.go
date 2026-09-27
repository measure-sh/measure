package journeymap

import "regexp"

const (
	// leadMs is how long before a freshly created host appears a screen view
	// may arrive and still belong to it. Flutter on iOS reports the route
	// before its view controller appears.
	leadMs = 1000

	// minVisitMs is the shortest tap-free visit that counts as a screen of its
	// own when the host moves on to another screen right after.
	minVisitMs = 300

	// triggerWindowMs is how long before a transition a tap can happen and
	// still be counted as its trigger.
	triggerWindowMs = 3000

	// tapLagMs is how long after a screen change a tap is still credited to
	// the screen before it. Flutter reports a new route a few milliseconds
	// before the tap that caused it.
	tapLagMs = 300

	// variantSimilarity is how much two snapshot structures must overlap, from
	// 0 to 1, to be one variant.
	variantSimilarity = 0.85

	// minVariantVisits is the fewest visits a variant must be seen in to be
	// reported. A state seen once is usually a transition caught mid-way.
	minVariantVisits = 2

	// loadingShare is the share of a screen's elements below which a variant
	// is the screen still loading, as React Native and Flutter hosts are on
	// every arrival before their content draws.
	loadingShare = 0.25

	// fetchWorkers is how many snapshots are read from storage at once.
	fetchWorkers = 16
)

// containerHosts matches view controller classes that wrap the screen a user
// sees rather than being one, such as navigation controllers and the hosts
// React Native, Flutter and Compose draw into.
var containerHosts = regexp.MustCompile(`^(UI|RCT|PU|PH|_|FlutterViewController$|FlutterEngine|ComposeHostingViewController$)`)
