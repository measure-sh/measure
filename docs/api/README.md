# Measure REST API Documentation <!-- omit in toc -->

Measure APIs are built following sound REST API design principles. Find all the resources and detailed documentation below.

## Contents <!-- omit in toc -->

- [Usage Notes](#usage-notes)
- [Request Headers](#request-headers)
- [Status Codes \& Troubleshooting](#status-codes--troubleshooting)
- [Resources \& Endpoints](#resources--endpoints)
  - [PUT `/sessions`](#put-sessions)
    - [Request Body](#request-body)
      - [Session Reference](#session-reference)
      - [Resource Reference](#resource-reference)
      - [Events Reference](#events-reference)
        - [Event Types](#event-types)

## Usage Notes

1. All endpoints expects a Measure API key in `Authorization: Bearer <api-key>` format  in request headers.
2. All endpoints expects `Content-Type: application/json; charset=utf-8` in request headers.

## Request Headers

Common request headers that must be present in each request.

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

| **Status**                  | **Signifies**                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `202 Accepted`              | Request was accepted and will be processed                                                                              |
| `400 Bad Request`           | Request body is malformed or does not meet one or more acceptance criteria. Check the `"error"` field for more details. |
| `401 Unauthorized`          | Either the Measure API key is not present or has expired.                                                               |
| `500 Internal Server Error` | Measure server encountered an unfortunate error. Report this to your server administrator.                              |
</details>

## Resources & Endpoints

List of resources.

- [**Sessions**](#put-sessions) - Send an entire log of session containing all events, attachments, metrics and traces via this single unified endpoint.

### PUT `/sessions`

This single, unified endopint accepts everything that was captured in a single Measure session. Includes all events like, text logs, user interactive events like taps, scrolls and network events. Also, includes optional attachment files for screenshots, system dumps and so on. Metrics and traces collected during the session should be sent with this API. Also, includes optional attachment files for screenshots, system trace and so on.

- Each session must contain a unique UUIDv4 id.
- Each session must contain a nanosecond precision timestamp.
- Each session must contain a `resource` field containing various device characteristics.
- Multiple events must be sent in the `events` array field. They must be one of the valid types, like `string`, `gesture_long_click` and so on.
- The maximum number of attributes allowed in a single event is capped to **10**.
- Ensure each event `timestamp` is in nanosecond precision - `"2023-08-24T14:51:38.000000534Z"`
- Successful response always return a `202 Accepted` with the following response

  ```json
  {
    "ok": "accepted"
  }
  ```

  > ⚠ **Note**
  >
  > A success response of `202 Accepted` means the server has accepted the session, but it may choose to not process & discard some events, metrics, traces and attachments depending on various conditions.

- Failed requests have the following response shape

  ```json
  {
    "error": "error message appears here"
  }
  ```

#### Request Body

To understand the shape of the JSON payload, take a look at this sample request. You'll find detailed reference of `resource` and `events` shapes below.

**Example payload**

```json
{
  "session_id": "633a2fbc-a0d1-4912-a92f-9e43e72afbc6",
  "timestamp": "2023-08-24T14:51:38.000000534Z",
  "resource": {
    "device_name": "sunfish",
    "device_model": "SM-G950F",
    "device_manufacturer": "samsung",
    "device_type": "phone",
    "device_is_foldable": true,
    "device_is_physical": false,
    "device_density_dpi": 100,
    "device_width_px": 480,
    "device_height_px": 800,
    "device_density": 2,
    "os_name": "android",
    "os_version": "31",
    "platform": "android",
    "app_version": "1.0.1",
    "app_build": "576358",
    "app_unique_id": "com.example.app",
    "measure_sdk_version": "0.0.1"
  },
  "events": [
    {
      "timestamp": "2023-08-24T14:51:39.000000534Z",
      "type": "string",
      "string": {
        "severity_text": "INFO",
        "string": "This is a log from the Android logcat"
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "timestamp": "2023-08-24T14:51:40.000000534Z",
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
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "timestamp": "2023-08-24T14:51:41.000000534Z",
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
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
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
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
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
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
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
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    },
    {
      "timestamp": "2023-08-24T14:51:41.000000534Z",
      "type": "exception",
      "exception": {
        "thread_name": "main",
        "handled": false,
        "exceptions": [
          {
            "type": "java.lang.RuntimeException",
            "message": "java.lang.reflect.InvocationTargetException",
            "frames": [
              {
                "line_num": 558,
                "col_num": 558,
                "module_name": "com.android.internal.osRuntimeInit$MethodAndArgsCaller",
                "file_name": "RuntimeInit.java",
                "class_name": "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
                "method_name": "run"
              },
              {
                "line_num": 936,
                "col_num": 558,
                "module_name": "com.android.internal.osRuntimeInit$MethodAndArgsCaller",
                "file_name": "ZygoteInit.java",
                "class_name": "com.android.internal.os.ZygoteInit",
                "method_name": "main"
              }
            ]
          }
        ],
        "threads": [
          {
            "name": "measure-thread-pool-09",
            "frames": [
              {
                "line_num": -2,
                "col_num": 158,
                "module_name": "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
                "file_name": "VMStack.java",
                "class_name": "dalvik.system.VMStack",
                "method_name": "getThreadStackTrace"
              }
            ]
          }
        ]
      },
      "attributes": {
        "key1": "value1",
        "key2": "value2"
      }
    }
  ]
}
```

> ⏳ **Coming soon**
>
> _Metrics_, _Traces_, and _Attachments_ will be added in near future.

##### Session Reference

The top-level Session object has the following properties.

```json
{
  "session_id": "",
  "timestamp": "",
  "resource": {},
  "events": []
}
```

| Field        | Type   | Optional | Comment                                                   |
| ------------ | ------ | -------- | --------------------------------------------------------- |
| `session_id` | string | No       | UUIDv4 string                                             |
| `timestamp`  | string | No       | Nanosecond precision timestamp in ISO 8601 format         |
| `resource`   | object | No       | Resource object. See below.                               |
| `events`     | array  | No       | Events array containing various event objects. See below. |

##### Resource Reference

Resource object has the following properties.

| Field                 | Type    | Optional | Comment                         |
| --------------------- | ------- | -------- | ------------------------------- |
| `device_name`         | string  | Yes      | Name of the device              |
| `device_model`        | string  | Yes      | Device model                    |
| `device_manufacturer` | string  | Yes      | Name of the device manufacturer |
| `device_type`         | string  | Yes      | `phone` or `tablet`             |
| `device_is_foldable`  | boolean | Yes      | `true` for foldable devices     |
| `device_is_physical`  | boolean | Yes      | `true` for physical devices     |
| `device_density_dpi`  | number  | Yes      | DPI density                     |
| `device_width_px`     | number  | Yes      | Screen width                    |
| `device_height_px`    | number  | Yes      | Screen height                   |
| `device_density`      | number  | Yes      | Device model                    |
| `os_name`             | string  | Yes      | Operating system name           |
| `os_version`          | string  | Yes      | Operating system version        |
| `app_version`         | string  | Yes      | App version identifier          |
| `app_build`           | string  | Yes      | App build identifier            |
| `app_unique_id`       | string  | Yes      | App bundle identifier           |
| `measure_sdk_version` | string  | Yes      | Measure SDK version identifier  |

##### Events Reference

Event objects have the following fields. Additionally, each object must contain one of the event types of the same name.

```json
{
  "timestamp": "",
  "type": "",
  "attributes": {}
}
```

| Field        | Type   | Optional | Comment                                                                                                    |
| ------------ | ------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `timestamp`  | string | No       | Nanosecond precision timestamp                                                                             |
| `type`       | string | No       | Device model                                                                                               |
| `attributes` | object | Yes      | Additional arbitrary metadata. All values must be of `string` type. Cannot contain more than **10** items. |

###### Event Types

Each event object must be of one of the following types. Refer to the sample payload above to understand the shape of each object.

1. **`exception`**

    Use the `exception` type for errors and crashes. 

    | Field         | Type    | Optional | Comment                                               |
    | ------------- | ------- | -------- | ----------------------------------------------------- |
    | `thread_name` | string  | Yes      | Name of the thread                                    |
    | `handled`     | boolean | No       | `false` for crashes, `true` if exceptions are handled |
    | `exceptions`  | array   | No       | Array of exception objects                            |
    | `threads`     | array   | Yes      | Array of thread objects                               |

    `exception` objects

    Each exception object contains further fields.

    | Field     | Type   | Optional | Comment                     |
    | --------- | ------ | -------- | --------------------------- |
    | `type`    | string | No       | Type of the exception       |
    | `message` | string | No       | Error message text          |
    | `frames`  | array  | Yes      | Array of stackframe objects |

    `thread` objects

    Each thread object contains further fields.

    | Field    | Type   | Optional | Comment                     |
    | -------- | ------ | -------- | --------------------------- |
    | `name`   | string | Yes      | Name of thread              |
    | `frames` | array  | Yes      | Array of stackframe objects |

    `frame` objects

    Each frame object contains further fields.

    | Field         | Type   | Optional | Comment                        |
    | ------------- | ------ | -------- | ------------------------------ |
    | `line_num`    | number | Yes      | Line number of the method      |
    | `col_num`     | number | Yes      | Column number of the method    |
    | `module_name` | string | Yes      | Name of the originating module |
    | `file_name`   | string | Yes      | Name of the originating file   |
    | `class_name`  | string | Yes      | Name of the originating class  |
    | `method_name` | string | Yes      | Name of the originating method |

2. **`string`**

    Use the `string` type when sending unstructured or structured logs. Make sure structured logs are in stringified JSON format.

    | Field           | Type   | Optional | Comment                                                        |
    | --------------- | ------ | -------- | -------------------------------------------------------------- |
    | `severity_text` | string | Yes      | Log level. One of `info`, `warning`, `error`, `fatal`, `debug` |
    | `string`        | string | No       | Log message text                                               |

3. **`gesture_long_click`**

    Use the `gesture_long_click` body type for longer press and hold gestures.

    | Field                       | Type   | Optional | Comment                                     |
    | --------------------------- | ------ | -------- | ------------------------------------------- |
    | `target`                    | string | Yes      | Class/Instance name of the originating view |
    | `target_user_readable_name` | string | Yes      | Contextual name of the target view          |
    | `target_id`                 | string | Yes      | Unique identifier for the target            |
    | `touch_down_time`           | string | Yes      | ISO 8601 timestamp when target was pressed  |
    | `touch_up_time`             | string | Yes      | ISO 8601 timestamp when target was released |
    | `width`                     | number | Yes      | Width of the target view in pixels          |
    | `height`                    | number | Yes      | Height of the target view in pixels         |
    | `x`                         | number | No       | X coordinate of the target view             |
    | `y`                         | number | No       | Y coordinate of the target view             |

4. **`gesture_scroll`**

    Use the `gesture_scroll` body type for scroll events.

    | Field                       | Type   | Optional | Comment                                           |
    | --------------------------- | ------ | -------- | ------------------------------------------------- |
    | `target`                    | string | Yes      | Class/Instance name of the originating view       |
    | `target_user_readable_name` | string | Yes      | Contextual name of the target view                |
    | `target_id`                 | string | Yes      | Unique identifier for the target                  |
    | `touch_down_time`           | string | Yes      | ISO 8601 start timestamp when target was scrolled |
    | `touch_up_time`             | string | Yes      | ISO 8601 end timestamp when target scroll ended   |
    | `x`                         | number | No       | X coordinate of the target where scroll started   |
    | `y`                         | number | No       | Y coordinate of the target where scroll started   |
    | `end_x`                     | number | No       | X coordinate of the target where scroll ended     |
    | `end_y`                     | number | No       | Y coordinate of the target where scroll ended     |
    | `velocity_px`               | number | Yes      | Velocity at the time of scroll release            |
    | `direction`                 | number | Yes      | Angle at which the scroll took place              |

5. **`gesture_click`**

    Use the `gesture_click` body type for taps or clicks.

    | Field                       | Type   | Optional | Comment                                         |
    | --------------------------- | ------ | -------- | ----------------------------------------------- |
    | `target`                    | string | Yes      | Class/Instance name of the originating view     |
    | `target_user_readable_name` | string | Yes      | Contextual name of the target view              |
    | `target_id`                 | string | Yes      | Unique identifier for the target                |
    | `touch_down_time`           | string | Yes      | ISO 8601 timestamp when target was pressed      |
    | `touch_up_time`             | string | Yes      | ISO 8601 timestamp when target was released     |
    | `width`                     | number | Yes      | Width of the target view in pixels              |
    | `height`                    | number | Yes      | Height of the target view in pixels             |
    | `x`                         | number | No       | X coordinate of the target where click happened |
    | `y`                         | number | No       | Y coordinate of the target where click happened |

6. **`http_request`**

    Use the `http_request` body type for HTTP requests.

    | Field                   | Type   | Optional | Comment                                                  |
    | ----------------------- | ------ | -------- | -------------------------------------------------------- |
    | `request_id`            | string | No       | UUIDv4 id of the HTTP request                            |
    | `request_url`           | string | No       | Complete URL of the HTTP request                         |
    | `method`                | string | No       | Any of the common HTTP method like, `GET` or `POST`      |
    | `http_protocol_version` | string | Yes      | Version of the HTTP protocol. `1.0`, `1.1`, `2` etc      |
    | `request_body_size`     | number | Yes      | Size of the HTTP request body in bytes                   |
    | `request_body`          | string | Yes      | Body of the HTTP request                                 |
    | `request_headers`       | object | Yes      | Headers of the HTTP request. All values must be strings. |

7. **`http_response`**

    Use the `http_response` body type for HTTP responses.

    | Field              | Type   | Optional | Comment                                                             |
    | ------------------ | ------ | -------- | ------------------------------------------------------------------- |
    | `request_id`       | string | No       | UUIDv4 id of the request                                            |
    | `request_url`      | string | No       | Complete URL of the request                                         |
    | `method`           | string | No       | Any of the common HTTP method like, `GET` or `POST`                 |
    | `latency_ms`       | number | No       | Time in milliseconds taken from request start to last byte received |
    | `status_code`      | number | Yes      | HTTP response status code                                           |
    | `response_body`    | string | Yes      | Body of the response                                                |
    | `response_headers` | object | Yes      | Headers of the HTTP response. All values must be strings.           |