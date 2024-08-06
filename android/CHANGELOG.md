# measure-android

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

## 0.4.0
#### Fixes
* Fix for plugin breaking the configuration cache by @abhaysood in https://github.com/measure-sh/measure/pull/986

## 0.3.0

Initial release to maven.

* Using `vanniktech/gradle-maven-publish-plugin` for publishing to maven by @abhaysood in https://github.com/measure-sh/measure/pull/862.
* Add `measure` extension to allow configuring the plugin by @abhaysood in https://github.com/measure-sh/measure/pull/912.
* Missing API key or URL in manifest does not fail builds by @abhaysood in https://github.com/measure-sh/measure/pull/911.
