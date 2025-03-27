# Configuration Options

Measure provides a number of configuration options to customize the data collected and the behavior of the SDK. These
options can be set in the `MeasureConfig` object which is passed to the `Measure.shared.initialize` method. Example:

```swift
let config = BaseMeasureConfig(enableLogging: true,
                               samplingRateForErrorFreeSessions: 1.0,
                               trackHttpHeaders: true,
                               trackHttpBody: true,
                               httpHeadersBlocklist: ["Authorization"],
                               httpUrlBlocklist: ["http://localhost:8080"],
                               httpUrlAllowlist: ["example.com"])
Measure.shared.initialize(with: clientInfo, config: config)
```

# Contents

* [**samplingRateForErrorFreeSessions**](#samplingRateForErrorFreeSessions)
* [**enableLogging**](#enableLogging)
* [**trackHttpHeaders**](#trackHttpHeaders)
* [**httpHeadersBlocklist**](#httpHeadersBlocklist)
* [**trackHttpBody**](#trackHttpBody)
* [**httpUrlBlocklist**](#httpUrlBlocklist)
* [**httpUrlAllowlist**](#httpUrlAllowlist)


## `samplingRateForErrorFreeSessions`

Controls sampling rate for non-crashed sessions. Defaults to 0. 

A value between 0.0 and 1.0 can be set:
* 0.0 (default): Only collect crashed sessions
* 0.1: Collect 10% of non-crashed sessions
* 1.0: Collect all sessions

Note that all crashed sessions are collected regardless of this setting.

## `enableLogging`

Allows enabling/disabling internal logging of Measure SDK. This is useful to debug issues with the SDK
itself. By default, logging is disabled.


## `trackHttpHeaders`

Allows enabling/disabling capturing of HTTP request and response headers. Disabled by default.

## `httpHeadersBlocklist`

Allows specifying HTTP headers which should not be captured.
See [HTTP headers blocklist](features/feature_network_monitoring.md#httpHeadersBlocklist)

By default, the following headers are always disallowed to prevent sensitive information from
leaking:

* Authorization
* Cookie
* Set-Cookie
* Proxy-Authorization
* WWW-Authenticate
* X-Api-Key

## `trackHttpBody`

Allows enabling/disabling capturing of HTTP request and response body. Disabled by default.

## `httpUrlBlocklist`

Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not
want to collect data for certain endpoints or third party domains. By default, no URLs are blocked.

Note that this list is used only if `httpUrlAllowlist` is empty.

The check is made using [String.contains] to see if the URL contains any of the strings in
the list.

## `httpUrlAllowlist`

Allows enabling collection of `http` events only for certain URLs. This is useful to setup if you want
to collect data only for certain endpoints or third party domains. If this list is empty, `httpUrlBlocklist` is
considered. By default, this list is empty.

The check is made using [String.contains] to see if the URL contains any of the strings in
the list.