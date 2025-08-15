# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [android-v0.12.0] - 2025-08-15

### :sparkles: New features

- (**android**): Add custom attributes to trackHandledException (#2510) by @abhaysood in #2510
- (**android**): Add custom attributes to trackScreenView (#2509) by @abhaysood in #2509
- (**android**): Support 2.9.2 androidx compose navigation instrumentation (#2455) by @abhaysood in #2455
- (**android**): Provide configurable storage limits (#2444) by @abhaysood in #2444

### :bug: Bug fixes

- (**android**): Take persistable permission for uris (#2549) by @abhaysood in #2549
- (**android**): Improve shake detection (#2535) by @abhaysood in #2535
- (**android**): Resolve http event tracking issues (#2515) by @abhaysood in #2515
- (**android**): Remove need for READ_MEDIA_IMAGES permission (#2503) by @abhaysood in #2503
- (**android**): Use correct timestamp for launch metric calculation (#2473) by @abhaysood in #2473

### :hammer: Misc

- (**android**): Prepare sdk release 0.12.0
- (**android**): Discard spans with empty name (#2541) by @abhaysood in #2541
- (**android**): Centralize user defined attributes validation (#2520) by @abhaysood in #2520
- (**android**): Add event logging (#2487) by @abhaysood in #2487
- (**android**): Prepare next development version 0.12.0-SNAPSHOT (#2424) by @abhaysood in #2424

## [android-v0.11.0] - 2025-07-21

### :sparkles: New features

- (**android**): Add support for custom headers (#2343) by @kamalnayan04 in #2343

### :bug: Bug fixes

- (**android**): Reliably track events when sdk is initialized late (#2386) by @abhaysood in #2386
- (**android**): Missing classes error in network client (#2371) by @abhaysood in #2371

### :hammer: Misc

- (**android**): Prepare sdk release 0.11.0 (#2405) by @abhaysood in #2405
- (**android**): Hide config serialization from public api (#2388) by @abhaysood in #2388
- (**android**): Remove shake to launch bug report config (#2359) by @abhaysood in #2359
- (**android**): Remove event transformer (#2298) by @abhaysood in #2298
- (**android**): Upgrade dependencies (#2194) by @abhaysood in #2194
- (**android**): Upload flutter symbols using gradle plugin (#2081) by @abhaysood in #2081
- (**android**): Convert event type to enum (#2046) by @abhaysood in #2046
- (**android**): Improve logging (#2022) by @abhaysood in #2022
- (**android**): Reformat by @abhaysood in #2019
- (**android**): Test app exit table version insertion by @abhaysood
- (**android**): Add v3 to v4 migration test by @abhaysood
- (**android**): Add version to app exit table by @abhaysood
- (**android**): Handle app exit in signal processor by @abhaysood
- (**android**): Extract attribute keys by @abhaysood
- (**android**): Add db migration tests by @abhaysood in #2009
- (**android**): Prepare next development version of android SDK by @abhaysood in #1990

### :recycle: Refactor

- (**android**): Decouple activity ttid from launch tracking (#2391) by @abhaysood in #2391

### :books: Documentation

- Improve SDK documentation (#2256) by @abhaysood in #2256

## [android-v0.10.0] - 2025-03-28

### :sparkles: New features

- (**android**): Track fragment ttid span (#1889) by @abhaysood in #1889
- (**android**): Auto track activity TTID spans (#1868) by @abhaysood in #1868
- (**android**): Add attributes to spans (#1848) by @abhaysood in #1848
- (**android**): Implement bug reporting (#1780) by @abhaysood in #1780

### :bug: Bug fixes

- (**android**): Truncate TTID span names to fit max span length (#1952) by @abhaysood in #1952
- (**android**): Support java 11 by @abhaysood in #1735

### :hammer: Misc

- (**android**): Prepare android sdk release 0.10.0 by @abhaysood
- (**android**): Prepare android gradle plugin release 0.8.0 (#1989) by @abhaysood in #1989
- (**android**): Add platform to builds API request (#1986) by @abhaysood in #1986
- (**android**): Upgrade AGP and downgrade androidx.core (#1925) by @abhaysood in #1925
- (**android**): Record a sample session with user ID (#1865) by @abhaysood in #1865
- (**android**): Update robolectric & fix instrumentation test crash (#1820) by @abhaysood in #1820
- (**android**): Prepare next development version for gradle plugin by @abhaysood in #1775
- (**android**): Prepare gradle plugin release 0.7.0 by @abhaysood
- (**android**): Prepare next development version of SDK by @abhaysood in #1695

## [android-v0.9.0] - 2025-01-06

### :sparkles: New features

- (**android**): Remove deprecated navigation event by @abhaysood in #1665
- (**android**): Implement custom events with user defined attrs by @abhaysood
- (**android**): Expose API to get current session ID by @abhaysood in #1634
- (**android**): Implement core API for perf tracing by @abhaysood
- (**android**): Attach SVG layout snapshots to click gestures by @abhaysood
- (**android**): Expose APIs to allow start/stop of SDK by @abhaysood in #1533
- (**android**): Add low power and thermal throttling attributes by @abhaysood

### :bug: Bug fixes

- (**android**): Remove unneeded view id prefix in gesture events by @abhaysood in #1673
- (**android**): Serialize numbers as numbers instead of string by @abhaysood in #1667
- (**android**): Add keep rule for AndroidComposeView by @abhaysood in #1540
- (**android**): Revert usage of reentrant lock for heartbeat and SDK initialization by @abhaysood in #1539
- (**android**): Initialization issues by @abhaysood in #1538

### :hammer: Misc

- (**android**): Prepare sdk release 0.9.0 by @abhaysood
- (**android**): Upgrade agp to 8.7.3 by @abhaysood in #1672
- (**android**): Apply spotless to gradle plugin module by @abhaysood
- (**android**): Remove uneeded log for SVG by @abhaysood in #1662
- (**android**): Bump up curtains to 1.2.5 by @abhaysood in #1536
- (**android**): Prepare next development version of SDK by @abhaysood in #1483

### :recycle: Refactor

- (**android**): Avoid accessing thermal status change for older APIs by @abhaysood in #1661
- (**android**): Implement batch insertions of events and spans in db by @abhaysood in #1659

### :books: Documentation

- (**android**): Update benchmarks & related information in README by @abhaysood in #1537

## [android-v0.8.2] - 2024-11-05

### :bug: Bug fixes

- (**android**): Revert to use uptime millis for launch tracking by @abhaysood in #1438
- (**android**): Use shared prefs commit to update recent session by @abhaysood in #1439

### :hammer: Misc

- (**android**): Prepare sdk release 0.8.2 by @abhaysood
- (**android**): Always collect events required for journey by @abhaysood in #1482
- (**android**): Change default sampling rate to 0 by @abhaysood
- (**android**): Prepare next development version of SDK by @abhaysood in #1442
- (**android**): Prepare sdk release 0.8.1 by @abhaysood
- (**android**): Prepare next development version of SDK by @abhaysood in #1419

## [android-v0.8.0] - 2024-10-29

### :sparkles: New features

- (**android**): Improve session management by @abhaysood in #1372
- (**android**): Add screen view event by @abhaysood

### :bug: Bug fixes

- (**android**): Create new session if app version changed since last by @abhaysood in #1422
- (**android**): Handle session management when elapsed time gets reset by @abhaysood in #1394
- (**android**): Ignore duplicate inserts to app exit by @abhaysood in #1379
- (**android**): Track fragment lifecycle events when r8 is enabled by @abhaysood in #1327

### :hammer: Misc

- (**android**): Prepare sdk release 0.8.0 by @abhaysood
- (**android**): Add max session duration config by @abhaysood in #1392
- (**android**): Remove low memory event by @abhaysood in #1384
- (**android**): Support latest stable navigation compose version by @abhaysood in #1383
- (**android**): Remove unnecessary logs for launch tracking by @abhaysood in #1382
- (**android**): Auto-track screen view event for androidx fragment-navigation by @abhaysood
- (**android**): Prepare next development version by @abhaysood in #1301
- (**android**): Prepare gradle plugin release 0.6.1 by @abhaysood in #1285

### :recycle: Refactor

- (**android**): Use monotonic clock to get time by @abhaysood in #1402

## [android-v0.7.0] - 2024-09-25

### :sparkles: New features

- (**android**): Add parent fragment to fragment lifecycle events (#1262) by @abhaysood in #1262
- (**android**): Add lukewarm launch by @abhaysood

### :bug: Bug fixes

- (**android**): Lukewarm time duration calculation by @abhaysood
- (**android**): Incorrect URL parsing by @abhaysood
- (**android**): Report activity launched with saved state as warm launch by @abhaysood in #1247
- (**android**): Fix blank screenshots for Android 15 by @abhaysood in #1233
- (**android**): Support 16KB page size and add it to attibutes by @abhaysood

### :hammer: Misc

- (**android**): Prepare sdk release 0.7.0 by @abhaysood in #1283
- (**android**): Run benchmarks for 0.7.0 version by @abhaysood in #1286
- (**android**): Update tests by @abhaysood
- (**android**): Log instead of throw when URL is incorrect by @abhaysood in #1272
- (**android**): Improve logs by @abhaysood
- (**android**): Log request URL and method by @abhaysood
- (**android**): Update sdk version to 35 and agp to 8.6 by @abhaysood in #1253
- (**android**): Prepare next development version of SDK by @abhaysood in #1191

## [android-v0.6.1] - 2024-09-04

### :sparkles: New features

- (**android**): Apply bytecode transformation only for supported dependency versions by @abhaysood in #1087
- (**android**): Enable automaticRelease to maven central by @abhaysood in #1071

### :bug: Bug fixes

- (**android**): Crash when app visible time isn't available to calculate launch time by @abhaysood
- (**android**): Handle exceptions when loading native library by @abhaysood in #1179
- (**android**): Update gradle plugin group id by @abhaysood
- (**android**): Make Android tests more reliable by @abhaysood in #1070
- (**android**): Resolve crash when OkHttp is not a runtime dependency by @abhaysood in #1067

### :hammer: Misc

- (**android**): Prepare sdk release 0.6.1 by @abhaysood in #1186
- (**android**): Prepare next development version for gradle plugin by @abhaysood in #1091
- (**android**): Prepare gradle plugin release 0.6.0 by @abhaysood
- (**android**): Prepare next development version of SDK by @abhaysood in #1089
- (**android**): Prepare sdk release 0.6.0 by @abhaysood
- (**android**): Enable publishing on gradle plugin portal by @abhaysood
- (**android**): Prepare next development version for gradle plugin by @abhaysood
- (**android**): Prepare gradle plugin release 0.5.0 by @abhaysood
- (**android**): Prepare next development version of SDK by @abhaysood

### :recycle: Refactor

- (**android**): Remove usage of double bang operator by @abhaysood in #1185
- (**android**): Replace throw with a error log by @abhaysood in #1183
- (**android**): Fix potential exception in launch tracker by @abhaysood

## [android-v0.5.0] - 2024-08-19

### :sparkles: New features

- (**android**): Configure http urls to collect events for by @abhaysood

### :bug: Bug fixes

- (**android**): Respect http configs for trackHttpBody and trackHttpHeaders by @abhaysood in #1020
- (**android**): Overflow due to incorrect data type for time by @abhaysood in #1014
- (**android**): Use same thread for session and event insertion by @abhaysood

### :hammer: Misc

- (**android**): Prepare sdk release 0.5.0 by @abhaysood
- (**android**): Update docs and min-max supported versions for bytecode transformations by @abhaysood in #1053
- (**android**): Add dependencies block config in plugin fixture by @abhaysood
- (**android**): Add version checks to apply asm transformations by @abhaysood
- (**android**): Include semver source code and implement serializable by @abhaysood
- (**android**): Add end to end tests for event collection by @abhaysood in #1039
- (**android**): Remove existing android tests by @abhaysood
- (**android**): Disabling measure plugin disables all features by @abhaysood in #1018
- (**android**): Read and log http response body by @abhaysood in #1011
- (**android**): Add log to warn when mapping file is not found by @abhaysood in #1012
- (**android**): Add gitignore for gradle plugin by @abhaysood
- (**android**): Add todo for handling event insertion failures for early crashes by @abhaysood in #1008
- (**android**): Improve error handling for event insertion failures by @abhaysood
- (**android**): Create new session before any collectors are registered by @abhaysood
- (**android**): Implement versioning for sample app by @abhaysood in #1003
- (**android**): Update references to path measure-android to android by @abhaysood in #988
- (**android**): Rename measure-android directory to android by @abhaysood

### :books: Documentation

- Move android docs by @abhaysood

[android-v0.12.0]: https://github.com/measure-sh/measure/compare/android-v0.11.0..android-v0.12.0
[android-v0.11.0]: https://github.com/measure-sh/measure/compare/android-v0.10.0..android-v0.11.0
[android-v0.10.0]: https://github.com/measure-sh/measure/compare/android-v0.9.0..android-v0.10.0
[android-v0.9.0]: https://github.com/measure-sh/measure/compare/android-v0.8.2..android-v0.9.0
[android-v0.8.2]: https://github.com/measure-sh/measure/compare/android-v0.8.0..android-v0.8.2
[android-v0.8.0]: https://github.com/measure-sh/measure/compare/android-v0.7.0..android-v0.8.0
[android-v0.7.0]: https://github.com/measure-sh/measure/compare/android-v0.6.1..android-v0.7.0
[android-v0.6.1]: https://github.com/measure-sh/measure/compare/android-v0.5.0..android-v0.6.1
[android-v0.5.0]: https://github.com/measure-sh/measure/compare/android-v0.4.0..android-v0.5.0

