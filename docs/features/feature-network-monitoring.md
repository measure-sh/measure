# Network Monitoring

* [**Overview**](#overview)
* [**Data collected**](#data-collected)

Measure SDK can capture network requests, responses and failures along with useful metrics to help understand how APIs
are performing in production from an end user perspective.

## Overview

Most heavy lifting of network monitoring is done automatically by the Measure SDK. There are a lot of configuration
options available to control the behavior of network monitoring.

#### Android

On Android, network requests made using the [OkHttp](https://square.github.io/okhttp/) library, including any third
party libraries, are automatically tracked by simply adding the Measure Android Gradle Plugin.

#### iOS

On iOS, network requests made using the [URLSession](https://developer.apple.com/documentation/foundation/urlsession),
including any third party libraries, are automatically tracked by simply adding the iOS SDK to your project.

#### Flutter

On Flutter, network requests made using the [Dio](https://pub.dev/packages/dio) package can be tracked by adding
the `measure_dio` package to your project. This package provides `MsrInterceptor` that can automatically
track network requests done using Dio.


```yaml
dependencies:
  measure_dio: ^0.1.1
```

```dart
final dio = Dio();
dio.interceptors.add(MsrInterceptor());
```

For any other HTTP client libraries, you can manually track network requests using the `trackHttpEvent` method. 
Example using `http` package:

```dart
import 'package:http/http.dart' as http;
import 'package:measure/measure.dart';

Future<http.Response> trackedGet(Uri uri, {Map<String, String>? headers}) async {
  return _trackRequest(() => http.get(uri, headers: headers), uri, 'get', headers);
}

Future<http.Response> trackedPost(Uri uri, {Map<String, String>? headers, Object? body}) async {
  return _trackRequest(() => http.post(uri, headers: headers, body: body), uri, 'post', headers, body);
}

Future<http.Response> _trackRequest(
    Future<http.Response> Function() request,
    Uri uri,
    String method,
    Map<String, String>? headers,
    [Object? body]
    ) async {
  final measure = Measure.instance;
  final startTime = measure.getTimestamp();

  try {
    final response = await request();

    measure.trackHttpEvent(
      url: uri.toString(),
      method: method,
      statusCode: response.statusCode,
      startTime: startTime,
      endTime: measure.getTimestamp(),
      requestHeaders: headers,
      responseHeaders: response.headers,
      requestBody: body?.toString(),
      responseBody: response.body,
      client: 'http',
    );

    return response;
  } catch (e) {
    measure.trackHttpEvent(
      url: uri.toString(),
      method: method,
      startTime: startTime,
      endTime: measure.getTimestamp(),
      failureReason: e.runtimeType.toString(),
      failureDescription: e.toString(),
      requestHeaders: headers,
      requestBody: body?.toString(),
      client: 'http',
    );
    rethrow;
  }
}
```

## Configuration Options

By default, all network requests are tracked with key information like the URL, HTTP method, response status code,
timestamp, any failure reason, and the duration of the request. You can also optionally, disable certain URLs from
being tracked or track additional information like request and response headers, request body, and response body.

All configuration options can be set during SDK initialization.

### Configure URLs to track or ignore

Use `httpUrlAllowlist` to specify a list of URLs that should be tracked. If this is set, only the URLs in this list
will be tracked. This is useful to ensure that only specific APIs are monitored, especially in cases where
you want to avoid tracking sensitive or unnecessary URLs.

If you are unsure about which URLs to track, you can leave this option empty and instead use `httpUrlBlocklist` to
specify a list of URLs that should not be tracked.

You should only use one of these options at a time, either `httpUrlAllowlist` or `httpUrlBlocklist`. If both are
specified, the SDK will take `httpUrlAllowlist` as the source of truth and ignore the `httpUrlBlocklist`.

The check for URLs is done using a simple string match. For example, if you specify `https://api.example.com/`,
then all requests to `https://api.example.com/` and its sub-paths will be tracked. If you want to track only a specific
endpoint, you can specify the full URL, like `https://api.example.com/v1/users`.

Note that wildcards are not supported yet.

### Track HTTP headers

Use `trackHttpHeaders` to control whether HTTP headers should be tracked for network requests. By default, this is set
to `false`.

By default, the following headers are always disallowed to prevent sensitive information from
leaking:

* Authorization
* Cookie
* Set-Cookie
* Proxy-Authorization
* WWW-Authenticate
* X-Api-Key

To add additional headers to this list, use the `httpHeadersBlocklist` configuration option to provide a list of
additional headers that should not be tracked.

### Track HTTP body

Use `trackHttpBody` to control whether HTTP request and response bodies should be tracked for network requests. By
default, this is set to `false`. This option only works for `application/json` content type.

On **iOS**, enable network tracking for a given URLSession to track HTTP body. This is done by adding the
`MsrNetworkInterceptor` to the URLSession configuration as shown below:

```swift
let configuration = URLSessionConfiguration.default
MsrNetworkInterceptor.enable(on: configuration)
self.session = URLSession(configuration: configuration)
```

> [!CAUTION]
> Note that tracking HTTP bodies can significantly increase the size of the collected data, so it should be used with
> caution. Typically, setting this to `true` is only recommended using a feature flag which can be controlled remotely
> and turned on for very specific conditions for a limited time.

## Data collected

Checkout the data collected by Measure for each HTTP request in the [HTTP Event](../api/sdk/README.md#http) section.