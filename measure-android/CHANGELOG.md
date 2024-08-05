# measure-android

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

## 0.3.0

Initial release to maven.

* Using `vanniktech/gradle-maven-publish-plugin` for publishing to maven by @abhaysood in https://github.com/measure-sh/measure/pull/862.
* Add `measure` extension to allow configuring the plugin by @abhaysood in https://github.com/measure-sh/measure/pull/912.
* Missing API key or URL in manifest does not fail builds by @abhaysood in https://github.com/measure-sh/measure/pull/911.
