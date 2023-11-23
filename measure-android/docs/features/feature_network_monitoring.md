# Feature - Network Monitoring

Measure SDK can capture network requests, responses and failures along with useful metrics to help
understand how APIs are performing in production from an end user perspective. We support OkHttp
as of now and will be adding support for other networking libraries soon.

## OkHttp

### Setup

Add `MeasureEventListenerFactory` to all `OkHttpClient` instances in your app that you'd like to
monitor:

```kotlin
val client = OkHttpClient.Builder()
    .eventListenerFactory(MeasureEventListenerFactory())
    .build()
```

### Event

Event name: `http`.

The following properties are captured for each network event:

| Property               | Description                                              |
|------------------------|----------------------------------------------------------|
| url                    | The complete URL of the request                          |
| method                 | HTTP method (e.g., get, post) in lowercase               |
| status_code            | HTTP response code (e.g., 200, 401)                      |
| request_body_size      | Size of the request body in bytes                        |
| response_body_size     | Size of the response body in bytes                       |
| request_timestamp      | Timestamp in ISO-8601 UTC when the request was sent      |
| response_timestamp     | Timestamp in ISO-8601 UTC when the response was received |
| start_time             | Uptime when the HTTP call started (ms)                   |
| end_time               | Uptime when the HTTP call ended (ms)                     |
| dns_start              | Uptime when DNS lookup started (ms)                      |
| dns_end                | Uptime when DNS lookup ended (ms)                        |
| connect_start          | Uptime when connection was acquired (ms)                 |
| connect_end            | Uptime when connection ended (ms)                        |
| request_start          | Uptime when request started (ms)                         |
| request_end            | Uptime when request ended (ms)                           |
| request_headers_start  | Uptime when request headers started to be sent           |
| request_headers_end    | Uptime when request headers were sent                    |
| request_body_start     | Uptime when request body started to be sent              |
| request_body_end       | Uptime when request body was sent                        |
| response_start         | Uptime when response started to be received              |
| response_end           | Uptime when response ended (ms)                          |
| response_headers_start | Uptime when response headers started to be rec.          |
| response_headers_end   | Uptime when response headers were received               |
| response_body_start    | Uptime when response body started to be rec.             |
| response_body_end      | Uptime when response body was received                   |
| request_headers_size   | Request headers size in bytes                            |
| response_headers_size  | Response headers size in bytes                           |
| failure_reason         | Reason for failure (typically IOException)               |
| failure_description    | Description of failure (typically IOException)           |
| request_headers        | Request headers                                          |
| response_headers       | Response headers                                         |
| client                 | Name of the client sending the request                   |

### Metrics

The following metrics are calculated for each HTTP event:

| Metric           | Description              | Formula                          |
|------------------|--------------------------|:---------------------------------|
| dns_duration     | DNS lookup duration (ms) | dns_end - dns_start              |
| connect_duration | Connection duration (ms) | connect_end - connect_start      |
| ttfb             | Time to first byte (ms)  | start_time - response_body_start |
| ttlb             | Time to last byte (ms)   | start_time - response_body_end   |

