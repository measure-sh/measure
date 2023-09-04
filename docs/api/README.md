# Measure REST API Documentation

Measure APIs are built following sound REST API design principles. Find all the resources and detailed documentation below.

## Usage Notes

1. All endpoints expects a Measure API key in `Authorization: Bearer <api-key>` format  in request headers.
2. All endpoints expects `Content-Type: application/json; charset=utf-8` in request headers.

## Request Headers

Lists all common request headers that must be present in each API request.

<details>
<summary>Request Headers</summary>

| **Name**        | **Value**                       |
| --------------- | ------------------------------- |
| `Authorization` | Bearer &lt;measure-api-key&gt;  |
| `Content-Type`  | application/json; charset=utf-8 |
</details>

## Status Codes & Troubleshooting

List of common status codes for success and errors.

<details>
<summary>Status Codes</summary>

| **Name**                    | **Signifies**                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `202 Accepted`              | Request was accepted and will be processed                                                                     |
| `400 Bad Request`           | Request body is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the Measure API key is not present or has expired.                                                   |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.               |
</details>

## Resources & Endpoints

List of resources.

- [**Events**](#put-events) - Each log entry, interactive gesture, network call and so on originating from mobile devices is an event.
  - [string](#string)
  - [exception](#exception)
  - [gesture_long_click](#gesture-long-click)
  - [gesture_scroll](#gesture-scroll)
  - [gesture_click](#gesture-click)
  - [http_request](#http-request)
  - [http_response](#http-response)
- [**Metrics**](#metrics) - Any aggregated measures of compute, memory, energy & more consumed is a metric.
- [**Config**](#config) - SDK or app specific configurations to best fit your customer and business needs.

### PUT `/events`

- Each event must be one of the valid body types, like `string`, `gesture_long_click` and so on.
- Send 1 or more events in a JSON array.
- You can mix multiple body type events in a single request, that is, `string`, or `http_request`.
- The maximum number of attributes in a single event is capped to **10**.
- Make sure `timestamp` is in nanoseconds precision - `"2023-08-24T14:51:38.000000534Z"`

#### Body

##### String

Use the `string` body type when sending unstructured or structured logs. Make sure structured logs are in stringified JSON format.

```json
[{
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "severity_text": "info",
  "body": {
    "type": "string",
    "string": "this is just a simple text log that is supposed to tell you that something happened at this point"
  },
  "resource": {
    "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
    "device_name": "samsung",
    "device_model": "s23",
    "device_manufacturer": "foxconn",
    "device_type": "phone",
    "device_is_foldable": false,
    "device_is_physical": true,
    "device_density_dpi": 230,
    "device_width_px": 2000,
    "device_height_px": 4000,
    "device_density": 2,
    "os_name": "Android",
    "platform": "Android",
    "app_version": "1.2.3",
    "app_build": "123456",
    "app_unique_id": "sh.measure.whatever",
    "measure_sdk_version": "0.0.1"
  },
  "attributes": {
    "key-1": "value 1",
    "key-2": "value 2",
    "key-3": "value 3",
    "key-4": "value 4",
    "key-5": "value 5",
    "key-6": "value 6",
    "key-7": "value 7",
    "key-8": "value 8",
    "key-9": "value 9",
    "key-10": "value 10"
  }
}]
```

##### Exception

Use the `exception` body type for errors and crashes.

>
> ⏳ Coming soon
>

##### Gesture Long Click

Use the `gesture_long_click` body type for longer gestures.

```json
[{
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "severity_text": "info",
  "body": {
    "type": "gesture_long_click",
    "gesture_long_click": {
        "target": "some_target_name",
        "target_user_readable_name": "some user readable name",
        "target_id": "some-target-id",
        "touch_down_time": "2023-09-02T07:14:22Z",
        "touch_up_time": "2023-09-02T07:14:47Z",
        "width": 1440,
        "height": 996,
        "x": 1234,
        "y": 340
      }
    },
  "resource": {
    "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
    "device_name": "samsung",
    "device_model": "s23",
    "device_manufacturer": "foxconn",
    "device_type": "phone",
    "device_is_foldable": false,
    "device_is_physical": true,
    "device_density_dpi": 230,
    "device_width_px": 2000,
    "device_height_px": 4000,
    "device_density": 2,
    "os_name": "Android",
    "platform": "Android",
    "app_version": "1.2.3",
    "app_build": "123456",
    "app_unique_id": "sh.measure.whatever",
    "measure_sdk_version": "0.0.1"
  },
  "attributes": {
    "key-1": "value 1",
    "key-2": "value 2",
    "key-3": "value 3",
    "key-4": "value 4",
    "key-5": "value 5",
    "key-6": "value 6",
    "key-7": "value 7",
    "key-8": "value 8",
    "key-9": "value 9",
    "key-10": "value 10"
  }
}]
```

##### Gesture Scroll

Use the `gesture_scroll` body type for scroll events.

```json
[{
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "severity_text": "info",
  "body": {
    "type": "gesture_scroll",
    "gesture_scroll": {
      "target": "some-scroll-target",
      "target_user_readable_name": "user readable scroll name",
      "target_id": "scroll-target-id",
      "touch_down_time": "2023-09-02T07:14:22Z",
      "touch_up_time": "2023-09-02T07:14:47Z",
      "x": 1234,
      "y": 340,
      "end_x": 1330,
      "end_y": 370,
      "velocity_px": 123,
      "direction": 78
    }
  },
  "resource": {
    "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
    "device_name": "samsung",
    "device_model": "s23",
    "device_manufacturer": "foxconn",
    "device_type": "phone",
    "device_is_foldable": false,
    "device_is_physical": true,
    "device_density_dpi": 230,
    "device_width_px": 2000,
    "device_height_px": 4000,
    "device_density": 2,
    "os_name": "Android",
    "platform": "Android",
    "app_version": "1.2.3",
    "app_build": "123456",
    "app_unique_id": "sh.measure.whatever",
    "measure_sdk_version": "0.0.1"
  },
  "attributes": {
    "key-1": "value 1",
    "key-2": "value 2",
    "key-3": "value 3",
    "key-4": "value 4",
    "key-5": "value 5",
    "key-6": "value 6",
    "key-7": "value 7",
    "key-8": "value 8",
    "key-9": "value 9",
    "key-10": "value 10"
  }
}]
```

##### Gesture Click

Use the `gesture_click` body type for taps or clicks.

```json
[{
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "severity_text": "info",
  "body": {
    "type": "gesture_click",
    "gesture_click": {
      "target": "some-click-target",
      "target_user_readable_name": "user readable click name",
      "target_id": "click-target-id",
      "touch_down_time": "2023-09-02T07:14:22Z",
      "touch_up_time": "2023-09-02T07:14:47Z",
      "width": 1440,
      "height": 996,
      "x": 1234,
      "y": 340
    }
  },
  "resource": {
    "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
    "device_name": "samsung",
    "device_model": "s23",
    "device_manufacturer": "foxconn",
    "device_type": "phone",
    "device_is_foldable": false,
    "device_is_physical": true,
    "device_density_dpi": 230,
    "device_width_px": 2000,
    "device_height_px": 4000,
    "device_density": 2,
    "os_name": "Android",
    "platform": "Android",
    "app_version": "1.2.3",
    "app_build": "123456",
    "app_unique_id": "sh.measure.whatever",
    "measure_sdk_version": "0.0.1"
  },
  "attributes": {
    "key-1": "value 1",
    "key-2": "value 2",
    "key-3": "value 3",
    "key-4": "value 4",
    "key-5": "value 5",
    "key-6": "value 6",
    "key-7": "value 7",
    "key-8": "value 8",
    "key-9": "value 9",
    "key-10": "value 10"
  }
}]
```

##### HTTP Request

Use the `http_request` body type for HTTP requests.

```json
[{
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "severity_text": "info",
  "body": {
    "type": "http_request",
    "http_request": {
      "request_id": "ffcf24b6-7cea-4fac-a2bf-131321843ccc",
      "request_url": "https://example.com/foo/bar/baz",
      "method": "GET",
      "http_protocol_version": "1.1",
      "request_body_size": 1024,
      "request_body": "bla bla bla",
      "request_headers": {
        "content-type": "application/json",
        "authorization": "bearer some-secret-here"
      }
    }
  },
  "resource": {
    "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
    "device_name": "samsung",
    "device_model": "s23",
    "device_manufacturer": "foxconn",
    "device_type": "phone",
    "device_is_foldable": false,
    "device_is_physical": true,
    "device_density_dpi": 230,
    "device_width_px": 2000,
    "device_height_px": 4000,
    "device_density": 2,
    "os_name": "Android",
    "platform": "Android",
    "app_version": "1.2.3",
    "app_build": "123456",
    "app_unique_id": "sh.measure.whatever",
    "measure_sdk_version": "0.0.1"
  },
  "attributes": {
    "key-1": "value 1",
    "key-2": "value 2",
    "key-3": "value 3",
    "key-4": "value 4",
    "key-5": "value 5",
    "key-6": "value 6",
    "key-7": "value 7",
    "key-8": "value 8",
    "key-9": "value 9",
    "key-10": "value 10"
  }
}]
```

##### HTTP Response

Use the `http_response` body type for HTTP responses.

```json
[{
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "severity_text": "info",
  "body": {
    "type": "http_response",
    "http_response": {
      "request_id": "ffcf24b6-7cea-4fac-a2bf-131321843ccc",
      "request_url": "https://example.com/foo/bar/baz",
      "method": "GET",
      "latency_ms": 220,
      "status_code": 200,
      "http_protocol_version": "1.1",
      "response_body": "{foo: \"bar\"}",
      "response_headers": {
        "content-type": "application/json"
      }
    }
  },
  "resource": {
    "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
    "device_name": "samsung",
    "device_model": "s23",
    "device_manufacturer": "foxconn",
    "device_type": "phone",
    "device_is_foldable": false,
    "device_is_physical": true,
    "device_density_dpi": 230,
    "device_width_px": 2000,
    "device_height_px": 4000,
    "device_density": 2,
    "os_name": "Android",
    "platform": "Android",
    "app_version": "1.2.3",
    "app_build": "123456",
    "app_unique_id": "sh.measure.whatever",
    "measure_sdk_version": "0.0.1"
  },
  "attributes": {
    "key-1": "value 1",
    "key-2": "value 2",
    "key-3": "value 3",
    "key-4": "value 4",
    "key-5": "value 5",
    "key-6": "value 6",
    "key-7": "value 7",
    "key-8": "value 8",
    "key-9": "value 9",
    "key-10": "value 10"
  }
}]
```

### Metrics

_Coming soon_

### Config

_Coming soon_