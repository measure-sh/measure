# Feature - Network Monitoring

Measure SDK can capture network requests, responses, and failures along with useful metrics to help understand how APIs are performing in production from an end-user perspective. Network monitoring is currently supported for URLSession's data tasks.

### How It Works

Measure uses two techniques to intercept network requests. The first method relies on swizzling `NSURLSessionTask`'s `setState:` method, while the second method involves adding a custom implementation of `URLProtocol` to `URLSessionConfiguration`'s `protocolClasses`.

While the swizzling of the `setState:` method provides sufficient information about network requests, such as the request URL, headers, and status, it does not give access to the response data. However, the advantage of this approach is that no additional code needs to be added on the app side.

To address the limitation of not being able to track response objects, Measure also provides an option for developers to enable network tracking for a given `URLSession`. All you need to do is add the following code:

```swift
let configuration = URLSessionConfiguration.default
MsrNetworkInterceptor.enable(on: configuration)
self.session = URLSession(configuration: configuration)
```

If the `MsrNetworkInterceptor` is enabled for a particular URLSession, automated network tracking is disabled, and only the network requests of the enabled URLSession are tracked.

### Data collected

Checkout the data collected by Measure for each HTTP request in the [HTTP Event](../../api/sdk/README.md#http) section.