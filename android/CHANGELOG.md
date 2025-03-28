# measure-android

# 0.10.0

#### Important notes
* This version of the SDK *must* be paired with v0.6.0 version of the server or higher. Older server versions will 
drop events.

#### Features

* feat(android): add attributes to spans by @abhaysood in https://github.com/measure-sh/measure/pull/1848
* feat(android): auto track activity TTID spans by @abhaysood in https://github.com/measure-sh/measure/pull/1868
* feat(android): auto track fragment ttid by @abhaysood in https://github.com/measure-sh/measure/pull/1889

#### Fixes

* fix(android): support java 11 by @abhaysood in https://github.com/measure-sh/measure/pull/1735
* chore(android): upgrade AGP and downgrade androidx.core by @abhaysood in https://github.com/measure-sh/measure/pull/1925

#### Others

* docs(android): improve android readme by @abhaysood in https://github.com/measure-sh/measure/pull/1793
* chore(android): update robolectric by @abhaysood in https://github.com/measure-sh/measure/pull/1820
* fix(android): truncate TTID span names to fit max span length by @abhaysood in https://github.com/measure-sh/measure/pull/1952

# 0.9.0

#### Important notes

* This version of the SDK *must* be paired with v0.5.0 version of the server or higher. Older server versions will 
drop events.
* Breaking changes:
  * Deprecated `Measure.trackNavigation` method has been removed. Use `Measure.trackScreenView` instead.
  * Config `sessionSamplingRate` renamed to `samplingRateForErrorFreeSessions` to be more precise.
* Dependency updates:
  * chore(android): upgrade AGP version by @abhaysood in https://github.com/measure-sh/measure/pull/1672
  * chore(android): bump up curtains to 1.2.5 by @abhaysood in https://github.com/measure-sh/measure/pull/1536

#### Features

* feat(android): add low power and thermal throttling attributes by @abhaysood in https://github.com/measure-sh/measure/pull/1525
* feat(android): expose APIs to start/stop SDK by @abhaysood in https://github.com/measure-sh/measure/pull/1533
* feat(android): attach layout snapshots with gesture click events by @abhaysood in https://github.com/measure-sh/measure/pull/1551
* feat(android): implement tracing for Android by @abhaysood in https://github.com/measure-sh/measure/pull/1405
* feat(android): expose API to get current session ID by @abhaysood in https://github.com/measure-sh/measure/pull/1634
* feat(android): support custom events and attributes by @abhaysood in https://github.com/measure-sh/measure/pull/1616


#### Fixes

* fix(android): initialization issues by @abhaysood in https://github.com/measure-sh/measure/pull/1538
* fix(android): revert usage of reentrant lock for heartbeat and SDK initialization by @abhaysood in https://github.com/measure-sh/measure/pull/1539
* fix(android): add keep rule for AndroidComposeView by @abhaysood in https://github.com/measure-sh/measure/pull/1540
* fix(android): serialize numbers as numbers instead of string in user def attrs by @abhaysood in https://github.com/measure-sh/measure/pull/1667
* fix(android): remove unneeded view id prefix in gesture events by @abhaysood in https://github.com/measure-sh/measure/pull/1673
* chore(android): apply spotless to gradle plugin module by @abhaysood in https://github.com/measure-sh/measure/pull/1671


#### Others

* docs(android): update benchmarks & related information in README by @abhaysood in https://github.com/measure-sh/measure/pull/1537
* refactor(android): implement batch insertions of events and spans in db by @abhaysood in https://github.com/measure-sh/measure/pull/1659
* refactor(android): avoid accessing thermal status change for older APIs by @abhaysood in https://github.com/measure-sh/measure/pull/1661
* docs(android): add minimum version compatibility by @abhaysood in https://github.com/measure-sh/measure/pull/1670


# 0.8.2

#### Features

chore(android): Collect only launch & journey events for non-crashed sessions by @abhaysood in https://github.com/measure-sh/measure/pull/1482
All events for crashed sessions continue to be reported. Non-crashed sessions are not reported by default, only launch and lifecycle events
are reported.


# 0.8.1

#### Fixes

* fix(android): create new session if previous session crashed by @abhaysood in https://github.com/measure-sh/measure/pull/1439
* fix(android): use uptime millis for cold launch instead of realtime elapsed by @abhaysood in https://github.com/measure-sh/measure/pull/1438

# 0.8.0
#### Features

* feat(android): add screen view event & deprecate navigation event by @abhaysood in https://github.com/measure-sh/measure/pull/1265
* feat(android): improve session management by @abhaysood in https://github.com/measure-sh/measure/pull/1372

#### Fixes

* fix(android): track fragment lifecycle events when r8 is enabled by @abhaysood in https://github.com/measure-sh/measure/pull/1327
* fix(android): ignore duplicate inserts to app exit by @abhaysood in https://github.com/measure-sh/measure/pull/1379
* chore(android): remove unnecessary logs for launch tracking by @abhaysood in https://github.com/measure-sh/measure/pull/1382
* chore(android): support latest stable compose-navigation by @abhaysood in https://github.com/measure-sh/measure/pull/1383
* chore(android): remove low memory event by @abhaysood in https://github.com/measure-sh/measure/pull/1384
* chore(android): add max session duration config by @abhaysood in https://github.com/measure-sh/measure/pull/1392
* fix(android): handle session management when elapsed time gets reset by @abhaysood in https://github.com/measure-sh/measure/pull/1394
* refactor(android): use monotonic clock to get time by @abhaysood in https://github.com/measure-sh/measure/pull/1402

**Full Changelog**: https://github.com/measure-sh/measure/compare/android-v0.7.0...0.8.0](https://github.com/measure-sh/measure/pull/1265)

# 0.7.0
#### Features

* feat(android): report activity launched with saved state as warm launch by @abhaysood in https://github.com/measure-sh/measure/pull/1247
* feat(android): handle warm launches that are lukewarm by @abhaysood in https://github.com/measure-sh/measure/pull/1268
* feat(android): add parent fragment to fragment lifecycle events by @abhaysood in https://github.com/measure-sh/measure/pull/1262

#### Fixes

* fix(android): make sdk 16KB page size compliant by @abhaysood in https://github.com/measure-sh/measure/pull/1211
* fix(android): blank screenshots for Android 15 by @abhaysood in https://github.com/measure-sh/measure/pull/1233
* fix(android): incorrect URL parsing by @abhaysood in https://github.com/measure-sh/measure/pull/1272

### Others
* chore(android): update sdk version to 35 and agp to 8.6 by @abhaysood in https://github.com/measure-sh/measure/pull/1253
  
**Full Changelog**: https://github.com/measure-sh/measure/compare/android-v0.6.1...v0.7.0

## 0.6.1
#### Fixes

* fix(android): handle exceptions when loading native library by @abhaysood in https://github.com/measure-sh/measure/pull/1179
* fix(android): NPE when app visible time isn't available to calculate launch time by @abhaysood in https://github.com/measure-sh/measure/pull/1183
* refactor(android): remove usage of double bang operator by @abhaysood in https://github.com/measure-sh/measure/pull/1185 

## 0.6.0
#### Fixes

* Resolve crash when OkHttp is not a runtime dependency by @abhaysood in https://github.com/measure-sh/measure/pull/1067
* Make Android tests more reliable by @abhaysood in https://github.com/measure-sh/measure/pull/1070

**Full Changelog**: https://github.com/measure-sh/measure/compare/android-v0.5.0...0.6.0

## 0.5.0
#### Features
* Allow configuring http urls for which to enable collection of http events. This configuration is simpler to setup 
than finding out all URLs to block by @abhaysood in https://github.com/measure-sh/measure/pull/1020

#### Fixes
* fix(android): gracefully handle session and event insertion failures by @abhaysood in https://github.com/measure-sh/measure/pull/1008
* fix(android): overflow due to incorrect data type for time by @abhaysood in https://github.com/measure-sh/measure/pull/1014

**Full Changelog**: https://github.com/measure-sh/measure/compare/android-v0.4.0...0.5.0

## 0.4.0
#### Features
* Add ability to turn on logs for the SDK, logs are disabled by default by @abhaysood in https://github.com/measure-sh/measure/pull/925
* Add ability to configure sampling rate for non-crashed sessions by @abhaysood in https://github.com/measure-sh/measure/pull/955

#### Fixes
* Fix network provider attribute key name by @abhaysood in https://github.com/measure-sh/measure/pull/929
* Fix calculation of CPU & memory usage by @abhaysood in https://github.com/measure-sh/measure/pull/946
* Use process death time instead of current time for AppExit timestamp by @abhaysood in https://github.com/measure-sh/measure/pull/954
* Guard executor submit blocks with try-catch blocks by @abhaysood in https://github.com/measure-sh/measure/pull/961
* Add indexes to database by @abhaysood in https://github.com/measure-sh/measure/pull/966
* Make OkHttp a compile time dependency for the SDK by @abhaysood in https://github.com/measure-sh/measure/pull/980

## 0.3.0

Initial release to maven.

* Better session management. A new session is created when the app is launched after a certain
  period of inactivity. Prior to this, a new session was created during cold start by @abhaysood in https://github.com/measure-sh/measure/pull/793.
* Improved export logic for better session replay during crashes. Earlier, exceptions were at times
  exported without events that occurred just before the crash, leading to incomplete session replay by @abhaysood in https://github.com/measure-sh/measure/pull/755.
* Improved executor services usage. Does not have any impact on the SDK usage by @abhaysood in https://github.com/measure-sh/measure/pull/849.
* Network attributes are now non-nullable. Does not have any impact on the SDK usage by @abhaysood in https://github.com/measure-sh/measure/pull/726.
* Using `vanniktech/gradle-maven-publish-plugin` for publishing to maven by @abhaysood in https://github.com/measure-sh/measure/pull/862.

# measure-android-gradle

## 0.8.0
* chore(android): add platform to builds API request by @abhaysood in https://github.com/measure-sh/measure/pull/1986

## 0.7.0
* fix(android): support java 11 by @abhaysood in https://github.com/measure-sh/measure/pull/1735

## 0.6.1
* fix(android): incorrect URL parsing by @abhaysood in https://github.com/measure-sh/measure/pull/1272

## 0.6.0
#### Features

* Apply bytecode transformation only for supported dependency versions by @abhaysood in https://github.com/measure-sh/measure/pull/1087

## 0.5.0
#### Features
* Add version constraints for bytecode transformation to ensure bytecode transformation is applied only to library
  versions which are compatible by @abhaysood in https://github.com/measure-sh/measure/pull/1053

#### Fixes
* fix(android): plugin does not break configuration cache by @abhaysood in https://github.com/measure-sh/measure/pull/986

## 0.4.0
#### Fixes
* Fix for plugin breaking the configuration cache by @abhaysood in https://github.com/measure-sh/measure/pull/986

## 0.3.0

Initial release to maven.

* Using `vanniktech/gradle-maven-publish-plugin` for publishing to maven by @abhaysood in https://github.com/measure-sh/measure/pull/862.
* Add `measure` extension to allow configuring the plugin by @abhaysood in https://github.com/measure-sh/measure/pull/912.
* Missing API key or URL in manifest does not fail builds by @abhaysood in https://github.com/measure-sh/measure/pull/911.
