# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### :hammer: Misc

- (**android**): Improve logging (#2022)
- (**android**): Reformat
- (**android**): Test app exit table version insertion
- (**android**): Add v3 to v4 migration test
- (**android**): Add version to app exit table
- (**android**): Handle app exit in signal processor
- (**android**): Extract attribute keys
- (**android**): Add db migration tests
- (**android**): Prepare next development version of android SDK

## [android-v0.10.0] - 2025-03-28

### :sparkles: New features

- (**android**): Track fragment ttid span (#1889)
- (**android**): Auto track activity TTID spans (#1868)
- (**android**): Add attributes to spans (#1848)
- (**android**): Implement bug reporting (#1780)

### :bug: Bug fixes

- (**android**): Truncate TTID span names to fit max span length (#1952)
- (**android**): Support java 11

### :hammer: Misc

- (**android**): Prepare android sdk release 0.10.0
- (**android**): Prepare android gradle plugin release 0.8.0 (#1989)
- (**android**): Add platform to builds API request (#1986)
- (**android**): Upgrade AGP and downgrade androidx.core (#1925)
- (**android**): Record a sample session with user ID (#1865)
- (**android**): Update robolectric & fix instrumentation test crash (#1820)
- (**android**): Prepare next development version for gradle plugin
- (**android**): Prepare gradle plugin release 0.7.0
- (**android**): Prepare next development version of SDK

## [android-v0.9.0] - 2025-01-06

### :sparkles: New features

- (**android**): Remove deprecated navigation event
- (**android**): Implement custom events with user defined attrs
- (**android**): Expose API to get current session ID
- (**android**): Implement core API for perf tracing
- (**android**): Attach SVG layout snapshots to click gestures
- (**android**): Expose APIs to allow start/stop of SDK
- (**android**): Add low power and thermal throttling attributes

### :bug: Bug fixes

- (**android**): Remove unneeded view id prefix in gesture events
- (**android**): Serialize numbers as numbers instead of string
- (**android**): Add keep rule for AndroidComposeView
- (**android**): Revert usage of reentrant lock for heartbeat and SDK initialization
- (**android**): Initialization issues

### :hammer: Misc

- (**android**): Prepare sdk release 0.9.0
- (**android**): Upgrade agp to 8.7.3
- (**android**): Apply spotless to gradle plugin module
- (**android**): Remove uneeded log for SVG
- (**android**): Bump up curtains to 1.2.5
- (**android**): Prepare next development version of SDK

### :recycle: Refactor

- (**android**): Avoid accessing thermal status change for older APIs
- (**android**): Implement batch insertions of events and spans in db

### :books: Documentation

- (**android**): Update benchmarks & related information in README

## [android-v0.8.2] - 2024-11-05

### :bug: Bug fixes

- (**android**): Revert to use uptime millis for launch tracking
- (**android**): Use shared prefs commit to update recent session

### :hammer: Misc

- (**android**): Prepare sdk release 0.8.2
- (**android**): Always collect events required for journey
- (**android**): Change default sampling rate to 0
- (**android**): Prepare next development version of SDK
- (**android**): Prepare sdk release 0.8.1
- (**android**): Prepare next development version of SDK

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
- (**android**): Prepare gradle plugin release 0.6.1

### :recycle: Refactor

- (**android**): Use monotonic clock to get time

## [android-v0.7.0] - 2024-09-25

### :sparkles: New features

- (**android**): Add parent fragment to fragment lifecycle events (#1262)
- (**android**): Add lukewarm launch

### :bug: Bug fixes

- (**android**): Lukewarm time duration calculation
- (**android**): Incorrect URL parsing
- (**android**): Report activity launched with saved state as warm launch
- (**android**): Fix blank screenshots for Android 15
- (**android**): Support 16KB page size and add it to attibutes

### :hammer: Misc

- (**android**): Prepare sdk release 0.7.0
- (**android**): Run benchmarks for 0.7.0 version
- (**android**): Update tests
- (**android**): Log instead of throw when URL is incorrect
- (**android**): Improve logs
- (**android**): Log request URL and method
- (**android**): Update sdk version to 35 and agp to 8.6
- (**android**): Prepare next development version of SDK

## [android-v0.6.1] - 2024-09-04

### :sparkles: New features

- (**android**): Apply bytecode transformation only for supported dependency versions
- (**android**): Enable automaticRelease to maven central

### :bug: Bug fixes

- (**android**): Crash when app visible time isn't available to calculate launch time
- (**android**): Handle exceptions when loading native library
- (**android**): Update gradle plugin group id
- (**android**): Make Android tests more reliable
- (**android**): Resolve crash when OkHttp is not a runtime dependency

### :hammer: Misc

- (**android**): Prepare sdk release 0.6.1
- (**android**): Prepare next development version for gradle plugin
- (**android**): Prepare gradle plugin release 0.6.0
- (**android**): Prepare next development version of SDK
- (**android**): Prepare sdk release 0.6.0
- (**android**): Enable publishing on gradle plugin portal
- (**android**): Prepare next development version for gradle plugin
- (**android**): Prepare gradle plugin release 0.5.0
- (**android**): Prepare next development version of SDK

### :recycle: Refactor

- (**android**): Remove usage of double bang operator
- (**android**): Replace throw with a error log
- (**android**): Fix potential exception in launch tracker

## [android-v0.5.0] - 2024-08-19

### :sparkles: New features

- (**android**): Configure http urls to collect events for

### :bug: Bug fixes

- (**android**): Respect http configs for trackHttpBody and trackHttpHeaders
- (**android**): Overflow due to incorrect data type for time
- (**android**): Use same thread for session and event insertion

### :hammer: Misc

- (**android**): Prepare sdk release 0.5.0
- (**android**): Update docs and min-max supported versions for bytecode transformations
- (**android**): Add dependencies block config in plugin fixture
- (**android**): Add version checks to apply asm transformations
- (**android**): Include semver source code and implement serializable
- (**android**): Add end to end tests for event collection
- (**android**): Remove existing android tests
- (**android**): Disabling measure plugin disables all features
- (**android**): Read and log http response body
- (**android**): Add log to warn when mapping file is not found
- (**android**): Add gitignore for gradle plugin
- (**android**): Add todo for handling event insertion failures for early crashes
- (**android**): Improve error handling for event insertion failures
- (**android**): Create new session before any collectors are registered
- (**android**): Implement versioning for sample app
- (**android**): Update references to path measure-android to android
- (**android**): Rename measure-android directory to android

### :books: Documentation

- Move android docs

[unreleased]: https://github.com///compare/android-v0.10.0..HEAD
[android-v0.10.0]: https://github.com///compare/android-v0.9.0..android-v0.10.0
[android-v0.9.0]: https://github.com///compare/android-v0.8.2..android-v0.9.0
[android-v0.8.2]: https://github.com///compare/android-v0.8.0..android-v0.8.2
[android-v0.8.0]: https://github.com///compare/android-v0.7.0..android-v0.8.0
[android-v0.7.0]: https://github.com///compare/android-v0.6.1..android-v0.7.0
[android-v0.6.1]: https://github.com///compare/android-v0.5.0..android-v0.6.1
[android-v0.5.0]: https://github.com///compare/android-v0.4.0..android-v0.5.0

