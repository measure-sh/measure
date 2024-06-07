# Feature - Network Monitoring

Measure SDK can capture network requests, responses and failures along with useful metrics to help
understand how APIs are performing in production from an end user perspective. Network monitoring for OkHttp is
currently supported, more clients will be added in the future.

## OkHttp

Measure can track HTTP request body, response body, response code, response headers, request duration, and more from
OkHttp. Using the Measure Gradle Plugin, this tracking is done automatically for all `OkHttpClient` instances in your
app, including the ones in third party libraries.

### How it works

Measure Gradle Plugin injects
an [Application Interceptor](../../measure/src/main/java/sh/measure/android/okhttp/MeasureOkHttpApplicationInterceptor.kt)
and an [Event Listener Factory](../../measure/src/main/java/sh/measure/android/okhttp/MeasureEventListenerFactory.kt)
into all `OkHttpClient` instances used by your application.

This is done using ASM, a bytecode manipulation library, which transforms code at compile time to add the necessary
hooks. Read more about automatic
instrumentation [here](../../measure-android-gradle/README.md#automatic-instrumentation).

### Data collected

Checkout the data collected by Measure for each HTTP request in the [HTTP Event](../../../docs/api/sdk/README.md#http) section.

### Configuration

#### `restrictedHttpUrlBlocklist`

Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not
want to collect data for certain endpoints or third party domains. By default, Measure endpoints
are always disabled.

The check is made in order of the list and uses a simple `contains` check to see if the URL
contains any of the strings in the list.

Internally, this list is combined with [restrictedHttpUrlBlocklist] to form the final blocklist.
Example:
```kotlin
MeasureConfig(
    httpUrlBlocklist = listOf(
        "example.com", // disables a domain, it's subdomains and paths
        "api.example.com", // disable a subdomain and it's paths
        "example.com/order" // disable a particular path on a domain
    )
)
```

#### `enableHttpHeaders`

Allows enabling/disabling capturing of HTTP request and response headers. Disabled by default.

#### `enableHttpBody`

Allows enabling/disabling capturing of HTTP request and response body. Disabled by default.

#### `httpHeadersBlocklist`

Allows specifying HTTP headers which should not be captured.

Example:

```kotlin
MeasureConfig(
    enableHttpHeaders = listOf("X-Request-Id")
)
```

By default, the following headers are always disallowed to prevent sensitive information from
leaking:

* Authorization
* Cookie
* Set-Cookie
* Proxy-Authorization
* WWW-Authenticate
* X-Api-Key
