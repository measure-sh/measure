# Feature — Performance Tracing

* [Introduction](#introduction)
* [API Reference](#api-reference)
    * [Limits](#limits)
    * [Start a span](#start-a-span)
    * [End a span](#end-a-span)
    * [Set span parent](#set-parent-span)
    * [Set attributes](#set-attributes)
    * [Remove attribute](#remove-attribute)
    * [Add checkpoint](#add-checkpoint)
    * [Deferred span start](#deferred-span-start)
* [Distributed Tracing](#distributed-tracing)
    * [URLSession example](#example-with-urlsession)
* [Naming Convention](#naming-conventions)
    * [Span Names](#span-names)
        * [Function Calls](#function-calls)
        * [Http](#http)
        * [Database](#database)

## Introduction

Tracing helps understand how long certain operations take to complete, from the moment they begin until they finish, including all the intermediate steps, dependencies, and parallel activities that occur during execution.

A **trace** represents the entire operation, which could be a complete user journey like onboarding, further divided into multiple steps like login, create profile, etc. A trace is represented by a `traceId`.

A **span** is the fundamental building block of a trace. A span represents a single unit of work. This could be an HTTP request, a database query, a function call, etc. Each span contains information about the operation — when it started, how long it took, and whether it completed successfully or not. A span is identified using a `spanId` and a user-defined `name`.

To achieve this, spans in a trace are organized as a Directed Acyclic Graph (DAG). This means spans can have a parent span, and each span can have multiple children. This is done by adding a **parentId** to each span, whose value is the `spanId` of its parent.

## API Reference

### Limits

The following limits apply to spans. Spans violating the limits will either be discarded or have their data truncated.

|                            | Limit |
|----------------------------|-------|
| Max span name length       | 64    |
| Max checkpoint name length | 64    |
| Max checkpoints per span   | 100   |

### Start a span

A span can be started using the `startSpan` function.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name")
```

A span can also be started by providing the start time. This is useful in cases where a certain operation has already started, but there wasn't any way to access the Measure APIs in that part of the code.

> **Important**  
> To set the start time, use `Measure.shared.getCurrentTime()`, which returns epoch time calculated using a monotonic clock. Passing in `Date().timeIntervalSince1970` can lead to issues with corrupted span timings due to clock skew issues.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name", timestamp: Measure.shared.getCurrentTime())
```

### End a span

A span can be ended using the `end` function. Status is mandatory to set when ending a span.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name")
span.setStatus(.ok).end()
```

A span can also be ended by providing the end time. This is useful in cases where a certain operation has already ended, but there wasn't any way to access the Measure APIs in that part of the code.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name")
span.setStatus(.ok).end(timestamp: Measure.shared.getCurrentTime())
```

### Set parent span

```swift
let parentSpan: Span = Measure.shared.startSpan(name: "parent-span")
let childSpan: Span = Measure.shared.startSpan(name: "child-span").setParent(parentSpan)
```

### Set attributes

Attributes are key-value pairs that can be attached to a span. Attributes are used to add additional context to a span.

To add attributes to a span, use `setAttribute`.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name")
span.setAttribute("key", value: "value")
```

To add multiple attributes at once, use `setAttributes`.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name")
let attributes: [String: AttributeValue] = ["key": "value", "key2": 42]
span.setAttributes(attributes)
```

### Remove attribute

To remove an attribute, use `removeAttribute`.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name")
span.removeAttribute("key")
```

### Update span name

To update the name of the span after it is started, use `setName`.

```swift
let span: Span = Measure.shared.startSpan(name: "span-name")
span.setName("updated-name").end()
```

### Add checkpoint

```swift
let span: Span = Measure.shared.startSpan(name: "span-name").setCheckpoint("checkpoint-name")
```

### Deferred span start

The span builder API allows pre-configuring a span without starting it immediately.

```swift
let spanBuilder: SpanBuilder = Measure.shared.createSpanBuilder(name: "span-name")!
let span: Span = spanBuilder.startSpan()
```

The span builder also allows setting a parent using the builder:

```swift
let spanBuilder: SpanBuilder = Measure.shared.createSpanBuilder(name: "span-name")!
    .setParent(parentSpan)
let span: Span = spanBuilder.startSpan()
```

## Distributed Tracing

Distributed tracing is a monitoring method that helps track requests as they travel through different services in a distributed system (like microservices, serverless functions, and mobile apps).

The `traceparent` header is a key component of distributed tracing that helps track requests as they flow through different services. It follows the [W3C Trace Context specification](https://www.w3.org/TR/trace-context/#header-name) and consists of four parts in a single string:

Example: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`

Where:

* `00`: Version
* `4bf92f3577b34da6a3ce929d0e0e4736`: Globally unique trace ID
* `00f067aa0ba902b7`: Parent span ID (representing the current operation)
* `01`: Trace flags (like whether sampling is enabled)

When your mobile app makes API calls, including this header allows you to correlate the client-side operations with server-side processing, giving you end-to-end visibility of your request flow.

To get a trace parent header:

```swift
let span = Measure.shared.startSpan(name: "http")
let key = Measure.shared.getTraceParentHeaderKey()
let value = Measure.shared.getTraceParentHeaderValue(span: span)
```

#### Example with URLSession

```swift
// Create a URLSession interceptor to handle tracing
class TracingInterceptor: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        let span = Measure.shared.startSpan(name: "http")
        var tracedRequest = request
        tracedRequest.addValue(
            Measure.shared.getTraceParentHeaderValue(span: span),
            forHTTPHeaderField: Measure.shared.getTraceParentHeaderKey()
        )
        completionHandler(tracedRequest)
        span.setStatus(.ok).end()
    }
}

// Set up URLSession with the interceptor
let session = URLSession(configuration: .default, delegate: TracingInterceptor(), delegateQueue: nil)
```

## Naming conventions

### Span Names

Naming spans consistently is important, as they are used to search on the dashboard. The span name must concisely identify the work represented by the Span.

> The span name SHOULD be the most general string that identifies a (statistically) interesting class of Spans, rather than individual Span instances while still being human-readable. That is, "get_user" is a reasonable name, while "get_user/314159", where "314159" is a user ID, is not a good name due to its high cardinality. Generality SHOULD be prioritized over human-readability.  
> *[Excerpt from Open Telemetry](https://github.com/open-telemetry/opentelemetry-specification/blob/v1.37.0/specification/trace/api.md#span)*

Here are some common conventions you can use when naming spans:

#### Function Calls

`{CLASS_NAME}.{METHOD_NAME}`

- UserRepository.getUser
- OrderService.processOrder
- CartManager.updateCache
- AuthService._refreshToken

#### HTTP

`HTTP {METHOD} {ROUTE}`

- HTTP GET /users
- HTTP POST /orders/{orderId}
- HTTP PUT /products/{productId}

#### Database

`db.{OPERATION} {TABLE_NAME}`

- db.select users
- db.insert orders
- db.update products
- db.delete sessions

#### App Launch

`launch.{TYPE}.{METRIC}`

- launch.cold.ttid
- launch.cold.ttfd
- launch.warm.ttid
- launch.hot.ttid
