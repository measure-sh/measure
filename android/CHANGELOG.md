# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [android-v0.15.0] - 2025-11-24

### :hammer: Misc

- (**android**): Fix event insertion error for cleaned up session (#2932) by @abhaysood in #2932
- (**android**): Update measure config and default event collection (#2924) by @abhaysood in #2924
- (**android**): Prepare next development version (#2863) by @abhaysood in #2863

## [android-v0.14.0] - 2025-10-29

### :bug: Bug fixes

- (**android**): Manual http tracking validation (#2811) by @abhaysood in #2811

### :hammer: Misc

- (**android**): Prepare sdk release 0.14.0 (#2862) by @abhaysood in #2862
- (**android**): Reverts min sdk change back to 21 (#2812) by @abhaysood in #2812
- (**android**): Upgrade dependencies (#2806) by @abhaysood in #2806

### :recycle: Refactor

- (**android**): Filter HTTP body fields instead of discarding events (#2822) by @abhaysood in #2822

### :books: Documentation

- (**android**): Document validations for bug reports (#2802) by @abhaysood in #2802

## [android-v0.13.0] - 2025-10-22

### :sparkles: New features

- (**android**): Expose API to track http events (#2692) by @abhaysood in #2692
- (**android**): Track session start event (#2576) by @abhaysood in #2576

### :bug: Bug fixes

- (**android**): Collect screenshots with ANRs (#2728) by @abhaysood in #2728
- (**android**): Prevent OOM in HTTP body reading with 256KB limit (#2677) by @abhaysood in #2677

### :hammer: Misc

- (**android**): Prepare sdk release 0.13.0 (#2782) by @abhaysood in #2782
- (**android**): Fix config.toml path for changelog generation (#2781) by @abhaysood in #2781
- (**android**): Fix changelog generation (#2779) by @abhaysood in #2779
- (**android**): Continue existing attachment export on unregister (#2767) by @abhaysood in #2767
- (**android**): Json events request & separate attachment upload (#2706) by @abhaysood in #2706
- (**android**): Support latest okhttp and navigation for auto collection (#2679) by @abhaysood in #2679
- (**android**): Update session configs (#2671) by @abhaysood in #2671
- (**android**): Add jitter to each export pulse (#2674) by @abhaysood in #2674
- (**android**): Use snapshot version for android sdk (#2630) by @abhaysood in #2630

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

- (**android**): Prepare sdk release 0.12.0 (#2553) by @abhaysood in #2553
- (**android**): Discard spans with empty name (#2541) by @abhaysood in #2541
- (**android**): Centralize user defined attributes validation (#2520) by @abhaysood in #2520
- (**android**): Add event logging (#2487) by @abhaysood in #2487
- (**android**): Prepare next development version 0.12.0-SNAPSHOT (#2424) by @abhaysood in #2424

### :books: Documentation

- (**android**): Update attributes API for errors and screen view (#2518) by @abhaysood in #2518

## [android-v0.11.0] - 2025-07-21

### :sparkles: New features

- (**android**): Add support for custom headers (#2343) by @kamalnayan04 in #2343

### :bug: Bug fixes

- (**android**): Reliably track events when sdk is initialized late (#2386) by @abhaysood in #2386
- (**android**): Missing classes error in network client (#2371) by @abhaysood in #2371

### :hammer: Misc

- (**android**): Prepare sdk release 0.11.0 (#2405) by @abhaysood in #2405
- (**android**): Fix prepare release command (#2402) by @abhaysood in #2402
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

- (**android**): Update readme (#2155) by @abhaysood in #2155
- (**android**): Improve firebase comparison visualisation (#2062) by @abhaysood in #2062
- (**android**): Add impact on launch time comparison to Firebase (#2052) by @abhaysood in #2052
- (**android**): Update span attributes section (#2030) by @abhaysood in #2030
- (**android**): Behaviour of SDK when stopped by @abhaysood in #2020

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

### :books: Documentation

- (**android**): Improve android README by @abhaysood in #1793
- (**readme**): Update banner image by @gandharva in #1768

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
- (**android**): Update gradle wrapper validation action by @abhaysood in #1616
- (**android**): Bump up curtains to 1.2.5 by @abhaysood in #1536
- (**android**): Prepare next development version of SDK by @abhaysood in #1483

### :recycle: Refactor

- (**android**): Avoid accessing thermal status change for older APIs by @abhaysood in #1661
- (**android**): Implement batch insertions of events and spans in db by @abhaysood in #1659

### :books: Documentation

- (**android**): Update cheatsheet with custom events API by @abhaysood in #1694
- (**android**): Add minimum version compatibility by @abhaysood in #1670
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
- (**android**): Publish plugin to gradle plugin portal by @abhaysood

### :bug: Bug fixes

- (**android**): Crash when app visible time isn't available to calculate launch time by @abhaysood
- (**android**): Handle exceptions when loading native library by @abhaysood in #1179
- (**android**): Update gradle plugin group id by @abhaysood
- (**android**): Make Android tests more reliable by @abhaysood in #1070
- (**android**): Resolve crash when OkHttp is not a runtime dependency by @abhaysood in #1067

### :hammer: Misc

- (**android**): Prepare sdk release 0.6.1 by @abhaysood in #1186
- (**android**): Prepare next development version for gradle plugin by @abhaysood in #1091
- (**android**): Re-enable all android workflow jobs by @abhaysood in #1090
- (**android**): Explicitly publish plugin and plugin marker to maven central by @abhaysood
- (**android**): Temporary disable all jobs except publish by @abhaysood
- (**android**): Fix release commands by @abhaysood
- (**android**): Prepare gradle plugin release 0.6.0 by @abhaysood
- (**android**): Prepare next development version of SDK by @abhaysood in #1089
- (**android**): Prepare sdk release 0.6.0 by @abhaysood
- (**android**): Fix publish command for gradle plugin on CI by @abhaysood in #1088
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
- (**android**): Plugin does not break configuration cache by @abhaysood in #986

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
- (**android**): Fix path for CI workflows by @abhaysood
- (**android**): Implement versioning for sample app by @abhaysood in #1003
- (**android**): Fix ambiguous path in android workflow by @abhaysood in #999
- (**android**): Update references to path measure-android to android by @abhaysood in #988
- (**android**): Rename measure-android directory to android by @abhaysood
- (**android**): Prepare next development version of gradle plugin by @abhaysood
- (**android**): Prepare gradle plugin release 0.4.0 by @abhaysood
- (**android**): Update measure SDK version for functional tests by @abhaysood in #987
- (**android**): Prepare next development version of SDK by @abhaysood

### :books: Documentation

- (**android**): Add cheatsheet by @abhaysood in #1028
- (**android**): Update release checklist by @abhaysood

## [android-v0.4.0] - 2024-08-06

### :sparkles: New features

- (**android**): Add config to whitelist certain events for export regardless of sampling rate by @abhaysood
- (**android**): Implement sampled non-crashed session export by @abhaysood
- (**android**): Implement sampled session export by @abhaysood
- (**android**): Calculate CPU usage in SDK by @abhaysood

### :bug: Bug fixes

- (**android**): Fix serialization of event packets by @abhaysood in #982
- (**android**): Incorrectly configured SQL query by @abhaysood
- (**android**): Disable okhttp logs if logging is disabled by @abhaysood in #967
- (**android**): Missing method in FakeMeasureInitializer by @abhaysood
- (**android**): Use process death time instead of current time for AppExit by @abhaysood in #954
- (**android**): Rename interval_config to interval by @abhaysood
- (**android**): Dynamically calculate interval_config for memory usage and cpu usage by @abhaysood
- (**android**): Fix network provider attribute key name by @abhaysood in #929

### :hammer: Misc

- (**android**): Prepare sdk release 0.4.0 by @abhaysood
- (**android**): Add test for AppExitProvider by @abhaysood in #981
- (**android**): Reformat by @abhaysood in #980
- (**android**): Remove unused function by @abhaysood
- (**android**): Replace okhttp with HttpUrlConnection by @abhaysood
- (**android**): Add indexes to database by @abhaysood in #966
- (**android**): Fix failing database tests by @abhaysood
- (**android**): Reformat by @abhaysood in #960
- (**android**): Remove unused db methods by @abhaysood in #955
- (**android**): Improve cleaning up of stale data by @abhaysood
- (**android**): Stop export when server is down or rate limiting is triggered by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Update session clean up logic by @abhaysood
- (**android**): Update log for session creation by @abhaysood
- (**android**): Update configs by @abhaysood
- (**android**): Update measure.api by @abhaysood
- (**android**): Rename config name by @abhaysood
- (**android**): Remove unused function by @abhaysood
- (**android**): Mark session as crashed a needs reporting in db by @abhaysood
- (**android**): Export events for crashed session on crash by @abhaysood
- (**android**): Disable logs by default, add a public config to enable logs by @abhaysood in #925

### :recycle: Refactor

- (**android**): Guard executor submit with try-catch blocks by @abhaysood in #961
- (**android**): Remove unused function by @abhaysood
- (**android**): Improve database tests by @abhaysood
- (**android**): Introduce session entity by @abhaysood
- (**android**): Add fk relation between events table & sessions table by @abhaysood
- (**android**): Rename function by @abhaysood

### :books: Documentation

- (**android**): Update CPU usage calculation doc by @abhaysood in #946

## [android-v0.3.0] - 2024-07-16

### :sparkles: New features

- (**android**): Use URL from manifest for uploading builds by @abhaysood in #880
- (**android**): Allow configuring URL for API calls by @abhaysood
- (**android**): Implement user defined attributes by @abhaysood
- (**android**): Implement user triggered events by @abhaysood
- (**android**): Implement user triggered events by @abhaysood
- (**android**): Improve session management by @abhaysood
- (**android**): Add source to navigation and update tests by @abhaysood
- (**android**): Improve navigation schema by @abhaysood
- (**android**): Implement ANR tracking using SIGQUIT by @abhaysood
- (**android**): Track screenshots for exceptions and ANRs by @abhaysood
- (**android**): Implement app exit tracking by @abhaysood
- (**android**): Remove session, storage and transport layers by @abhaysood
- (**android**): Remove resource usages by @abhaysood
- (**android**): Remove collection of thread name and related classes by @abhaysood
- (**android**): Remove thread name everywhere by @abhaysood
- (**android**): Add attributes to all events by @abhaysood
- (**android**): Implement attribute generator by @abhaysood
- (**android**): Track okhttp request and response body by @abhaysood
- (**android**): Add gradle task to calculate app size by @abhaysood
- (**android**): Add foreground property to exceptions by @abhaysood
- (**android**): Implement compose navigation tracking by @abhaysood
- (**android**): Initialize a new compose navigation sample by @abhaysood
- (**android**): Add scripts to automate benchmark result interpretation by @abhaysood
- (**android**): Add benchmark for click and scroll detection by @abhaysood
- (**android**): Add startup benchmark by @abhaysood
- (**android**): Add trace sections to Measure by @abhaysood
- (**android**): Track gestures in compose by @abhaysood in #373
- (**android**): Auto add MeasureEventListenerFactory by @abhaysood
- (**android**): Use measure-gradle-plugin to upload mapping files by @abhaysood
- (**android**): Collect memory and cpu usage by @abhaysood
- (**android**): Add provision for adding a custom event factory by @abhaysood in #229
- (**android**): Track http event for okhttp using event listener by @abhaysood
- (**android**): Track locale in resource, exception and anr by @abhaysood
- (**android**): Track device locale as part of resource by @abhaysood
- (**android**): Track network info and network change event by @abhaysood
- (**android**): Add session samples for cold, warm and hot launch by @abhaysood
- (**android**): Implement cold, warm and hot launch by @abhaysood
- (**android**): Track thread name with all events (#174) by @abhaysood in #174
- (**android**): Collect cold launch method trace as attachment by @abhaysood
- (**android**): Add attachments to session multipart request by @abhaysood
- (**android**): Add attachments to session request by @abhaysood
- (**android**): Add attachments to session report by @abhaysood
- (**android**): Get all attachments from storage by @abhaysood
- (**android**): Persist attachment info by @abhaysood
- (**android**): Cold launch tracker (#154) by @abhaysood in #154
- (**android**): Track lifecycle events (#131) by @abhaysood in #131
- (**android**): Use int for gesture target width and height (#99) by @abhaysood in #99
- (**android**): Add gesture events (#87) by @abhaysood in #87
- (**android**): Add unit tests for session controller by @abhaysood in #78
- (**android**): Capture exit info for all sessions when available by @abhaysood in #77
- (**android**): Implement ANR watchdog to track ANRs by @abhaysood in #69
- (**android**): Persist and sync uncaught exceptions by @abhaysood in #48

### :bug: Bug fixes

- (**android**): Fix sdk initialization in benchmarks app by @abhaysood
- (**android**): Make disabling of signing easy by @abhaysood in #881
- (**android**): Fix events request schema by @abhaysood in #875
- (**android**): Fix benchmarks app setup by @abhaysood in #863
- (**android**): Fix http headers blocking logic by @abhaysood in #793
- (**android**): Track app exits only once per pid by @abhaysood
- (**android**): Fix fake config for androidTests by @abhaysood
- (**android**): Downgrade robolectric as it won't run tests after upgrade by @abhaysood
- (**android**): Non nullable network properties by @abhaysood
- (**android**): Use scheduleWithFixedDelay instead of scheduleWithFixedRate by @abhaysood in #754
- (**android**): Update internal docs by @abhaysood in #698
- (**android**): Update measure.api with renamed config by @abhaysood
- (**android**): Use defaults and user set http url blocklist by @abhaysood
- (**android**): Fix test compilation by @abhaysood
- (**android**): Use process start uptime for API 24 and above by @abhaysood
- (**android**): Match measure gradle plugin's kotlin version with rest of project by @abhaysood in #652
- (**android**): Remove measure-ndk module by @abhaysood
- (**android**): Improve error handling for event insertion by @abhaysood
- (**android**): Add name to attachment form data as expected by server by @abhaysood
- (**android**): Fix format of serialized attachments in an event by @abhaysood
- (**android**): Fix formatting by @abhaysood in #618
- (**android**): Fix test file names to match the class being tested by @abhaysood
- (**android**): Do not start CPU and memory collection if process is not in foreground by @abhaysood
- (**android**): Rename file by @abhaysood
- (**android**): Ensure batch creation for exceptions happens synchronously by @abhaysood
- (**android**): Fix failing test by @abhaysood
- (**android**): Add test for network client by @abhaysood
- (**android**): Fix app exit schema by @abhaysood
- (**android**): Fix disabled endpoints config for http body tracking by @abhaysood
- (**android**): Fix form data creation by @abhaysood
- (**android**): Fix request body json by @abhaysood
- (**android**): Fix request header key name by @abhaysood
- (**android**): Fix network changes test by @abhaysood
- (**android**): Close file buffer to avoid leak by @abhaysood in #542
- (**android**): Downgrade android-tools deps in gradle plugin by @abhaysood in #534
- (**android**): Warn if measure plugin is applied to a non android application project by @abhaysood
- (**android**): Warn if measure plugin is applied to a non android application project by @abhaysood in #493
- (**android**): Increment okhttp version 4.9.1 -> 4.12.0 by @abhaysood
- (**android**): Rename locale to device_locale by @abhaysood in #414
- (**android**): Fix gradle plugin transformation initialization by @abhaysood
- (**android**): Move release documentation to measure-android by @abhaysood
- (**android**): Functional tests to use correct gradle plugin version by @abhaysood
- (**android**): Fix typo in plugin task name by @abhaysood
- (**android**): Handle unsuccessful response after retries by @abhaysood
- (**android**): Get latest time from time provider by @abhaysood in #197
- (**android**): Fix gesture time types (#162) by @abhaysood in #162
- (**android**): Fix schema for gesture_scroll event (#108) by @abhaysood in #108
- (**android**): Create valid session json in case of zero events (#106) by @abhaysood in #106
- (**android**): Use put instead of post for /sessions by @abhaysood in #72
- (**android**): Switch to file based storage for events by @abhaysood in #67
- (**android**): Add limits to size of stack trace by @abhaysood

### :hammer: Misc

- (**android**): Update workflow to run for tags by @abhaysood in #919
- (**android**): Prepare next development version by @abhaysood
- (**android**): Prepare release 0.3.0 for SDK and gradle plugin by @abhaysood
- (**android**): Update publish step conditions by @abhaysood
- (**android**): Downgrade android-tools by @abhaysood in #913
- (**android**): Upgrade dependencies by @abhaysood
- (**android**): Add configuration to configure measure plugin for variants by @abhaysood in #912
- (**android**): Make meta data in manifest optional for gradle plugin by @abhaysood in #911
- (**android**): Upgrade autonomousapps-testkit plugin by @abhaysood
- (**android**): Improve error logs for gradle plugin by @abhaysood
- (**android**): Improve error handling for events export by @abhaysood in #898
- (**android**): Publish benchmark results on README by @abhaysood
- (**android**): Fix lint warning by @abhaysood
- (**android**): Run publish only for releases by @abhaysood in #870
- (**android**): Enable publishing to maven by @abhaysood in #862
- (**android**): Fix android tests by @abhaysood in #836
- (**android**): Remove user defined attributes from network request by @abhaysood
- (**android**): Update README by @abhaysood
- (**android**): Update architecture doc by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Update public API by @abhaysood
- (**android**): Implement persistence for user ID by @abhaysood
- (**android**): Implement persistence for user defined attributes by @abhaysood
- (**android**): Begin implementation for persisted attributes by @abhaysood
- (**android**): Improve executor services implementation by @abhaysood in #849
- (**android**): Update measure.api with new configs by @abhaysood
- (**android**): Remove unused code by @abhaysood
- (**android**): Rename function to better represent intent by @abhaysood
- (**android**): Update measure.api with config name change by @abhaysood in #755
- (**android**): Rename internal config by @abhaysood
- (**android**): Improve logging by @abhaysood
- (**android**): Fix formatting by @abhaysood
- (**android**): Improve exporting logic when an crash occurs by @abhaysood
- (**android**): Update to AGP 8.4.1 by @abhaysood in #730
- (**android**): Update ui automator to 2.3.0 by @abhaysood
- (**android**): Fix AabSize task test by @abhaysood
- (**android**): Upgrade robolectric to 4.12.1 by @abhaysood
- (**android**): Remove explicit kotlin dsl version by @abhaysood
- (**android**): Update android tools to 31.4.1 by @abhaysood
- (**android**): Update kotlin-dsl plugin to 4.4.0 by @abhaysood
- (**android**): Upgrade AGP version by @abhaysood
- (**android**): Prepare release for gradle plugin by @abhaysood
- (**android**): Prepare release 0.2.0 by @abhaysood in #728
- (**android**): Improve config docs and naming by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Update measure.api with new Measure.init function by @abhaysood
- (**android**): Apply configs which modify events centrally using new event transformer API by @abhaysood
- (**android**): Implement http url blocklist config by @abhaysood
- (**android**): Merge multiple intent data configs into one by @abhaysood
- (**android**): Implement configs for http headers by @abhaysood
- (**android**): Fix formatting by @abhaysood
- (**android**): Update measure.api by @abhaysood
- (**android**): Add docs for configs by @abhaysood
- (**android**): Rename configs for consistency by @abhaysood
- (**android**): Remove config in favor of ConfigProvider by @abhaysood
- (**android**): Fix test by @abhaysood
- (**android**): Replace config with new config provider for okhttp by @abhaysood
- (**android**): Replace config with new config provider for batch creator by @abhaysood
- (**android**): Replace config with new config provider for event processor by @abhaysood
- (**android**): Replace config with new config provider for screenshots by @abhaysood
- (**android**): Implement a config provider by @abhaysood
- (**android**): Remove unused MeasureApi interface by @abhaysood
- (**android**): Introduce a public MeasureConfig class by @abhaysood
- (**android**): Remove SDK init from content provider by @abhaysood
- (**android**): Update default masking level to AllTextAndMedia by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Add tests for screenshot masking by @abhaysood
- (**android**): Add different levels of masking as an enum by @abhaysood
- (**android**): Add demo for screenshot feature by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Improve screenshot feature by @abhaysood
- (**android**): Add new sample app events by @abhaysood in #655
- (**android**): Remove unused class by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Group variables for readability by @abhaysood
- (**android**): Fix double registration of anr collector by @abhaysood
- (**android**): Improve naming by @abhaysood
- (**android**): Rename bridge object to reflect it's global by @abhaysood
- (**android**): Remove watchdog ANR collector in favour of SIGQUIT ANR collector by @abhaysood
- (**android**): Setup an empty native module to collect ANRs and wire it with event processor for ANR detection by @abhaysood
- (**android**): Init measure-anr module by @abhaysood
- (**android**): Add new sessions to sessionator by @abhaysood in #648
- (**android**): Fix attachment data type in test by @abhaysood in #637
- (**android**): Fix formatting by @abhaysood
- (**android**): Fix formatting by @abhaysood in #636
- (**android**): Add test for event processor by @abhaysood
- (**android**): Fix broken android tests by @abhaysood
- (**android**): Fix formatting by @abhaysood in #635
- (**android**): Refactor event store by @abhaysood
- (**android**): Upgrade okio to 3.7.0 by @abhaysood in #620
- (**android**): Upgrade junit-jupiter to 5.10.2 by @abhaysood
- (**android**): Upgrade leak canary to 2.14 by @abhaysood
- (**android**): Upgrade gradle test kit versions by @abhaysood
- (**android**): Add functional test for latest agp version by @abhaysood
- (**android**): Upgrade AGP to 8.3.2 and compile sdk 34 by @abhaysood
- (**android**): Use config for ANR timeout by @abhaysood in #624
- (**android**): Reduce visibility of members in MeasureInitializer by @abhaysood
- (**android**): Remove unused code by @abhaysood
- (**android**): Create a process info provider to abstract process related information by @abhaysood
- (**android**): Reformat by @abhaysood in #616
- (**android**): Update measure.api by @abhaysood
- (**android**): Fix tests by @abhaysood
- (**android**): Improve Measure initialization setup by @abhaysood
- (**android**): Rename tracker to eventProcessor by @abhaysood
- (**android**): Rename sessionIdProvider to SessionManager by @abhaysood
- (**android**): Drop activity suffix from navigation sample file name by @abhaysood
- (**android**): Rename tracker to eventProcessor by @abhaysood
- (**android**): Remove incorrect activity declaration in manifest by @abhaysood
- (**android**): Fix formatting by @abhaysood in #614
- (**android**): Rename enum to better express the intent by @abhaysood
- (**android**): Fix formatting by @abhaysood
- (**android**): Delete files when events are exported successfully by @abhaysood
- (**android**): Use single directory to store all event and attachment files by @abhaysood
- (**android**): Fix formatting by @abhaysood
- (**android**): Update public api by @abhaysood
- (**android**): Fix android tests by @abhaysood
- (**android**): Make OkHttp collector class name consistent with other collectors by @abhaysood
- (**android**): Use ISO-8601 format for event timestamps by @abhaysood
- (**android**): Remove unused fields from AttachmentPacket by @abhaysood
- (**android**): Rename to attribute in events request by @abhaysood
- (**android**): Fix request ID header key by @abhaysood
- (**android**): Fix event schema by @abhaysood
- (**android**): Add tests for database by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Fix app exit tests by @abhaysood
- (**android**): Reduce calls to connectivity manager by @abhaysood
- (**android**): Improve method names by @abhaysood
- (**android**): Remove initial delay from PeriodicEventExporter by @abhaysood
- (**android**): Attempt to clean up old sessions when new session is created by @abhaysood
- (**android**): Add comment by @abhaysood
- (**android**): Add tests for event store by @abhaysood
- (**android**): Store http event in file storage if it contains request/response body by @abhaysood
- (**android**): Remove unused constructor arg by @abhaysood
- (**android**): Add gitignore for benchmarks python venv by @abhaysood
- (**android**): Remove unused function by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Add tests for event exporter by @abhaysood
- (**android**): Fix event deletion by @abhaysood
- (**android**): Export exceptions and ANRs on background thread by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Export exceptions & ANRs as soon as they occur by @abhaysood
- (**android**): Rename tracker to event processor in android tests by @abhaysood
- (**android**): Fix android tests by @abhaysood
- (**android**): Rewrite event processor and event store by @abhaysood
- (**android**): Add docs by @abhaysood
- (**android**): Reformat by @abhaysood
- (**android**): Refactor executor service implementation by @abhaysood
- (**android**): Assume success for all 2xx response codes by @abhaysood
- (**android**): Add tests by @abhaysood
- (**android**): Refactor PeriodicEventExporter by @abhaysood
- (**android**): Exported existing batches periodically by @abhaysood
- (**android**): Create network request to /events API by @abhaysood
- (**android**): Fetch events and attachments to export by @abhaysood
- (**android**): Setup a periodic batching of events by @abhaysood
- (**android**): Add extension to attachments table by @abhaysood
- (**android**): Fix test by @abhaysood
- (**android**): Cache shared preferences instance in PrefsStorage by @abhaysood
- (**android**): Fix attachment size calculation by @abhaysood
- (**android**): Add docs by @abhaysood
- (**android**): Add attachments size to events table by @abhaysood
- (**android**): Add trace sections to event processor by @abhaysood
- (**android**): Add tests for thread name attribute by @abhaysood
- (**android**): Format by @abhaysood
- (**android**): Reduce visibility of classes to internal by @abhaysood
- (**android**): Expose public API to set user ID by @abhaysood
- (**android**): Apply spotless by @abhaysood
- (**android**): Remove cold launch trace from android tests by @abhaysood
- (**android**): Store attributes by @abhaysood
- (**android**): Remove setting of redundant thread name attribute by @abhaysood
- (**android**): Add docs by @abhaysood
- (**android**): Safe return when attachment cannot be written by @abhaysood
- (**android**): Apply spotless by @abhaysood
- (**android**): Add convenience function to add attribute to event by @abhaysood
- (**android**): Add attachments by @abhaysood
- (**android**): Remove attachments by @abhaysood
- (**android**): Add thread name attribute to all events by @abhaysood
- (**android**): Add session ID to AttachmentEntity and EventEntity by @abhaysood
- (**android**): Rename event tracker to event processor by @abhaysood
- (**android**): Add tests for AttributeProcessor by @abhaysood
- (**android**): Add tests for AttachmentStore by @abhaysood
- (**android**): Add tests for AttachmentProcessor by @abhaysood
- (**android**): Implement attachments, remove transformers by @abhaysood
- (**android**): Implement attachment storage by @abhaysood
- (**android**): Add docs for Database by @abhaysood
- (**android**): Improve file storage API by @abhaysood
- (**android**): Remove synchronous mode config from sqlite by @abhaysood
- (**android**): Remove log by @abhaysood
- (**android**): Add tests for FileStorage by @abhaysood
- (**android**): Use writeException for both exception and ANR by @abhaysood
- (**android**): Improve logs by @abhaysood
- (**android**): Add tests InstallationIdAttributeProcessor by @abhaysood
- (**android**): Add tests for ComputeOnceAttributeProcessor by @abhaysood
- (**android**): Add documentation for event processor by @abhaysood
- (**android**): Add tests for attribute processor and event transformer by @abhaysood
- (**android**): Use fake event factory for EventProcessorTest by @abhaysood
- (**android**): Implement storage and event transformers by @abhaysood
- (**android**): Introduce event type by @abhaysood
- (**android**): Rename user attribute processor by @abhaysood
- (**android**): Rename to attribute processor by @abhaysood
- (**android**): Remove all transient usages by @abhaysood
- (**android**): Add documentation to attribute collectors by @abhaysood
- (**android**): Rename EventTracker to EventProcessor by @abhaysood
- (**android**): Add sample app sessions by @abhaysood
- (**android**): Add wikipedia sessions by @abhaysood
- (**android**): Remove old session data by @abhaysood
- (**android**): Fix formatting by @abhaysood in #532
- (**android**): Add functional tests for MeasurePlugin by @abhaysood
- (**android**): Make mapping–file and mapping_type optional by @abhaysood
- (**android**): Split app size task into aab and apk size tasks by @abhaysood
- (**android**): Add app size task to measure plugin by @abhaysood
- (**android**): Refactor BuildUploadTask by @abhaysood
- (**android**): Use directory to load APK instead of file by @abhaysood
- (**android**): Update app size output to contain build type by @abhaysood
- (**android**): Update upload task schema by @abhaysood
- (**android**): Fix failing measure gradle functional test by @abhaysood in #494
- (**android**): Reformat by @abhaysood in #481
- (**android**): Add android test by @abhaysood
- (**android**): Remove app_exit.timestamp from session data by @abhaysood
- (**android**): Track memory along with low memory event by @abhaysood in #458
- (**android**): Remove timestamp from app_exit event by @abhaysood in #459
- (**android**): Do not fail build when upload task fails, improve error messages by @abhaysood in #422
- (**android**): Use version catalog for centralizing dependencies (#404) by @abhaysood in #404
- (**android**): Clean up measure gradle dependencies by @abhaysood in #394
- (**android**): Reformat by @abhaysood
- (**android**): Fix typo in compose theme name by @abhaysood
- (**android**): Convert gesture benchmark to target finder by @abhaysood in #377
- (**android**): Reformat by @abhaysood
- (**android**): Run checks on all projects on ci by @abhaysood
- (**android**): Rename gradle plugin dir by @abhaysood
- (**android**): Update dependencies by @abhaysood in #369
- (**android**): Run gradle plugin tests on CI by @abhaysood in #356
- (**android**): Add action to publish measure sdk and plugin to github by @abhaysood in #353
- (**android**): Test plugin doesn't break configuration cache by @abhaysood in #334
- (**android**): Run all checks on CI by @abhaysood in #344
- (**android**): Fix formatting by @abhaysood
- (**android**): Add spotless plugin by @abhaysood in #343
- (**android**): Add binary-compatibility-validator by @abhaysood in #342
- (**android**): Downgrade kotlin 1.9.10, use java 17 for gradle plugin by @abhaysood
- (**android**): Upgrade gradle 8.5, AGP 8.2.1, Kotlin 1.9.20 by @abhaysood
- (**android**): Rename test files for clarity by @abhaysood
- (**android**): Use test rule for managing temp directories in tests by @abhaysood
- (**android**): Change plugin version to 0.0.1 by @abhaysood in #321
- (**android**): Ignore build directories by @abhaysood
- (**android**): Remove uneeded directory by @abhaysood
- (**android**): Optimize imports by @abhaysood in #294
- (**android**): Add session data by @abhaysood in #293
- (**android**): Remove unneeded query to load resource for session by @abhaysood in #177
- (**android**): Add attachment sample in session-samples by @abhaysood in #169
- (**android**): Refactor storage and remove measure client by @abhaysood
- (**android**): Refactor session initialization and storage (#149) by @abhaysood in #149
- (**android**): Add sample sessions for testing (#120) by @abhaysood in #120
- (**android**): Reformat by @abhaysood

### :zap: Performance

- (**android**): Improve perf of converting current time to ISO format by @abhaysood in #467

### :recycle: Refactor

- (**android**): Improve internal SDK traces by @abhaysood in #887
- (**android**): Improve config usage by @abhaysood in #871

### :books: Documentation

- (**android**): Update tag convention in RELEASE.md by @abhaysood
- (**android**): Add a index section for README by @abhaysood in #888
- (**android**): Update docs to allow configuring API URL by @abhaysood in #876
- (**android**): Add java doc by @abhaysood in #777
- (**android**): Remove un-needed info in the docs by @abhaysood
- (**android**): Remove cold launch method trace section as it's no longer collected by @abhaysood
- (**android**): Fix docs by @abhaysood
- (**android**): Documentation fixes by @abhaysood in #672
- (**android**): Update screenshot feature docs by @abhaysood
- (**android**): Add documentation for screenshot feature by @abhaysood
- (**android**): Update ANR feature documentation by @abhaysood in #649
- (**android**): Add readme to measure-ndk module by @abhaysood
- (**android**): Update version compatibility by @abhaysood
- (**android**): Add docs for thread management by @abhaysood
- (**android**): Add documentation for event storage, batching and export by @abhaysood
- (**android**): Add docs for Android Gradle Plugin by @abhaysood in #512
- (**android**): Update docs by @abhaysood
- (**android**): Add docs for lifecycle and navigation tracking by @abhaysood
- (**android**): Improve the benchmark readme by @abhaysood
- (**android**): Document release process by @abhaysood
- (**android**): Update readme by @abhaysood
- (**android**): Update network monitoring docs to mention gradle plugin by @abhaysood
- (**android**): Add missing links to readme by @abhaysood
- (**android**): Create a template for Android SDK documentation by @abhaysood

[android-v0.15.0]: https://github.com/measure-sh/measure/compare/android-v0.14.0..android-v0.15.0
[android-v0.14.0]: https://github.com/measure-sh/measure/compare/android-v0.13.0..android-v0.14.0
[android-v0.13.0]: https://github.com/measure-sh/measure/compare/android-v0.12.0..android-v0.13.0
[android-v0.12.0]: https://github.com/measure-sh/measure/compare/android-v0.11.0..android-v0.12.0
[android-v0.11.0]: https://github.com/measure-sh/measure/compare/android-v0.10.0..android-v0.11.0
[android-v0.10.0]: https://github.com/measure-sh/measure/compare/android-v0.9.0..android-v0.10.0
[android-v0.9.0]: https://github.com/measure-sh/measure/compare/android-v0.8.2..android-v0.9.0
[android-v0.8.2]: https://github.com/measure-sh/measure/compare/android-v0.8.0..android-v0.8.2
[android-v0.8.0]: https://github.com/measure-sh/measure/compare/android-v0.7.0..android-v0.8.0
[android-v0.7.0]: https://github.com/measure-sh/measure/compare/android-v0.6.1..android-v0.7.0
[android-v0.6.1]: https://github.com/measure-sh/measure/compare/android-v0.5.0..android-v0.6.1
[android-v0.5.0]: https://github.com/measure-sh/measure/compare/android-v0.4.0..android-v0.5.0
[android-v0.4.0]: https://github.com/measure-sh/measure/compare/android-v0.3.0..android-v0.4.0

