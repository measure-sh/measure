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
an [Application Interceptor](../../../android/measure/src/main/java/sh/measure/android/okhttp/MeasureOkHttpApplicationInterceptor.kt)
and an [Event Listener Factory](../../../android/measure/src/main/java/sh/measure/android/okhttp/MeasureEventListenerFactory.kt)
into all `OkHttpClient` instances used by your application.

This is done using ASM, a bytecode manipulation library, which transforms code at compile time to add the necessary
hooks. Read more about automatic
instrumentation [here](../../../android/measure-android-gradle/README.md#automatic-instrumentation).

### Request and Response Body
Measure supports collecting request and response body, this is currently restricted to APIs which have a
header `Content-Type: application/json`. This feature is disabled by default and can be enabled
using [enableHttpBody](#enableHttpBody) config.

### Data collected

Checkout the data collected by Measure for each HTTP request in the [HTTP Event](../../api/sdk/README.md#http) section.
