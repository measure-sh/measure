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
                               httpUrlAllowlist: ["example.com"],
                               autoStart: true,
                               trackViewControllerLoadTime: true)
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
* [**autoStart**](#autoStart)
* [**trackViewControllerLoadTime**](#trackViewControllerLoadTime)


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

## `autoStart`

Controls whether to start tracking immediately or delay starting the SDK.

Defaults to true.

Use `Measure.start` to start the SDK at a different point and `Measure.stop` to stop the SDK from tracking
data.

## `trackViewControllerLoadTime`

Enables or disables automatic collection of ViewController load time.

Defaults to `true`.
    
ViewController load time measures the time between when the ViewController's view is loaded and the first frame is drawn on the screen. This is also known as **Time to First Frame (TTF)** or **Time to Initial Display (TTID)**.
    
A large TTID value means users are waiting too long before any content appears on screen during app navigation.
    
Each ViewController load time is captured as a `Span` with the name `VC TTID <class name>`. For example, for a class `MainViewController`, the span name would be: `VC TTID MainViewController`.
