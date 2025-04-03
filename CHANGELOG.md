# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### :sparkles: New features
- (**ios**): Expose APIs to allow start/stop of SDK (#2007)
- (**frontend**): Update iOS availability on landing page
- (**frontend**): Update landing page with bug reports feature
### :hammer: Misc
- (**android**): Improve logging (#2022)
- (**android**): Reformat
- (**android**): Test app exit table version insertion
- (**android**): Add v3 to v4 migration test
- (**android**): Add version to app exit table
- (**android**): Handle app exit in signal processor
- (**android**): Extract attribute keys
- (**android**): Add db migration tests
- (**ios**): Update json encoding logic (#1959)
- (**ios**): Remove swift-lint check on ci (#2017)
### :books: Documentation
- (**android**): Behaviour of SDK when stopped
- (**other**): Update bug reports feature video from mov to webm
- (**other**): Update iOS availability in README
- (**other**): Update README with bug reports feature

## [ios-v0.1.0] - 2025-03-28
### :hammer: Misc
- (**ios**): Prepare sdk release 0.1.0 (#2000)
- (**ios**): Update release script (#1999)
- (**ios**): Update pod name to measure-sh (#1998)
- (**ios**): Update heartbeat tests (#1994)

## [android-v0.10.0] - 2025-03-28
### :hammer: Misc
- (**android**): Prepare android sdk release 0.10.0
- (**android**): Prepare android gradle plugin release 0.8.0 (#1989)
- (**android**): Add platform to builds API request (#1986)

## [v0.6.1] - 2025-03-28

### :bug: Bug fixes
- (**backend**): Broken builds api for older android sdks (#1984)

## [v0.6.0] - 2025-03-27
### :sparkles: New features
- (**frontend**): Update bug report details desc text size
- (**frontend**): Adjust bug report table text sizes
- (**frontend**): Update website description
- (**frontend**): Show bug reports in session timeline
- (**frontend**): Show user def attrs in bug report details
- (**frontend**): Add build number to session replay attr display
- (**frontend**): Match bug report attr display style with others
- (**frontend**): Rename button to "Close/Re-Open Bug Report"
### :bug: Bug fixes
- (**frontend**): Improve crash display for ios (#1916)
- (**frontend**): Handle session timeline with no events
- (**frontend**): Handle no events selected case in session timeline
- (**frontend**): Make user def attr dropdown stay in viewport
### :hammer: Misc
- (**frontend**): Update next js to 14.2.26
- (**frontend**): Render attachments for more gesture events
- (**frontend**): Refactor FiltersApiType to FilterSource
- (**frontend**): Upgrade to nivo 0.88
- (**frontend**): Update to tailwind 4.0 with dashboard container file sync
- (**frontend**): Change font-sans to font-body
- (**frontend**): Refactor details link fetch in session timeline event details
- (**frontend**): Rename session 'replay' to 'timeline'
- (**frontend**): Remove 'font-regular'
- (**frontend**): Rename font variables
- (**frontend**): Add .node-version

### :sparkles: New features
- (**backend**): Symbolicate ttid span classes (#1947)
- (**backend**): Integrate new cross-platform symbolicator with ios support (#1800)
- (**backend**): Implement bug reports
- (**backend**): Add user defined attrs to spans
### :bug: Bug fixes
- (**backend**): Incorrect data backfill script (#1978)
- (**backend**): Mismatch and duplicate sessions (#1974)
- (**backend**): Filter duplicate ud attribute keys (#1967)
- (**backend**): Broken session pagination with user defined attrs (#1948)
- (**backend**): Anr exception type was not symbolicated (#1944)
- (**backend**): Remove mapping file size validation (#1935)
- (**backend**): Fix partial android symbolication (#1933)
- (**backend**): Fix a panic during anr symbolication (#1927)
- (**backend**): Fix issue with sessionator clean-all flag (#1924)
- (**backend**): Fixed an issue where clock_speed validation was failing for iOS (#1907)
- (**backend**): Fix errors in sessionator record & ingest (#1902)
- (**backend**): Codeql integer conversion error (#1897)
- (**backend**): Sessionator would fail deleting objects (#1891)
- (**backend**): Svg layout attachments are not visible sometimes (#1777)
### :hammer: Misc
- (**backend**): Add data backfill for upcoming release (#1977)
- (**backend**): Change compose command detection logic (#1962)
- (**backend**): Update migration script for seamless migration (#1937)
- (**backend**): Support .dylib mapping files in ios (#1914)
- (**backend**): Send attachments for more gesture events
- (**backend**): Clean more resources in sessionator (#1899)
- (**backend**): Update go deps (#1896)
- (**backend**): Update go toolchain version (#1894)
- (**backend**): Update ci changelog (#1893)
- (**backend**): Rename span api endpoints for consistency
- (**backend**): Refactor event, attachment & span cleanup
- (**backend**): Cleanup stale bug reports
- (**backend**): Tidy sessionator `go.mod` (#1776)
### :books: Documentation
- (**backend**): Update sdk api docs (#1918)

## [android-gradle-plugin-v0.7.0] - 2025-01-28
### :bug: Bug fixes
- (**android**): Support java 11
### :hammer: Misc
- (**android**): Prepare gradle plugin release 0.7.0
- (**android**): Prepare next development version of SDK

## [android-v0.9.0] - 2025-01-06
### :hammer: Misc
- (**android**): Prepare sdk release 0.9.0

## [v0.5.0] - 2025-01-06
### :sparkles: New features
- (**frontend**): Add memory usage absolute plot in session timeline (#1625)
- (**frontend**): Make whole checkbox container clickable in dropdown select component
- (**frontend**): Show user defined attrs in session timeline
### :bug: Bug fixes
- (**frontend**): Handle incorrect http event display in session timeline
- (**frontend**): Show memory usage in mbs in session timeline (#1679)
- (**frontend**): Made api key input read only to fix warnings (#1657)
- (**frontend**): Check onboarding status after filters api call
- (**frontend**): Fix span sorting & null checkpoints handling
- (**frontend**): Place span durations above bar
- (**frontend**): Retain overflowing span name bg color
- (**frontend**): Round millis to nearest int
- (**frontend**): Fix root span names api call
- (**frontend**): Handle empty user_defined_attrs in session timeline
- (**frontend**): Don't update filters on selectedApp change
### :hammer: Misc
- (**frontend**): Remove "|| null" from empty metrics sample
- (**frontend**): Remove old journey code
- (**frontend**): Remove clarity
- (**frontend**): Clear span statuses in filters
- (**frontend**): Improve custom event ui in session timeline
- (**frontend**): Improve user def attrs spacing
- (**frontend**): Adjust dropdown select popup position & width
- (**frontend**): Remove cursor pointer style
- (**frontend**): Support attachments for gesture click
- (**frontend**): Truncate class names in session timeline event titles
- (**frontend**): Delete unused url filters code

### :sparkles: New features
- (**backend**): Show traces in session timeline
- (**backend**): Ios session timeline (#1624)
- (**backend**): Support ios event ingestion (#1587)
- (**backend**): Add span support
- (**backend**): Support custom events (#1554)
- (**backend**): Support user defined attributes (#1529)
### :bug: Bug fixes
- (**backend**): Log extra info during ingestion failure (#1686)
- (**backend**): Duplicate sessions shown in sessions overview (#1668)
- (**backend**): Nil pointer dereference in remove apps (#1654)
- (**backend**): Dashboard no longer depends on api service (#1653)
- (**backend**): Handle large numbers in user defined attributes gracefully (#1644)
- (**backend**): Add session id to free text search
- (**backend**): Sessionator ingestion failure (#1622)
- (**backend**): Handle checkpoint parsing in GetTrace
- (**backend**): Unexpected shortcodes gets created sometimes (#1603)
- (**backend**): Improve ios support (#1599)
- (**backend**): Format checkpoints for ingestion
- (**backend**): Make span name query param
- (**backend**): Validate required event & span attributes (#1590)
- (**backend**): Discard batch if it contains duplicate event or span ids (#1588)
- (**backend**): Filter versions and os versions securely (#1563)
### :hammer: Misc
- (**backend**): Remove unneeded log lines (#1687)
- (**backend**): Update user defined attributes sample session
- (**backend**): Cleanup expired resources (#1655)
- (**backend**): Remove all app resources in sessionator (#1647)
- (**backend**): Update sessionator example config (#1632)
- (**backend**): Add new sessions
- (**backend**): Add span limits
- (**backend**): Revert deletion of session data with spans
- (**backend**): Support layout_snapshot attachments for gesture click
- (**backend**): Made span queries secure (#1566)
- (**backend**): Update sessionator deps (#1553)
- (**backend**): Remove unused code (#1545)
- (**backend**): Add sample sessions
- (**backend**): Ingest low power and thermal throttling attributes
### :recycle: Refactor
- (**backend**): Use aws-sdk-go-v2 for object uploads (#1675)
### :books: Documentation
- (**backend**): Document short filters api (#1552)
- (**backend**): Document rename app api (#1547)

## [v0.4.1] - 2024-11-11

### :bug: Bug fixes
- (**backend**): Use specific clickhouse image version (#1517)
### :books: Documentation
- (**backend**): Fix typos and missing info (#1513)

## [v0.4.0] - 2024-11-07
### :bug: Bug fixes
- (**frontend**): Handle no data case for sessions list
- (**frontend**): Truncate matched free text
- (**frontend**): Better pagination in session detail (#1491)
- (**frontend**): Handle empty attr distributions

### :bug: Bug fixes
- (**backend**): Validate limit to not be zero (#1500)
- (**backend**): Incorrect pagination when no data (#1499)
- (**backend**): Optimize session detail apis and overall loading experience (#1490)
### :hammer: Misc
- (**backend**): Add migration guide & script for next version (#1512)
- (**backend**): Remove backfilling migrations (#1511)
- (**backend**): Change postgres compose config (#1509)
- (**backend**): Change index type in sessions table (#1505)
- (**backend**): Add skip indexes for sessions table (#1492)
### :books: Documentation
- (**backend**): Document sessions overview list api (#1502)

## [android-v0.8.2] - 2024-11-05
### :hammer: Misc
- (**android**): Prepare sdk release 0.8.2
- (**android**): Always collect events required for journey
- (**android**): Change default sampling rate to 0

## [v0.3.0] - 2024-11-01
### :sparkles: New features
- (**frontend**): Replace exception detail journey with attr distribution plot
### :bug: Bug fixes
- (**frontend**): Crash detail not showing id (#1453)
- (**frontend**): Hot launch metric was incorrectly showing warm launch metric (#1448)
- (**frontend**): Some dashboard apis were failing due to lack of url encoding (#1449)
- (**frontend**): Handle empty mem/cpu graph in session replay
### :hammer: Misc
- (**frontend**): Improve exception details loading state
- (**frontend**): Update default time filter to last 6 hours

### :bug: Bug fixes
- (**backend**): Improve crash/anr detail experience (#1451)
- (**backend**): Improve dashboard api response times (#1404)
### :hammer: Misc
- (**backend**): Remove deprecated cliff feature (#1462)
- (**backend**): Apply suitable restart policy (#1458)
- (**backend**): Add data skipping indexes for fingerprints (#1455)

## [android-v0.8.0] - 2024-10-29
### :sparkles: New features
- (**android**): Improve session management
- (**android**): Add screen view event
### :bug: Bug fixes
- (**android**): Create new session if app version changed since last
- (**android**): Handle session management when elapsed time gets reset
- (**android**): Ignore duplicate inserts to app exit
- (**android**): Track fragment lifecycle events when r8 is enabled
### :hammer: Misc
- (**android**): Prepare sdk release 0.8.0
- (**android**): Add max session duration config
- (**android**): Remove low memory event
- (**android**): Support latest stable navigation compose version
- (**android**): Remove unnecessary logs for launch tracking
- (**android**): Auto-track screen view event for androidx fragment-navigation
- (**android**): Prepare next development version
### :recycle: Refactor
- (**android**): Use monotonic clock to get time

## [v0.2.1] - 2024-09-25
### :bug: Bug fixes
- (**frontend**): Add option to handle no data & not onboarded in filters

### :bug: Bug fixes
- (**backend**): Crash/anr details instances plot won't load sometimes (#1298)

## [android-gradle-plugin-v0.6.1] - 2024-09-25
### :hammer: Misc
- (**android**): Prepare gradle plugin release 0.6.1

## [android-v0.7.0] - 2024-09-25
### :hammer: Misc
- (**android**): Prepare sdk release 0.7.0

## [v0.2.0] - 2024-09-24
### :sparkles: New features
- (**frontend**): Add custom error page
- (**frontend**): Add custom 404 page
- (**frontend**): Update tooltips
- (**frontend**): Link to crash/anr details from session replay
- (**frontend**): Add 'Last 6 months' date range option
- (**frontend**): Add detailed filters to crash + anr overview pages
- (**frontend**): Add filter for OS versions
- (**frontend**): Add 'All', 'Latest' options + 'at least 1' enforcement
- (**frontend**): Redesign apps page
### :bug: Bug fixes
- (**frontend**): Hide attachment data in session replay event body
- (**frontend**): Only attempt to show attachments for crashes/anrs in sesion replay
- (**frontend**): Add missing useEffect deps for journey
- (**frontend**): Use whole int left axes for crash + anr instances plots
### :hammer: Misc
- (**frontend**): Use selected filters instead of expanded params
- (**frontend**): Fix table column widths and move paginator to top right
- (**frontend**): Refactor filter application to api calls
- (**frontend**): Refactor time utils to have separate functions for human readable datetime, date only and time only

### :sparkles: New features
- (**backend**): Update warm launch schema and duration calculation
- (**backend**): Track email on new user sign in
- (**backend**): Improve session explorer
- (**backend**): Add session explorer with text search filter
### :bug: Bug fixes
- (**backend**): Overview instance plot would not load for some cases (#1288)
- (**backend**): Round crash rate metrics to 2 decimal places
- (**backend**): Update warm_launch ingest
- (**backend**): Set warm launch duration threshold to 10s
- (**backend**): Use client timezone for plots
- (**backend**): Round crash and anr contribution percentage to 2 decimal places (#1221)
- (**backend**): Addressed ingestion failures related to ip inspection (#1197)
- (**backend**): Nil pointer dereference when ingesting `low_memory` events (#1190)
### :hammer: Misc
- (**backend**): Capture more details in otel traces (#1289)
- (**backend**): Add new sessions
- (**backend**): Remove compose profile
- (**backend**): Enable sessionator parallel ingest (#1220)
- (**backend**): Add os_page_size attribute
- (**backend**): Additional log for anomalous cold launch duration (#1199)
### :books: Documentation
- (**backend**): Add self host upgrade guide (#1291)

## [android-v0.6.1] - 2024-09-04
### :bug: Bug fixes
- (**android**): Crash when app visible time isn't available to calculate launch time
- (**android**): Handle exceptions when loading native library
### :hammer: Misc
- (**android**): Prepare sdk release 0.6.1
### :recycle: Refactor
- (**android**): Remove usage of double bang operator
- (**android**): Replace throw with a error log
- (**android**): Fix potential exception in launch tracker

## [v0.1.1] - 2024-08-31

### :bug: Bug fixes
- (**backend**): Handle no selected versions for app journey & metrics

## [v0.1.0] - 2024-08-30
### :sparkles: New features
- (**frontend**): Add "Copy AI context" button
### :hammer: Misc
- (**frontend**): Remove commented code
- (**frontend**): Update landing hero animation
- (**frontend**): Revert google ux_mode
- (**frontend**): Remove commented code
- (**frontend**): Lazy load landing page videos
- (**frontend**): Adjust landing hero anim dimensions

### :bug: Bug fixes
- (**backend**): Fix incorrect filter query for crash & anr groups
- (**backend**): Proceed with event ingestion on symbolication failure
- (**backend**): Handle exception/anr groups with no events
### :hammer: Misc
- (**backend**): Reorder & cleanup postgres migrations (#1155)
- (**backend**): Remove eventIds array from crash + anr groups
- (**backend**): Fix session data (#1141)
- (**backend**): Fix dashboard healthcheck
- (**backend**): Fix dashboard healthcheck
- (**backend**): Fix incorrect path
### :books: Documentation
- (**backend**): Update self host guide

## [android-v0.5.0] - 2024-08-19
### :hammer: Misc
- (**android**): Prepare sdk release 0.5.0

## [v0.0.1] - 2024-08-19
### :bug: Bug fixes
- (**frontend**): Use node env for auth.ts jest test
### :hammer: Misc
- (**frontend**): Change android availability on landing page
- (**frontend**): Remove unity section from landing page

### :sparkles: New features
- (**backend**): Add stale data cleanup service
### :bug: Bug fixes
- (**backend**): Google auth (#1022)
### :hammer: Misc
- (**backend**): Update dashboard github workflow
- (**backend**): Fix dockerfile
- (**backend**): Fix dashboard docker compose
- (**backend**): Update compose.yml
- (**backend**): Update rigmarole script
- (**backend**): Remove stale files
- (**backend**): Update go.work.sum (#1050)
- (**backend**): Move dashboard directory
- (**backend**): Update cleanup deps
- (**backend**): Update cleanup service
- (**backend**): Change health check
- (**backend**): Update github workflow
- (**backend**): Update docker compose
- (**backend**): Rename directory & service names
- (**backend**): Rename directory & service names
- (**backend**): Tidy go.mod
- (**backend**): Change default retention period to 90 days
- (**backend**): Extend access token expiry (#1031)
- (**backend**): Update `config.sh`
- (**backend**): Proxy attachments by default
- (**backend**): Fix typos
- (**backend**): Rename web env vars
- (**backend**): Fix a sessionator edge case (#1026)
- (**backend**): Consistent healthcheck (#997)
- (**backend**): Add healthchecks (#989)
- (**backend**): Remove example env (#985)
### :recycle: Refactor
- (**backend**): Minor refactor to google auth (#1038)
### :books: Documentation
- (**backend**): Update migrations
- (**backend**): Update self-host guide

## [android-gradle-plugin-v0.4.0] - 2024-08-06
### :bug: Bug fixes
- (**android**): Plugin does not break configuration cache
### :hammer: Misc
- (**android**): Prepare gradle plugin release 0.4.0
- (**android**): Update measure SDK version for functional tests
- (**android**): Prepare next development version of SDK
### :books: Documentation
- (**android**): Update release checklist

## [android-v0.4.0] - 2024-08-06
### :sparkles: New features
- (**android**): Add config to whitelist certain events for export regardless of sampling rate
- (**android**): Implement sampled non-crashed session export
- (**android**): Implement sampled session export
- (**android**): Calculate CPU usage in SDK
### :bug: Bug fixes
- (**android**): Fix serialization of event packets
- (**android**): Incorrectly configured SQL query
- (**android**): Disable okhttp logs if logging is disabled
- (**android**): Missing method in FakeMeasureInitializer
- (**android**): Use process death time instead of current time for AppExit
- (**android**): Rename interval_config to interval
- (**android**): Dynamically calculate interval_config for memory usage and cpu usage
- (**android**): Fix network provider attribute key name
### :hammer: Misc
- (**android**): Prepare sdk release 0.4.0
- (**android**): Add test for AppExitProvider
- (**android**): Reformat
- (**android**): Remove unused function
- (**android**): Replace okhttp with HttpUrlConnection
- (**android**): Add indexes to database
- (**android**): Fix failing database tests
- (**android**): Reformat
- (**android**): Remove unused db methods
- (**android**): Improve cleaning up of stale data
- (**android**): Stop export when server is down or rate limiting is triggered
- (**android**): Reformat
- (**android**): Update session clean up logic
- (**android**): Update log for session creation
- (**android**): Update configs
- (**android**): Update measure.api
- (**android**): Rename config name
- (**android**): Remove unused function
- (**android**): Mark session as crashed a needs reporting in db
- (**android**): Export events for crashed session on crash
- (**android**): Disable logs by default, add a public config to enable logs
### :recycle: Refactor
- (**android**): Guard executor submit with try-catch blocks
- (**android**): Remove unused function
- (**android**): Improve database tests
- (**android**): Introduce session entity
- (**android**): Add fk relation between events table & sessions table
- (**android**): Rename function
### :books: Documentation
- (**android**): Update CPU usage calculation doc

## [android-v0.3.0] - 2024-07-16
### :sparkles: New features
- (**android**): Use URL from manifest for uploading builds
- (**android**): Allow configuring URL for API calls
- (**android**): Implement user defined attributes
- (**android**): Implement user triggered events
- (**android**): Implement user triggered events
- (**android**): Improve session management
- (**android**): Add source to navigation and update tests
- (**android**): Improve navigation schema
### :bug: Bug fixes
- (**android**): Fix sdk initialization in benchmarks app
- (**android**): Make disabling of signing easy
- (**android**): Fix events request schema
- (**android**): Fix benchmarks app setup
- (**android**): Fix http headers blocking logic
- (**android**): Track app exits only once per pid
- (**android**): Fix fake config for androidTests
- (**android**): Downgrade robolectric as it won't run tests after upgrade
- (**android**): Non nullable network properties
- (**android**): Use scheduleWithFixedDelay instead of scheduleWithFixedRate
### :hammer: Misc
- (**android**): Update workflow to run for tags
- (**android**): Prepare next development version
- (**android**): Prepare release 0.3.0 for SDK and gradle plugin
- (**android**): Update publish step conditions
- (**android**): Downgrade android-tools
- (**android**): Upgrade dependencies
- (**android**): Add configuration to configure measure plugin for variants
- (**android**): Make meta data in manifest optional for gradle plugin
- (**android**): Upgrade autonomousapps-testkit plugin
- (**android**): Improve error logs for gradle plugin
- (**android**): Improve error handling for events export
- (**android**): Publish benchmark results on README
- (**android**): Fix lint warning
- (**android**): Run publish only for releases
- (**android**): Enable publishing to maven
- (**android**): Fix android tests
- (**android**): Remove user defined attributes from network request
- (**android**): Update README
- (**android**): Update architecture doc
- (**android**): Reformat
- (**android**): Update public API
- (**android**): Implement persistence for user ID
- (**android**): Implement persistence for user defined attributes
- (**android**): Begin implementation for persisted attributes
- (**android**): Improve executor services implementation
- (**android**): Update measure.api with new configs
- (**android**): Remove unused code
- (**android**): Rename function to better represent intent
- (**android**): Update measure.api with config name change
- (**android**): Rename internal config
- (**android**): Improve logging
- (**android**): Fix formatting
- (**android**): Improve exporting logic when an crash occurs
- (**android**): Update to AGP 8.4.1
- (**android**): Update ui automator to 2.3.0
- (**android**): Fix AabSize task test
- (**android**): Upgrade robolectric to 4.12.1
- (**android**): Remove explicit kotlin dsl version
- (**android**): Update android tools to 31.4.1
- (**android**): Update kotlin-dsl plugin to 4.4.0
- (**android**): Upgrade AGP version
### :recycle: Refactor
- (**android**): Improve internal SDK traces
- (**android**): Improve config usage
### :books: Documentation
- (**android**): Update tag convention in RELEASE.md
- (**android**): Add a index section for README
- (**android**): Update docs to allow configuring API URL
- (**android**): Add java doc

## [measure-android-0.2.0] - 2024-06-08
[unreleased]: https://github.com/measure-sh/measure/compare/ios-v0.1.0..HEAD
[ios-v0.1.0]: https://github.com/measure-sh/measure/compare/android-v0.10.0..ios-v0.1.0
[android-v0.10.0]: https://github.com/measure-sh/measure/compare/v0.6.1..android-v0.10.0
[0.6.1]: https://github.com/measure-sh/measure/compare/v0.6.0..v0.6.1
[0.6.0]: https://github.com/measure-sh/measure/compare/android-gradle-plugin-v0.7.0..v0.6.0
[android-gradle-plugin-v0.7.0]: https://github.com/measure-sh/measure/compare/android-v0.9.0..android-gradle-plugin-v0.7.0
[android-v0.9.0]: https://github.com/measure-sh/measure/compare/v0.5.0..android-v0.9.0
[0.5.0]: https://github.com/measure-sh/measure/compare/v0.4.1..v0.5.0
[0.4.1]: https://github.com/measure-sh/measure/compare/v0.4.0..v0.4.1
[0.4.0]: https://github.com/measure-sh/measure/compare/android-v0.8.2..v0.4.0
[android-v0.8.2]: https://github.com/measure-sh/measure/compare/v0.3.0..android-v0.8.2
[0.3.0]: https://github.com/measure-sh/measure/compare/android-v0.8.0..v0.3.0
[android-v0.8.0]: https://github.com/measure-sh/measure/compare/v0.2.1..android-v0.8.0
[0.2.1]: https://github.com/measure-sh/measure/compare/android-gradle-plugin-v0.6.1..v0.2.1
[android-gradle-plugin-v0.6.1]: https://github.com/measure-sh/measure/compare/android-v0.7.0..android-gradle-plugin-v0.6.1
[android-v0.7.0]: https://github.com/measure-sh/measure/compare/v0.2.0..android-v0.7.0
[0.2.0]: https://github.com/measure-sh/measure/compare/android-v0.6.1..v0.2.0
[android-v0.6.1]: https://github.com/measure-sh/measure/compare/v0.1.1..android-v0.6.1
[0.1.1]: https://github.com/measure-sh/measure/compare/v0.1.0..v0.1.1
[0.1.0]: https://github.com/measure-sh/measure/compare/android-v0.5.0..v0.1.0
[android-v0.5.0]: https://github.com/measure-sh/measure/compare/v0.0.1..android-v0.5.0
[0.0.1]: https://github.com/measure-sh/measure/compare/android-gradle-plugin-v0.4.0..v0.0.1
[android-gradle-plugin-v0.4.0]: https://github.com/measure-sh/measure/compare/android-v0.4.0..android-gradle-plugin-v0.4.0
[android-v0.4.0]: https://github.com/measure-sh/measure/compare/android-v0.3.0..android-v0.4.0
[android-v0.3.0]: https://github.com/measure-sh/measure/compare/measure-android-gradle-0.2.0..android-v0.3.0
[measure-android-0.2.0]: https://github.com/measure-sh/measure/compare/measure-android-gradle-0.1.0..measure-android-0.2.0

